import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers.mjs';
import { INITIAL_NEWCOMER_SURVEY_REPORT } from '../src/types.ts';
const sdk = `export class Timestamp { constructor(n) { this.n=n; } toMillis(){ return this.n; } static now(){ return new Timestamp(42); } static fromMillis(n){ return new Timestamp(n); } }
export const doc=(db,name,id)=>({collection:name,id:id || 'allocated-id'}); export const collection=(db,name)=>({collection:name}); export const query=(ref,...args)=>({...ref,args}); export const orderBy=(...a)=>a; export const where=(...a)=>a; export const limit=n=>n;
export const serverTimestamp=()=> 'server-time';
export const getDocs=(ref)=>globalThis.sdkMock.getDocs(ref); export const getDoc=(ref)=>globalThis.sdkMock.getDoc(ref); export const getDocFromServer=(ref)=>globalThis.sdkMock.getDoc(ref);
export const setDoc=(ref,data,...args)=>globalThis.sdkMock.writes.push({op:'set',ref,data,args}); export const updateDoc=(ref,data)=>globalThis.sdkMock.writes.push({op:'update',ref,data}); export const deleteDoc=(ref)=>globalThis.sdkMock.writes.push({op:'delete',ref}); export const addDoc=(ref,data)=>{globalThis.sdkMock.writes.push({op:'add',ref,data});return {id:'legacy-new'};};
export const writeBatch=()=>{ const operations=[]; return {set(ref,data){operations.push({op:'set',ref,data});}, update(ref,data){operations.push({op:'update',ref,data});}, delete(ref){operations.push({op:'delete',ref});}, commit:async()=>globalThis.sdkMock.writes.push(...operations)}; };`;
const firebase = 'export const db={}; export const auth={currentUser:{uid:"issuer"}};';
const service = await loadModule('src/services/firebaseService.ts', { firebase, 'firebase/firestore': sdk });
const publicService = await loadModule('src/services/publicNewcomerService.ts', { firebase, 'firebase/firestore': sdk });
const record = (id, raw) => ({ id, data: () => raw });
const form = { token: '11111111-1111-4111-8111-111111111111', project: '現場', director: '所長', expiresAt: Date.now()+3600000, active: true, contractorOptions: ['会社'] };
test('staff list merges legacy and public data with unique IDs and timestamp order', async () => {
  const read = [];
  globalThis.sdkMock = { writes: [], async getDocs(ref) { read.push(ref.collection); return { docs: ref.collection === 'drafts' ? [record('same', { type: 'NEWCOMER_SURVEY', data: { company: '旧会社' }, lastModified: 1 }), record('diary', { type: 'DAILY_SAFETY', data: {}, lastModified: 2 })] : [record('same', { data: { company: '新会社', nameSei: '山田', nameMei: '太郎' }, lastModified: { toMillis: () => 3 } })] }; } };
  const result = await service.fetchDrafts(); assert.deepEqual(read, ['drafts','publicNewcomerSubmissions']); assert.deepEqual(result.map(x=>x.id), ['public-newcomer/same','diary','same']); assert.equal(result[0].data.company, '新会社');
});
test('existing saves stay in drafts; public staff edits/deletes preserve their source', async () => {
  globalThis.sdkMock = { writes: [] };
  await service.saveDraft(null, 'DAILY_SAFETY', { existing: true });
  await service.saveDraft('legacy', 'NEWCOMER_SURVEY', { old: true });
  await service.saveDraft('public-newcomer/new', 'NEWCOMER_SURVEY', { ...INITIAL_NEWCOMER_SURVEY_REPORT, company: '修正会社' });
  await service.removeDraft('public-newcomer/new'); await service.removeDraft('legacy');
  const writes = globalThis.sdkMock.writes;
  assert.deepEqual(writes.map(w=>w.ref.collection), ['drafts','drafts','publicNewcomerSubmissions','publicNewcomerSubmissions','drafts']);
  assert.equal(writes[2].op, 'update'); assert.equal(writes[2].data.createdAt, undefined); assert.equal(writes[2].data.token, undefined); assert.equal(writes[2].data.lastModified, 'server-time'); assert.equal(writes[1].data.data.old, true);
});
test('public submit writes only dedicated collection and never fetches private data or submitted document', async () => {
  globalThis.sdkMock = { writes: [], getDocs(){throw new Error('No lists allowed');}, getDoc(){throw new Error('No reads after submit');} };
  const id = publicService.newSubmissionId(); await publicService.submitPublicNewcomerSurvey(id, form, { ...INITIAL_NEWCOMER_SURVEY_REPORT, project: 'forged', director: 'forged', company: '会社', companyInputType: 'master' });
  assert.equal(globalThis.sdkMock.writes.length, 1); const write = globalThis.sdkMock.writes[0]; assert.equal(write.ref.collection, 'publicNewcomerSubmissions'); assert.equal(write.data.project, form.project); assert.equal(write.data.data.director, form.director); assert.equal(write.data.createdAt, 'server-time');
});
test('QR issue uses a random token, public company names only, and private issuer audit', async () => {
  globalThis.sdkMock = { writes: [] };
  const token = await publicService.issuePublicNewcomerForm('現場','所長',Date.now()+3600000,['会社','会社',' 他社 ']);
  assert.match(token,/^[0-9a-f-]{36}$/); const [config,audit] = globalThis.sdkMock.writes;
  assert.equal(config.ref.collection,'publicNewcomerForms'); assert.deepEqual(config.data.contractorOptions,['会社','他社']); assert.equal(config.data.createdBy,'staff'); assert.equal(audit.ref.collection,'publicNewcomerFormAudit'); assert.equal(audit.data.createdBy,'issuer'); assert.equal(config.data.uid,undefined);
});
test('public config retrieval does a server get only and rejects disabled or expired results', async () => {
  let reads=0; globalThis.sdkMock = { getDoc(ref){ reads++; assert.equal(ref.collection,'publicNewcomerForms');return {exists:()=>true,data:()=>({...form,createdAt:{toMillis:()=>1},expiresAt:{toMillis:()=>Date.now()+3600000}})}; } };
  assert.equal((await publicService.getPublicNewcomerForm(form.token)).project,form.project); assert.equal(reads,1);
  globalThis.sdkMock.getDoc=()=>({exists:()=>true,data:()=>({...form,active:false,createdAt:{toMillis:()=>1},expiresAt:{toMillis:()=>0}})});
  await assert.rejects(publicService.getPublicNewcomerForm(form.token)); await assert.rejects(publicService.getPublicNewcomerForm('invalid'));
});
test('server report adapter resolves both data sources without changing report IDs', async () => {
  const read=[];
  globalThis.sdkMock={getDoc(ref){read.push(ref.collection);return {id:ref.id,exists:()=>true,data:()=>({type:'NEWCOMER_SURVEY',data:{nameSei:'氏',nameMei:'名'},lastModified:7})};}};
  assert.equal((await service.getReportFromServer('old')).id,'old');
  assert.equal((await service.getReportFromServer('public-newcomer/new')).id,'public-newcomer/new');
  assert.deepEqual(read,['drafts','publicNewcomerSubmissions']);
});
test('explicit project deletion retires its QR first and pages public submissions before legacy deletion', async () => {
  const read=[];let publicPage=0;
  globalThis.sdkMock={writes:[],async getDocs(ref){read.push(ref);if(ref.collection==='publicNewcomerForms')return {docs:[{ref:{collection:ref.collection,id:'form'}}]};if(ref.collection==='publicNewcomerSubmissions'){publicPage++;return publicPage===1?{empty:false,docs:[{ref:{collection:ref.collection,id:'survey'}}]}:{empty:true,docs:[]};}return {forEach(){}};}};
  await service.deleteDraftsByProject('対象現場');
  assert.deepEqual(globalThis.sdkMock.writes.map(w=>[w.op,w.ref.collection]),[['update','publicNewcomerForms'],['delete','publicNewcomerSubmissions']]);
  assert.equal(globalThis.sdkMock.writes[0].data.active,false);
  assert.deepEqual(read.slice(0,3).map(r=>r.collection),['publicNewcomerForms','publicNewcomerSubmissions','publicNewcomerSubmissions']);
  assert.deepEqual(read[1].args,[['project','==','対象現場'],100]);
});
