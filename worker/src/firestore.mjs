import { decodeFields, TRANSFER_FIELDS } from './data.mjs';
export function firestoreBase(env) {
  if (env.MODE === 'local') {
    if (env.FIREBASE_PROJECT_ID !== 'demo-core-safe' || env.FIRESTORE_EMULATOR_ORIGIN !== 'http://127.0.0.1:18080') throw Error('local-project-guard');
    return env.FIRESTORE_EMULATOR_ORIGIN+'/v1/projects/demo-core-safe/databases/(default)/documents';
  }
  if (env.MODE !== 'production' || env.FIREBASE_PROJECT_ID !== 'core-safe' || env.FIRESTORE_EMULATOR_ORIGIN) throw Error('project-guard');
  return 'https://firestore.googleapis.com/v1/projects/core-safe/databases/(default)/documents';
}
async function firestore(env, suffix, bearer, body) {
  const headers = {'Content-Type':'application/json'};
  if (bearer) headers.Authorization = 'Bearer '+bearer;
  const response = await fetch(firestoreBase(env)+suffix,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000),redirect:'manual'});
  if (!response.ok) throw Error('firestore-access-denied');
  return response.json();
}
export const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export async function validateQR(env, token) {
  if (!TOKEN_PATTERN.test(token || '')) throw Error('invalid-form');
  // Anonymous Firebase REST request follows the exact live public-form Rules.
  // Never cache this authorization: expiry/revocation applies to every request.
  const doc = await firestore(env,'/publicNewcomerForms/'+token);
  const form = decodeFields(doc.fields || {});
  if (form.active !== true || !(Date.parse(form.expiresAt) > Date.now())) throw Error('invalid-form');
}
export async function authorizeStaff(env, request) {
  const bearer = request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
  if (!bearer || bearer.length > 8000) throw Error('staff-required');
  let subject;
  try { subject = JSON.parse(atob(bearer.split('.')[1].replaceAll('-','+').replaceAll('_','/'))).sub; } catch { throw Error('staff-required'); }
  if (typeof subject !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(subject)) throw Error('staff-required');
  // Decoding sub is only a routing hint. Firebase validates the JWT/signature,
  // project/expiry AND the current Rules' auth.uid==path.uid on this GET.
  const doc = await firestore(env,'/staffUsers/'+encodeURIComponent(subject),bearer);
  if (doc.fields?.active?.booleanValue !== true) throw Error('staff-required');
  return {bearer,subject};
}
export async function employeePage(env, bearer, state) {
  const query = {from:[{collectionId:'employees'}],select:{fields:TRANSFER_FIELDS.map(fieldPath=>({fieldPath}))},orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:1};
  if (state.cursor) query.startAt = {values:[{referenceValue:state.cursor}],before:false};
  const response = await firestore(env,':runQuery',bearer,{structuredQuery:query,...(state.readTime?{readTime:state.readTime}:{})});
  return {document:response.find(r=>r.document)?.document, readTime:response.find(r=>r.readTime)?.readTime};
}
