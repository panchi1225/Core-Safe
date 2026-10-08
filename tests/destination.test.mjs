import assert from 'node:assert/strict';
import test from 'node:test';
import { unzipSync, strFromU8 } from 'fflate';
import { loadModule } from './loadModule.mjs';
const { folderDestination, zipDestination, pickPdfDirectory, preparePdfDestination } = await loadModule('src/services/pdfDestination.ts');
const { runBatch } = await loadModule('src/utils/bulkReports.ts');
const { cleanupStaleZipFiles, acquireZipLease } = await loadModule('src/services/zipTempFiles.ts');
const locks = (held = new Set()) => ({ held, async request(name, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  if (held.has(name)) return callback(null);
  held.add(name);
  try { return await callback({ name }); } finally { held.delete(name); }
} });
const item = { id: '1', project: '現場/A', type: 'DAILY_SAFETY', date: '2026-10-01', name: '', lastModified: 100 };
const pdf = new Blob(['%PDF-1.7\nfixture']);
const directory = (files = new Map(), failWrite = false) => ({
  files,
  async getDirectoryHandle(name) {
    if (!files.has(name)) files.set(name, directory());
    return files.get(name);
  },
  async getFileHandle(name, options) {
    if (!files.has(name) && !options?.create) throw new DOMException('missing', 'NotFoundError');
    if (!files.has(name)) files.set(name, null);
    return { async createWritable() { return {
      async write(blob) { if (failWrite) throw new Error('disk full'); files.set(name, blob); },
      async close() {}, async abort() { files.set('aborted', true); },
    }; } };
  },
});

test('フォルダ保存は現場／種別で分類し、既存PDFや同名PDFを上書きしない', async () => {
  const root = directory(); const sink = folderDestination(root);
  await sink.save(item, pdf); await sink.save({ ...item, id: '2' }, pdf);
  const category = root.files.get('現場_A').files.get('安全衛生日誌');
  assert.ok(category.files.has('2026-10-01_安全衛生日誌.pdf'));
  assert.ok(category.files.has('2026-10-01_安全衛生日誌_2.pdf'));
  await sink.save({ ...item, type: 'NEWCOMER_SURVEY', name: '山田太郎' }, pdf);
  assert.ok(root.files.get('現場_A').files.get('新規入場者アンケート').files.has('2026-10-01_新規入場者アンケート_山田太郎.pdf'));
  assert.equal(await sink.finish(), null);
});

test('書込み失敗時はストリームをabortして後続処理へエラーを返す', async () => {
  const leaf = directory(new Map(), true);
  const root = { async getDirectoryHandle() { return { async getDirectoryHandle() { return leaf; } }; } };
  await assert.rejects(folderDestination(root).save(item, pdf), /disk full/);
  assert.equal(leaf.files.get('aborted'), true);
});

test('非対応ブラウザのZIPは1つで、フォルダ階層・重複名・PDF内容を保持する', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { storage: {} } });
  try {
    const sink = await zipDestination();
    await sink.save(item, pdf); await sink.save(item, pdf);
    await sink.save({ ...item, type: 'NEWCOMER_SURVEY', name: '山田太郎' }, pdf);
    const zip = await sink.finish();
    const files = unzipSync(new Uint8Array(await zip.arrayBuffer()));
    assert.equal(Object.keys(files).length, 3);
    assert.equal(strFromU8(files['現場_A/安全衛生日誌/2026-10-01_安全衛生日誌.pdf']), '%PDF-1.7\nfixture');
    assert.ok(files['現場_A/安全衛生日誌/2026-10-01_安全衛生日誌_2.pdf']);
    assert.ok(files['現場_A/新規入場者アンケート/2026-10-01_新規入場者アンケート_山田太郎.pdf']);
    await sink.dispose(); await sink.release(); t.mock.timers.tick(60000);
  } finally { Object.defineProperty(globalThis, 'navigator', oldNavigator); }
});

test('対応ブラウザではクリック時にpickerを即座に呼び、キャンセルはAbortErrorを維持する', async () => {
  let called = 0;
  globalThis.window = { isSecureContext: true, showDirectoryPicker() { called++; return Promise.reject(new DOMException('cancelled', 'AbortError')); } };
  const pending = pickPdfDirectory();
  assert.equal(called, 1);
  await assert.rejects(pending, { name: 'AbortError' });
  globalThis.window = { isSecureContext: true };
  assert.equal(pickPdfDirectory(), null);
  delete globalThis.window;
});

test('OPFSを利用するとZIPデータを逐次書き込み、完了後に一時ファイルを削除する', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const chunks = []; let closed = false, removed = false;
  const root = {
    async getFileHandle() { return {
      async createWritable() { return { async write(chunk) { chunks.push(chunk); }, async close() { closed = true; }, async abort() {} }; },
      async getFile() { assert.equal(closed, true); return new Blob(chunks); },
    }; },
    async removeEntry() { removed = true; },
  };
  const manager = locks();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: manager, storage: { async getDirectory() { return root; } } } });
  try {
    const sink = await zipDestination(); await sink.save(item, pdf);
    assert.ok(chunks.length > 0);
    const zip = await sink.finish();
    assert.equal(Object.keys(unzipSync(new Uint8Array(await zip.arrayBuffer()))).length, 1);
    assert.equal(removed, false);
    assert.equal(manager.held.size, 1); // Protect the UI's manual ZIP download.
    await sink.dispose(); await sink.release(); t.mock.timers.tick(60000);
    await Promise.resolve(); assert.equal(removed, true); assert.equal(manager.held.size, 0);
  } finally { Object.defineProperty(globalThis, 'navigator', oldNavigator); }
});

test('300件中50件目の保存先致命エラーでは49件成功・251件未処理として以降を生成しない', async () => {
  const items = Array.from({ length: 300 }, (_, i) => ({ ...item, id: String(i + 1) }));
  let generated = 0, writes = 0, aborted = 0;
  const root = {
    async getDirectoryHandle() { return root; },
    async getFileHandle(_name, options) {
      if (!options?.create) throw new DOMException('missing', 'NotFoundError');
      return { async createWritable() { return {
        async write() { if (++writes === 50) throw new DOMException('disk full', 'QuotaExceededError'); },
        async close() {}, async abort() { aborted++; },
      }; } };
    },
  };
  const sink = folderDestination(root);
  const result = await runBatch(items, async item => { generated++; await sink.save(item, pdf); }, () => {});
  assert.equal(result.succeeded, 49); assert.equal(result.failures.length, 0);
  assert.equal(result.unprocessed.length, 251); assert.equal(result.unprocessed[0].id, '50');
  assert.match(result.destinationError, /disk full/); assert.equal(generated, 50); assert.equal(aborted, 1);
});

test('フォルダ権限消失・アクセス不能も保存先エラーとして後続停止する', async () => {
  for (const name of ['NotAllowedError', 'NotFoundError']) {
    let generated = 0;
    const sink = folderDestination({ async getDirectoryHandle() { throw new DOMException('destination unavailable', name); } });
    const result = await runBatch([item, { ...item, id: '2' }], async item => { generated++; await sink.save(item, pdf); }, () => {});
    assert.equal(generated, 1); assert.equal(result.unprocessed.length, 2);
    assert.match(result.destinationError, /destination unavailable/);
  }
});

test('ZIP容量上限で後続生成を停止し、上限到達前のPDFは有効なZIPに残す', async () => {
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { storage: {} } });
  try {
    let generated = 0;
    const sink = await zipDestination();
    const targets = [item, { ...item, id: '2' }, { ...item, id: '3' }];
    const result = await runBatch(targets, async item => {
      generated++;
      const largePdf = { size: 256 * 1024 * 1024, async arrayBuffer() { throw new Error('must not allocate'); } };
      await sink.save(item, item.id === '2' ? largePdf : pdf);
    }, () => {});
    assert.equal(generated, 2); assert.equal(result.succeeded, 1); assert.equal(result.unprocessed.length, 2);
    assert.match(result.destinationError, /メモリ上限/);
    const archive = await sink.finish();
    assert.equal(Object.keys(unzipSync(new Uint8Array(await archive.arrayBuffer()))).length, 1);
    await sink.dispose(); await sink.release();
  } finally { Object.defineProperty(globalThis, 'navigator', oldNavigator); }
});

test('ZIPの帳票生成失敗は継続し、ZIP再試行でpickerを呼ばずZIP方式を維持する', async () => {
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const oldWindow = globalThis.window;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { storage: {} } });
  let pickerCalls = 0;
  globalThis.window = { isSecureContext: true, showDirectoryPicker() { pickerCalls++; throw new Error('unexpected picker'); } };
  try {
    const sink = await preparePdfDestination('zip');
    let generated = 0;
    const targets = [item, { ...item, id: '2' }, { ...item, id: '3' }];
    const result = await runBatch(targets, async item => {
      generated++; if (item.id === '2') throw new Error('PDF generation failed');
      await sink.save(item, pdf);
    }, () => {});
    assert.equal(generated, 3); assert.equal(result.succeeded, 2); assert.equal(result.failures.length, 1);
    assert.equal(result.destinationError, undefined); assert.equal(result.unprocessed.length, 0);
    const archive = await sink.finish();
    assert.equal(Object.keys(unzipSync(new Uint8Array(await archive.arrayBuffer()))).length, 2);
    const retrySink = await preparePdfDestination(sink.mode);
    const retry = await runBatch(result.failures.map(f => f.item), item => retrySink.save(item, pdf), () => {});
    assert.equal(retrySink.mode, 'zip'); assert.equal(retry.succeeded, 1); assert.equal(pickerCalls, 0);
    await retrySink.finish(); await retrySink.dispose(); await retrySink.release();
    await sink.dispose(); await sink.release();
  } finally { Object.defineProperty(globalThis, 'navigator', oldNavigator); globalThis.window = oldWindow; }
});

test('OPFS書込みエラーで後続生成停止・ZIP全体を失敗とし一時ファイルとleaseを解放する', async () => {
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const manager = locks(); let generated = 0, aborted = false, removed = false;
  const root = {
    async getFileHandle() { return { async createWritable() { return {
      async write() { throw new DOMException('OPFS full', 'QuotaExceededError'); },
      async close() {}, async abort() { aborted = true; },
    }; } }; },
    async removeEntry() { removed = true; },
  };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: manager, storage: { async getDirectory() { return root; } } } });
  try {
    const sink = await zipDestination();
    const result = await runBatch([item, { ...item, id: '2' }], async item => { generated++; await sink.save(item, pdf); }, () => {});
    assert.equal(generated, 1); assert.equal(result.unprocessed.length, 2); assert.match(result.destinationError, /OPFS full/);
    await assert.rejects(sink.finish(), /OPFS full/);
    await sink.dispose(); assert.equal(aborted, true); assert.equal(removed, true); assert.equal(manager.held.size, 0);
  } finally { Object.defineProperty(globalThis, 'navigator', oldNavigator); }
});

test('OPFS掃除は24時間以上経過したCore Safe UUID ZIPのみ削除し、稼働中・無関係・ディレクトリは保持', async () => {
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const manager = locks(); const now = Date.now(), old = now - 25 * 60 * 60 * 1000;
  const names = Array.from({ length: 5 }, () => `core-safe-${crypto.randomUUID()}.zip`);
  const file = (lastModified, fail = false) => ({ kind: 'file', async getFile() { if (fail) throw new Error('no access'); return { lastModified }; } });
  const entries = new Map([
    [names[0], file(old)], [names[1], file(now)], [names[2], file(old)],
    [names[3], { kind: 'directory' }], [names[4], file(old, true)],
    ['other-app.zip', file(old)], ['core-safe-important.zip', file(old)],
  ]);
  const removed = [];
  const root = { async *entries() { yield* entries; }, async removeEntry(name) { removed.push(name); } };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: manager } });
  try {
    const release = await acquireZipLease(names[2]);
    await cleanupStaleZipFiles(root, now);
    assert.deepEqual(removed, [names[0]]);
    await release(); entries.delete(names[0]);
    await cleanupStaleZipFiles(root, now);
    assert.deepEqual(removed, [names[0], names[2]]);
    assert.equal(manager.held.size, 0);
  } finally { Object.defineProperty(globalThis, 'navigator', oldNavigator); }
});

test('Web Locks非対応ではOPFSを作らずZIPのメモリ方式を使用する', async () => {
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let opfsCalls = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { storage: { async getDirectory() { opfsCalls++; throw new Error('unexpected OPFS'); } } } });
  try {
    const sink = await zipDestination(); await sink.save(item, pdf); await sink.finish();
    await sink.dispose(); await sink.release(); assert.equal(opfsCalls, 0);
  } finally { Object.defineProperty(globalThis, 'navigator', oldNavigator); }
});

test('フォルダ再試行はクリック時のpickerとフォルダ方式を維持し、権限拒否でZIPへ変更しない', async () => {
  const oldWindow = globalThis.window;
  let calls = 0;
  globalThis.window = { isSecureContext: true, showDirectoryPicker() { calls++; return Promise.resolve(directory()); } };
  try {
    const pending = preparePdfDestination('auto');
    assert.equal(calls, 1); // Transient activation is preserved before awaiting.
    const sink = await pending; assert.equal(sink.mode, 'folder');
    const retry = await preparePdfDestination(sink.mode); assert.equal(retry.mode, 'folder'); assert.equal(calls, 2);
    globalThis.window.showDirectoryPicker = () => Promise.reject(new DOMException('access denied', 'SecurityError'));
    await assert.rejects(preparePdfDestination('folder'), { name: 'SecurityError' });
  } finally { globalThis.window = oldWindow; }
});
