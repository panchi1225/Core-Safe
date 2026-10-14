// Build-time replacement only. No Firebase host or network fetch exists here.
import {guard,authorize} from './auth.mjs';
import {fields,token} from './fixtures.mjs';
import {TRANSFER_FIELDS} from '../src/data.mjs';
export const TOKEN_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function firestoreBase(env){guard(env);return 'staging-fixture-only';}
export async function authorizeStaff(env,request){return authorize(env,request);}
export async function validateQR(env,provided){
 guard(env);const control=await env.DB.prepare('SELECT active,expires_at FROM fixture_control WHERE id=1').first();
 if(provided!==token||!control||control.active!==1||control.expires_at<=Date.now())throw Error('invalid staging QR');
}
export async function employeePage(env,_bearer,state){
 guard(env);const control=await env.DB.prepare('SELECT version,sync_fail FROM fixture_control WHERE id=1').first();
 if(control.sync_fail)throw Error('synthetic sync failure');
 const readTime='staging-version-'+control.version;if(state.readTime&&state.readTime!==readTime)throw Error('fixture changed mid-sync');
 const id=state.cursor?.split('/').at(-1)||'';
 const row=await env.DB.prepare('SELECT id,fields_json FROM fixture_employees WHERE id>? ORDER BY id LIMIT 1').bind(id).first();
 if(!row)return {readTime};
 const raw=JSON.parse(row.fields_json),projection=Object.fromEntries(TRANSFER_FIELDS.filter(k=>k in raw).map(k=>[k,raw[k]]));
 // Exercise the same Firestore-shaped field decoder as production.
 return {readTime,document:{name:'projects/demo-core-safe/databases/(default)/documents/employees/'+row.id,fields:JSON.parse(JSON.stringify(fields(projection)))}};
}
