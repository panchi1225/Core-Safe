import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadModule } from './helpers.mjs';
import { loadModule as loadBundled } from './loadModule.mjs';
import { INITIAL_NEWCOMER_SURVEY_REPORT } from '../src/types.ts';
const service = await loadBundled('src/services/firebaseService.ts', [{ name:'integration-sdk', setup(b) {
  b.onResolve({filter:/^firebase\/firestore$/},()=>({path:path.resolve('tests/firestoreStub.mjs')}));
  b.onResolve({filter:/^\.\.\/firebase$/},()=>({path:'firebase',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const db={}; export const auth={};'}));
} }]);
const {runBatch,fileName} = await loadModule('src/utils/bulkReports.ts');
const conditions={project:'現場A',start:'2026-10-01',end:'2026-10-31',types:['NEWCOMER_SURVEY']};
const data=()=>({...structuredClone(INITIAL_NEWCOMER_SURVEY_REPORT),project:'現場A',director:'所長',company:'公開会社',nameSei:'山田',nameMei:'太郎',birthYear:7,birthMonth:1,birthDay:1,address:'架空住所',healthCheckYear:8,healthCheckMonth:1,qualifications:{...INITIAL_NEWCOMER_SURVEY_REPORT.qualifications,electrician:true},pledgeDateYear:8,pledgeDateMonth:10,pledgeDateDay:1,signatureDataUrl:'data:image/png;base64,YQ=='});
function fixture(old=10,modern=8) {
  return globalThis.__firestoreFixture={calls:[],records:Array.from({length:old},(_,i)=>({id:String(i).padStart(3,'0'),type:'NEWCOMER_SURVEY',data:data(),lastModified:100})),
    publicRecords:Array.from({length:modern},(_,i)=>({id:String(i).padStart(3,'0'),type:'NEWCOMER_SURVEY',project:'現場A',data:data(),lastModified:100}))};
}
test('integration count includes 10 legacy + 8 public surveys, with distinct namespaces and collection-specific project queries',async()=>{
  const f=fixture(),items=await service.fetchExportItems(conditions);
  assert.equal(items.length,18);assert.equal(new Set(items.map(x=>x.id)).size,18);
  assert.equal(items.filter(x=>x.id.startsWith('public-newcomer/')).length,8);
  assert.deepEqual(f.calls.map(q=>[q.name,q.constraints[0].field,q.constraints[0].value]),[['drafts','data.project','現場A'],['publicNewcomerSubmissions','project','現場A']]);
  for(const q of f.calls){assert.equal(q.constraints.find(c=>c.kind==='limit').value,25);assert.equal(q.constraints.find(c=>c.kind==='order').field,'__name__');}
});
test('integration pagination has independent cursors per source and retains no report body',async()=>{
  const f=fixture(30,30),items=await service.fetchExportItems(conditions);assert.equal(items.length,60);
  assert.deepEqual(f.calls.map(q=>q.name),['drafts','drafts','publicNewcomerSubmissions','publicNewcomerSubmissions']);
  assert.equal(f.calls[2].constraints.some(c=>c.kind==='cursor'),false);assert.ok(items.every(x=>!('data' in x)));
});
test('integration filters project, period, and type for both survey sources; safety plan is excluded',async()=>{
  const f=fixture(3,3);f.records[1].data.project='現場B';f.publicRecords[1].project='現場B';f.publicRecords[1].data.project='現場B';
  f.records[2].data.pledgeDateMonth=9;f.publicRecords[2].data.pledgeDateMonth=9;
  f.records.push({id:'diary',type:'DAILY_SAFETY',data:{project:'現場A',workDate:'2026-10-01'},lastModified:100},{id:'plan',type:'SAFETY_PLAN',data:{project:'現場A',date:'2026-10-01'},lastModified:100});
  assert.deepEqual((await service.fetchExportItems(conditions)).map(x=>x.id),['000','public-newcomer/000']);
  assert.deepEqual((await service.fetchExportItems({...conditions,types:['DAILY_SAFETY']})).map(x=>x.id),['diary']);
});
test('integration generation re-reads each source from server and detects public changes and deletion',async()=>{
  const f=fixture(1,1),items=await service.fetchExportItems(conditions);
  for(const item of items)assert.equal((await service.fetchExportDraft(item,conditions)).id,item.id);
  assert.deepEqual(f.reads.map(x=>x.name),['drafts','publicNewcomerSubmissions']);
  const item=items[1],raw=f.publicRecords[0];
  for(const change of [()=>raw.lastModified++,()=>raw.data.pledgeDateDay++,()=>raw.data.nameMei='次郎',()=>raw.data.project='現場B',()=>raw.type='DAILY_SAFETY']){
    const saved=structuredClone(raw);change();await assert.rejects(service.fetchExportDraft(item,conditions),/変更/);Object.assign(raw,saved);
  }
  f.publicRecords=[];
  const generated=[];const result=await runBatch([item,items[0]],async x=>{const d=await service.fetchExportDraft(x,conditions);generated.push(d.id);},()=>{});
  assert.equal(result.failures.length,1);assert.match(result.failures[0].message,/削除/);assert.equal(result.succeeded,1);assert.deepEqual(generated,['000']);
});
test('integration abort after public server read prevents another read',async()=>{
  const f=fixture(0,1),[item]=await service.fetchExportItems(conditions),c=new AbortController();c.abort();
  await assert.rejects(service.fetchExportDraft(item,conditions,c.signal),{name:'AbortError'});assert.equal(f.reads,undefined);
});
test('legacy and public survey use exactly the same PDF layout including company, signature and qualification',async()=>{
  const f=fixture(1,1),items=await service.fetchExportItems(conditions);
  const pdf = await loadModule('src/services/reportPdf.tsx', {
    html2canvas:'export default ()=>{};',jspdf:'export const jsPDF=()=>{};',
    'react-dom/client':'export const createRoot=()=>{};', 'react-dom':'export const flushSync=()=>{};',
    '../styles/pdf.css?inline':'export default "";',
  });
  const drafts=await Promise.all(items.map(x=>service.fetchExportDraft(x,conditions)));
  const html=drafts.map(d=>renderToStaticMarkup(pdf.reportLayout('NEWCOMER_SURVEY',d.data)));
  assert.equal(html[0],html[1]);for(const text of ['公開会社','山田','架空住所','data:image/png;base64,YQ==','資格'])assert.ok(html[1].includes(text),text);
  assert.equal(fileName(items[0]),fileName(items[1]));
});
