import {mac,equalMac} from '../src/crypto.mjs';
export function guard(env){
 if(env.MODE!=='staging'||env.STAGING_ONLY!=='synthetic-v1'||env.FIREBASE_PROJECT_ID!=='demo-core-safe'||env.WORKER_NAME!=='core-safe-public-autofill-staging')throw Error('staging isolation guard');
}
export async function authorize(env,request){
 guard(env);const bearer=request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_.-]{1,8000})$/)?.[1];
 if(!bearer)throw Error('staging authorization required');
 const parts=bearer.split('.');if(parts.length!==3)throw Error('invalid staging credential');
 const decode=s=>JSON.parse(atob(s.replaceAll('-','+').replaceAll('_','/')));
 const header=decode(parts[0]),claims=decode(parts[1]);
 const signature=Uint8Array.from(atob(parts[2].replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
 const hex=Array.from(signature,v=>v.toString(16).padStart(2,'0')).join('');
 if(header.alg!=='HS256'||!equalMac(hex,await mac(env.STAGING_AUTH_KEY,parts[0]+'.'+parts[1]))||claims.iss!=='core-safe-synthetic-staging'||claims.aud!==env.WORKER_NAME||claims.sub!=='staging-admin'||claims.role!=='staff'||!Number.isInteger(claims.exp)||claims.exp<=Date.now()/1000||claims.exp>Date.now()/1000+3700)throw Error('invalid staging credential');
 return {bearer,subject:claims.sub};
}
