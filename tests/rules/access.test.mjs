import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, collection, getDoc, getDocs, getDocsFromServer, getDocFromServer, query, where, orderBy, documentId, limit, setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, writeBatch, runTransaction, arrayUnion } from 'firebase/firestore';
import { INITIAL_NEWCOMER_SURVEY_REPORT } from '../../src/types.ts';
import { surveyPayload } from '../../src/utils/newcomerAccess.ts';

// Never silently point Rules tests at production.
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080') throw new Error('Run npm run test:rules (demo-core-safe local emulator only).');
const token = '11111111-1111-4111-8111-111111111111';
let env;
const config = () => ({ project: '現場A', director: '所長A', active: true, createdBy: 'staff', createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 3600000), contractorOptions: ['協力会社A'] });
const payload = () => ({ ...INITIAL_NEWCOMER_SURVEY_REPORT, project: '現場A', director: '所長A', company: '協力会社A', companyInputType: 'master', nameSei: '山田', nameMei: '太郎', birthYear: 10, birthMonth: 1, birthDay: 1, age: 28, experienceYears: 1, healthCheckYear: 8, healthCheckMonth: 1, signatureDataUrl: 'data:image/png;base64,YQ==' });
const submission = () => ({ type: 'NEWCOMER_SURVEY', token, project: '現場A', director: '所長A', company: '協力会社A', data: surveyPayload(payload()), createdAt: serverTimestamp(), lastModified: serverTimestamp() });
const anon = () => env.unauthenticatedContext().firestore();
const user = (uid = 'staff') => env.authenticatedContext(uid).firestore();
const send = (body = submission(), id = 'new', db = anon()) => setDoc(doc(db, 'publicNewcomerSubmissions', id), body);
test('integration export server queries/read deny anonymous and outsiders, allow staff, then deny revoked staff for both sources',async()=>{
  for(const [name,field] of [['drafts','data.project'],['publicNewcomerSubmissions','project']]){
    const page=db=>getDocsFromServer(query(collection(db,name),where(field,'==','現場A'),orderBy(documentId()),limit(25)));
    for(const db of [anon(),user('outsider')]){await assertFails(page(db));await assertFails(getDocFromServer(doc(db,name,'existing')));}
    const db=user();assert.equal((await assertSucceeds(page(db))).size,1);await assertSucceeds(getDocFromServer(doc(db,name,'existing')));
    await seed('staffUsers/staff',{active:false});await assertFails(page(db));await assertFails(getDocFromServer(doc(db,name,'existing')));
    await seed('staffUsers/staff',{active:true});
  }
});
const seed = async (path, data) => env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), path), data));
test('type-filtered report lists preserve staff-only access without a new composite query', async () => {
  const types = ['NEWCOMER_SURVEY','DAILY_SAFETY','SAFETY_TRAINING','DISASTER_COUNCIL','SAFETY_PLAN'];
  for (const type of types.slice(1)) await seed(`drafts/${type}`, { type, data: { project: '架空現場' }, lastModified: Timestamp.now() });
  const reads = db => [
    ...types.map(type => query(collection(db,'drafts'),where('type','==',type))),
    query(collection(db,'publicNewcomerSubmissions'),orderBy('lastModified','desc')),
  ];
  for (const db of [anon(),user('outsider')]) for (const q of reads(db)) await assertFails(getDocs(q));
  for (const q of reads(user())) assert.equal((await assertSucceeds(getDocs(q))).size, 1);
  await seed('staffUsers/staff',{active:false});
  for (const q of reads(user())) await assertFails(getDocs(q));
});
before(async () => {
  const rules = await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'demo-core-safe', firestore: { host: '127.0.0.1', port: 18080, rules } });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c => {
    const db = c.firestore(), batch = writeBatch(db);
    batch.set(doc(db, 'staffUsers/staff'), { active: true });
    batch.set(doc(db, 'staffUsers/disabled'), { active: false });
    batch.set(doc(db, `publicNewcomerForms/${token}`), config());
    batch.set(doc(db, 'masterData/general'), {contractors:['協力会社A'],supervisors:['PRIVATE']});
    batch.set(doc(db, 'publicNewcomerCompanyMaster/general'), {contractorOptions:['協力会社A']});
    for (const name of ['drafts','employees','masterData','diagramImages']) batch.set(doc(db, name, 'existing'), { type: 'NEWCOMER_SURVEY', data: payload(), lastModified: Timestamp.now() });
    batch.set(doc(db, 'publicNewcomerSubmissions/existing'), { ...submission(), createdAt: Timestamp.now(), lastModified: Timestamp.now() });
    await batch.commit();
  });
});

for (const uid of [null, 'outsider', 'staff']) test(`${uid ?? 'anonymous'} catch-all denies retired autofill collections and unrelated collections`, async () => {
  const db = uid ? user(uid) : anon();
  for (const name of ['employeeAutofillRateLimits', 'employeeAutofillMappings', 'unknownCollection']) {
    await seed(`${name}/existing`, { attempts: 1 });
    await assertFails(getDoc(doc(db, name, 'existing'))); await assertFails(getDocs(collection(db, name)));
    await assertFails(setDoc(doc(db, name, 'new'), { attempts: 0 })); await assertFails(updateDoc(doc(db, name, 'existing'), { attempts: 0 }));
    await assertFails(deleteDoc(doc(db, name, 'existing')));
  }
});

for (const name of ['drafts','employees','masterData','diagramImages','staffUsers','publicNewcomerFormAudit']) {
  test(`anonymous cannot get or list ${name}`, async () => { await assertFails(getDoc(doc(anon(), name, 'existing'))); await assertFails(getDocs(collection(anon(), name))); });
}
for (const uid of ['outsider','disabled']) {
  test(`${uid} cannot read internal data despite Authentication`, async () => { for (const name of ['drafts','employees','masterData','diagramImages','publicNewcomerSubmissions']) await assertFails(getDocs(collection(user(uid), name))); });
}
test('anonymous cannot create an internal draft', async () => { await assertFails(setDoc(doc(anon(), 'drafts/new'), { type: 'NEWCOMER_SURVEY', data: payload() })); });
test('active staff can use all internal collections', async () => { for (const name of ['drafts','employees','masterData','diagramImages']) { await assertSucceeds(getDocs(collection(user(), name))); await assertSucceeds(setDoc(doc(user(), name, 'new'), { value: 'staff edit' })); await assertSucceeds(deleteDoc(doc(user(), name, 'new'))); } });
test('users can check only their own staff permission and cannot self-promote', async () => { await assertFails(setDoc(doc(anon(), 'staffUsers/new'), { active: true })); await assertSucceeds(getDoc(doc(user('outsider'), 'staffUsers/outsider'))); await assertFails(getDoc(doc(user('outsider'), 'staffUsers/staff'))); for (const uid of ['outsider','disabled','staff']) { await assertFails(setDoc(doc(user(uid), 'staffUsers', uid), { active: true })); await assertFails(getDocs(collection(user(uid), 'staffUsers'))); } });
test('valid token permits one public config get but never list', async () => { const value = await assertSucceeds(getDoc(doc(anon(), 'publicNewcomerForms', token))); assert.equal(value.data().createdBy, 'staff'); await assertFails(getDocs(collection(anon(), 'publicNewcomerForms'))); });
test('invalid token cannot get config or submit', async () => { await assertFails(getDoc(doc(anon(), 'publicNewcomerForms/invalid'))); await assertFails(send({ ...submission(), token: 'invalid' })); });
test('disabled token cannot get config or submit', async () => { await seed(`publicNewcomerForms/${token}`, { ...config(), active: false }); await assertFails(getDoc(doc(anon(), 'publicNewcomerForms', token))); await assertFails(send()); });
test('expired token cannot get config or submit', async () => { await seed(`publicNewcomerForms/${token}`, { ...config(), expiresAt: Timestamp.fromMillis(Date.now() - 10000) }); await assertFails(getDoc(doc(anon(), 'publicNewcomerForms', token))); await assertFails(send()); });
test('valid public submission is create-only', async () => { await assertSucceeds(send()); await assertFails(getDoc(doc(anon(), 'publicNewcomerSubmissions/new'))); await assertFails(getDocs(collection(anon(), 'publicNewcomerSubmissions'))); await assertFails(updateDoc(doc(anon(), 'publicNewcomerSubmissions/new'), { company: 'changed' })); await assertFails(deleteDoc(doc(anon(), 'publicNewcomerSubmissions/new'))); await assertFails(send()); });
test('complete survey with all numeric fields and qualification checks passes evaluation limits', async () => {
  const body = submission();
  Object.assign(body.data, { birthYear: 10, birthMonth: 1, birthDay: 1, age: 28, experienceYears: 10, experienceMonths: 5, healthCheckYear: 8, healthCheckMonth: 10, healthCheckDay: 1, pledgeDateYear: 8, pledgeDateMonth: 10, pledgeDateDay: 7, companyInputType: 'other', address: '住所'.repeat(200), signatureDataUrl: 'data:image/png;base64,' + 'a'.repeat(490000) });
  for (const key of Object.keys(body.data.qualifications)) body.data.qualifications[key] = key.startsWith('otherText') ? '資格'.repeat(100) : true;
  await assertSucceeds(send(body));
});
for (const field of ['project','director']) {
  test(`token rejects forged ${field}`, async () => { const body = submission(); body[field] = '別現場'; body.data[field] = '別現場'; await assertFails(send(body)); });
}
test('master company must be in token options', async () => { const body = submission(); body.company = body.data.company = '未登録会社'; await assertFails(send(body)); });
test('an already-issued QR accepts companies added later after staff synchronize its options', async () => {
  await seed('masterData/general', { contractors:['協力会社A','追加会社'], supervisors:['PRIVATE'] });
  const body = submission(); body.company = body.data.company = '追加会社';
  await assertFails(send(body));
  await assertSucceeds(updateDoc(doc(user(),'publicNewcomerForms',token),{contractorOptions:['協力会社A','追加会社']}));
  const config = await assertSucceeds(getDocFromServer(doc(anon(),'publicNewcomerForms',token)));
  assert.deepEqual(config.data().contractorOptions,['協力会社A','追加会社']);
  assert.equal(config.data().supervisors,undefined);
  await assertSucceeds(send(body));
  await assertFails(getDoc(doc(anon(),'masterData/general')));
});
test('contractor synchronization is staff-only and can publish only the current company master', async () => {
  await seed('masterData/general',{contractors:['新会社'],supervisors:['PRIVATE']});
  for (const db of [anon(),user('outsider'),user('disabled')]) {
    await assertFails(updateDoc(doc(db,'publicNewcomerForms',token),{contractorOptions:['新会社']}));
  }
  await assertFails(updateDoc(doc(user(),'publicNewcomerForms',token),{contractorOptions:['勝手な会社']}));
  await assertSucceeds(updateDoc(doc(user(),'publicNewcomerForms',token),{contractorOptions:['新会社']}));
  await assertFails(updateDoc(doc(user(),'publicNewcomerForms',token),{contractorOptions:['新会社'],director:'別所長'}));
  await assertFails(updateDoc(doc(user(),'publicNewcomerForms',token),{contractorOptions:['新会社'],createdBy:'社員UID'}));
});
test('company master and published names can be changed atomically while preserving other master fields', async () => {
  await seed('masterData/general',{contractors:['協力会社A'],supervisors:['PRIVATE']});
  const db=user(), batch=writeBatch(db);
  batch.set(doc(db,'masterData/general'),{contractors:['名称変更会社']},{merge:true});
  batch.set(doc(db,'publicNewcomerCompanyMaster/general'),{contractorOptions:['名称変更会社']});
  batch.update(doc(db,'publicNewcomerForms',token),{contractorOptions:['名称変更会社']});
  await assertSucceeds(batch.commit());
  assert.deepEqual((await getDoc(doc(db,'masterData/general'))).data().supervisors,['PRIVATE']);
  const old=submission(); await assertFails(send(old));
  old.company=old.data.company='名称変更会社'; await assertSucceeds(send(old));
});
test('a full synchronization page of 100 QR updates stays within Rules transaction access limits', async () => {
  const tokens=Array.from({length:100},(_,i)=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`);
  await env.withSecurityRulesDisabled(async c=>{
    const db=c.firestore(),batch=writeBatch(db);
    batch.set(doc(db,'masterData/general'),{contractors:['追加会社']});
    for(const id of tokens)batch.set(doc(db,'publicNewcomerForms',id),config());
    await batch.commit();
  });
  const db=user();
  await assertSucceeds(runTransaction(db,async transaction=>{
    const master=await transaction.get(doc(db,'masterData/general'));
    const forms=await Promise.all(tokens.map(id=>transaction.get(doc(db,'publicNewcomerForms',id))));
    for(const form of forms)transaction.update(form.ref,{contractorOptions:master.data().contractors});
  }));
  const form=await assertSucceeds(getDoc(doc(anon(),'publicNewcomerForms',tokens.at(-1))));
  assert.deepEqual(form.data().contractorOptions,['追加会社']);
});
test('synchronizing company options never reactivates expired or revoked QR codes', async () => {
  await seed('masterData/general',{contractors:['新会社']});
  for (const patch of [{active:false},{expiresAt:Timestamp.fromMillis(0)}]) {
    await seed(`publicNewcomerForms/${token}`,{...config(),...patch});
    await assertSucceeds(updateDoc(doc(user(),'publicNewcomerForms',token),{contractorOptions:['新会社']}));
    await assertFails(getDoc(doc(anon(),'publicNewcomerForms',token)));
    const body=submission();body.company=body.data.company='新会社';await assertFails(send(body));
  }
});
test('other company accepts bounded free text', async () => { const body = submission(); body.company = body.data.company = '手入力会社'; body.data.companyInputType = 'other'; await assertSucceeds(send(body)); });
const registerCompany = (id, company='手入力会社', options={}) => {
  const db=anon(),batch=writeBatch(db),body=submission();
  body.company=body.data.company=company;body.data.companyInputType='other';
  if(options.invalid)body.data.signatureDataUrl='invalid';
  batch.set(doc(db,'publicNewcomerSubmissions',id),body);
  batch.set(doc(db,'masterData/general'),{contractors:arrayUnion(company),lastPublicCompanySubmission:id,...options.master},{merge:true});
  batch.set(doc(db,'publicNewcomerCompanyMaster/general'),{contractorOptions:arrayUnion(options.publicCompany || company)},{merge:true});
  return batch.commit();
};
test('public other-company submission registers the name atomically without any private master read', async () => {
  await assertSucceeds(registerCompany('auto-added'));
  const master=(await getDoc(doc(user(),'masterData/general'))).data();
  assert.deepEqual(master.contractors,['協力会社A','手入力会社']);assert.deepEqual(master.supervisors,['PRIVATE']);
  const publicNames=(await assertSucceeds(getDoc(doc(anon(),'publicNewcomerCompanyMaster/general')))).data();
  assert.deepEqual(publicNames,{contractorOptions:['協力会社A','手入力会社']});
  const next=submission();next.company=next.data.company='手入力会社';
  await assertSucceeds(send(next,'next-worker'));
  await assertFails(getDoc(doc(anon(),'masterData/general')));
  await assertFails(getDocs(collection(anon(),'publicNewcomerCompanyMaster')));
  await assertFails(getDoc(doc(anon(),'publicNewcomerCompanyMaster/other')));
});
test('simultaneous same-company and different-company submissions preserve all names without duplicates', async () => {
  await Promise.all([assertSucceeds(registerCompany('same-1')),assertSucceeds(registerCompany('same-2')),assertSucceeds(registerCompany('different','別会社'))]);
  const master=(await getDoc(doc(user(),'masterData/general'))).data().contractors;
  const names=(await getDoc(doc(anon(),'publicNewcomerCompanyMaster/general'))).data().contractorOptions;
  assert.equal(master.length,3);assert.deepEqual(new Set(master),new Set(['協力会社A','手入力会社','別会社']));
  assert.deepEqual(names,master);
});
test('invalid or mismatched registrations cannot save either the answer or company', async () => {
  for(const [id,options] of [['bad-survey',{invalid:true}],['bad-company',{publicCompany:'異なる会社'}],['private-field',{master:{supervisors:['INJECTED']}}],['replace-list',{master:{contractors:['手入力会社']}}]]){
    await assertFails(registerCompany(id,'手入力会社',options));
    assert.equal((await getDoc(doc(user(),'publicNewcomerSubmissions',id))).exists(),false);
    assert.deepEqual((await getDoc(doc(user(),'masterData/general'))).data().contractors,['協力会社A']);
  }
});
test('public registration cannot replay an old answer or append without a new valid answer', async () => {
  await assertSucceeds(registerCompany('once'));
  await assertFails(registerCompany('once'));
  const db=anon(),batch=writeBatch(db);
  batch.set(doc(db,'masterData/general'),{contractors:arrayUnion('偽会社'),lastPublicCompanySubmission:'once'},{merge:true});
  batch.set(doc(db,'publicNewcomerCompanyMaster/general'),{contractorOptions:arrayUnion('偽会社')},{merge:true});
  await assertFails(batch.commit());
  await assertFails(updateDoc(doc(db,'masterData/general'),{contractors:arrayUnion('偽会社'),lastPublicCompanySubmission:'missing'}));
});
test('expired or disabled QR never adds a company, and company capacity failure rolls back its answer', async () => {
  for(const [id,patch] of [['disabled-auto',{active:false}],['expired-auto',{expiresAt:Timestamp.fromMillis(0)}]]){
    await seed(`publicNewcomerForms/${token}`,{...config(),...patch});
    await assertFails(registerCompany(id));
    assert.equal((await getDoc(doc(user(),'publicNewcomerSubmissions',id))).exists(),false);
  }
  await seed(`publicNewcomerForms/${token}`,config());
  const companies=Array.from({length:300},(_,i)=>`会社${i}`);
  await seed('masterData/general',{contractors:companies,supervisors:['PRIVATE']});
  await seed('publicNewcomerCompanyMaster/general',{contractorOptions:companies});
  await assertFails(registerCompany('over-capacity'));
  assert.equal((await getDoc(doc(user(),'publicNewcomerSubmissions/over-capacity'))).exists(),false);
  assert.equal((await getDoc(doc(user(),'masterData/general'))).data().contractors.length,300);
});
test('company-only public projection rejects other master fields and arbitrary list changes', async () => {
  for(const db of [anon(),user('outsider'),user()]){
    await assertFails(setDoc(doc(db,'publicNewcomerCompanyMaster/general'),{contractorOptions:['協力会社A'],supervisors:['PRIVATE']}));
    await assertFails(setDoc(doc(db,'publicNewcomerCompanyMaster/general'),{contractorOptions:['偽会社']}));
  }
  await assertFails(deleteDoc(doc(anon(),'publicNewcomerCompanyMaster/general')));
});
for (const company of ['', 'x'.repeat(201)]) test(`empty/oversized company (${company.length}) is denied`, async () => { const body = submission(); body.company = body.data.company = company; body.data.companyInputType = 'other'; await assertFails(send(body)); });
test('extra administrative fields cannot be injected', async () => { await assertFails(send({ ...submission(), active: true })); const body = submission(); body.data.employeeId = 'secret'; await assertFails(send(body)); });
test('invalid type and past client-created timestamp are rejected', async () => { await assertFails(send({ ...submission(), type: 'DAILY_SAFETY' })); await assertFails(send({ ...submission(), createdAt: Timestamp.fromMillis(0) })); });
test('invalid payload types / signature size / qualifications fields are rejected', async () => { for (const patch of [{ address: 123 }, { age: 121 }, { signatureDataUrl: 'data:image/png;base64,' + 'a'.repeat(500001) }, { qualifications: { ...payload().qualifications, employeeId: 'private' } }]) { const body = submission(); Object.assign(body.data, patch); await assertFails(send(body)); } });
test('anonymous cannot create or modify QR settings', async () => { await assertFails(setDoc(doc(anon(), 'publicNewcomerForms/new'), config())); await assertFails(updateDoc(doc(anon(), 'publicNewcomerForms', token), { active: false })); });
test('staff issues config and private audit atomically, then deactivates', async () => { const nextToken = '22222222-2222-4222-8222-222222222222'; const db = user(), batch = writeBatch(db); batch.set(doc(db, 'publicNewcomerForms', nextToken), { ...config(), createdAt: serverTimestamp() }); batch.set(doc(db, 'publicNewcomerFormAudit', nextToken), { createdBy: 'staff', createdAt: serverTimestamp() }); await assertSucceeds(batch.commit()); await assertSucceeds(updateDoc(doc(db, 'publicNewcomerForms', nextToken), { active: false })); await assertFails(getDoc(doc(anon(), 'publicNewcomerForms', nextToken))); });
test('expired QR can still be deactivated by staff', async () => { await seed(`publicNewcomerForms/${token}`, { ...config(), expiresAt: Timestamp.fromMillis(0) }); await assertSucceeds(updateDoc(doc(user(), 'publicNewcomerForms', token), { active: false })); });
test('QR config excludes private fields and missing expiry even with a valid issuance audit', async () => {
  const nextToken = '22222222-2222-4222-8222-222222222222';
  for (const patch of [{ employeeId: 'private' }, { expiresAt: null }, { createdBy: 'real-uid' }]) {
    const db = user(), batch = writeBatch(db);
    batch.set(doc(db, 'publicNewcomerForms', nextToken), { ...config(), createdAt: serverTimestamp(), ...patch });
    batch.set(doc(db, 'publicNewcomerFormAudit', nextToken), { createdBy: 'staff', createdAt: serverTimestamp() });
    await assertFails(batch.commit());
  }
  await assertFails(updateDoc(doc(user(), 'publicNewcomerForms', token), { project: '別現場' }));
});
test('unlisted Auth user cannot list or issue QR; staff cannot forge issuer audit', async () => {
  await assertFails(getDocs(collection(user('outsider'), 'publicNewcomerForms')));
  const nextToken = '22222222-2222-4222-8222-222222222222';
  for (const uid of ['staff','outsider']) { const db = user(uid), batch = writeBatch(db); batch.set(doc(db, 'publicNewcomerForms', nextToken), { ...config(), createdAt: serverTimestamp() }); batch.set(doc(db, 'publicNewcomerFormAudit', nextToken), { createdBy: 'wrong-issuer', createdAt: serverTimestamp() }); await assertFails(batch.commit()); }
});
test('staff reads both sources and edits public submissions after QR expiry', async () => { await assertSucceeds(getDocs(collection(user(), 'drafts'))); await assertSucceeds(getDocs(collection(user(), 'publicNewcomerSubmissions'))); await seed(`publicNewcomerForms/${token}`, { ...config(), active: false }); const changed = surveyPayload({ ...payload(), address: '社員修正' }); await assertSucceeds(updateDoc(doc(user(), 'publicNewcomerSubmissions/existing'), { data: changed, lastModified: serverTimestamp() })); await assertFails(updateDoc(doc(user(), 'publicNewcomerSubmissions/existing'), { createdAt: Timestamp.fromMillis(0), lastModified: serverTimestamp() })); });
