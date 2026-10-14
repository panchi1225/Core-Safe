import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { LIMITS } from '../src/index.mjs';
import { birthDate, transferEmployee } from '../src/data.mjs';
import { decrypt } from '../src/crypto.mjs';
import { call, employee, environment, firestoreMock, origin, synchronize, token, jwt } from './helpers.mjs';

async function fixture(fn,records) {
  const env=environment(),mock=firestoreMock(records),previous=globalThis.fetch;globalThis.fetch=mock.fetcher;
  try {await fn(env,mock);}finally{globalThis.fetch=previous;env.DB.sql.close();}
}
async function candidate(env) {const r=await call(worker,env,'/candidates?token='+token);assert.equal(r.status,200);return (await r.json()).candidates[0];}
const verify=(env,id,birthDate='19950101',ip='192.0.2.1')=>call(worker,env,'/verify',{token,employeeId:id,birthDate},false,{'CF-Connecting-IP':ip});

test('anonymous candidates expose only opaque selection ID and name; no login, no employee Firestore read',()=>fixture(async(env,mock)=>{
  await synchronize(worker,env);const start=mock.calls.length,c=await candidate(env);
  assert.deepEqual(Object.keys(c).sort(),['id','name']);assert.match(c.id,/^[0-9a-f]{64}$/);assert.equal(c.name,'架空 社員');
  assert.ok(mock.calls.slice(start).every(c=>c.url.includes('/publicNewcomerForms/')));
}));
test('correct DOB returns every whitelisted field, excluding signatures, seals and management; D1 private payload is encrypted',()=>fixture(async env=>{
  await synchronize(worker,env);const c=await candidate(env), r=await verify(env,c.id);assert.equal(r.status,200);
  assert.deepEqual((await r.json()).employee,transferEmployee(employee));
  const row=env.DB.sql.prepare('SELECT * FROM roster').get(), dump=JSON.stringify(row);
  for(const value of ['架空住所','000-0000','19950101','PRIVATE-SEAL','PRIVATE-SIGNATURE','PRIVATE-MANAGEMENT'])assert.ok(!dump.includes(value));
  await assert.rejects(decrypt(env.PAYLOAD_KEY,row.ciphertext,'wrong-associated-data'));
}));
test('wrong DOB, unknown employee and malformed inputs never return private data',()=>fixture(async env=>{
  await synchronize(worker,env);const c=await candidate(env);
  const results=await Promise.all([verify(env,c.id,'19950102'),verify(env,'f'.repeat(64)),verify(env,c.id,'1995-01-01')]);
  for(const r of results){assert.ok(!r.ok);const body=await r.json();assert.deepEqual(Object.keys(body),['error']);assert.ok(!JSON.stringify(body).includes('架空住所'));}
}));
test('five failures lock the employee across IPs/QRs; correct DOB also refused until expiry',()=>fixture(async env=>{
  await synchronize(worker,env);const c=await candidate(env);
  for(let i=0;i<5;i++)assert.equal((await verify(env,c.id,'19950102','192.0.2.'+(i+2))).status,403);
  assert.equal((await verify(env,c.id,'19950101','192.0.2.20')).status,429);
  const lock=env.DB.sql.prepare('SELECT expires_at FROM gates WHERE failures=5').get();assert.ok(lock.expires_at>=Date.now()+LIMITS.windowMs-1000);
  env.DB.sql.prepare('UPDATE gates SET expires_at=0').run();assert.equal((await verify(env,c.id,'19950101','192.0.2.20')).status,200);
}));
test('parallel attempts cannot bypass per-employee reservation limit',()=>fixture(async env=>{
  await synchronize(worker,env);const c=await candidate(env);
  const results=await Promise.all(Array.from({length:25},(_,i)=>verify(env,c.id,'19950102','198.51.100.'+(i+1))));
  assert.ok(results.filter(r=>r.status!==429).length<=LIMITS.employeeAttempts);assert.ok(results.some(r=>r.status===429));
}));
test('invalid, disabled and expired tokens reject both candidates and verification',()=>fixture(async(env,mock)=>{
  await synchronize(worker,env);const c=await candidate(env);
  assert.ok(!(await call(worker,env,'/candidates?token=invalid')).ok);
  for(const state of [{active:false},{active:true,expired:true}]){Object.assign(mock.control,state);assert.ok(!(await call(worker,env,'/candidates?token='+token)).ok);assert.ok(!(await verify(env,c.id)).ok);}
}));
test('QR revoked during matching is checked again before private response',()=>fixture(async(env,mock)=>{
  await synchronize(worker,env);const c=await candidate(env),original=globalThis.fetch;let n=0;
  globalThis.fetch=async(...args)=>{if(String(args[0]).includes('/publicNewcomerForms/')&&++n===2)mock.control.active=false;return original(...args);};
  const r=await verify(env,c.id);assert.ok(!r.ok);assert.equal((await r.json()).employee,undefined);
}));
test('restricted CORS, no-store even on errors, no cookies and no unsupported methods',()=>fixture(async env=>{
  for(const o of [null,'https://untrusted.example']){const r=await worker.fetch(new Request('http://worker.local/candidates',{headers:o?{Origin:o}:{}}),env);assert.equal(r.status,403);assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);}
  const r=await call(worker,env,'/candidates?token=invalid');assert.match(r.headers.get('Cache-Control'),/no-store/);assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);assert.equal(r.headers.get('Set-Cookie'),null);
  const pre=await worker.fetch(new Request('http://worker.local/verify',{method:'OPTIONS',headers:{Origin:origin}}),env);assert.equal(pre.status,200);
}));
test('sync requires an actually allowed staff token; no anonymous, outsider or forged UID allowance',()=>fixture(async(env,mock)=>{
  for(const staff of [false,'outsider','forged-staff']){const r=await call(worker,env,'/sync/start',{},staff);assert.ok(!r.ok);}
  assert.equal(env.DB.sql.prepare('SELECT COUNT(*) n FROM roster').get().n,0);
  assert.equal(mock.calls.filter(c=>c.url.endsWith(':runQuery')).length,0);
}));
test('sync uses staff ID token for Rules-controlled, projected, single-record Firestore REST reads, and consistent readTime',()=>fixture(async(env,mock)=>{
  const result=await synchronize(worker,env);assert.equal(result.count,1);
  const queries=mock.calls.filter(c=>c.url.endsWith(':runQuery')).map(c=>JSON.parse(c.body));assert.equal(queries.length,2);assert.equal(queries[0].readTime,undefined);assert.ok(queries[1].readTime);assert.ok(queries[1].structuredQuery.startAt);
}));
test('staff revocation between sync steps stops copying and leaves public roster unavailable',()=>fixture(async env=>{
  const start=await (await call(worker,env,'/sync/start',{},true)).json();const r=await call(worker,env,'/sync/step',{session:start.session},'outsider');assert.ok(!r.ok);assert.ok(!(await call(worker,env,'/candidates?token='+token)).ok);
}));
test('partial staging and sync failure never expose an outdated/partial roster',()=>fixture(async(env,mock)=>{
  await synchronize(worker,env);await candidate(env);
  const start=await (await call(worker,env,'/sync/start',{},true)).json();assert.ok(!(await call(worker,env,'/candidates?token='+token)).ok);
  mock.control.failSync=true;assert.ok(!(await call(worker,env,'/sync/step',{session:start.session},true)).ok);assert.ok(!(await call(worker,env,'/candidates?token='+token)).ok);
  mock.control.failSync=false;await synchronize(worker,env);env.DB.sql.prepare('UPDATE metadata SET synced_at=0').run();await candidate(env);
}));
test('invalid DOBs are excluded with aggregate reasons, never automatically corrected',()=>fixture(async env=>{
  const result=await synchronize(worker,env);assert.equal(result.count,1);assert.equal(result.excluded,2);assert.deepEqual(result.reasons,{outsideEraBoundary:1,invalidComponents:1});
  assert.equal((await (await call(worker,env,'/candidates?token='+token)).json()).candidates.length,1);
},[employee,{...employee,birthYear:1,birthMonth:1,birthDay:1},{...employee,birthMonth:13}]));
test('resync removes deleted employees and uses changed master values',()=>fixture(async(env,mock)=>{
  await synchronize(worker,env);const id=(await candidate(env)).id;
  const newMock=firestoreMock([{...employee,address:'更新した架空住所'}]);globalThis.fetch=newMock.fetcher;await synchronize(worker,env);assert.equal((await (await verify(env,id)).json()).employee.address,'更新した架空住所');
  globalThis.fetch=firestoreMock([]).fetcher;await synchronize(worker,env);assert.deepEqual((await (await call(worker,env,'/candidates?token='+token)).json()).candidates,[]);
}));
test('Free quota daily cap refuses further reads/writes without incrementing exhausted counter',()=>fixture(async(env,mock)=>{
  const key='public:'+Math.floor(Date.now()/86400000);env.DB.sql.prepare('INSERT INTO days VALUES(?,?)').run(key,LIMITS.publicPerDay);
  const before=mock.calls.length;for(let i=0;i<3;i++)assert.equal((await call(worker,env,'/candidates?token='+token)).status,429);
  assert.equal(mock.calls.length,before);assert.equal(env.DB.sql.prepare('SELECT used FROM days WHERE key=?').get(key).used,LIMITS.publicPerDay);
}));
test('unapproved sync and mixed demo/production settings fail closed',()=>fixture(async env=>{
  env.SYNC_APPROVED='false';assert.ok(!(await call(worker,env,'/sync/start',{},true)).ok);
  env.FIREBASE_PROJECT_ID='core-safe';assert.ok(!(await call(worker,env,'/candidates?token='+token)).ok);
}));
test('oversized request body and nonexistent sync session are rejected',()=>fixture(async env=>{
  assert.equal((await call(worker,env,'/verify',{token,extra:'x'.repeat(3000)})).status,400);
  assert.equal((await call(worker,env,'/sync/step',{session:token},true)).status,409);
}));
test('DOB calendar, era boundaries, future dates and qualified payload validation',()=>{
  assert.equal(birthDate(employee).digits,'19950101');
  assert.equal(birthDate({...employee,birthYear:1,birthDay:7}).error,'outsideEraBoundary');
  assert.equal(birthDate({...employee,birthMonth:2,birthDay:30}).error,'invalidCalendarDate');
  assert.equal(birthDate({...employee,birthEra:'Reiwa',birthYear:99}).error,'futureDate');
  assert.equal(birthDate({...employee,birthEra:'unknown'}).error,'unsupportedEra');
  assert.throws(()=>transferEmployee({...employee,address:'x'.repeat(501)}));
});
test('scheduled cleanup retains active roster regardless of age and expires abandoned staging',()=>fixture(async env=>{
  await synchronize(worker,env);env.DB.sql.prepare('UPDATE metadata SET synced_at=0').run();
  await worker.scheduled({},env);assert.equal(env.DB.sql.prepare('SELECT COUNT(*) n FROM roster').get().n,1);
  const start=await (await call(worker,env,'/sync/start',{},true)).json();await call(worker,env,'/sync/step',{session:start.session},true);
  await worker.scheduled({},env);assert.equal(env.DB.sql.prepare('SELECT COUNT(*) n FROM roster').get().n,1);
  env.DB.sql.prepare('UPDATE sync_state SET expires_at=0').run();await worker.scheduled({},env);assert.equal(env.DB.sql.prepare('SELECT COUNT(*) n FROM roster').get().n,0);
}));
test('a newer sync cancels earlier snapshots and old sessions cannot publish after a master update',()=>fixture(async env=>{
  const first=await (await call(worker,env,'/sync/start',{},true)).json();
  await call(worker,env,'/sync/step',{session:first.session},true);
  env.DB.sql.prepare('UPDATE sync_state SET busy=1').run();
  const second=await (await call(worker,env,'/sync/start',{},true)).json();assert.ok(second.session);assert.notEqual(second.session,first.session);
  assert.equal((await call(worker,env,'/sync/step',{session:first.session},true)).status,409);
  assert.equal(env.DB.sql.prepare('SELECT generation FROM metadata').get().generation,'');
  assert.equal(env.DB.sql.prepare('SELECT COUNT(*) n FROM roster').get().n,0);
}));
test('over 200 employees stops synchronization without publishing a truncated roster',()=>fixture(async env=>{
  const start=await (await call(worker,env,'/sync/start',{},true)).json();
  for(let i=0;i<200;i++)assert.equal((await call(worker,env,'/sync/step',{session:start.session},true)).status,200);
  assert.equal((await call(worker,env,'/sync/step',{session:start.session},true)).status,422);
  assert.equal(env.DB.sql.prepare('SELECT generation FROM metadata').get().generation,'');
},Array.from({length:201},()=>employee)));
test('IP limit is persisted and list traffic does not consume shared-site verification allowance',()=>fixture(async env=>{
  await synchronize(worker,env);
  for(let i=0;i<LIMITS.ipAttempts;i++)assert.equal((await call(worker,env,'/candidates?token='+token)).status,200);
  assert.equal((await call(worker,env,'/candidates?token='+token)).status,429);
  const row=env.DB.sql.prepare('SELECT selection_id FROM roster').get();
  assert.equal((await verify(env,row.selection_id)).status,200);
}));
test('a resync started while a DOB matches suppresses the old private response',()=>fixture(async(env,mock)=>{
  await synchronize(worker,env);const c=await candidate(env),original=globalThis.fetch;let n=0;
  globalThis.fetch=async(...a)=>{const r=await original(...a);if(String(a[0]).includes('/publicNewcomerForms/')&&++n===2)env.DB.sql.prepare("UPDATE metadata SET generation='',synced_at=0").run();return r;};
  const r=await verify(env,c.id);assert.ok(!r.ok);assert.equal((await r.json()).employee,undefined);
}));
