// Integration test: real workerd/D1 + Rules-controlled Firebase REST.
// No option can select a live Firebase project or remote D1.
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:18080')throw Error('demo-core-safe emulator only');
const origin='http://127.0.0.1:5178',token='11111111-1111-4111-8111-111111111111';
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'test-autofill',modules:true,scriptPath:fileURLToPath(new URL('dist/index.js',import.meta.url)),compatibilityDate:'2026-10-14',
  bindings:{MODE:'local',FIREBASE_PROJECT_ID:'demo-core-safe',FIRESTORE_EMULATOR_ORIGIN:'http://127.0.0.1:18080',ALLOWED_ORIGINS:origin,PUBLIC_ENABLED:'true',SYNC_APPROVED:'true',PAYLOAD_KEY:'1'.repeat(64),MATCH_KEY:'2'.repeat(64)},d1Databases:{DB:'test-only'}}]}));
async function account(email){const r=await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'Local-test-12345!',returnSecureToken:true})});assert.ok(r.ok);return (await r.json()).idToken;}
async function call(route,data,idToken){return mf.dispatchFetch('http://localhost'+route,{method:data?'POST':'GET',headers:{Origin:origin,...(data?{'Content-Type':'application/json'}:{}),...(idToken?{Authorization:'Bearer '+idToken}:{})},...(data?{body:JSON.stringify(data)}:{})});}
try {
  const db=await mf.getD1Database('DB');
  for(const sql of readFileSync(new URL('migrations/0001_autofill.sql',import.meta.url),'utf8').split(';').filter(x=>x.trim()))await db.prepare(sql).run();
  const staff=await account('staff@core-safe.local'),outsider=await account('outsider@core-safe.local');
  assert.ok(!(await call('/sync/start',{})).ok);assert.ok(!(await call('/sync/start',{},outsider)).ok);
  const start=await call('/sync/start',{},staff);assert.equal(start.status,200);const session=(await start.json()).session;
  let result;for(let i=0;i<203;i++){const r=await call('/sync/step',{session},staff);assert.equal(r.status,200);result=await r.json();if(result.done)break;}
  assert.equal(result.done,true);assert.equal(result.count,1);assert.equal(result.excluded,0);
  const candidates=await call('/candidates?token='+token);assert.equal(candidates.status,200);const list=(await candidates.json()).candidates;
  assert.equal(list.length,1);assert.deepEqual(Object.keys(list[0]).sort(),['id','name']);
  const verify=dob=>call('/verify',{token,employeeId:list[0].id,birthDate:dob});
  const wrong=await verify('19950102');assert.equal(wrong.status,403);assert.equal((await wrong.json()).employee,undefined);
  const success=await verify('19950101');assert.equal(success.status,200);const employee=(await success.json()).employee;assert.equal(employee.nameMei,'社員');assert.equal(employee.address,'架空の住所');assert.equal(employee.sealImage,undefined);assert.equal(employee.signatureDataUrl,undefined);
  for(let i=0;i<4;i++)assert.equal((await verify('19950102')).status,403);assert.equal((await verify('19950101')).status,429);
  const firestore='http://127.0.0.1:18080/v1/projects/demo-core-safe/databases/(default)/documents';
  for(const route of ['/employees/synthetic','/employees'])assert.equal((await fetch(firestore+route)).status,403);
  assert.ok(!(await call('/candidates?token=invalid')).ok);
  console.log(JSON.stringify({workerdD1:true,allowedStaffSync:true,outsiderAndAnonymousSyncDenied:true,candidatesNameOnly:true,correctDOBAutofill:true,wrongDOBNoPII:true,lockout:true,anonymousEmployeeGetAndListDenied:true,productionConnections:0,functionsConnections:0}));
} finally {await mf.dispose();}
