import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { AUTOFILL_FIELDS } from '../../lib/autofillData.js';
import { createAutofillService, RATE_COLLECTION } from '../../lib/autofillService.js';
import { secretKey } from '../../lib/opaqueEmployeeId.js';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:18080'||process.env.GCLOUD_PROJECT!=='demo-core-safe') throw new Error('Local demo emulator only.');
const app=initializeApp({projectId:'demo-core-safe'}), db=getFirestore(app);
const token='11111111-1111-4111-8111-111111111111';
const second='22222222-2222-4222-8222-222222222222';
const employee={nameSei:'山田',nameMei:'太郎',furiganaSei:'ヤマダ',furiganaMei:'タロウ',birthEra:'Heisei',birthYear:7,birthMonth:1,birthDay:1,gender:'Male',address:'本人だけの住所',phone:'000-0000',emergencyContactSei:'山田',emergencyContactMei:'家族',emergencyContactRelation:'家族',emergencyContactPhone:'000',bloodType:'A',bloodTypeRh:'Plus',healthCheckYear:8,healthCheckMonth:1,healthCheckDay:1,jobType:'オペ',experienceYears:10,experienceMonths:5,qualifications:{slinging:true,electrician:true,otherText1:'資格',sealImage:'SECRET'},sealImage:'PRIVATE-ELECTRONIC-SEAL',employeeNumber:'社員番号0001',auth:'PRIVATE-AUTH'};
const form=()=>({project:'現場A',director:'所長A',active:true,createdAt:Timestamp.now(),createdBy:'staff',expiresAt:Timestamp.fromMillis(Date.now()+3600000),contractorOptions:['協力会社']});
async function call(name,data){
  const response=await fetch(`http://127.0.0.1:15001/demo-core-safe/asia-northeast1/${name}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data})});
  return response.json();
}
const list=(t=token)=>call('listPublicEmployeeCandidates',{token:t});
const verify=(id,birthDate='19950101',t=token)=>call('verifyEmployeeAutofill',{token:t,employeePublicId:id,birthDate});
async function candidate(){ const result=await list(); assert.ok(Array.isArray(result.result),JSON.stringify(result)); return result.result.find(x=>x.displayName==='山田 太郎').employeePublicId; }
before(async()=>{ await db.doc('publicNewcomerForms/ready').get(); });
after(async()=>{ await db.terminate(); await deleteApp(app); });
beforeEach(async()=>{
  const cleared=await fetch('http://127.0.0.1:18080/emulator/v1/projects/demo-core-safe/databases/(default)/documents',{method:'DELETE'}); assert.ok(cleared.ok);
  const batch=db.batch(); batch.set(db.doc(`publicNewcomerForms/${token}`),form()); batch.set(db.doc(`publicNewcomerForms/${second}`),form());
  batch.set(db.doc('employees/社員番号0001'),employee);
  batch.set(db.doc('employees/other-employee'),{...employee,nameSei:'鈴木',nameMei:'次郎',address:'OTHER-PERSON-ADDRESS',birthEra:'Showa',birthYear:62,birthMonth:12,birthDay:5});
  batch.set(db.doc('employees/disabled'),{...employee,active:false}); await batch.commit();
});
test('callable candidate list returns only opaque ID and display name, without other personal data',async()=>{
  const result=await list(); assert.equal(result.result.length,2);
  for(const item of result.result) assert.deepEqual(Object.keys(item).sort(),['displayName','employeePublicId']);
  const json=JSON.stringify(result); for(const secret of ['birthDate','birthYear','19950101','address','phone','bloodType','healthCheck','qualifications','sealImage','PRIVATE','社員番号0001']) assert.ok(!json.includes(secret),secret);
});
for(const [label,patch,t]of [['invalid',null,'invalid'],['nonexistent',null,'33333333-3333-4333-8333-333333333333'],['disabled',{active:false},token],['expired',{expiresAt:Timestamp.fromMillis(0)},token]])
  test(`${label} QR rejects both list and verification`,async()=>{if(patch)await db.doc(`publicNewcomerForms/${token}`).update(patch); const a=await list(t),b=await verify('anything','19950101',t);assert.equal(a.error.status,'PERMISSION_DENIED');assert.equal(b.error.status,'PERMISSION_DENIED');assert.equal(a.result,undefined);assert.equal(b.result,undefined);});
test('name selection alone returns no private data; valid YYYYMMDD succeeds for exactly one employee',async()=>{
  const id=await candidate(); const unverified=await call('verifyEmployeeAutofill',{token,employeePublicId:id});
  assert.equal(unverified.error.status,'PERMISSION_DENIED'); assert.equal(unverified.result,undefined);
  const result=await verify(id); assert.ok(result.result,JSON.stringify(result));
  assert.deepEqual(Object.keys(result.result).sort(),[...AUTOFILL_FIELDS].sort());
  assert.equal(result.result.birthEra,'Heisei');assert.equal(result.result.birthYear,7);assert.equal(result.result.birthMonth,1);assert.equal(result.result.birthDay,1);
  assert.equal(result.result.address,employee.address); assert.equal(result.result.company,'松浦建設株式会社');
  assert.equal(result.result.qualifications.slinging,true);assert.equal(result.result.qualifications.electrician,true);
  for(const secret of ['PRIVATE','OTHER-PERSON','sealImage','employeeNumber','社員番号0001','lastUpdatedExperience','auth']) assert.ok(!JSON.stringify(result.result).includes(secret),secret);
});
for(const date of ['1995-01-01','1995/01/01','1995011','19950231','19950102','19871205'])
  test(`verification rejects invalid, wrong or another employee's DOB: ${date}`,async()=>{const r=await verify(await candidate(),date);assert.equal(r.error.status,'PERMISSION_DENIED');assert.equal(r.result,undefined);assert.equal(r.error.message,'本人確認ができませんでした。氏名と生年月日を確認してください。');});
test('nonexistent employee, wrong DOB, inconsistent master and tampered ID have identical errors',async()=>{
  const id=await candidate(),wrong=await verify(id,'19950102');
  await db.doc('employees/社員番号0001').update({birthDay:31,birthMonth:2}); const inconsistent=await verify(id);
  await db.doc('employees/社員番号0001').delete(); const missing=await verify(id),tampered=await verify('fake-id');
  for(const r of [inconsistent,missing,tampered]) assert.deepEqual(r.error,wrong.error);
});
test('opaque employee ID cannot be transferred to another valid QR; revoked QR fails after names were loaded',async()=>{
  const id=await candidate(); assert.equal((await verify(id,'19950101',second)).error.status,'PERMISSION_DENIED');
  await db.doc(`publicNewcomerForms/${token}`).update({active:false});assert.equal((await verify(id)).error.status,'PERMISSION_DENIED');
});
test('server rate limit survives new opaque IDs and blocks the sixth attempt',async()=>{
  for(let i=0;i<5;i++)assert.equal((await verify(await candidate(),'19950102')).error.status,'PERMISSION_DENIED');
  const blocked=await verify(await candidate());assert.equal(blocked.error.status,'RESOURCE_EXHAUSTED');assert.equal(blocked.result,undefined);
  const counters=await db.collection(RATE_COLLECTION).get();assert.ok(counters.size>0);
  for(const c of counters.docs){assert.match(c.id,/^[a-f0-9]{64}$/);const json=JSON.stringify(c.data());assert.ok(!json.includes('19950102'));assert.ok(!json.includes(token));assert.ok(!json.includes('社員番号0001'));}
});
test('atomic counters cap concurrent attempts across server instances',async()=>{
  const id=await candidate(),results=await Promise.all(Array.from({length:12},()=>verify(id)));
  assert.equal(results.filter(r=>r.result).length,5);assert.equal((await verify(id)).error.status,'RESOURCE_EXHAUSTED');
});
test('short window expires automatically without a permanent employee lock',async()=>{
  let now=Date.now();const service=createAutofillService(db,secretKey('a'.repeat(64)),()=>now),id=(await service.list(token,'local-test')).find(x=>x.displayName==='山田 太郎').employeePublicId;
  for(let i=0;i<5;i++)await assert.rejects(service.verify({token,employeePublicId:id,birthDate:'19950102'},'local-test'),e=>e.kind==='verification-failed');
  await assert.rejects(service.verify({token,employeePublicId:id,birthDate:'19950101'},'different-client'),e=>e.kind==='rate-limited');
  now+=61000;assert.equal((await service.verify({token,employeePublicId:id,birthDate:'19950101'},'local-test')).address,employee.address);
});
test('success cannot reset counters to enable unlimited attempts',async()=>{
  const id=await candidate();for(let i=0;i<5;i++)assert.ok((await verify(id)).result);
  assert.equal((await verify(id)).error.status,'RESOURCE_EXHAUSTED');
});
test('global employee counter prevents changing clients or valid QR tokens to reset the limit',async()=>{
  const service=createAutofillService(db,secretKey('a'.repeat(64)));
  for(const t of [token,second]){
    const id=(await service.list(t,'one-client')).find(x=>x.displayName==='山田 太郎').employeePublicId;
    for(let i=0;i<5;i++)await assert.rejects(service.verify({token:t,employeePublicId:id,birthDate:'19950102'},`client-${i}`),e=>e.kind==='verification-failed');
  }
  const third='33333333-3333-4333-8333-333333333333';await db.doc(`publicNewcomerForms/${third}`).set(form());
  const id=(await service.list(third,'another-client')).find(x=>x.displayName==='山田 太郎').employeePublicId;
  await assert.rejects(service.verify({token:third,employeePublicId:id,birthDate:'19950101'},'new-client'),e=>e.kind==='rate-limited');
});
