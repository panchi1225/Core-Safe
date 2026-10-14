import core from '../src/index.mjs';
import {authorize,guard} from './auth.mjs';
import {employee,token} from './fixtures.mjs';
import {meteredDB} from './metrics.mjs';
async function control(request,env){
 await authorize(env,request);
 if(request.method!=='POST'||!request.headers.get('Content-Type')?.startsWith('application/json'))throw Error('staging POST required');
 const text=await request.text();if(text.length>1024)throw Error('body limit');const input=JSON.parse(text);
 const route=new URL(request.url).pathname;
 if(route==='/__staging/seed'){
  const count=await env.DB.prepare('SELECT COUNT(*) n FROM fixture_employees').first();if(count.n)throw Error('already seeded');
  await env.DB.batch([...Array.from({length:31},(_,i)=>env.DB.prepare('INSERT INTO fixture_employees VALUES(?,?)').bind('fixture-'+String(i+1).padStart(3,'0'),JSON.stringify(employee(i+1)))),env.DB.prepare('UPDATE fixture_control SET active=1,expires_at=?,version=version+1 WHERE id=1').bind(Date.now()+365*86400000)]);
  return {seeded:31,synthetic:true};
 }
 if(route==='/__staging/master'){
  if(!/^fixture-\d{3}$/.test(input.id||'')||!['add','edit','delete'].includes(input.op))throw Error('invalid fixture mutation');
  const n=Number(input.id.slice(-3));if(n<1||n>200)throw Error('fixture range');
  // Do not accept any user-provided employee data: only generated fake records.
  if(Object.keys(input).some(k=>!['op','id'].includes(k)))throw Error('external employee data prohibited');
  const sql=input.op==='delete'?env.DB.prepare('DELETE FROM fixture_employees WHERE id=?').bind(input.id):input.op==='add'?env.DB.prepare('INSERT INTO fixture_employees VALUES(?,?)').bind(input.id,JSON.stringify(employee(n))):env.DB.prepare('UPDATE fixture_employees SET fields_json=? WHERE id=?').bind(JSON.stringify(employee(n,true)),input.id);
  await env.DB.batch([sql,env.DB.prepare('UPDATE fixture_control SET version=version+1 WHERE id=1')]);return {changed:true};
 }
 if(route==='/__staging/age'){
  if(![1,7,30].includes(input.days))throw Error('invalid fake age');
  await env.DB.prepare('UPDATE metadata SET synced_at=? WHERE id=1').bind(Date.now()-(input.days*86400000+1)).run();
  await core.scheduled({},env);return {artificialAgeDays:input.days};
 }
 if(route==='/__staging/failure'){
  if(typeof input.enabled!=='boolean')throw Error('invalid synthetic failure flag');
  await env.DB.prepare('UPDATE fixture_control SET sync_fail=? WHERE id=1').bind(input.enabled?1:0).run();return {syntheticFailure:input.enabled};
 }
 if(route==='/__staging/qr'){
  if(!['active','disabled','expired'].includes(input.state))throw Error('invalid QR state');
  await env.DB.prepare('UPDATE fixture_control SET active=?,expires_at=? WHERE id=1').bind(input.state==='disabled'?0:1,input.state==='expired'?Date.now()-1:Date.now()+365*86400000).run();return {fixtureQRState:input.state};
 }
 if(route==='/__staging/cron'){await core.scheduled({},env);return {scheduledCleanup:true};}
 throw Error('unknown staging control');
}
export default {
 async fetch(request,bindings){
  const measured=meteredDB(bindings.DB),env={...bindings,DB:measured.DB};let response;
  try{
   guard(env);const origin=request.headers.get('Origin');if(origin!==env.ALLOWED_ORIGINS)throw Error('staging origin denied');
   const route=new URL(request.url).pathname;
   response=route.startsWith('/__staging/')?Response.json(await control(request,env)):await core.fetch(request,env);
  }catch{response=Response.json({error:'Staging request refused'},{status:403});}
  const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-Staging-Synthetic','true');headers.set('X-D1-Rows-Read',String(measured.totals.read));headers.set('X-D1-Rows-Written',String(measured.totals.written));headers.set('X-D1-Queries',String(measured.totals.queries));
  return new Response(response.body,{status:response.status,headers});
 },
 async scheduled(event,bindings){guard(bindings);await core.scheduled(event,bindings);}
};
