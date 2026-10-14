import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {token,employee} from './fixtures.mjs';
import {transferEmployee} from '../src/data.mjs';
const root=path.resolve(import.meta.dirname,'..'),vars=JSON.parse(fs.readFileSync(path.join(root,'wrangler.staging.example.jsonc'),'utf8')).vars;
const key='3'.repeat(64),parts=[{alg:'HS256'},{sub:'staging-admin',role:'staff',iss:'core-safe-synthetic-staging',aud:vars.WORKER_NAME,exp:Math.floor(Date.now()/1000)+3600}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url'));
const jwt=parts.join('.')+'.'+createHmac('sha256',Buffer.from(key,'hex')).update(parts.join('.')).digest('base64url');
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'synthetic-staging-local',modules:true,scriptPath:path.join(root,'dist-staging/worker.mjs'),compatibilityDate:'2026-10-14',d1Databases:{DB:'staging-local-tests'},bindings:{...vars,PAYLOAD_KEY:'1'.repeat(64),MATCH_KEY:'2'.repeat(64),STAGING_AUTH_KEY:key}}]}));
const request=async(route,input,staff=true)=>{const r=await mf.dispatchFetch('http://localhost'+route,{method:input?'POST':'GET',headers:{Origin:vars.ALLOWED_ORIGINS,'CF-Connecting-IP':'192.0.2.1',...(input?{'Content-Type':'application/json'}:{}),...(staff?{Authorization:'Bearer '+jwt}:{})},...(input?{body:JSON.stringify(input)}:{})});return {r,data:await r.json()};};
try{
 const db=await mf.getD1Database('DB');for(const file of ['migrations/0001_autofill.sql','migrations/0002_mutation_guard.sql','staging/schema.sql'])for(const sql of fs.readFileSync(path.join(root,file),'utf8').split(';').filter(s=>s.trim()))await db.prepare(sql).run();
 assert.equal((await request('/__staging/seed',{},false)).r.status,403);
 const peerParts=[{alg:'HS256'},{sub:'staging-staff-1',role:'staff',iss:'core-safe-synthetic-staging',aud:vars.WORKER_NAME,exp:Math.floor(Date.now()/1000)+3600}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url'));
 const peerJWT=peerParts.join('.')+'.'+createHmac('sha256',Buffer.from(key,'hex')).update(peerParts.join('.')).digest('base64url');
 const peer=await mf.dispatchFetch('http://localhost/__staging/seed',{method:'POST',headers:{Origin:vars.ALLOWED_ORIGINS,'Content-Type':'application/json',Authorization:'Bearer '+peerJWT},body:'{}'});
 assert.equal(peer.status,403);
 assert.equal((await request('/__staging/seed',{})).data.seeded,31);
 const start=await request('/sync/start',{});assert.equal(start.r.status,200);
 let result;for(let i=0;i<33;i++){result=await request('/sync/step',{session:start.data.session});assert.equal(result.r.status,200);if(result.data.done)break;}
 assert.equal(result.data.done,true);assert.equal(result.data.count,31);
 const list=await request('/candidates?token='+token,undefined,false);assert.equal(list.data.candidates.length,31);
 const id=list.data.candidates.find(c=>c.name==='架空 社員001').id;
 const correct=await request('/verify',{token,employeeId:id,birthDate:'19950101'},false);assert.deepEqual(correct.data.employee,transferEmployee(employee(1)));assert.ok(Number(correct.r.headers.get('X-D1-Rows-Read'))>0);
 const wrong=await request('/verify',{token,employeeId:id,birthDate:'19000101'},false);assert.ok(!wrong.r.ok);assert.equal(wrong.data.employee,undefined);
 await request('/__staging/age',{days:30});assert.equal((await request('/verify',{token,employeeId:id,birthDate:'19950101'},false)).r.status,200);
 assert.equal((await request('/__staging/master',{op:'edit',id:'fixture-001',address:'external real data forbidden'})).r.status,403);
 console.log(JSON.stringify({stagingBuiltWorker:true,workerdD1:true,synthetic31:true,correctAndWrongDOB:true,projectIsolation:true,externalEmployeePayloadRejected:true,rowMetrics:true}));
}finally{await mf.dispose();}
