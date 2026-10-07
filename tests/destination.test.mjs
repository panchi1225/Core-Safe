import assert from 'node:assert/strict';
import test from 'node:test';
import { unzipSync, strFromU8 } from 'fflate';
import { loadModule } from './loadModule.mjs';
const { folderDestination, zipDestination, pickPdfDirectory } = await loadModule('src/services/pdfDestination.ts');
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
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { storage: { async getDirectory() { return root; } } } });
  try {
    const sink = await zipDestination(); await sink.save(item, pdf);
    assert.ok(chunks.length > 0);
    const zip = await sink.finish();
    assert.equal(Object.keys(unzipSync(new Uint8Array(await zip.arrayBuffer()))).length, 1);
    assert.equal(removed, false);
    await sink.dispose(); await sink.release(); t.mock.timers.tick(60000);
    await Promise.resolve(); assert.equal(removed, true);
  } finally { Object.defineProperty(globalThis, 'navigator', oldNavigator); }
});
