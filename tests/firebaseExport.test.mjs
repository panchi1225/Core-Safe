import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { loadModule } from './loadModule.mjs';
const services = await loadModule('src/services/firebaseService.ts', [{
  name: 'firestore-fixture', setup(build) {
    build.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: path.resolve('tests/firestoreStub.mjs') }));
    build.onResolve({ filter: /^\.\.\/firebase$/ }, () => ({ path: 'firebase-fixture', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const db = {};' }));
  },
}]);
const conditions = { project: '現場A', start: '2026-10-01', end: '2026-10-31', types: ['DAILY_SAFETY'] };
const fixture = () => globalThis.__firestoreFixture = { calls: [], records: Array.from({ length: 76 }, (_, i) => ({
  id: String(i).padStart(3, '0'), type: 'DAILY_SAFETY', lastModified: 100,
  data: { project: i === 75 ? '現場B' : '現場A', workDate: '2026-10-01', annotatedDiagramUrl: 'data:large-image' },
})) };

test('Firestoreは現場を指定して25件ずつ取得し画像を一覧に保持しない', async () => {
  const state = fixture(); const items = await services.fetchExportItems(conditions);
  assert.equal(items.length, 75); assert.equal(state.calls.length, 4);
  assert.ok(state.calls.every(q => q.constraints.find(c => c.kind === 'where').field === 'data.project'));
  assert.ok(state.calls.every(q => q.constraints.find(c => c.kind === 'limit').value === 25));
  assert.ok(items.every(item => !('data' in item) && !('annotatedDiagramUrl' in item)));
});

test('件数確認と生成直前の読み取りでpermission-deniedを隠さない', async () => {
  const state = fixture(); state.deny = true;
  await assert.rejects(services.fetchExportItems(conditions), /permission-denied/);
  await assert.rejects(services.fetchExportDraft({ id: '000' }, conditions), /permission-denied/);
});

test('生成直前に帳票を再取得して削除・変更・別現場への移動を検出する', async () => {
  const state = fixture(); const items = await services.fetchExportItems(conditions); const item = items[0];
  assert.equal((await services.fetchExportDraft(item, conditions)).id, item.id);
  state.records[0].lastModified++;
  await assert.rejects(services.fetchExportDraft(item, conditions), /変更/);
  state.records[0].lastModified = 100; state.records[0].data.project = '現場B';
  await assert.rejects(services.fetchExportDraft(item, conditions), /変更/);
  state.records[0].data.project = '現場A';
  state.records[0].type = 'SAFETY_TRAINING'; state.records[0].data.date = item.date;
  await assert.rejects(services.fetchExportDraft(item, { ...conditions, types: ['DAILY_SAFETY', 'SAFETY_TRAINING'] }), /変更/);
  state.records.shift(); await assert.rejects(services.fetchExportDraft(item, conditions), /削除/);
});

test('一覧確認のキャンセルで後続ページを読み取らない', async () => {
  const state = fixture(), controller = new AbortController(); state.abort = () => controller.abort();
  await assert.rejects(services.fetchExportItems(conditions, controller.signal), { name: 'AbortError' });
  assert.equal(state.calls.length, 1);
});

test('オフラインでは古いキャッシュを一括出力せず、サーバー確認エラーを返す', async () => {
  const state = fixture(); state.offline = true;
  await assert.rejects(services.fetchExportItems(conditions), /unavailable/);
  await assert.rejects(services.fetchExportDraft({ id: '000' }, conditions), /unavailable/);
});
