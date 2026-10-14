import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { TRANSFER_FIELDS, QUALIFICATIONS, QUALIFICATION_TEXT } from '../src/data.mjs';
export const origin='http://127.0.0.1:5178', token='11111111-1111-4111-8111-111111111111';
export const employee={nameSei:'架空',nameMei:'社員',furiganaSei:'カクウ',furiganaMei:'シャイン',birthEra:'Heisei',birthYear:7,birthMonth:1,birthDay:1,gender:'Male',bloodType:'A',bloodTypeRh:'Plus',address:'架空住所',phone:'000-0000',emergencyContactSei:'架空',emergencyContactMei:'家族',emergencyContactRelation:'家族',emergencyContactPhone:'000-0001',jobType:'架空専門職',experienceYears:10,experienceMonths:5,healthCheckYear:8,healthCheckMonth:1,healthCheckDay:1,qualifications:{...Object.fromEntries(QUALIFICATIONS.map(k=>[k,true])),...Object.fromEntries(QUALIFICATION_TEXT.map(k=>[k,'架空資格']))},sealImage:'PRIVATE-SEAL',signatureDataUrl:'PRIVATE-SIGNATURE',management:'PRIVATE-MANAGEMENT'};
export function database() {
  const sql=new DatabaseSync(':memory:');
  for(const file of ['0001_autofill.sql','0002_mutation_guard.sql'])sql.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
  const statement=(query,values=[])=>({bind(...v){return statement(query,v);},async first(){return sql.prepare(query).get(...values) || null;},async all(){return {results:sql.prepare(query).all(...values)};},async run(){return sql.prepare(query).run(...values);}});
  return {sql,prepare:statement,async batch(statements){sql.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
}
export const encode=v=>v===null?{nullValue:null}:typeof v==='string'?{stringValue:v}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{integerValue:String(v)}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]))}};
export const fields=v=>Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]));
export const jwt=subject=>'header.'+btoa(JSON.stringify({sub:subject})).replaceAll('=','').replaceAll('+','-').replaceAll('/','_')+'.signature';
export function environment() {return {DB:database(),MODE:'local',FIREBASE_PROJECT_ID:'demo-core-safe',FIRESTORE_EMULATOR_ORIGIN:'http://127.0.0.1:18080',ALLOWED_ORIGINS:origin,PUBLIC_ENABLED:'true',SYNC_APPROVED:'true',ADMIN_UIDS:'staff',PAYLOAD_KEY:'1'.repeat(64),MATCH_KEY:'2'.repeat(64)};}
export function firestoreMock(records=[employee]) {
  const calls=[], control={active:true,expired:false,failSync:false,staffSubjects:['staff'],expiresAt:null};
  const fetcher=async(url,options={})=>{
    calls.push({url,method:options.method,body:options.body});
    const headers=new Headers(options.headers), bearer=headers.get('Authorization');
    const permitted=control.staffSubjects.some(s=>bearer==='Bearer '+jwt(s));
    if(url.includes('/staffUsers/'))return Response.json({fields:{active:{booleanValue:permitted}}},{status:permitted?200:403});
    if(url.endsWith(':runQuery')){
      if(control.failSync || !permitted)return Response.json({},{status:403});
      const body=JSON.parse(options.body), q=body.structuredQuery;
      const projection=q.select.fields.map(f=>f.fieldPath);
      if(JSON.stringify(projection)!==JSON.stringify(TRANSFER_FIELDS)||q.limit!==1)throw Error('Unbounded/private projection');
      const cursor=q.startAt?.values[0].referenceValue?.split('/').at(-1);
      const docs=records.map((raw,i)=>({id:raw.id||String(i).padStart(4,'0'),raw})).sort((a,b)=>a.id.localeCompare(b.id));
      const found=docs.find(d=>!cursor||d.id>cursor);
      return Response.json([found?{document:{name:'projects/demo-core-safe/databases/(default)/documents/employees/'+found.id,fields:fields(found.raw)},readTime:'2026-10-14T00:00:00Z'}:{readTime:'2026-10-14T00:00:00Z'}]);
    }
    if(url.endsWith('/publicNewcomerForms/'+token)&&control.active&&!control.expired)return Response.json({fields:{active:{booleanValue:true},expiresAt:{timestampValue:new Date(control.expiresAt||Date.now()+3600000).toISOString()}}});
    return Response.json({},{status:403});
  };
  return {fetcher,calls,control};
}
export async function call(worker,env,route,data,staff=false,extra={}) {
  return worker.fetch(new Request('http://worker.local'+route,{method:data?'POST':'GET',headers:{Origin:origin,'CF-Connecting-IP':'192.0.2.1',...(data?{'Content-Type':'application/json'}:{}),...(staff?{Authorization:'Bearer '+jwt(staff===true?'staff':staff)}:{}),...extra},...(data?{body:JSON.stringify(data)}:{})}),env);
}
export async function synchronize(worker,env) {
  const started=await call(worker,env,'/sync/start',{},true), start=await started.json();
  if(!started.ok)throw Error('start rejected');
  let result;
  for(let i=0;i<=201;i++){const r=await call(worker,env,'/sync/step',{session:start.session},true);result=await r.json();if(!r.ok)throw Error('step rejected');if(result.done)return result;}
  throw Error('unbounded synchronization');
}
