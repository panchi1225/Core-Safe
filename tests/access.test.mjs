import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadModule } from './helpers.mjs';
import { publicEntryRoute, reportLocation, asPublicDraft, surveyPayload } from '../src/utils/newcomerAccess.ts';
import { INITIAL_NEWCOMER_SURVEY_REPORT, INITIAL_MASTER_DATA } from '../src/types.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.window = { scrollTo() {}, addEventListener() {}, removeEventListener() {}, innerWidth: 1000, location: { search: '' } };
const token = '11111111-1111-4111-8111-111111111111';
const form = { token, project: '公開現場', director: '公開所長', active: true, createdBy: 'staff', createdAt: Date.now(), expiresAt: Date.now() + 3600000, contractorOptions: ['公開会社'] };

test('public route survives reload and does not trust project/director URL parameters', () => {
  assert.deepEqual(publicEntryRoute(`?form=newcomer&token=${token}&project=forged&director=forged`), { public: true, token });
  assert.deepEqual(publicEntryRoute('?form=newcomer&project=legacy'), { public: true, token: null });
  assert.deepEqual(publicEntryRoute('?form=newcomer&token=invalid'), { public: true, token: null });
  assert.deepEqual(publicEntryRoute(''), { public: false, token: null });
});
test('source IDs route both old and new reports without collisions', () => {
  assert.deepEqual(reportLocation('old-id'), { collection: 'drafts', id: 'old-id' });
  assert.deepEqual(reportLocation('public-newcomer/new-id'), { collection: 'publicNewcomerSubmissions', id: 'new-id' });
  assert.throws(() => reportLocation('public-newcomer/a/b')); assert.throws(() => reportLocation(''));
  const draft = asPublicDraft('new-id', { data: { nameSei: '山田', nameMei: '太郎', company: '会社' }, lastModified: { toMillis: () => 42 } });
  assert.equal(draft.data.name, '山田太郎'); assert.equal(draft.data.company, '会社'); assert.equal(draft.lastModified, 42);
});
test('public serialization omits unrelated report and private employee fields', () => {
  const data = surveyPayload({ ...INITIAL_NEWCOMER_SURVEY_REPORT, employeeId: 'secret', photos: ['secret'], qualifications: { electrician: true, employeeId: 'secret' } });
  assert.equal(data.employeeId, undefined); assert.equal(data.photos, undefined); assert.equal(data.qualifications.employeeId, undefined); assert.equal(data.qualifications.electrician, true); assert.equal(data.qualifications.slinging, false);
});
const serviceStub = `export const getMasterData = (...a) => globalThis.wizardServices.master(...a); export const fetchEmployees = (...a) => globalThis.wizardServices.employees(...a); export const saveDraft = (...a) => globalThis.wizardServices.save(...a); export const deleteDraftsByProject = async () => {};`;
const wizard = (await loadModule('src/components/NewcomerSurveyWizard.tsx', {
  firebaseService: serviceStub,
  publicNewcomerService: `export const newSubmissionId = () => 'new-id'; export const submitPublicNewcomerSurvey = (...a) => globalThis.wizardServices.submit(...a);`,
  'react-to-print': `export const useReactToPrint = () => () => {};`,
  SignatureCanvas: `export default () => null;`, NewcomerSurveyPrintLayout: `export default () => null;`
})).default;
test('public wizard never fetches employees or internal master; locks project/director and supports other company', async () => {
  let master = 0, employees = 0;
  globalThis.wizardServices = { master: async () => { master++; return INITIAL_MASTER_DATA; }, employees: async () => { employees++; return []; } };
  let tree;
  await act(async () => { tree = create(React.createElement(wizard, { isPublicEntry: true, publicForm: form, initialData: { project: form.project, director: form.director }, onBackToMenu() {} })); });
  assert.equal(master, 0); assert.equal(employees, 0);
  const rendered = JSON.stringify(tree.toJSON());
  assert.ok(rendered.includes(form.project)); assert.ok(rendered.includes(form.director)); assert.ok(!rendered.includes('社員はこちら'));
  const select = tree.root.findByProps({ 'aria-label': '所属会社' });
  await act(async () => select.props.onChange({ target: { value: '__other__' } }));
  const input = tree.root.findByProps({ 'aria-label': '会社名入力' });
  await act(async () => input.props.onChange({ target: { value: '手入力会社' } }));
  assert.equal(tree.root.findByProps({ 'aria-label': '会社名入力' }).props.value, '手入力会社');
  await act(async () => tree.unmount());
});
test('internal wizard still loads master and employee autofill', async () => {
  let master = 0, employees = 0;
  globalThis.wizardServices = { master: async () => { master++; return INITIAL_MASTER_DATA; }, employees: async () => { employees++; return [{ id: 'staff', nameSei: '社員', nameMei: '太郎' }]; } };
  let tree; await act(async () => { tree = create(React.createElement(wizard, { onBackToMenu() {} })); });
  assert.equal(master, 1); assert.equal(employees, 1); assert.ok(JSON.stringify(tree.toJSON()).includes('社員はこちら'));
  await act(async () => tree.unmount());
});
test('staff can display and correct the public form free-text company without losing its string value', async () => {
  globalThis.wizardServices = { master: async () => INITIAL_MASTER_DATA, employees: async () => [] };
  let tree; await act(async () => { tree = create(React.createElement(wizard, { initialDraftId: 'public-newcomer/id', initialData: { ...INITIAL_NEWCOMER_SURVEY_REPORT, company: '手入力会社', companyInputType: 'other' }, onBackToMenu() {} })); });
  assert.ok(tree.root.findAllByType('option').some(x=>x.props.value==='手入力会社'));
  const input = tree.root.findByProps({ 'aria-label': '会社名修正' });
  await act(async () => input.props.onChange({ target: { value: '修正会社' } }));
  assert.equal(tree.root.findByProps({ 'aria-label': '会社名修正' }).props.value, '修正会社');
  await act(async () => tree.unmount());
});
test('public send uses its dedicated create with a stable ID and blocks simultaneous/repeated clicks', async () => {
  let sends = 0, release;
  const received = [];
  globalThis.wizardServices = { master(){ throw new Error('Private read'); }, employees(){ throw new Error('Private read'); }, save(){ throw new Error('Internal save'); }, submit(id) { sends++; received.push(id); return new Promise(resolve => { release = resolve; }); } };
  const data = { ...INITIAL_NEWCOMER_SURVEY_REPORT, project: form.project, director: form.director, company: '公開会社', nameSei: '山田', nameMei: '太郎', furiganaSei: 'ヤマダ', furiganaMei: 'タロウ', birthYear: 10, birthMonth: 1, birthDay: 1, experienceYears: 1, address: '住所', phone: '000', emergencyContactSei: '山田', emergencyContactMei: '次郎', emergencyContactRelation: '家族', emergencyContactPhone: '000', healthCheckYear: 8, healthCheckMonth: 1, signatureDataUrl: 'data:image/png;base64,YQ==' };
  let tree; await act(async () => { tree = create(React.createElement(wizard, { isPublicEntry: true, publicForm: form, initialData: data, onBackToMenu() {} })); });
  const nextButton = () => tree.root.findAllByType('button').find(b => b.children.includes('次へ '));
  await act(async () => nextButton().props.onClick()); await act(async () => nextButton().props.onClick());
  const save = tree.root.findAllByType('button').find(b => b.props.onClick?.name === 'handleSave');
  await act(async () => { const first = save.props.onClick(); const second = save.props.onClick(); assert.equal(sends,1); release(); await Promise.all([first,second]); });
  await act(async () => save.props.onClick()); assert.equal(sends,1); assert.deepEqual(received,['new-id']);
  assert.ok(JSON.stringify(tree.toJSON()).includes('この画面を閉じてください'));
  await act(async () => tree.unmount());
});
const StaffGate = (await loadModule('src/components/StaffGate.tsx', { authService: `export const observeStaffAccess = () => () => {}; export const staffSignIn = async () => {}; export const staffSignOut = async () => {};` })).default;
test('private children mount only after permission and unmount on revocation/logout', async () => {
  let next, mounts = 0, unmounts = 0;
  const source = { observeStaffAccess(cb) { next = cb; return () => {}; }, staffSignIn: async () => {}, staffSignOut: async () => {} };
  function Private() { React.useEffect(() => { mounts++; return () => { unmounts++; }; }, []); return React.createElement('p', null, 'private'); }
  let tree; await act(async () => { tree = create(React.createElement(StaffGate, { source }, React.createElement(Private))); });
  for (const state of ['signedOut','denied','error','checking']) await act(async () => next({ state }));
  assert.equal(mounts, 0);
  await act(async () => next({ state: 'allowed' })); assert.equal(mounts, 1);
  await act(async () => next({ state: 'denied' })); assert.equal(unmounts, 1);
  await act(async () => next({ state: 'allowed' })); await act(async () => next({ state: 'signedOut' })); assert.equal(unmounts, 2);
  assert.equal(tree.root.findAllByType('input').length, 2); assert.ok(!JSON.stringify(tree.toJSON()).includes('新規登録'));
  await act(async () => tree.unmount());
});
test('Auth observer rejects cached approval and ignores stale callbacks from a previous user', async () => {
  let authNext, profileNext, oldProfile, authError, stopped = 0;
  globalThis.authMocks = { onAuthStateChanged(a, next, error) { authNext = next; authError = error; return () => stopped++; }, onSnapshot(ref, options, cb) { profileNext = cb; return () => stopped++; } };
  const auth = await loadModule('src/services/authService.ts', {
    firebase: 'export const auth = {}; export const db = {};',
    'firebase/auth': 'export const onAuthStateChanged = (...a) => globalThis.authMocks.onAuthStateChanged(...a); export const signInWithEmailAndPassword = () => {}; export const signOut = () => {};',
    'firebase/firestore': 'export const doc = (...a) => a; export const onSnapshot = (...a) => globalThis.authMocks.onSnapshot(...a);'
  });
  const states = [], stop = auth.observeStaffAccess(x => states.push(x.state));
  authNext({ uid: 'first' }); const snapshot = (active, cached = false) => ({ metadata: { fromCache: cached }, exists: () => true, data: () => ({ active }) });
  profileNext(snapshot(true, true)); assert.equal(states.at(-1), 'checking');
  profileNext(snapshot(true)); assert.equal(states.at(-1), 'allowed'); oldProfile = profileNext;
  authNext({ uid: 'second' }); oldProfile(snapshot(true)); assert.equal(states.at(-1), 'checking');
  profileNext(snapshot(false)); assert.equal(states.at(-1), 'denied'); authError(); oldProfile(snapshot(true)); assert.equal(states.at(-1), 'error');
  stop(); assert.ok(stopped >= 3);
});
test('old and public records render with the identical existing print layout', async () => {
  const Layout = (await loadModule('src/components/NewcomerSurveyPrintLayout.tsx')).default;
  const original = { ...INITIAL_NEWCOMER_SURVEY_REPORT, project: '現場', company: '会社', nameSei: '山田', nameMei: '太郎', qualifications: { ...INITIAL_NEWCOMER_SURVEY_REPORT.qualifications, electrician: true }, signatureDataUrl: 'data:image/png;base64,YQ==' };
  const publicDraft = asPublicDraft('id', { data: surveyPayload(original) });
  assert.equal(renderToStaticMarkup(React.createElement(Layout, { data: publicDraft.data })), renderToStaticMarkup(React.createElement(Layout, { data: original })));
});
