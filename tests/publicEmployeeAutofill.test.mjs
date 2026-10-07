import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { loadModule } from './helpers.mjs';
import { INITIAL_MASTER_DATA, INITIAL_NEWCOMER_SURVEY_REPORT } from '../src/types.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.window={scrollTo(){},addEventListener(){},removeEventListener(){},innerWidth:1000};
const token='11111111-1111-4111-8111-111111111111';
const apiStub=`export const listPublicEmployeeCandidates=(...a)=>globalThis.autofillAPI.list(...a);export const verifyEmployeeAutofill=(...a)=>globalThis.autofillAPI.verify(...a);`;
const Component=(await loadModule('src/components/PublicEmployeeAutofill.tsx',{publicEmployeeAutofillService:apiStub})).default;
const names=[{employeePublicId:'opaque-id',displayName:'山田 太郎'}];
const selected=tree=>tree.root.findByProps({'aria-label':'本人確認する社員氏名'});
const dob=tree=>tree.root.findByProps({'aria-label':'本人確認用の生年月日'});
const button=tree=>tree.root.findAllByType('button').find(x=>x.children.includes('社員情報を自動入力'));
async function enter(tree,value='19950101'){
  await act(async()=>selected(tree).props.onChange({target:{value:'opaque-id'}}));
  await act(async()=>dob(tree).props.onChange({target:{value}}));
}
test('public employee UI explains YYYYMMDD, loads only candidates, and sends verification only on request',async()=>{
  let calls=0,received,success;
  globalThis.autofillAPI={list:async t=>{assert.equal(t,token);return names;},verify:async(...args)=>{calls++;received=args;return {nameSei:'山田'};}};
  let tree;await act(async()=>{tree=create(React.createElement(Component,{token,onVerified:d=>success=d}));});
  const json=JSON.stringify(tree.toJSON());for(const text of ['松浦建設株式会社の社員の方','西暦8桁','19950101','「-」や「/」'])assert.ok(json.includes(text));
  assert.equal(dob(tree).props.type,'text');assert.equal(dob(tree).props.inputMode,'numeric');assert.equal(dob(tree).props.maxLength,8);
  await enter(tree,'a19950101999');assert.equal(dob(tree).props.value,'19950101');assert.equal(calls,0);assert.equal(success,undefined);
  await act(async()=>button(tree).props.onClick());assert.equal(calls,1);assert.deepEqual(received,[token,'opaque-id','19950101']);assert.deepEqual(success,{nameSei:'山田'});
  assert.equal(dob(tree).props.value,'');assert.ok(JSON.stringify(tree.toJSON()).includes('社員情報を読み込みました。'));
  await act(async()=>tree.unmount());
});
test('incomplete birth date cannot send and failure discloses no employee existence or DOB detail',async()=>{
  let calls=0,success=false;globalThis.autofillAPI={list:async()=>names,verify:async()=>{calls++;throw {code:'functions/permission-denied',message:'internal detail must not appear'};}};
  let tree;await act(async()=>{tree=create(React.createElement(Component,{token,onVerified:()=>success=true}));});
  await enter(tree,'1995011');assert.equal(button(tree).props.disabled,true);await act(async()=>button(tree).props.onClick());assert.equal(calls,0);
  await act(async()=>dob(tree).props.onChange({target:{value:'19950102'}}));await act(async()=>button(tree).props.onClick());
  assert.equal(calls,1);assert.equal(success,false);const json=JSON.stringify(tree.toJSON());assert.ok(json.includes('本人確認ができませんでした。氏名と生年月日を確認してください。'));assert.ok(!json.includes('internal detail'));assert.equal(dob(tree).props.value,'');
  await act(async()=>tree.unmount());
});
test('rate limit offers short retry or manual entry; list outage also preserves manual entry',async()=>{
  globalThis.autofillAPI={list:async()=>names,verify:async()=>{throw {code:'functions/resource-exhausted'};}};
  let tree;await act(async()=>{tree=create(React.createElement(Component,{token,onVerified(){throw new Error('Unexpected success');}}));});
  await enter(tree);await act(async()=>button(tree).props.onClick());assert.ok(JSON.stringify(tree.toJSON()).includes('1分ほど待つか、手入力'));
  await act(async()=>tree.unmount());globalThis.autofillAPI.list=async()=>{throw new Error('Unavailable');};
  await act(async()=>{tree=create(React.createElement(Component,{token,onVerified(){}}));});assert.ok(JSON.stringify(tree.toJSON()).includes('手入力でも提出できます'));assert.equal(tree.root.findAllByType('select').length,0);
  await act(async()=>tree.unmount());
});
test('response after token change/unmount cannot fill the wrong form',async()=>{
  let resolve,filled=0;globalThis.autofillAPI={list:async()=>names,verify:()=>new Promise(r=>resolve=r)};
  let tree;await act(async()=>{tree=create(React.createElement(Component,{token,onVerified:()=>filled++}));});await enter(tree);
  await act(async()=>{button(tree).props.onClick();});await act(async()=>{tree.update(React.createElement(Component,{token:'different-token',onVerified:()=>filled++}));});
  await act(async()=>resolve({nameSei:'Late'}));assert.equal(filled,0);await act(async()=>tree.unmount());
});

const employee={id:'private-id',...INITIAL_NEWCOMER_SURVEY_REPORT,nameSei:'山田',nameMei:'太郎',furiganaSei:'ヤマダ',furiganaMei:'タロウ',birthEra:'Heisei',birthYear:7,birthMonth:1,birthDay:1,address:'本人住所',phone:'000-0000',emergencyContactSei:'山田',emergencyContactMei:'家族',emergencyContactRelation:'家族',emergencyContactPhone:'000',experienceYears:10,experienceMonths:5,jobType:'登録済み専門職',healthCheckYear:8,healthCheckMonth:1,healthCheckDay:1,qualifications:{...INITIAL_NEWCOMER_SURVEY_REPORT.qualifications,electrician:true,slinging:true},sealImage:'NEVER-RETURNED'};
const Wizard=(await loadModule('src/components/NewcomerSurveyWizard.tsx',{
  firebaseService:`export const getMasterData=async()=>globalThis.internalMaster; export const fetchEmployees=async()=>globalThis.internalEmployees;export const saveDraft=async()=>{};`,
  publicNewcomerService:`export const newSubmissionId=()=> 'id';export const submitPublicNewcomerSurvey=async()=>{};`,
  PublicEmployeeAutofill:`export default function Mock(props){globalThis.publicAutofillProps=props;return null;}`,
  'react-to-print':`export const useReactToPrint=()=>()=>{};`,SignatureCanvas:`export default()=>null;`,NewcomerSurveyPrintLayout:`export default()=>null;`,
})).default;
test('verified public autofill and normal staff name selection apply the same necessary fields, without a DOB check in staff mode',async()=>{
  globalThis.internalMaster=INITIAL_MASTER_DATA;globalThis.internalEmployees=[employee];let internal,publicTree;
  await act(async()=>{internal=create(React.createElement(Wizard,{onBackToMenu(){}}));});
  const privateSelect=internal.root.findAllByType('select').find(s=>s.props.onChange&&s.findAllByType('option').some(o=>o.props.value==='private-id'));
  await act(async()=>privateSelect.props.onChange({target:{value:'private-id'}}));
  assert.equal(internal.root.findAllByProps({'aria-label':'本人確認用の生年月日'}).length,0);
  const form={token,project:'固定現場',director:'固定所長',active:true,createdAt:Date.now(),expiresAt:Date.now()+3600000,createdBy:'staff',contractorOptions:['協力会社']};
  await act(async()=>{publicTree=create(React.createElement(Wizard,{isPublicEntry:true,publicForm:form,initialData:{project:form.project,director:form.director},onBackToMenu(){}}));});
  const {id,sealImage,...safe}=employee;await act(async()=>globalThis.publicAutofillProps.onVerified({...safe,company:'松浦建設株式会社'}));
  const values=tree=>tree.root.findAllByType('input').map(x=>x.props.value);
  for(const field of ['nameSei','nameMei','furiganaSei','furiganaMei','address','phone','emergencyContactSei','emergencyContactMei','emergencyContactRelation','emergencyContactPhone']){
    assert.ok(values(internal).includes(employee[field]),field);assert.ok(values(publicTree).includes(employee[field]),field);
  }
  assert.equal(publicTree.root.findByProps({'aria-label':'所属会社'}).props.value,'__other__');assert.equal(publicTree.root.findByProps({'aria-label':'会社名入力'}).props.value,'松浦建設株式会社');
  assert.ok(JSON.stringify(publicTree.toJSON()).includes(form.project));assert.ok(JSON.stringify(publicTree.toJSON()).includes(form.director));assert.ok(!JSON.stringify(publicTree.toJSON()).includes('NEVER-RETURNED'));
  await act(async()=>{internal.unmount();publicTree.unmount();});
});
