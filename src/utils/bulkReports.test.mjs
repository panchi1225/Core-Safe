import assert from 'node:assert/strict';
import test from 'node:test';
import { conditionError, exportItem, fileName, reportDate, runBatch, safePath, validDate } from './bulkReports.ts';

const conditions = { project: '現場A', start: '2026-10-01', end: '2026-10-31', types: ['DAILY_SAFETY', 'NEWCOMER_SURVEY'] };
const diary = (id, date, project = '現場A') => ({ id, type: 'DAILY_SAFETY', data: { project, workDate: date }, lastModified: 100 });
const survey = (id, day) => ({ id, type: 'NEWCOMER_SURVEY', data: { project: '現場A', pledgeDateYear: 8, pledgeDateMonth: 10, pledgeDateDay: day, nameSei: '山田', nameMei: '太郎', date: '2020-01-01' }, lastModified: 100 });

test('実在する日付・期間・現場・種別を検証する', () => {
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2026-10-01T12:00:00Z'), false);
  assert.match(conditionError({ ...conditions, start: '2026-11-01' }), /終了日/);
  assert.match(conditionError({ ...conditions, project: '' }), /現場/);
  assert.match(conditionError({ ...conditions, types: [] }), /帳票種別/);
  assert.equal(conditionError(conditions), null);
});

test('日誌は作業日、アンケートは令和の誓約日を使用する', () => {
  assert.equal(reportDate(diary('d1', '2026-10-01')), '2026-10-01');
  assert.equal(reportDate(survey('s1', 3)), '2026-10-03');
  assert.equal(reportDate({ ...diary('d2', ''), data: { meetingDate: '2026-10-02' } }), '2026-10-02');
  assert.equal(reportDate({ id: 'x', type: 'SAFETY_TRAINING', data: { date: '2026-10-04' }, lastModified: 100 }), '2026-10-04');
  assert.equal(reportDate({ ...diary('d3', ''), lastModified: NaN }), null);
});

test('ケース1：1現場1か月の日誌31件を選び、両端と他現場を正しく判定する', async () => {
  const data = Array.from({ length: 31 }, (_, i) => diary(`d${i}`, `2026-10-${String(i + 1).padStart(2, '0')}`));
  data.push(diary('other', '2026-10-01', '現場B'), diary('before', '2026-09-30'), diary('after', '2026-11-01'), survey('s1', 1));
  const items = data.map(draft => exportItem(draft, { ...conditions, types: ['DAILY_SAFETY'] })).filter(Boolean);
  const saved = [];
  const result = await runBatch(items, async item => { saved.push(item.id); }, () => {});
  assert.equal(items.length, 31); assert.equal(result.succeeded, 31); assert.equal(saved.length, 31);
});

test('ケース2：日誌31件＋アンケート18件の49件を絞り込み、氏名付きファイル名を作る', () => {
  const data = [...Array.from({ length: 31 }, (_, i) => diary(`d${i}`, `2026-10-${String(i + 1).padStart(2, '0')}`)), ...Array.from({ length: 18 }, (_, i) => survey(`s${i}`, i + 1))];
  const items = data.map(draft => exportItem(draft, conditions)).filter(Boolean);
  assert.equal(items.length, 49);
  assert.equal(items.filter(item => item.type === 'NEWCOMER_SURVEY').length, 18);
  assert.equal(fileName(items.find(item => item.id === 's2')), '2026-10-03_新規入場者アンケート_山田太郎.pdf');
});

test('Windows禁則・予約名・長さ・末尾の点空白を安全にする', () => {
  assert.equal(safePath('a<>:"/\\|?*\u0000b. '), 'a__________b');
  for (const name of ['CON', 'nul.txt', 'COM1', 'LPT9', 'com¹']) assert.match(safePath(name), /^_/);
  assert.equal(safePath('.. '), '名称未設定');
  assert.ok(safePath('漢'.repeat(300)).length <= 80);
});

test('ケース3：300件を逐次処理し1件失敗後も継続し、UIへ制御を返す', async () => {
  const items = Array.from({ length: 300 }, (_, i) => exportItem(diary(`d${i}`, '2026-10-01'), conditions));
  let active = 0, max = 0, heartbeat = 0;
  const timer = setInterval(() => heartbeat++, 1);
  const progress = [];
  const result = await runBatch(items, async item => {
    active++; max = Math.max(max, active);
    try { if (item.id === 'd100') throw new Error('生成失敗'); }
    finally { active--; }
  }, count => progress.push(count));
  clearInterval(timer);
  assert.equal(max, 1); assert.ok(heartbeat > 0);
  assert.equal(result.succeeded, 299); assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].item.id, 'd100'); assert.equal(progress.at(-1), 300);
  const retry = await runBatch(result.failures.map(f => f.item), async () => {}, () => {});
  assert.equal(retry.succeeded, 1);
});

test('0件は生成しない、中止は次の帳票で停止する', async () => {
  let calls = 0;
  await runBatch([], async () => { calls++; }, () => {});
  assert.equal(calls, 0);
  const items = [1, 2, 3].map(i => exportItem(diary(String(i), '2026-10-01'), conditions));
  const result = await runBatch(items, async () => { calls++; }, () => {}, () => calls >= 1);
  assert.equal(result.succeeded, 1); assert.equal(result.cancelled, true);
});
