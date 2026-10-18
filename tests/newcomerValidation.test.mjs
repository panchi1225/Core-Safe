import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { loadModule } from './helpers.mjs';
import { INITIAL_NEWCOMER_SURVEY_REPORT } from '../src/types.ts';
import { newcomerStep1Errors, NEWCOMER_REQUIRED_LABELS } from '../src/utils/newcomerValidation.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.window = { scrollTo() {}, addEventListener() {}, removeEventListener() {}, innerWidth: 390 };
globalThis.alert = () => {};
const Wizard = (await loadModule('src/components/NewcomerSurveyWizard.tsx', {
  firebaseService: `export const getMasterData=()=>{throw Error('Unexpected private read');};export const fetchEmployees=()=>{throw Error('Unexpected private read');};`,
  publicNewcomerService: `export const newSubmissionId=()=>'fake-only';export const submitPublicNewcomerSurvey=(...args)=>globalThis.manualSubmit(...args);`,
  PublicEmployeeAutofill: `export default()=>null;`,
  'react-to-print': `export const useReactToPrint=()=>()=>{};`,
  SignatureCanvas: `import React from 'react';export default p=>React.createElement('button',{onClick:()=>p.onSave('data:image/png;base64,YQ==')},'架空署名');`,
  NewcomerSurveyPrintLayout: `export default()=>null;`, ReportPdfButton: `export default()=>null;`,
})).default;
const valid = {
  ...INITIAL_NEWCOMER_SURVEY_REPORT,
  project: '架空検証現場', director: '架空所長', nameSei: '架空', nameMei: '作業員',
  furiganaSei: 'カクウ', furiganaMei: 'サギョウイン', birthEra: 'Heisei', birthYear: 7, birthMonth: 1, birthDay: 1,
  company: '架空協力会社A', companyInputType: 'master', experienceYears: 0, experienceMonths: null,
  jobType: '土工', address: '架空県検証市1', phone: '000-0000-0000',
  emergencyContactSei: '架空', emergencyContactMei: '連絡先', emergencyContactRelation: 'その他', emergencyContactPhone: '000-0000-0001',
  healthCheckYear: 8, healthCheckMonth: 10, healthCheckDay: null, subcontractorRank: '',
};
const form = { token: '77777777-7777-4777-8777-777777777777', project: valid.project, director: valid.director, active: true, expiresAt: Date.now() + 3600000, contractorOptions: [valid.company] };
async function mount(overrides = {}, options) {
  let tree;
  await act(async () => { tree = create(React.createElement(Wizard, { isPublicEntry: true, publicForm: form, initialData: { ...valid, ...overrides }, onBackToMenu() {} }), options); });
  return tree;
}
const next = tree => tree.root.findAllByType('button').find(b => b.children.includes('次へ '));
const step = tree => tree.root.findAllByType('h2').find(h => String(h.children[0]).startsWith('STEP')).children[0];
const close = tree => act(async () => tree.unmount());

test('last text change and Next in the same update validate the latest input', async () => {
  const tree = await mount({ address: '' });
  const input = tree.root.findByProps({ placeholder: '住所' }), button = next(tree);
  await act(async () => { input.props.onChange({ target: { value: '架空県検証市1' } }); button.props.onClick(); });
  assert.equal(step(tree), 'STEP 2: 資格');
  await close(tree);
});

test('two Next taps in the same update cannot skip STEP 2', async () => {
  const tree = await mount(), button = next(tree);
  await act(async () => { button.props.onClick(); button.props.onClick(); });
  assert.equal(step(tree), 'STEP 2: 資格');
  await close(tree);
});

test('zero experience, optional fields and an old health-check date retain existing validation', () => {
  assert.deepEqual(newcomerStep1Errors(valid), {});
  assert.deepEqual(newcomerStep1Errors({ ...valid, experienceMonths: null, healthCheckDay: null, healthCheckYear: 1, subcontractorRank: '' }), {});
  assert.deepEqual(newcomerStep1Errors({ ...valid, jobType: 'その他', jobTypeOther: '架空職種' }), {});
});

for (const [key, label] of Object.entries(NEWCOMER_REQUIRED_LABELS)) test(`missing ${key}: matching label, invalid control and first-error focus`, async () => {
  const overrides = { [key]: key === 'experienceYears' ? null : '' };
  if (key === 'jobTypeOther') overrides.jobType = 'その他';
  assert.deepEqual(newcomerStep1Errors({ ...valid, ...overrides }), { [key]: true });
  const focused = [], scrolled = [];
  const tree = await mount(overrides, { createNodeMock: element => element.type === 'main' ? {
    querySelector: selector => ({ focus: () => focused.push(selector), scrollIntoView: () => scrolled.push(selector) }),
  } : null });
  await act(async () => next(tree).props.onClick());
  assert.equal(step(tree), 'STEP 1: 基本情報');
  const alert = tree.root.findByProps({ role: 'alert' });
  assert.deepEqual(alert.findByType('ul').findAllByType('button').map(button => button.children.join('')), [label]);
  const field = tree.root.findByProps({ 'data-survey-field': key });
  assert.equal(field.props['aria-invalid'], true);
  assert.equal(field.props['aria-describedby'], 'newcomer-required-errors');
  if (field.type !== 'p') assert.match(field.props.className, /border-red-500/);
  assert.deepEqual(focused, [`[data-survey-field="${key}"]`]);
  assert.deepEqual(scrolled, focused);
  // Repeated invalid taps still guide the user and never advance.
  await act(async () => next(tree).props.onClick());
  assert.equal(focused.length, 2);
  await close(tree);
});

test('company Other stays invalid until text is entered; error link focuses the text field', async () => {
  const tree = await mount({ company: '' });
  await act(async () => next(tree).props.onClick());
  await act(async () => tree.root.findByProps({ 'aria-label': '所属会社' }).props.onChange({ target: { value: '__other__' } }));
  const input = tree.root.findByProps({ 'aria-label': '会社名入力' });
  assert.equal(input.props['aria-invalid'], true);
  assert.match(input.props.className, /border-red-500/);
  assert.equal(tree.root.findAllByProps({ 'data-survey-field': 'company' }).length, 1);
  assert.equal(tree.root.findByProps({ 'data-survey-field': 'company' }).type, 'input');
  assert.ok(JSON.stringify(tree.toJSON()).includes('所属会社名（その他・手入力）'));
  await act(async () => { input.props.onChange({ target: { value: '架空手入力会社' } }); next(tree).props.onClick(); });
  assert.equal(step(tree), 'STEP 2: 資格');
  await close(tree);
});

test('corrected errors clear, still-empty fields remain red, conditional job errors disappear', async () => {
  const tree = await mount({ phone: '', address: '', jobType: 'その他', jobTypeOther: '' });
  await act(async () => next(tree).props.onClick());
  await act(async () => {
    tree.root.findByProps({ 'data-survey-field': 'phone' }).props.onChange({ target: { value: '000-0000-0000' } });
    tree.root.findByProps({ 'data-survey-field': 'address' }).props.onChange({ target: { value: '' } });
    tree.root.findByProps({ 'data-survey-field': 'jobType' }).props.onChange({ target: { value: '土工' } });
  });
  assert.equal(tree.root.findByProps({ 'data-survey-field': 'phone' }).props['aria-invalid'], false);
  assert.equal(tree.root.findByProps({ 'data-survey-field': 'address' }).props['aria-invalid'], true);
  assert.equal(tree.root.findAllByProps({ 'data-survey-field': 'jobTypeOther' }).length, 0);
  assert.equal(tree.root.findByProps({ role: 'alert' }).findAllByType('li').length, 1);
  await close(tree);
});

test('an IME composition commits its final string before the pending Next tap is validated', async () => {
  const tree = await mount({ address: '' });
  const main = tree.root.findByType('main');
  let blurred = 0;
  const input = { tagName: 'INPUT', dataset: { surveyField: 'address' }, value: '', blur() { blurred++; } };
  await act(async () => main.props.onCompositionStart({ target: input }));
  await act(async () => next(tree).props.onClick({ timeStamp: 1000 }));
  assert.equal(step(tree), 'STEP 1: 基本情報');
  assert.equal(tree.root.findAllByProps({ role: 'alert' }).length, 0);
  input.value = '架空県検証市1';
  await act(async () => main.props.onCompositionEnd({ target: input }));
  assert.equal(step(tree), 'STEP 2: 資格');
  assert.equal(blurred, 1);
  await close(tree);
});

test('compositionend just before Next, including a trailing onChange, advances once', async () => {
  const tree = await mount({ emergencyContactMei: '' });
  const main = tree.root.findByType('main'), control = tree.root.findByProps({ 'data-survey-field': 'emergencyContactMei' });
  const input = { tagName: 'INPUT', dataset: { surveyField: 'emergencyContactMei' }, value: '架空連絡先', blur() {} };
  await act(async () => { main.props.onCompositionStart({ target: input }); main.props.onCompositionEnd({ target: input }); control.props.onChange({ target: input }); next(tree).props.onClick({ timeStamp: 1000 }); });
  assert.equal(step(tree), 'STEP 2: 資格');
  await close(tree);
});

test('rapid taps across renders cannot skip qualifications; the next deliberate tap works', async () => {
  const tree = await mount();
  await act(async () => next(tree).props.onClick({ timeStamp: 1000 }));
  await act(async () => next(tree).props.onClick({ timeStamp: 1100 }));
  assert.equal(step(tree), 'STEP 2: 資格');
  await act(async () => next(tree).props.onClick({ timeStamp: 1500 }));
  assert.equal(step(tree), 'STEP 3: 誓約・署名');
  await close(tree);
});

test('the final numeric selection is validated immediately, including zero experience', async () => {
  for (const [key, value] of [['experienceYears', '0'], ['healthCheckMonth', '10']]) {
    const tree = await mount({ [key]: null });
    const input = tree.root.findByProps({ 'data-survey-field': key }), button = next(tree);
    await act(async () => { input.props.onChange({ target: { value } }); button.props.onClick(); });
    assert.equal(step(tree), 'STEP 2: 資格');
    await close(tree);
  }
});

test('Back resets the double-tap guard so the next deliberate Next is accepted', async () => {
  const tree = await mount();
  await act(async () => next(tree).props.onClick({ timeStamp: 1000 }));
  await act(async () => tree.root.findAllByType('button').find(b => b.children.includes('戻る')).props.onClick());
  await act(async () => next(tree).props.onClick({ timeStamp: 1200 }));
  assert.equal(step(tree), 'STEP 2: 資格');
  await close(tree);
});

test('an invalid tap does not debounce a corrected form, and an empty IME commit stays invalid', async () => {
  const tree = await mount({ address: '' });
  const input = { tagName: 'INPUT', dataset: { surveyField: 'address' }, value: '', blur() {} };
  await act(async () => tree.root.findByType('main').props.onCompositionStart({ target: input }));
  await act(async () => next(tree).props.onClick({ timeStamp: 1000 }));
  await act(async () => tree.root.findByType('main').props.onCompositionEnd({ target: input }));
  assert.equal(step(tree), 'STEP 1: 基本情報');
  assert.equal(tree.root.findByProps({ 'data-survey-field': 'address' }).props['aria-invalid'], true);
  await act(async () => {
    tree.root.findByProps({ 'data-survey-field': 'address' }).props.onChange({ target: { value: '架空県検証市1' } });
    next(tree).props.onClick({ timeStamp: 1100 });
  });
  assert.equal(step(tree), 'STEP 2: 資格');
  await close(tree);
});

for (const mode of ['master', 'other']) test(`manual contractor ${mode}: all required inputs, zero years, signature and mocked submission`, async () => {
  const blanks = Object.fromEntries(Object.keys(NEWCOMER_REQUIRED_LABELS).filter(key => !['project', 'director'].includes(key)).map(key => [key, key === 'experienceYears' ? null : '']));
  const tree = await mount(blanks);
  for (const [key, value] of Object.entries(valid)) {
    if (!(key in blanks) || ['company', 'jobTypeOther'].includes(key)) continue;
    await act(async () => tree.root.findByProps({ 'data-survey-field': key }).props.onChange({ target: { value: String(value) } }));
  }
  await act(async () => tree.root.findByProps({ 'aria-label': '所属会社' }).props.onChange({ target: { value: mode === 'master' ? valid.company : '__other__' } }));
  if (mode === 'other') await act(async () => tree.root.findByProps({ 'aria-label': '会社名入力' }).props.onChange({ target: { value: '架空手入力会社' } }));
  await act(async () => next(tree).props.onClick({ timeStamp: 1000 }));
  assert.equal(step(tree), 'STEP 2: 資格');
  await act(async () => next(tree).props.onClick({ timeStamp: 2000 }));
  await act(async () => tree.root.findAllByType('button').find(b => b.children.includes('架空署名')).props.onClick());
  let saved;
  globalThis.manualSubmit = async (...args) => { saved = args; };
  await act(async () => tree.root.findAllByType('button').find(b => b.props.onClick?.name === 'handleSave').props.onClick());
  assert.equal(saved[1].token, form.token);
  assert.equal(saved[2].companyInputType, mode);
  assert.equal(saved[2].experienceYears, 0);
  assert.equal(saved[2].healthCheckDay, null);
  assert.equal(saved[2].signatureDataUrl, 'data:image/png;base64,YQ==');
  assert.equal(saved[2].company, mode === 'master' ? valid.company : '架空手入力会社');
  assert.ok(JSON.stringify(tree.toJSON()).includes('保存が完了しました'));
  delete globalThis.manualSubmit;
  await close(tree);
});
