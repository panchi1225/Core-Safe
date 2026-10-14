import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.mjs';
import {environment,call} from './helpers.mjs';
import {readFileSync} from 'node:fs';

test('production preparation configuration disables public endpoints and both approval flags',()=>{
 const config=JSON.parse(readFileSync(new URL('../wrangler.production.example.jsonc',import.meta.url),'utf8'));
 assert.equal(config.workers_dev,false);assert.equal(config.preview_urls,false);
 assert.equal(config.vars.PUBLIC_ENABLED,'false');assert.equal(config.vars.SYNC_APPROVED,'false');
 assert.deepEqual(config.triggers.crons,['0 * * * *']);
});

test('disabled production public/sync operations reject before any Firebase request or employee copy',async()=>{
 const env={...environment(),MODE:'production',FIREBASE_PROJECT_ID:'core-safe',PUBLIC_ENABLED:'false',SYNC_APPROVED:'false'};
 delete env.FIRESTORE_EMULATOR_ORIGIN;
 const original=globalThis.fetch;let externalCalls=0;
 globalThis.fetch=()=>{externalCalls++;throw Error('No external Firebase connection allowed');};
 try{
  for(const [route,input] of [['/candidates?token=11111111-1111-4111-8111-111111111111'],['/verify',{token:'test'}],['/sync/start',{}],['/sync/prepare',{}],['/sync/settle',{}],['/sync/step',{}]]){
   const response=await call(worker,env,route,input,true);assert.equal(response.status,503);assert.deepEqual(Object.keys(await response.json()),['error']);
  }
  await worker.scheduled({},env);
  assert.equal(externalCalls,0);
  assert.equal(env.DB.sql.prepare('SELECT COUNT(*) n FROM roster').get().n,0);
  assert.equal(env.DB.sql.prepare('SELECT COUNT(*) n FROM sync_state').get().n,0);
 }finally{globalThis.fetch=original;env.DB.sql.close();}
});
