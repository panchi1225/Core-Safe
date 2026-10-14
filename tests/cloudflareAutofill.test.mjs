import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadModule } from './helpers.mjs';
import { employeeSurveyFields } from '../src/utils/employeeAutofill.ts';
import { employee } from '../worker/test/helpers.mjs';
import { INITIAL_NEWCOMER_SURVEY_REPORT } from '../src/types.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.window={scrollTo(){},addEventListener(){},removeEventListener(){},innerWidth:1000};
const service=`export const publicAutofillConfigured=true;export const getEmployeeCandidates=async()=>[{id:'opaque',name:'架空 社員'}];export const verifyPublicEmployee=(...a)=>globalThis.autofillVerify(...a);`;
const Form=(await loadModule('src/components/PublicEmployeeAutofill.tsx',{employeeAutofillService:service})).default;
const Wizard=(await loadModule('src/components/NewcomerSurveyWizard.tsx',{
  employeeAutofillService:service,
  firebaseService:`export const getMasterData=()=>{throw Error('Private read');};export const fetchEmployees=()=>{throw Error('Private read');};`,
  publicNewcomerService:`export const newSubmissionId=()=>'autofilled-survey';export const submitPublicNewcomerSurvey=(...a)=>globalThis.autofillSubmit(...a);`,
  'react-to-print':`export const useReactToPrint=()=>()=>{};`,
  SignatureCanvas:`import React from 'react';export default p=>React.createElement('button',{onClick:()=>p.onSave('data:image/png;base64,YQ==')},'架空署名');`,
  NewcomerSurveyPrintLayout:`export default p=>{globalThis.autofillReport=p.data;return null;};`,ReportPdfButton:`export default()=>null;`,
})).default;
const text=tree=>JSON.stringify(tree.toJSON());
async function select(tree){await act(async()=>tree.root.findAllByType('button').find(b=>b.children.includes('松浦建設の社員')).props.onClick());await act(async()=>tree.root.findByProps({'aria-label':'社員のお名前'}).props.onChange({target:{value:'opaque'}}));await act(async()=>tree.root.findByProps({'aria-label':'本人確認用の生年月日'}).props.onChange({target:{value:'19950101'}}));}
const verify=tree=>tree.root.findAllByType('button').find(b=>b.children.includes('生年月日を確認して自動入力'));

test('public employee UI uses server verification; errors and stale results never autofill; manual path remains',async()=>{
  let filled=0,tree;globalThis.autofillVerify=async()=>{throw Error('mismatch');};
  await act(async()=>{tree=create(React.createElement(Form,{token:'existing-token',onAutofill(){filled++;}}));});
  await select(tree);await act(async()=>verify(tree).props.onClick());assert.equal(filled,0);assert.ok(text(tree).includes('確認できませんでした'));
  let complete;globalThis.autofillVerify=()=>new Promise(resolve=>{complete=resolve;});
  let pending;await act(async()=>{pending=verify(tree).props.onClick();});
  await act(async()=>tree.root.findAllByType('button').find(b=>b.children.includes('協力会社・手入力')).props.onClick());
  await act(async()=>{complete(employee);await pending;});assert.equal(filled,0);assert.equal(tree.root.findAllByProps({'aria-label':'本人確認用の生年月日'}).length,0);
  await act(async()=>tree.unmount());
});

for(const included of [false,true])test(`public verified autofill shares staff fields, leaves signature to the user and submits using existing company Rules (${included?'master':'other'})`,async()=>{
  globalThis.autofillVerify=async(token,id,dob)=>{assert.equal(id,'opaque');assert.equal(dob,'19950101');return employee;};
  let saved,tree;globalThis.autofillSubmit=async(...a)=>{saved=a;};
  const form={token:'11111111-1111-4111-8111-111111111111',project:'検証現場',director:'検証所長',active:true,expiresAt:Date.now()+3600000,contractorOptions:included?['松浦建設株式会社']:['架空協力会社']};
  await act(async()=>{tree=create(React.createElement(Wizard,{isPublicEntry:true,publicForm:form,initialData:{...INITIAL_NEWCOMER_SURVEY_REPORT,project:form.project,director:form.director,signatureDataUrl:'PREVIOUS-PERSON-SIGNATURE'},onBackToMenu(){}}));});
  await select(tree);await act(async()=>verify(tree).props.onClick());
  const report=globalThis.autofillReport,expected=employeeSurveyFields(employee);
  for(const [key,value]of Object.entries(expected))assert.deepEqual(report[key],value,key);
  assert.equal(report.companyInputType,included?'master':'other');assert.equal(report.project,form.project);assert.equal(report.director,form.director);assert.ok(!report.signatureDataUrl);
  assert.equal(report.sealImage,undefined);assert.equal(report.management,undefined);assert.equal(tree.root.findByProps({'aria-label':'本人確認用の生年月日'}).props.value,'');
  await act(async()=>tree.root.findByProps({'aria-label':'社員のお名前'}).props.onChange({target:{value:''}}));
  assert.equal(globalThis.autofillReport.nameSei,'');assert.equal(globalThis.autofillReport.address,'');assert.ok(!globalThis.autofillReport.signatureDataUrl);
  await act(async()=>tree.root.findByProps({'aria-label':'社員のお名前'}).props.onChange({target:{value:'opaque'}}));
  await act(async()=>tree.root.findByProps({'aria-label':'本人確認用の生年月日'}).props.onChange({target:{value:'19950101'}}));await act(async()=>verify(tree).props.onClick());
  const next=()=>tree.root.findAllByType('button').find(b=>b.children.includes('次へ '));
  await act(async()=>next().props.onClick());await act(async()=>next().props.onClick());
  await act(async()=>tree.root.findAllByType('button').find(b=>b.children.includes('架空署名')).props.onClick());
  await act(async()=>tree.root.findAllByType('button').find(b=>b.props.onClick?.name==='handleSave').props.onClick());
  assert.ok(saved);assert.equal(saved[1].token,form.token);assert.equal(saved[2].signatureDataUrl,'data:image/png;base64,YQ==');assert.equal(saved[2].nameSei,employee.nameSei);
  const Print=(await loadModule('src/components/NewcomerSurveyPrintLayout.tsx')).default;
  const html=renderToStaticMarkup(React.createElement(Print,{data:saved[2]}));
  for(const value of ['架空','松浦建設株式会社','検証現場','検証所長','data:image/png;base64,YQ=='])assert.ok(html.includes(value));
  await act(async()=>tree.unmount());
});
