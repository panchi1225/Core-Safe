import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { loadModule } from './helpers.mjs';
import { INITIAL_MASTER_DATA, INITIAL_NEWCOMER_SURVEY_REPORT } from '../src/types.ts';
import { calculateCurrentExperience } from '../src/utils/experience.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.window = { scrollTo() {}, addEventListener() {}, removeEventListener() {}, innerWidth: 1000 };
globalThis.alert = message => { throw new Error(message); };

test('production module graph has no Functions client, server code or callable path', async () => {
  const result = await build({ entryPoints: ['src/index.tsx'], bundle: true, write: false, metafile: true,
    platform: 'browser', format: 'esm', loader: { '.css': 'text' }, logLevel: 'silent',
    define: { 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_USE_FIREBASE_EMULATORS': '"false"' } });
  assert.ok(!Object.keys(result.metafile.inputs).some(p => /(?:^|[/\\])functions[/\\]/.test(p)), 'Functions must not enter the browser module graph');
  const output = result.outputFiles.map(f => f.text).join('\n');
  assert.doesNotMatch(output, /httpsCallable|getFunctions|connectFunctionsEmulator|listPublicEmployeeCandidates|verifyEmployeeAutofill|EMPLOYEE_AUTOFILL_KEY/);
  // firebase/app includes an SDK-wide product-name registry (@firebase/functions).
  // It does not import the Functions SDK; the module graph above checks actual dependencies.
  assert.doesNotMatch(output, /["']firebase\/functions(?:\/[^"']*)?["']/);
});

const Wizard = (await loadModule('src/components/NewcomerSurveyWizard.tsx', {
  firebaseService: `export const getMasterData=()=>globalThis.sparkStaff.master();export const fetchEmployees=()=>globalThis.sparkStaff.employees();export const saveDraft=async()=>{};`,
  publicNewcomerService: `export const newSubmissionId=()=>'manual-survey';export const submitPublicNewcomerSurvey=(...a)=>globalThis.sparkSubmit(...a);`,
  'react-to-print': `export const useReactToPrint=()=>()=>{};`,
  SignatureCanvas: `import React from 'react';export default props=>React.createElement('button',{onClick:()=>props.onSave('data:image/png;base64,YQ==')},'架空署名');`,
  NewcomerSurveyPrintLayout: `export default props=>{globalThis.sparkReport=props.data;return null;};`, ReportPdfButton: `export default()=>null;`,
})).default;
const employee = { ...INITIAL_NEWCOMER_SURVEY_REPORT, id: 'synthetic-staff', nameSei: '検証', nameMei: '社員', furiganaSei: 'ケンショウ', furiganaMei: 'シャイン',
  birthEra: 'Heisei', birthYear: 7, birthMonth: 1, birthDay: 1, address: '架空住所', phone: '000-0000', emergencyContactSei: '検証', emergencyContactMei: '家族',
  emergencyContactRelation: '家族', emergencyContactPhone: '000-0001', healthCheckYear: 8, healthCheckMonth: 1, healthCheckDay: 1,
  experienceYears: 10, experienceMonths: 5, jobType: '架空専門職', qualifications: { ...INITIAL_NEWCOMER_SURVEY_REPORT.qualifications, electrician: true, slinging: true }, sealImage: 'PRIVATE-SEAL' };

for (const [label, dob] of [
  ['regular employee', {}],
  ['synthetic era-boundary inconsistency', { birthEra: 'Heisei', birthYear: 1, birthMonth: 1, birthDay: 1 }],
  ['synthetic out-of-range date', { birthYear: 0, birthMonth: 13, birthDay: 32 }],
]) test(`staff name selection retains autofill without public DOB verification: ${label}`, async () => {
  const data = { ...employee, ...dob };
  globalThis.sparkStaff = { master: async () => INITIAL_MASTER_DATA, employees: async () => [data] };
  let tree;
  await act(async () => { tree = create(React.createElement(Wizard, { onBackToMenu() {} })); });
  const select = tree.root.findAllByType('select').find(s => s.findAllByType('option').some(o => o.props.value === data.id));
  await act(async () => select.props.onChange({ target: { value: data.id } }));
  assert.equal(tree.root.findAllByProps({ 'aria-label': '本人確認用の生年月日' }).length, 0);
  const values = [...tree.root.findAllByType('input'), ...tree.root.findAllByType('select')].map(input => input.props.value);
  for (const key of ['nameSei','nameMei','furiganaSei','furiganaMei','address','phone','emergencyContactSei','emergencyContactMei','emergencyContactRelation','emergencyContactPhone']) assert.ok(values.includes(data[key]), key);
  assert.ok(values.includes('松浦建設株式会社'));
  assert.ok(values.includes(calculateCurrentExperience(data.experienceYears, data.experienceMonths).years));
  assert.equal(globalThis.sparkReport.qualifications.electrician, true);
  assert.equal(globalThis.sparkReport.qualifications.slinging, true);
  for (const key of ['birthEra', 'birthYear', 'birthMonth', 'birthDay']) assert.equal(globalThis.sparkReport[key], data[key], key);
  assert.ok(!JSON.stringify(tree.toJSON()).includes('PRIVATE-SEAL'));
  await act(async () => tree.unmount());
});

const sdk = `export class Timestamp { constructor(n){this.n=n;} toMillis(){return this.n;} static now(){return new Timestamp(100);} static fromMillis(n){return new Timestamp(n);} }
export const doc=(db,name,id)=>({name,id:id||'manual-survey'});export const collection=(db,name)=>name;
export const query=(name,...constraints)=>({name,constraints});export const orderBy=field=>({field});export const where=(field,op,value)=>({field,op,value});export const documentId=()=> '__name__';export const limit=n=>n;export const startAfter=x=>x;
export const serverTimestamp=()=>new Timestamp(100);
export const setDoc=(ref,data)=>{if(ref.name!=='publicNewcomerSubmissions')throw new Error('Unexpected public write');globalThis.sparkRecords.push({id:ref.id,...data});};
export const getDocs=async ref=>{globalThis.sparkReads.push(ref.name);if(ref.name==='employees')throw new Error('Private employee read');return {docs:(ref.name==='publicNewcomerSubmissions'?globalThis.sparkRecords:[]).map(raw=>({id:raw.id,data:()=>raw})),size:ref.name==='publicNewcomerSubmissions'?globalThis.sparkRecords.length:0};};
export const getDoc=async ref=>{globalThis.sparkReads.push(ref.name);const raw=globalThis.sparkRecords.find(x=>x.id===ref.id);return {id:ref.id,exists:()=>!!raw,data:()=>raw};};export const getDocsFromServer=getDocs;export const getDocFromServer=getDoc;
export const addDoc=()=>{};export const updateDoc=()=>{};export const deleteDoc=()=>{};export const writeBatch=()=>{};`;
const stubs = { firebase: 'export const db={};export const auth={currentUser:{uid:"fixture-staff"}};', 'firebase/firestore': sdk };
const publicService = await loadModule('src/services/publicNewcomerService.ts', stubs);
const staffService = await loadModule('src/services/firebaseService.ts', stubs);
const pdf = await loadModule('src/services/reportPdf.tsx', { html2canvas:'export default()=>{};', jspdf:'export const jsPDF=()=>{};',
  'react-dom/client':'export const createRoot=()=>{};', 'react-dom':'export const flushSync=()=>{};', '../styles/pdf.css?inline':'export default "";' });

test('public manual entry and signature reach submissions, staff list and the unchanged PDF layout', async () => {
  globalThis.sparkRecords = []; globalThis.sparkReads = [];
  globalThis.sparkStaff = { master(){throw new Error('Private master read');}, employees(){throw new Error('Private employee read');} };
  globalThis.sparkSubmit = publicService.submitPublicNewcomerSurvey;
  const form = { token:'11111111-1111-4111-8111-111111111111',project:'検証現場',director:'検証所長',active:true,expiresAt:Date.now()+3600000,contractorOptions:['検証会社'] };
  const initialData = { ...employee, project:form.project,director:form.director,company:'',nameSei:'',nameMei:'',furiganaSei:'',furiganaMei:'',signatureDataUrl:null,pledgeDateYear:8,pledgeDateMonth:10,pledgeDateDay:1 };
  let tree; await act(async()=>{tree=create(React.createElement(Wizard,{isPublicEntry:true,publicForm:form,initialData,onBackToMenu(){}}));});
  for (const [placeholder,value] of [['氏','手入力'],['名','作業員'],['セイ','テニュウリョク'],['メイ','サギョウイン']]) await act(async()=>tree.root.findAllByProps({placeholder})[0].props.onChange({target:{value}}));
  await act(async()=>tree.root.findByProps({'aria-label':'所属会社'}).props.onChange({target:{value:'__other__'}}));
  await act(async()=>tree.root.findByProps({'aria-label':'会社名入力'}).props.onChange({target:{value:'松浦建設株式会社'}}));
  assert.deepEqual(globalThis.sparkReads, []);
  const next = () => tree.root.findAllByType('button').find(b=>b.children.includes('次へ '));
  await act(async()=>next().props.onClick());await act(async()=>next().props.onClick());
  await act(async()=>tree.root.findAllByType('button').find(b=>b.children.includes('架空署名')).props.onClick());
  await act(async()=>tree.root.findAllByType('button').find(b=>b.props.onClick?.name==='handleSave').props.onClick());
  assert.ok(JSON.stringify(tree.toJSON()).includes('この画面を閉じてください'));
  assert.equal(globalThis.sparkRecords.length,1); assert.deepEqual(globalThis.sparkReads,[]);
  const saved=globalThis.sparkRecords[0];assert.equal(saved.data.companyInputType,'other');assert.equal(saved.data.nameSei,'手入力');assert.equal(saved.data.sealImage,undefined);
  const [draft]=await staffService.fetchDrafts();assert.equal(draft.id,'public-newcomer/manual-survey');assert.equal(draft.data.company,'松浦建設株式会社');
  const conditions={project:form.project,start:'2026-10-01',end:'2026-10-31',types:['NEWCOMER_SURVEY']};
  const [item]=await staffService.fetchExportItems(conditions);const fetched=await staffService.fetchExportDraft(item,conditions);
  assert.equal(fetched.id,draft.id);
  const html=renderToStaticMarkup(pdf.reportLayout('NEWCOMER_SURVEY',fetched.data));
  for(const value of ['手入力','松浦建設株式会社','検証現場','検証所長','data:image/png;base64,YQ=='])assert.ok(html.includes(value),value);
  await act(async()=>tree.unmount());
});
