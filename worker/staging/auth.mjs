const authKeys=new Map(),encoder=new TextEncoder();
function verificationKey(secret){
 if(!/^[a-f0-9]{64}$/.test(secret||''))throw Error('missing staging secret');
 if(!authKeys.has(secret))authKeys.set(secret,crypto.subtle.importKey('raw',Uint8Array.from(secret.match(/../g),v=>parseInt(v,16)),{name:'HMAC',hash:'SHA-256'},false,['verify']));
 return authKeys.get(secret);
}
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
 if(header.alg!=='HS256'||!await crypto.subtle.verify('HMAC',await verificationKey(env.STAGING_AUTH_KEY),signature,encoder.encode(parts[0]+'.'+parts[1]))||claims.iss!=='core-safe-synthetic-staging'||claims.aud!==env.WORKER_NAME||!['staging-admin','staging-staff-1'].includes(claims.sub)||claims.role!=='staff'||!Number.isInteger(claims.exp)||claims.exp<=Date.now()/1000||claims.exp>Date.now()/1000+3700)throw Error('invalid staging credential');
 return {bearer,subject:claims.sub};
}
