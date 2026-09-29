import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateCurrentExperience } from './experience.ts';

test('登録値は2026年10月1日にはそのまま反映する', () => {
  assert.deepEqual(calculateCurrentExperience(5, 3, new Date(2026, 9, 1)), { years: 5, months: 3 });
});

test('基準日前は経過月数を差し引き、0未満にはしない', () => {
  assert.deepEqual(calculateCurrentExperience(5, 3, new Date(2026, 8, 30)), { years: 5, months: 2 });
  assert.deepEqual(calculateCurrentExperience(0, 0, new Date(2026, 8, 30)), { years: 0, months: 0 });
});

test('翌月と年をまたいだ後は経過月数を加算する', () => {
  assert.deepEqual(calculateCurrentExperience(5, 11, new Date(2026, 10, 1)), { years: 6, months: 0 });
  assert.deepEqual(calculateCurrentExperience(5, 3, new Date(2027, 0, 1)), { years: 5, months: 6 });
});
