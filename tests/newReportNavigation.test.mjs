import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { loadModule } from './helpers.mjs';
import {
  INITIAL_MASTER_DATA, INITIAL_NEWCOMER_SURVEY_REPORT,
  INITIAL_DAILY_SAFETY_REPORT, INITIAL_DISASTER_COUNCIL_REPORT,
  INITIAL_SAFETY_PLAN_REPORT, INITIAL_REPORT,
} from '../src/types.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.window = {
  location: { search: '' }, innerWidth: 1000,
  scrollTo() {}, addEventListener() {}, removeEventListener() {},
};
const noop = 'export default () => null;';
// Keep App and all five real wizards; isolate network, PDF and canvas side effects.
const App = (await loadModule('src/App.tsx', {
  firebaseService: `
    export const fetchDrafts = async () => globalThis.navigationDrafts;
    export const getMasterData = async () => globalThis.navigationMaster;
    export const fetchEmployees = async () => [];
    export const fetchDiagramImages = async () => [];
    const unexpectedWrite = () => { throw new Error('Navigation must not write data'); };
    export const saveDraft = unexpectedWrite, removeDraft = unexpectedWrite,
      deleteDraftsByProject = unexpectedWrite, saveDiagramImage = unexpectedWrite,
      removeDiagramImage = unexpectedWrite, compressImage = unexpectedWrite,
      compressDiagramImage = unexpectedWrite;
  `,
  publicNewcomerService: `export const newSubmissionId = () => 'unused';
    export const submitPublicNewcomerSurvey = () => { throw new Error('Unexpected submission'); };`,
  PublicQRManager: noop, MasterSettings: noop, BulkReportDownload: noop,
  SignatureCanvas: noop, ReportPdfButton: noop,
  NewcomerSurveyPrintLayout: noop, DailySafetyPrintLayout: noop,
  DisasterCouncilPrintLayout: noop, PrintLayout: noop,
  'react-to-print': 'export const useReactToPrint = () => () => {};',
})).default;

const reports = [
  ['NEWCOMER_SURVEY', '新規入場者アンケート', INITIAL_NEWCOMER_SURVEY_REPORT],
  ['SAFETY_TRAINING', '安全訓練', INITIAL_REPORT],
  ['DISASTER_COUNCIL', '災害防止協議会', INITIAL_DISASTER_COUNCIL_REPORT],
  ['SAFETY_PLAN', '安全管理計画表', INITIAL_SAFETY_PLAN_REPORT],
  ['DAILY_SAFETY', '安全衛生日誌', INITIAL_DAILY_SAFETY_REPORT],
];
const text = node => typeof node === 'string' ? node : node.children.map(text).join('');
const button = (tree, label) => {
  const found = tree.root.findAllByType('button').filter(node => text(node).trim() === label
    || node.findAll(child => typeof child.type === 'string' && text(child).trim() === label).length > 0);
  assert.equal(found.length, 1, `Expected one button: ${label}`);
  return found[0];
};
const click = async (tree, label) => act(async () => button(tree, label).props.onClick());
const wizard = tree => tree.root.find(node => typeof node.type === 'function' && 'initialStep' in node.props);
const previewVisible = tree => tree.root.findAllByType('button').some(node => text(node).trim() === 'ホームに戻る');

async function mount(t) {
  globalThis.navigationMaster = { ...INITIAL_MASTER_DATA, projects: ['架空旧現場'], contractors: ['架空会社'] };
  globalThis.navigationDrafts = reports.map(([type, , initial]) => ({
    id: `saved-${type}`, type, lastModified: Date.parse('2026-10-01T00:00:00Z'),
    data: { ...structuredClone(initial), project: '架空旧現場', company: '架空会社',
      name: '架空旧氏名', nameSei: '架空旧氏名', address: '架空旧住所',
      signatureDataUrl: 'data:image/png;base64,b2xk', workDate: '2026-10-01' },
  }));
  let tree;
  await act(async () => { tree = create(React.createElement(App)); });
  t.after(async () => act(async () => tree.unmount()));
  return tree;
}

async function openSaved(tree, type, action) {
  const [, title] = reports.find(report => report[0] === type);
  await click(tree, title);
  await click(tree, '架空旧現場');
  if (type === 'NEWCOMER_SURVEY') await click(tree, '架空会社');
  if (type === 'DAILY_SAFETY') await click(tree, '2026年10月');
  const entry = tree.root.find(node => node.type === 'div' && node.props.className === 'cursor-pointer flex-1');
  await act(async () => entry.props.onClick());
  const actionButton = tree.root.findAllByType('button').find(node => text(node).startsWith(action));
  assert.ok(actionButton, action);
  await act(async () => actionButton.props.onClick());
  const draft = globalThis.navigationDrafts.find(d => d.type === type);
  assert.equal(wizard(tree).props.initialDraftId, draft.id);
  assert.deepEqual(wizard(tree).props.initialData, draft.data);
}

async function assertNew(tree, type) {
  const [, title] = reports.find(report => report[0] === type);
  await click(tree, title);
  await click(tree, '新規作成');
  assert.equal(wizard(tree).props.initialStep, 1);
  assert.equal(wizard(tree).props.initialDraftId, null);
  assert.equal(wizard(tree).props.initialData, undefined);
  assert.equal(previewVisible(tree), false);
  if (type === 'SAFETY_PLAN') {
    assert.ok(tree.root.findAllByType('table').length > 0, 'Plan input table is displayed');
  } else {
    assert.ok(tree.root.findAllByType('h2').some(node => text(node).startsWith('STEP 1:')), 'STEP 1 input is displayed');
  }
  for (const control of tree.root.findAll(node => ['input', 'select', 'textarea'].includes(node.type))) {
    assert.ok(!String(control.props.value ?? '').includes('架空旧'), 'Saved values must not carry over');
  }
}

for (const [type, title] of reports) {
  test(`${title}: saved preview → home → new opens clean STEP 1/input`, async t => {
    const tree = await mount(t);
    await openSaved(tree, type, '印刷プレビュー');
    assert.equal(wizard(tree).props.initialStep, 99);
    assert.equal(previewVisible(tree), true);
    await click(tree, 'ホームに戻る');
    await assertNew(tree, type);
  });
  test(`${title}: editing keeps the saved data and draft ID`, async t => {
    const tree = await mount(t);
    await openSaved(tree, type, type === 'DAILY_SAFETY' ? '作業内容を修正' : '内容を修正');
    assert.equal(wizard(tree).props.initialStep, 1);
    assert.equal(previewVisible(tree), false);
  });
  if (type !== 'NEWCOMER_SURVEY') {
    test(`Newcomer preview → ${title} new does not inherit preview/data`, async t => {
      const tree = await mount(t);
      await openSaved(tree, 'NEWCOMER_SURVEY', '印刷プレビュー');
      await click(tree, 'ホームに戻る');
      await assertNew(tree, type);
    });
  }
}

test('Daily STEP 3 edit retains its entry point; subsequent new starts at STEP 1', async t => {
  const tree = await mount(t);
  await openSaved(tree, 'DAILY_SAFETY', '当日作業確認・巡視');
  assert.equal(wizard(tree).props.initialStep, 3);
  assert.ok(tree.root.findAllByType('h2').some(node => text(node).startsWith('STEP 3:')));
  await act(async () => wizard(tree).props.onBackToMenu());
  await assertNew(tree, 'DAILY_SAFETY');
});
