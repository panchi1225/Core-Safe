import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.mjs';
import {call,employee,environment,firestoreMock,synchronize,token} from './helpers.mjs';
const DAY=86400000;
async function fixture(fn,records=[employee]){
  const env=environment(),mock=firestoreMock(records),fetcher=globalThis.fetch,clock=Date.now;
  globalThis.fetch=mock.fetcher;
  try {await fn(env,mock,records);}finally{globalThis.fetch=fetcher;Date.now=clock;env.DB.sql.close();}
}
async function list(env){return (await (await call(worker,env,'/candidates?token='+token)).json()).candidates;}
const verify=(env,id)=>call(worker,env,'/verify',{token,employeeId:id,birthDate:'19950101'});
async function finish(env,ticket,who=true){
  assert.equal((await call(worker,env,'/sync/settle',{ticket},who)).status,200);
  const r=await call(worker,env,'/sync/start',{ticket},who);assert.equal(r.status,200);const {session}=await r.json();
  for(let i=0;i<203;i++){const page=await call(worker,env,'/sync/step',{session},who);assert.equal(page.status,200);if((await page.json()).done)return;}
  throw Error('sync did not finish');
}
for(const elapsed of [DAY+1,7*DAY,30*DAY])test(`initial roster continues after ${elapsed}ms without any staff login or resync`,()=>fixture(async(env,mock)=>{
  const base=Date.now();mock.control.expiresAt=base+365*DAY;await synchronize(worker,env);const id=(await list(env))[0].id;
  const generation=env.DB.sql.prepare('SELECT generation FROM metadata').get().generation;
  Date.now=()=>base+elapsed;await worker.scheduled({},env);const before=mock.calls.length;
  assert.equal((await list(env))[0].id,id);const r=await verify(env,id);assert.equal(r.status,200);assert.equal((await r.json()).employee.address,employee.address);
  assert.equal(env.DB.sql.prepare('SELECT generation FROM metadata').get().generation,generation);
  assert.ok(mock.calls.slice(before).every(c=>c.url.includes('/publicNewcomerForms/')));
}));
test('employee addition, edit and deletion are reflected via guarded automatic sync without admin/manual start',()=>fixture(async(env,mock,rows)=>{
  await synchronize(worker,env);env.ADMIN_UIDS='different-admin';
  let old=(await list(env))[0];
  const prepare=async()=>{const r=await call(worker,env,'/sync/prepare',{},true);assert.equal(r.status,200);assert.equal((await verify(env,old.id)).status,503);return (await r.json()).ticket;};
  let ticket=await prepare();rows.push({...employee,id:'second',nameMei:'追加社員'});await finish(env,ticket);assert.equal((await list(env)).length,2);
  ticket=await prepare();rows[0].address='変更後の架空住所';await finish(env,ticket);assert.equal((await (await verify(env,old.id)).json()).employee.address,'変更後の架空住所');
  ticket=await prepare();rows.splice(0,1);await finish(env,ticket);assert.equal((await list(env)).length,1);
  const deleted=await verify(env,old.id);assert.ok(!deleted.ok);assert.equal((await deleted.json()).employee,undefined);
},[{...employee,id:'first'}]));
test('unknown Firestore outcome remains closed across 30 days and cron; normal resync cannot bypass it',()=>fixture(async(env,mock)=>{
  const base=Date.now();mock.control.expiresAt=base+365*DAY;await synchronize(worker,env);const id=(await list(env))[0].id;
  assert.equal((await call(worker,env,'/sync/prepare',{},true)).status,200);
  Date.now=()=>base+30*DAY;await worker.scheduled({},env);
  assert.equal((await call(worker,env,'/sync/start',{},true)).status,409);
  assert.equal((await verify(env,id)).status,503);
  assert.equal(env.DB.sql.prepare('SELECT COUNT(*) n FROM mutations WHERE settled=0').get().n,1);
}));
test('failed sync after confirmed Firestore update does not expose the previous payload',()=>fixture(async(env,mock,rows)=>{
  await synchronize(worker,env);const id=(await list(env))[0].id;
  const {ticket}=await (await call(worker,env,'/sync/prepare',{},true)).json();rows[0].address='同期失敗後の架空住所';
  await call(worker,env,'/sync/settle',{ticket},true);mock.control.failSync=true;
  const {session}=await (await call(worker,env,'/sync/start',{ticket},true)).json();assert.ok(!(await call(worker,env,'/sync/step',{session},true)).ok);
  assert.equal((await verify(env,id)).status,503);assert.equal(env.DB.sql.prepare('SELECT COUNT(*) n FROM roster').get().n,0);
}));
test('pending concurrent employee writes block publication and invalidate earlier snapshots',()=>fixture(async(env,mock)=>{
  await synchronize(worker,env);mock.control.staffSubjects.push('staff2');
  const first=await (await call(worker,env,'/sync/prepare',{},true)).json();await call(worker,env,'/sync/settle',first,true);
  const old=await (await call(worker,env,'/sync/start',first,true)).json();
  const second=await (await call(worker,env,'/sync/prepare',{},'staff2')).json();
  assert.equal((await call(worker,env,'/sync/step',{session:old.session},true)).status,409);
  assert.equal((await call(worker,env,'/sync/start',first,true)).status,409);
  await finish(env,second.ticket,'staff2');assert.ok((await list(env)).length);
}));
test('administrator pause/purge removes copied PII and sessions; staff cannot resume/purge or defeat pending writes',()=>fixture(async env=>{
  await synchronize(worker,env);
  const originalAdmins=env.ADMIN_UIDS;env.ADMIN_UIDS='another-admin';
  assert.equal((await call(worker,env,'/sync/purge',{},true)).status,403);assert.equal((await call(worker,env,'/sync/start',{resume:true},true)).status,403);
  env.ADMIN_UIDS=originalAdmins;await call(worker,env,'/sync/pause',{},true);
  assert.equal(env.DB.sql.prepare('SELECT COUNT(*) n FROM roster').get().n,0);assert.equal((await call(worker,env,'/sync/start',{},true)).status,503);
  const start=await call(worker,env,'/sync/start',{resume:true},true);assert.equal(start.status,200);
  const session=(await start.json()).session;await call(worker,env,'/sync/step',{session},true);
  const before=env.DB.sql.prepare('SELECT COUNT(*) n FROM gates').get().n;
  assert.equal((await call(worker,env,'/sync/purge',{},true)).status,200);
  assert.equal(env.DB.sql.prepare('SELECT COUNT(*) n FROM roster').get().n,0);assert.equal(env.DB.sql.prepare('SELECT COUNT(*) n FROM sync_state').get().n,0);
  assert.equal(env.DB.sql.prepare('SELECT COUNT(*) n FROM gates').get().n,before);
  assert.equal((await call(worker,env,'/sync/step',{session},true)).status,409);
}));
test('explicit administrator recovery checks write settlement and minimum waiting; never auto-recovers by time',()=>fixture(async env=>{
  const base=Date.now();await call(worker,env,'/sync/prepare',{},true);
  assert.equal((await call(worker,env,'/sync/start',{recoverConfirmed:true,resume:true},true)).status,409);
  Date.now=()=>base+11*60000;env.ADMIN_UIDS='another-admin';
  assert.equal((await call(worker,env,'/sync/start',{recoverConfirmed:true,resume:true},true)).status,403);
  env.ADMIN_UIDS='staff';assert.equal((await call(worker,env,'/sync/start',{},true)).status,409);
  assert.equal((await call(worker,env,'/sync/start',{recoverConfirmed:true,resume:true},true)).status,200);
}));

test('withdrawing sync approval still permits administrator stop and erase without clearing pending write barriers',()=>fixture(async env=>{
  await synchronize(worker,env);await call(worker,env,'/sync/prepare',{},true);
  env.SYNC_APPROVED='false';
  assert.equal((await call(worker,env,'/sync/start',{},true)).status,503);
  assert.equal((await call(worker,env,'/sync/pause',{},true)).status,200);
  assert.equal((await call(worker,env,'/sync/purge',{},true)).status,200);
  assert.equal(env.DB.sql.prepare('SELECT COUNT(*) n FROM roster').get().n,0);
  assert.equal(env.DB.sql.prepare('SELECT COUNT(*) n FROM sync_state').get().n,0);
  assert.equal(env.DB.sql.prepare('SELECT COUNT(*) n FROM mutations WHERE settled=0').get().n,1);
  const state=await (await call(worker,env,'/sync/status',{},true)).json();
  assert.equal(state.paused,true);assert.equal(state.available,false);
}));
