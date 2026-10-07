import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { transform } from 'esbuild';
import { loadModule } from './loadModule.mjs';
const shared = await loadModule('src/utils/reportRestore.ts');
const types = await loadModule('src/types.ts');
const dailyWizard = fs.readFileSync(new URL('./fixtures/dailyBefore.tsx.txt', import.meta.url), 'utf8');
const start = dailyWizard.indexOf('      const restored = { ...initialData };');
const end = dailyWizard.indexOf('      return restored;', start) + '      return restored;'.length;
const dailySource = (await transform(`function restore(initialData: any) { ${dailyWizard.slice(start, end)} }`, { loader: 'ts' })).code;
const originalDaily = new Function('INITIAL_DAILY_SAFETY_REPORT', 'SAFETY_INSTRUCTIONS_COUNT', dailySource + '; return restore;')(types.INITIAL_DAILY_SAFETY_REPORT, 10);
const newcomerWizard = fs.readFileSync(new URL('./fixtures/newcomerBefore.tsx.txt', import.meta.url), 'utf8');
const ns = newcomerWizard.indexOf('const sanitizeReportData ='), ne = newcomerWizard.indexOf('// --- Modals ---', ns);
const newcomerSource = (await transform(newcomerWizard.slice(ns, ne), { loader: 'ts' })).code;
const originalNewcomer = new Function('INITIAL_NEWCOMER_SURVEY_REPORT', newcomerSource + '; return sanitizeReportData;')(types.INITIAL_NEWCOMER_SURVEY_REPORT);

test('共通化した日誌の旧データ復元は変更前Wizardと同じ値を生成する', () => {
  for (const data of [types.INITIAL_DAILY_SAFETY_REPORT, { project: '旧現場', safetyInstructions: ['注意'], workEntries: [{ id: '1' }], step3ConfirmationItems: { item1: '良' } }]) {
    assert.deepEqual(shared.restoreDailySafetyReport(structuredClone(data)), originalDaily(structuredClone(data)));
  }
});
test('共通化したアンケートの復元は変更前Wizardと同じ値を生成する', () => {
  for (const data of [types.INITIAL_NEWCOMER_SURVEY_REPORT, { project: '旧現場', nameSei: '試験', qualifications: { slinging: true } }]) {
    assert.deepEqual(shared.sanitizeReportData(structuredClone(data), false), originalNewcomer(structuredClone(data), false));
  }
  assert.deepEqual(shared.sanitizeReportData(undefined, true), originalNewcomer(undefined, true));
});
