import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers.mjs';
import { INITIAL_NEWCOMER_SURVEY_REPORT } from '../src/types.ts';
const sdk = `export class Timestamp { constructor(n) { this.n=n; } toMillis(){ return this.n; } static now(){ return new Timestamp(42); } static fromMillis(n){ return new Timestamp(n); } }
export const doc=(db,name,id)=>({collection:name,id:id || 'allocated-id'}); export const collection=(db,name)=>({collection:name}); export const query=(ref,...args)=>({...ref,args}); export const orderBy=(...a)=>a; export const where=(...a)=>a; export const limit=n=>n;
export const serverTimestamp=()=> 'server-time';
export const documentId=()=> '__name__'; export const startAfter=x=>x; export const getDocsFromServer=(ref)=>globalThis.sdkMock.getDocs(ref);
export const getDocs=(ref)=>globalThis.sdkMock.getDocs(ref); export const getDoc=(ref)=>globalThis.sdkMock.getDoc(ref); export const getDocFromServer=(ref)=>globalThis.sdkMock.getDoc(ref);
export const setDoc=(ref,data,...args)=>globalThis.sdkMock.writes.push({op:'set',ref,data,args}); export const updateDoc=(ref,data)=>globalThis.sdkMock.writes.push({op:'update',ref,data}); export const deleteDoc=(ref)=>globalThis.sdkMock.writes.push({op:'delete',ref}); export const addDoc=(ref,data)=>{globalThis.sdkMock.writes.push({op:'add',ref,data});return {id:'legacy-new'};};
export const runTransaction=async(db,callback)=>{ const operations=[]; const result=await callback({get:ref=>globalThis.sdkMock.getDoc(ref),set(ref,data,...args){operations.push({op:'set',ref,data,args});},update(ref,data){operations.push({op:'update',ref,data});}});globalThis.sdkMock.writes.push(...operations);return result; };
export const writeBatch=()=>{ const operations=[]; return {set(ref,data){operations.push({op:'set',ref,data});}, update(ref,data){operations.push({op:'update',ref,data});}, delete(ref){operations.push({op:'delete',ref});}, commit:async()=>globalThis.sdkMock.writes.push(...operations)}; };`;
const firebase = 'export const db={}; export const auth={currentUser:{uid:"issuer"}};';
const service = await loadModule('src/services/firebaseService.ts', { firebase, 'firebase/firestore': sdk });
const publicService = await loadModule('src/services/publicNewcomerService.ts', { firebase, 'firebase/firestore': sdk });
const record = (id, raw) => ({ id, data: () => raw });
const form = { token: '11111111-1111-4111-8111-111111111111', project: '現場', director: '所長', expiresAt: Date.now()+3600000, active: true, contractorOptions: ['会社'] };
const organizationMasterFields = ['projects', 'supervisors', 'workplaces', 'contractors', 'locations'];

test('missing staff master uses empty organization choices and generic templates without initializing Firestore', async () => {
  const reads = [];
  globalThis.sdkMock = { writes: [], getDoc(ref) { reads.push(ref); return { exists: () => false }; } };
  const master = await service.getMasterData();
  assert.deepEqual(reads, [{ collection: 'masterData', id: 'general' }]);
  for (const field of organizationMasterFields) assert.deepEqual(master[field], []);
  for (const value of Object.values(master)) assert.ok(Array.isArray(value));
  for (const field of ['roles', 'topics', 'jobTypes', 'goals', 'predictions', 'countermeasures']) assert.ok(master[field].length > 0);
  assert.deepEqual(globalThis.sdkMock.writes, []);
});

test('partial staff master falls back safely without replacing explicitly empty saved templates', async () => {
  globalThis.sdkMock = { writes: [], getDoc() { return { exists: () => true, data: () => ({ topics: [], goals: [], locations: ['架空会議室'] }) }; } };
  const master = await service.getMasterData();
  for (const field of organizationMasterFields.filter(field => field !== 'locations')) assert.deepEqual(master[field], []);
  assert.deepEqual(master.locations, ['架空会議室']);
  assert.deepEqual(master.topics, []); assert.deepEqual(master.goals, []);
  for (const value of Object.values(master)) assert.ok(Array.isArray(value));
  assert.deepEqual(globalThis.sdkMock.writes, []);
});

test('saved staff organization choices take priority and field registration preserves other master fields', async () => {
  const stored = { projects: ['架空工事'], supervisors: ['架空所長'], workplaces: ['架空作業所'], contractors: ['架空会社'], locations: ['架空場所'] };
  globalThis.sdkMock = { writes: [], getDoc() { return { exists: () => true, data: () => stored }; } };
  const master = await service.getMasterData();
  for (const field of organizationMasterFields) assert.deepEqual(master[field], stored[field]);
  assert.deepEqual(globalThis.sdkMock.writes, []);
  await service.saveMasterDataField('projects', ['追加の架空工事']);
  assert.deepEqual(globalThis.sdkMock.writes, [{ op: 'set', ref: { collection: 'masterData', id: 'general' }, data: { projects: ['追加の架空工事'] }, args: [{ merge: true }] }]);
});

test('staff list merges legacy and public data with unique IDs and timestamp order', async () => {
  const read = [];
  globalThis.sdkMock = { writes: [], async getDocs(ref) { read.push(ref.collection); return { docs: ref.collection === 'drafts' ? [record('same', { type: 'NEWCOMER_SURVEY', data: { company: '旧会社' }, lastModified: 1 }), record('diary', { type: 'DAILY_SAFETY', data: {}, lastModified: 2 })] : [record('same', { data: { company: '新会社', nameSei: '山田', nameMei: '太郎' }, lastModified: { toMillis: () => 3 } })] }; } };
  const result = await service.fetchDrafts(); assert.deepEqual(read, ['drafts','publicNewcomerSubmissions']); assert.deepEqual(result.map(x=>x.id), ['public-newcomer/same','diary','same']); assert.equal(result[0].data.company, '新会社');
});

for (const type of ['DAILY_SAFETY','SAFETY_TRAINING','DISASTER_COUNCIL','SAFETY_PLAN','NEWCOMER_SURVEY']) test(`report list queries only ${type} and reads public submissions only for newcomer surveys`, async () => {
  const reads = [];
  globalThis.sdkMock = { writes: [], async getDocs(ref) {
    reads.push(ref);
    return { docs: ref.collection === 'drafts'
      ? [record('old', { type, data: { project: '架空現場' }, lastModified: 1 }), record('recent', { type, data: { project: '架空現場' }, lastModified: 3 })]
      : [record('submitted', { type: 'NEWCOMER_SURVEY', data: { project: '架空現場', nameSei: '架空', nameMei: '作業員' }, lastModified: { toMillis: () => 2 } })] };
  } };
  const result = await service.fetchDrafts(type);
  assert.deepEqual(reads[0], { collection: 'drafts', args: [['type','==',type]] }, 'single-field equality needs no new composite index');
  assert.deepEqual(reads.map(r => r.collection), type === 'NEWCOMER_SURVEY' ? ['drafts','publicNewcomerSubmissions'] : ['drafts']);
  assert.deepEqual(result.map(d => d.id), type === 'NEWCOMER_SURVEY' ? ['recent','public-newcomer/submitted','old'] : ['recent','old']);
  assert.deepEqual(globalThis.sdkMock.writes, []);
});

test('safety plan attachment lookup filters its type before retaining the requested project', async () => {
  const reads = [];
  globalThis.sdkMock = { writes: [], async getDocs(ref) {
    reads.push(ref);
    return { docs: ['架空現場','架空別現場'].map((project, i) => record(String(i), { type: 'SAFETY_PLAN', data: { project }, lastModified: i })) };
  } };
  const result = await service.fetchSafetyPlansByProject('架空現場');
  assert.deepEqual(reads, [{ collection: 'drafts', args: [['type','==','SAFETY_PLAN']] }]);
  assert.deepEqual(result.map(d => d.id), ['0']);
});

test('filtered list errors propagate; an unrelated public collection is never awaited for diaries', async () => {
  const reads = [];
  globalThis.sdkMock = { writes: [], async getDocs(ref) {
    reads.push(ref.collection);
    if (ref.collection !== 'drafts') throw Error('Unrelated public query');
    return { docs: [] };
  } };
  assert.deepEqual(await service.fetchDrafts('DAILY_SAFETY'), []);
  assert.deepEqual(reads, ['drafts']);
  const denied = Object.assign(new Error('Denied'), { code: 'permission-denied' });
  globalThis.sdkMock.getDocs = async () => { throw denied; };
  await assert.rejects(service.fetchDrafts('DAILY_SAFETY'), denied);
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
  globalThis.sdkMock = { writes: [], getDoc(ref) { assert.equal(ref.collection, 'masterData'); return { data: () => ({ contractors: ['会社','会社',' 他社 '], employees: ['private'] }) }; } };
  const token = await publicService.issuePublicNewcomerForm('現場','所長',Date.now()+3600000);
  assert.match(token,/^[0-9a-f-]{36}$/); const [config,audit] = globalThis.sdkMock.writes;
  assert.equal(config.ref.collection,'publicNewcomerForms'); assert.deepEqual(config.data.contractorOptions,['会社','他社']); assert.equal(config.data.createdBy,'staff'); assert.equal(audit.ref.collection,'publicNewcomerFormAudit'); assert.equal(audit.data.createdBy,'issuer'); assert.equal(config.data.uid,undefined);
});

const syncFixture = (count = 2) => {
  const state = { writes: [], reads: [], contractors: ['会社', '追加会社'], forms: Array.from({length:count}, (_, i) => ({
    ...form, token:String(i).padStart(4, '0'), contractorOptions:['会社'],
    createdAt:{toMillis:()=>1}, expiresAt:{toMillis:()=>Date.now()+3600000},
  })) };
  const snapshot = raw => ({ id:raw.token, ref:{collection:'publicNewcomerForms',id:raw.token}, exists:()=>true, data:()=>raw });
  state.getDoc = ref => {
    state.reads.push(ref);
    if(ref.collection === 'masterData') return { exists:()=>true, data:()=>({contractors:state.contractors, supervisors:['private']}) };
    return snapshot(state.forms.find(f => f.token === ref.id));
  };
  state.getDocs = ref => {
    state.reads.push(ref);
    const after = ref.args.length > 3 ? ref.args.at(-1).id : '';
    const docs = state.forms.filter(f => f.active && f.token > after).slice(0,100).map(snapshot);
    return {docs, size:docs.length, empty:!docs.length};
  };
  return globalThis.sdkMock = state;
};
test('master additions synchronize every existing live QR without changing token or site settings', async () => {
  const state = syncFixture();
  await service.saveMasterDataField('contractors', ['会社', '追加会社']);
  const [master, ...updates] = state.writes;
  assert.deepEqual(master.data, {contractors:['会社','追加会社']});
  assert.equal(updates.length,2);
  for (const write of updates) { assert.equal(write.ref.collection,'publicNewcomerForms'); assert.deepEqual(write.data,{contractorOptions:['会社','追加会社']}); }
  assert.ok(!JSON.stringify(updates).includes('private'));
});
test('QR manager reconciliation repairs existing snapshots, skips current, revoked and expired forms, and removes renamed/deleted options', async () => {
  const state = syncFixture(5); state.contractors = ['名称変更会社'];
  state.forms[1].contractorOptions = ['名称変更会社'];
  state.forms[2].active = false;
  state.forms[3].expiresAt = {toMillis:()=>0};
  // A concurrent revocation after the query must be checked inside the transaction.
  const read = state.getDoc;
  state.getDoc = ref => { if (ref.id === '0004') state.forms[4].active=false; return read(ref); };
  await publicService.syncPublicNewcomerContractors();
  assert.deepEqual(state.writes, [{op:'update',ref:{collection:'publicNewcomerForms',id:'0000'},data:{contractorOptions:['名称変更会社']}}]);
});
test('synchronization pages more than 100 QR settings and reads the newest master for each page', async () => {
  const state = syncFixture(201);
  const query = state.getDocs;
  state.getDocs = ref => { if (ref.args.length > 3) state.contractors=['さらに追加']; return query(ref); };
  await publicService.syncPublicNewcomerContractors();
  assert.equal(state.writes.length,201);
  assert.deepEqual(state.writes[0].data.contractorOptions,['会社','追加会社']);
  assert.deepEqual(state.writes[100].data.contractorOptions,['さらに追加']);
  assert.deepEqual(state.writes[200].data.contractorOptions,['さらに追加']);
  assert.equal(state.reads.filter(r=>r.collection === 'publicNewcomerForms' && r.args).length,3);
});
test('failed QR synchronization reports that the master was saved and can be retried', async () => {
  const state = syncFixture(); const read = state.getDocs;
  state.getDocs = () => { throw Error('permission-denied'); };
  await assert.rejects(service.saveMasterDataField('contractors',state.contractors), /会社マスターは保存しましたが/);
  assert.equal(state.writes.length,1);
  state.getDocs = read;
  await publicService.syncPublicNewcomerContractors();
  assert.equal(state.writes.length,3);
});
test('company validation happens before overwriting the master and an empty master clears live QR options', async () => {
  const state = syncFixture();
  await assert.rejects(service.saveMasterDataField('contractors',['a'.repeat(201)]), /200文字/);
  await assert.rejects(service.saveMasterDataField('contractors',Array.from({length:301},(_,i)=>String(i))), /300件/);
  assert.equal(state.writes.length,0);
  state.contractors=[];
  await publicService.syncPublicNewcomerContractors();
  assert.ok(state.writes.every(w=>w.data.contractorOptions.length === 0));
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
