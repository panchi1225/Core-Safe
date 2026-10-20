import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { loadModule } from './helpers.mjs';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.window = { location: { search: '' } };
globalThis.alert = () => {};
const noop = 'export default()=>null;';
const fakeWizard = `import React from 'react';export default p=>React.createElement('p',{'data-testid':'fake-wizard'},'入力画面');`;
const App = (await loadModule('src/App.tsx', {
  firebaseService: `export const fetchDrafts=type=>globalThis.listHarness.read(type);export const removeDraft=id=>globalThis.listHarness.remove(id);export const fetchEmployees=async()=>[];`,
  PublicQRManager: `import React from 'react';export default p=>p.isOpen?React.createElement('p',null,'QR-OPEN'):null;`,
  SafetyTrainingWizard: fakeWizard, DisasterCouncilWizard: fakeWizard, SafetyPlanWizard: fakeWizard,
  NewcomerSurveyWizard: fakeWizard, DailySafetyWizard: fakeWizard, MasterSettings: noop, BulkReportDownload: noop,
})).default;
const types = [
  ['DAILY_SAFETY', '安全衛生日誌'], ['SAFETY_TRAINING', '安全訓練'],
  ['DISASTER_COUNCIL', '災害防止協議会'], ['SAFETY_PLAN', '安全管理計画表'], ['NEWCOMER_SURVEY', '新規入場者アンケート'],
];
const text = node => typeof node === 'string' ? node : node.children.map(text).join('');
const button = (tree, label) => tree.root.findAllByType('button').find(b => text(b).trim() === label);
async function open(tree, title) {
  await act(async () => tree.root.findAllByType('button').find(b => b.findAllByType('h3').some(h => text(h) === title)).props.onClick());
}
const fake = (type, project = '架空現場', id = type) => ({ id, type, lastModified: 1, data: { project, company: '架空会社', name: '架空作業員', workDate: '2026-10-01' } });
async function mount(t) {
  const requests = [], removed = [];
  globalThis.listHarness = {
    read(type) { return new Promise((resolve, reject) => requests.push({ type, resolve, reject })); },
    async remove(id) { removed.push(id); },
  };
  let tree;
  await act(async () => { tree = create(React.createElement(App)); });
  t.after(async () => act(async () => tree.unmount()));
  return { tree, requests, removed };
}

for (const [type, title] of types) test(`${title}: create is immediately available while its own list is pending`, async t => {
  const { tree, requests } = await mount(t);
  await open(tree, title);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].type, type);
  assert.ok(button(tree, '新規作成'), 'New must not wait for Firestore');
  assert.ok(!button(tree, '新規作成').props.disabled);
  await act(async () => button(tree, '新規作成').props.onClick());
  const wizard = tree.root.find(n => typeof n.type === 'function' && 'initialStep' in n.props);
  assert.equal(wizard.props.initialStep, 1);
  assert.equal(wizard.props.initialDraftId, null);
  assert.equal(wizard.props.initialData, undefined);
  await act(async () => requests[0].resolve([fake(type)]));
  assert.equal(tree.root.findAllByProps({ 'data-testid': 'fake-wizard' }).length, 1);
});

test('QR management is also accessible while newcomer report list is pending', async t => {
  const { tree, requests } = await mount(t);
  await open(tree, '新規入場者アンケート');
  assert.equal(tree.root.findAllByProps({ role: 'status' }).length, 1);
  await act(async () => button(tree, '新規入場者用QRコードを表示').props.onClick());
  assert.ok(JSON.stringify(tree.toJSON()).includes('QR-OPEN'));
  assert.equal(requests.length, 1);
});

for (const [type, title] of [['DAILY_SAFETY','安全衛生日誌'], ['NEWCOMER_SURVEY','新規入場者アンケート']]) test(`${title}: failed list displays retry without blocking new, then recovers`, async t => {
  const { tree, requests } = await mount(t);
  await open(tree, title);
  await act(async () => requests[0].reject(new Error('Synthetic network failure')));
  assert.equal(tree.root.findAllByProps({ role: 'status' }).length, 0);
  assert.equal(tree.root.findAllByProps({ role: 'alert' }).length, 1);
  assert.ok(button(tree, '新規作成'));
  assert.ok(!JSON.stringify(tree.toJSON()).includes('保存されたデータはありません'));
  await act(async () => button(tree, '再読み込み').props.onClick());
  assert.deepEqual(requests.map(r => r.type), [type, type]);
  assert.equal(tree.root.findAllByProps({ role: 'status' }).length, 1);
  assert.equal(tree.root.findAllByProps({ role: 'alert' }).length, 0);
  await act(async () => requests[1].resolve([fake(type)]));
  assert.ok(JSON.stringify(tree.toJSON()).includes('架空現場'));
  assert.equal(tree.root.findAllByProps({ role: 'status' }).length, 0);
});

for (const outcome of ['resolve','reject']) test(`closed report request ${outcome} cannot overwrite a later type or stop its loading state`, async t => {
  const { tree, requests } = await mount(t);
  await open(tree, '安全衛生日誌');
  await act(async () => tree.root.findByProps({ 'aria-label': '帳票選択を閉じる' }).props.onClick());
  await open(tree, '安全訓練');
  await act(async () => requests[0][outcome](outcome === 'resolve' ? [fake('DAILY_SAFETY','古い架空現場')] : new Error('Old failure')));
  assert.equal(tree.root.findAllByProps({ role: 'status' }).length, 1);
  assert.equal(tree.root.findAllByProps({ role: 'alert' }).length, 0);
  assert.ok(!JSON.stringify(tree.toJSON()).includes('古い架空現場'));
  await act(async () => requests[1].resolve([fake('SAFETY_TRAINING','現在の架空現場')]));
  assert.ok(JSON.stringify(tree.toJSON()).includes('現在の架空現場'));
  assert.ok(!JSON.stringify(tree.toJSON()).includes('古い架空現場'));
});

test('a later completed result stays visible if an earlier request completes afterwards', async t => {
  const { tree, requests } = await mount(t);
  await open(tree, '新規入場者アンケート');
  await act(async () => tree.root.findByProps({ 'aria-label': '帳票選択を閉じる' }).props.onClick());
  await open(tree, '安全衛生日誌');
  await act(async () => requests[1].resolve([fake('DAILY_SAFETY','現在の架空現場')]));
  await act(async () => requests[0].resolve([fake('NEWCOMER_SURVEY','古い架空現場')]));
  assert.ok(JSON.stringify(tree.toJSON()).includes('現在の架空現場'));
  assert.ok(!JSON.stringify(tree.toJSON()).includes('古い架空現場'));
  assert.equal(tree.root.findAllByProps({ role: 'status' }).length, 0);
});

test('reopening a type reads fresh records and keeps legacy/public report IDs for editing', async t => {
  const { tree, requests } = await mount(t);
  await open(tree, '新規入場者アンケート');
  await act(async () => requests[0].resolve([fake('NEWCOMER_SURVEY','架空現場','legacy-id'),fake('NEWCOMER_SURVEY','架空現場','public-newcomer/public-id')]));
  await act(async () => button(tree, '架空現場2 件のデータ').props.onClick());
  await act(async () => button(tree, '架空会社2 件のデータ').props.onClick());
  const entries = tree.root.findAll(n => n.type === 'div' && n.props.className === 'cursor-pointer flex-1');
  assert.equal(entries.length, 2);
  await act(async () => entries[1].props.onClick());
  await act(async () => tree.root.findAllByType('button').find(b => text(b).trim().startsWith('内容を修正')).props.onClick());
  const wizard = tree.root.find(n => typeof n.type === 'function' && 'initialStep' in n.props);
  assert.equal(wizard.props.initialDraftId, 'public-newcomer/public-id');
  assert.equal(wizard.props.initialData.company, '架空会社');
  await act(async () => wizard.props.onBackToMenu());
  await open(tree, '新規入場者アンケート');
  assert.equal(requests.length, 2);
  assert.equal(tree.root.findAllByProps({ role: 'status' }).length, 1);
  assert.ok(!JSON.stringify(tree.toJSON()).includes('2 件のデータ'));
  await act(async () => requests[1].resolve([]));
  assert.ok(JSON.stringify(tree.toJSON()).includes('保存されたデータはありません'));
});

test('deletion refresh reads only the selected report type and preserves empty-project navigation', async t => {
  const { tree, requests, removed } = await mount(t);
  await open(tree, '新規入場者アンケート');
  await act(async () => requests[0].resolve([fake('NEWCOMER_SURVEY','架空現場','public-newcomer/delete-id')]));
  await act(async () => button(tree, '架空現場1 件のデータ').props.onClick());
  await act(async () => button(tree, '架空会社1 件のデータ').props.onClick());
  await act(async () => tree.root.findByProps({ title: '削除' }).props.onClick({ stopPropagation() {} }));
  let pending;
  await act(async () => { pending = button(tree, '実行する').props.onClick(); });
  assert.deepEqual(removed, ['public-newcomer/delete-id']);
  assert.deepEqual(requests.map(r => r.type), ['NEWCOMER_SURVEY','NEWCOMER_SURVEY']);
  await act(async () => { requests[1].resolve([]); await pending; });
  assert.ok(button(tree, '新規作成'));
  assert.ok(JSON.stringify(tree.toJSON()).includes('保存されたデータはありません'));
});
