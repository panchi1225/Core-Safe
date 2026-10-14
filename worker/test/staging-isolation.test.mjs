import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {environment} from './helpers.mjs';
import {authorize,guard} from '../staging/auth.mjs';
import {employee,token} from '../staging/fixtures.mjs';
import {employeePage,validateQR,firestoreBase} from '../staging/firestore.mjs';
import {transferEmployee} from '../src/data.mjs';
const env=()=>({...environment(),MODE:'staging',STAGING_ONLY:'synthetic-v1',WORKER_NAME:'core-safe-public-autofill-staging',STAGING_AUTH_KEY:'3'.repeat(64)});
function jwt(key,extra={}){const parts=[{alg:'HS256'},{sub:'staging-admin',role:'staff',iss:'core-safe-synthetic-staging',aud:'core-safe-public-autofill-staging',exp:Math.floor(Date.now()/1000)+3600,...extra}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url'));return parts.join('.')+'.'+createHmac('sha256',Buffer.from(key,'hex')).update(parts.join('.')).digest('base64url');}
test('staging credentials require a valid signature, issuer, audience, role and unexpired lifetime',async()=>{
 const e=env(),request=extra=>new Request('https://staging.invalid',{headers:{Authorization:'Bearer '+jwt(e.STAGING_AUTH_KEY,extra)}});
 assert.equal((await authorize(e,request())).subject,'staging-admin');
 for(const extra of [{exp:0},{exp:Math.floor(Date.now()/1000)+10000},{aud:'production'},{iss:'other'},{sub:'outsider'},{role:'other'}])await assert.rejects(authorize(e,request(extra)));
 await assert.rejects(authorize(e,new Request('https://staging.invalid',{headers:{Authorization:'Bearer '+jwt('4'.repeat(64))}})));e.DB.sql.close();
});
test('staging refuses production project/mode or a missing isolation marker before any source read',()=>{
 const e=env();assert.equal(firestoreBase(e),'staging-fixture-only');
 for(const changes of [{MODE:'production'},{FIREBASE_PROJECT_ID:'core-safe'},{STAGING_ONLY:''},{WORKER_NAME:'lineworks-proxy'}])assert.throws(()=>guard({...e,...changes}));e.DB.sql.close();
});
test('31 generated fixtures transfer every allowed field and never include a seal or management field',()=>{
 for(let n=1;n<=31;n++){const data=transferEmployee(employee(n));assert.equal(data.nameMei,'社員'+String(n).padStart(3,'0'));assert.equal(data.sealImage,undefined);assert.equal(data.management,undefined);assert.equal(data.qualifications.slinging,true);}
});
test('synthetic source reads are network-free, projected and reject concurrent versions and invalid QR',async()=>{
 const e=env();e.DB.sql.exec(readFileSync(new URL('../staging/schema.sql',import.meta.url),'utf8'));
 e.DB.sql.prepare('INSERT INTO fixture_employees VALUES(?,?)').run('fixture-001',JSON.stringify(employee(1)));
 e.DB.sql.prepare('UPDATE fixture_control SET active=1,expires_at=?').run(Date.now()+10000);
 const fetcher=globalThis.fetch;globalThis.fetch=()=>{throw Error('external fetch prohibited');};
 try{await validateQR(e,token);await assert.rejects(validateQR(e,'bad'));const page=await employeePage(e,'',{});assert.equal(page.document.fields.sealImage,undefined);assert.equal(page.document.fields.address.stringValue,'架空住所001');await assert.rejects(employeePage(e,'',{readTime:'staging-version-0'}));}finally{globalThis.fetch=fetcher;e.DB.sql.close();}
});
