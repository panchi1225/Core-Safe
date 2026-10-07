import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {loadModule} from './helpers.mjs';
import {INITIAL_NEWCOMER_SURVEY_REPORT,INITIAL_MASTER_DATA} from '../src/types.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.window={location:{search:''},scrollTo(){},addEventListener(){},removeEventListener(){},innerWidth:1000};
const noop='export default ()=>null;';
const AccessApp=(await loadModule('src/AccessApp.tsx',{
  authService:'export const observeStaffAccess=cb=>{globalThis.accessNext=cb;return ()=>{};};export const staffSignIn=async()=>{};export const staffSignOut=async()=>{};',
  firebaseService:'export const fetchDrafts=async()=>[];export const fetchEmployees=async()=>[];export const removeDraft=async()=>{};',
  BulkReportDownload:'import React from "react";export default ()=>React.createElement("p",null,"PRIVATE-BULK");',
  PublicNewcomerEntry:'import React from "react";export default ()=>React.createElement("p",null,"PUBLIC-ENTRY");',
  PublicQRManager:noop,MasterSettings:noop,SafetyPlanWizard:noop,SafetyTrainingWizard:noop,DailySafetyWizard:noop,DisasterCouncilWizard:noop,NewcomerSurveyWizard:noop,
})).default;
test('AccessApp actual staff home exposes bulk only after staff approval and removes it on revocation/logout',async()=>{
  window.location.search='';let tree;await act(async()=>{tree=create(React.createElement(AccessApp));});
  for(const state of ['signedOut','denied','error']){await act(async()=>globalThis.accessNext({state}));assert.ok(!JSON.stringify(tree.toJSON()).includes('帳票一括ダウンロード'));}
  for(const revoked of ['denied','signedOut']){
    await act(async()=>globalThis.accessNext({state:'allowed'}));
    const link=tree.root.findAllByType('button').find(x=>x.findAllByType('h3').some(h=>h.children.includes('帳票一括ダウンロード')));
    assert.ok(link);await act(async()=>link.props.onClick());assert.ok(JSON.stringify(tree.toJSON()).includes('PRIVATE-BULK'));
    await act(async()=>globalThis.accessNext({state:revoked}));assert.ok(!JSON.stringify(tree.toJSON()).includes('PRIVATE-BULK'));
  }
  await act(async()=>tree.unmount());
});
test('public QR route cannot mount the staff home or bulk view even with injected view parameters',async()=>{
  window.location.search='?form=newcomer&token=11111111-1111-4111-8111-111111111111&view=BULK_DOWNLOAD';
  let tree;await act(async()=>{tree=create(React.createElement(AccessApp));});const html=JSON.stringify(tree.toJSON());
  assert.ok(html.includes('PUBLIC-ENTRY'));assert.ok(!html.includes('PRIVATE-BULK'));assert.ok(!html.includes('社員ログイン'));await act(async()=>tree.unmount());
});
const destinationStub=`export const downloadBlob=()=>{};export const preparePdfDestination=(mode)=>globalThis.batchMocks.prepare(mode);`;
const Bulk=(await loadModule('src/components/BulkReportDownload.tsx',{
  firebaseService:'export const fetchExportDraft=async()=>{};export const fetchExportItems=async()=>[];export const getMasterData=async()=>({projects:[]});',
  pdfDestination:destinationStub,
})).default;
const targets=Array.from({length:3},(_,i)=>({id:String(i),type:'NEWCOMER_SURVEY',project:'現場',date:'2026-10-01',name:'山田',lastModified:1}));
async function mounted(source){let tree;await act(async()=>{tree=create(React.createElement(Bulk,{source,onBack(){}}));});await act(async()=>tree.root.findByProps({id:'bulk-project'}).props.onChange({target:{value:'現場'}}));await act(async()=>tree.root.findAllByType('button').find(x=>x.children.includes('対象件数を確認')).props.onClick());return tree;}
const saveButton=tree=>tree.root.findAllByType('button').find(x=>x.children.includes('ZIPでダウンロード'));
test('bulk unmount during pending server read never starts PDF generation or fetches a next report',async()=>{
  let release,reads=0,generated=0,saved=0;
  globalThis.batchMocks={prepare:async()=>({mode:'zip',save:async()=>saved++,finish:async()=>null,dispose:async()=>{},release:async()=>{}})};
  const source={getMasterData:async()=>({projects:['現場']}),fetchExportItems:async()=>targets,fetchExportDraft:async()=>{reads++;return new Promise(r=>release=r);},generatePdf:async()=>{generated++;return new Blob();}};
  const tree=await mounted(source);let pending;await act(async()=>{pending=saveButton(tree).props.onClick();await Promise.resolve();});assert.equal(reads,1);
  await act(async()=>tree.unmount());await act(async()=>{release({data:{}});await pending;await new Promise(r=>setTimeout(r,10));});
  assert.equal(reads,1);assert.equal(generated,0);assert.equal(saved,0);
});
test('bulk unmount during current PDF generation stops saving it and never reads the next report',async()=>{
  let release,reads=0,generated=0,saved=0;
  globalThis.batchMocks={prepare:async()=>({mode:'folder',save:async()=>saved++,finish:async()=>null,dispose:async()=>{},release:async()=>{}})};
  const source={getMasterData:async()=>({projects:['現場']}),fetchExportItems:async()=>targets,fetchExportDraft:async()=>{reads++;return {data:{}};},generatePdf:async()=>{generated++;return new Promise(r=>release=r);}};
  const tree=await mounted(source);await act(async()=>saveButton(tree).props.onClick());await act(async()=>tree.unmount());
  await act(async()=>{release(new Blob());await new Promise(r=>setTimeout(r,10));});assert.equal(reads,1);assert.equal(generated,1);assert.equal(saved,0);
});
test('bulk permission-denied immediately stops further server reads and PDF generation',async()=>{
  let reads=0,generated=0;globalThis.batchMocks={prepare:async()=>({mode:'zip',save:async()=>{},finish:async()=>null,dispose:async()=>{},release:async()=>{}})};
  const tree=await mounted({getMasterData:async()=>({projects:['現場']}),fetchExportItems:async()=>targets,fetchExportDraft:async()=>{reads++;throw {code:'permission-denied'};},generatePdf:async()=>{generated++;return new Blob();}});
  await act(async()=>saveButton(tree).props.onClick());assert.equal(reads,1);assert.equal(generated,0);assert.ok(JSON.stringify(tree.toJSON()).includes('社員権限が変更'));await act(async()=>tree.unmount());
});
test('bulk UI retries only failed reports and preserves ZIP or folder mode',async()=>{
  for(const mode of ['zip','folder']){
    let first=true;const modes=[],generated=[];
    globalThis.batchMocks={prepare:async requested=>{modes.push(requested);return {mode,save:async()=>{},finish:async()=>null,dispose:async()=>{},release:async()=>{}};}};
    const tree=await mounted({getMasterData:async()=>({projects:['現場']}),fetchExportItems:async()=>targets,fetchExportDraft:async item=>({data:item}),generatePdf:async(_item,data)=>{generated.push(data.id);if(first){first=false;throw new Error('one report failed');}return new Blob();}});
    const initial=tree.root.findAllByType('button').find(x=>x.children.includes(mode==='zip'?'ZIPでダウンロード':'PDF一括保存'));
    await act(async()=>{initial.props.onClick();await new Promise(r=>setTimeout(r,30));});
    assert.deepEqual(generated,['0','1','2']);const retry=tree.root.findAllByType('button').find(x=>x.children.includes('失敗・未処理の'));
    assert.ok(retry);await act(async()=>{retry.props.onClick();await new Promise(r=>setTimeout(r,30));});
    assert.deepEqual(modes,[mode==='zip'?'zip':'auto',mode]);assert.deepEqual(generated,['0','1','2','0']);await act(async()=>tree.unmount());
  }
});
const Wizard=(await loadModule('src/components/NewcomerSurveyWizard.tsx',{
  firebaseService:'export const getMasterData=async()=>globalThis.wizardMaster;export const fetchEmployees=async()=>[];export const saveDraft=async()=>{};',
  publicNewcomerService:'export const newSubmissionId=()=>"id";export const submitPublicNewcomerSurvey=async()=>{};',
  PublicEmployeeAutofill:noop,SignatureCanvas:noop,NewcomerSurveyPrintLayout:noop,
  ReportPdfButton:'import React from "react";export default ()=>React.createElement("span",null,"STAFF-PDF");',
  'react-to-print':'export const useReactToPrint=()=>()=>{};',
})).default;
test('newcomer preview keeps staff individual PDF button out of the public QR preview',async()=>{
  globalThis.wizardMaster=INITIAL_MASTER_DATA;
  for(const isPublicEntry of [true,false]){let tree;await act(async()=>{tree=create(React.createElement(Wizard,{isPublicEntry,initialStep:99,initialData:INITIAL_NEWCOMER_SURVEY_REPORT,publicForm:{token:'token',project:'現場',director:'所長',contractorOptions:[]},onBackToMenu(){}}));});
    assert.equal(JSON.stringify(tree.toJSON()).includes('STAFF-PDF'),!isPublicEntry);await act(async()=>tree.unmount());}
});
