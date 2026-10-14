// Called with an in-memory staging key; never reads production data/credentials.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {token,employee} from './fixtures.mjs';
import {transferEmployee} from '../src/data.mjs';
export async function runRemote({url,authKey,onCheck=()=>{}}){
 if(!/^https:\/\/core-safe-public-autofill-staging\.[a-z0-9-]+\.workers\.dev$/.test(url)||!/^[a-f\d]{64}$/.test(authKey))throw Error('staging remote guard');
 const parts=[{alg:'HS256'},{sub:'staging-admin',role:'staff',iss:'core-safe-synthetic-staging',aud:'core-safe-public-autofill-staging',exp:Math.floor(Date.now()/1000)+3600}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url'));
 const jwt=parts.join('.')+'.'+createHmac('sha256',Buffer.from(authKey,'hex')).update(parts.join('.')).digest('base64url');
 const calls=[],checks=[];
 const call=async(route,input,staff=false)=>{
  if(calls.length>=400||calls.reduce((n,c)=>n+c.read,0)>100000||calls.reduce((n,c)=>n+c.written,0)>20000)throw Error('staging free safety budget reached');
  const r=await fetch(url+route,{method:input?'POST':'GET',headers:{Origin:'http://127.0.0.1:5178',...(input?{'Content-Type':'application/json'}:{}),...(staff?{Authorization:'Bearer '+jwt}:{})},...(input?{body:JSON.stringify(input)}:{}),signal:AbortSignal.timeout(30000)});
  assert.equal(r.headers.get('X-Staging-Synthetic'),'true');assert.ok(r.headers.get('Cache-Control').includes('no-store'));
  calls.push({path:route.split('?')[0],status:r.status,read:Number(r.headers.get('X-D1-Rows-Read')),written:Number(r.headers.get('X-D1-Rows-Written')),queries:Number(r.headers.get('X-D1-Queries')),at:new Date().toISOString()});
  return {r,data:await r.json()};
 };
 const check=name=>{checks.push(name);onCheck({check:name,passed:true,requests:calls.length});};
 const sync=async ticket=>{
  const start=await call('/sync/start',ticket?{ticket}:{},true);assert.equal(start.r.status,200);
  for(let i=0;i<202;i++){const page=await call('/sync/step',{session:start.data.session},true);assert.equal(page.r.status,200);if(page.data.done)return page.data;}
  throw Error('sync limit');
 };
 const list=async()=>{const result=await call('/candidates?token='+token);assert.equal(result.r.status,200);assert.ok(result.data.candidates.every(c=>Object.keys(c).sort().join(',')==='id,name'));return result.data.candidates;};
 const verify=(id,date)=>call('/verify',{token,employeeId:id,birthDate:date});
 assert.equal((await call('/__staging/seed',{},false)).r.status,403);check('unauthorized fixture administration denied');
 assert.equal((await call('/__staging/seed',{},true)).data.seeded,31);
 assert.equal((await sync()).count,31);check('initial synthetic 31 sync');
 let candidates=await list();assert.equal(candidates.length,31);
 const find=(n,items=candidates)=>items.find(c=>c.name==='架空 社員'+String(n).padStart(3,'0')).id;
 let id=find(1);
 for(let n=1;n<=31;n++){const result=await verify(find(n),'199501'+String((n-1)%28+1).padStart(2,'0'));assert.equal(result.r.status,200);assert.deepEqual(result.data.employee,transferEmployee(employee(n)));}
 check('name-only list and all allowed autofill fields for 31 employees');
 const locked=find(31);for(let i=0;i<5;i++){const result=await verify(locked,'19000101');assert.equal(result.r.status,403);assert.equal(result.data.employee,undefined);}assert.equal((await verify(locked,'19950103')).r.status,429);check('wrong DOB never discloses PII and five failures lock out');
 const beforeAging=calls.filter(c=>c.path.startsWith('/sync/')).length;
 for(const days of [1,7,30]){assert.equal((await call('/__staging/age',{days},true)).r.status,200);assert.equal((await verify(id,'19950101')).r.status,200);assert.equal((await list()).length,31);}
 assert.equal(calls.filter(c=>c.path.startsWith('/sync/')).length,beforeAging);check('24h 7d 30d old active roster survives cron without resync');
 const change=async(op,target,expected)=>{
  const prepare=await call('/sync/prepare',{},true);assert.equal(prepare.r.status,200);assert.equal((await verify(id,'19950101')).r.status,503);
  assert.equal((await call('/__staging/master',{op,id:target},true)).r.status,200);
  assert.equal((await call('/sync/settle',{ticket:prepare.data.ticket},true)).r.status,200);assert.equal((await sync(prepare.data.ticket)).count,expected);
 };
 await change('add','fixture-032',32);candidates=await list();assert.equal(candidates.length,32);check('addition automatically synchronized after invalidation');
 await change('edit','fixture-001',32);assert.deepEqual((await verify(id,'19950101')).data.employee,transferEmployee(employee(1,true)));check('edit replaces old information');
 const prepare=await call('/sync/prepare',{},true);assert.equal(prepare.r.status,200);assert.equal((await call('/__staging/master',{op:'edit',id:'fixture-002'},true)).r.status,200);
 await call('/__staging/failure',{enabled:true},true);await call('/sync/settle',{ticket:prepare.data.ticket},true);
 const start=await call('/sync/start',{ticket:prepare.data.ticket},true);assert.equal((await call('/sync/step',{session:start.data.session},true)).r.status,503);assert.equal((await verify(id,'19950101')).r.status,503);check('failed synchronization never exposes old roster');
 await call('/__staging/failure',{enabled:false},true);assert.equal((await sync()).count,32);
 await change('delete','fixture-001',31);const deleted=await verify(id,'19950101');assert.ok(!deleted.r.ok);assert.equal(deleted.data.employee,undefined);candidates=await list();assert.ok(!candidates.some(c=>c.name==='架空 社員001'));check('deleted employee cannot be retrieved');
 for(const state of ['disabled','expired']){await call('/__staging/qr',{state},true);const result=await call('/candidates?token='+token);assert.ok(!result.r.ok);assert.equal(result.data.candidates,undefined);}await call('/__staging/qr',{state:'active'},true);
 assert.ok(!(await call('/candidates?token=44444444-4444-4444-8444-444444444444')).r.ok);check('invalid disabled and expired synthetic QR refused');
 return {checks,requests:calls.length,d1RowsRead:calls.reduce((n,c)=>n+c.read,0),d1RowsWritten:calls.reduce((n,c)=>n+c.written,0),d1Queries:calls.reduce((n,c)=>n+c.queries,0),calls,realEmployeeRecords:0,productionFirebaseConnections:0};
}
