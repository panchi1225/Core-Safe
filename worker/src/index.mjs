import { MAX_EMPLOYEES, birthDate, decodeFields, transferEmployee } from './data.mjs';
import { mac, encrypt, decrypt, equalMac } from './crypto.mjs';
import { authorizeStaff, employeePage, validateQR, TOKEN_PATTERN, firestoreBase } from './firestore.mjs';

const MINUTE = 60000, DAY = 86400000;
export const LIMITS = {publicPerDay:2000,syncPerDay:1000,employeeAttempts:10,employeeFailures:5,ipAttempts:100,windowMs:15*MINUTE};
const generic = '確認できませんでした。入力内容を確認し、しばらく待ってからお試しください。';
class Refusal extends Error { constructor(status=403) { super('refused'); this.status=status; } }
const stmt = (env,sql,...values) => env.DB.prepare(sql).bind(...values);

async function budget(env, kind, now) {
  const day = Math.floor(now/DAY), cap = kind === 'public' ? LIMITS.publicPerDay : LIMITS.syncPerDay;
  const result = await stmt(env,`INSERT INTO days(key,used) VALUES(?,1) ON CONFLICT(key) DO UPDATE SET used=used+1 WHERE used < ? RETURNING used`,kind+':'+day,cap).first();
  if (!result) throw new Refusal(429);
  if (result.used === 1) {
    // Bound cleanup and writes; even rejected traffic cannot keep incrementing
    // the exhausted daily counter. No IPs, DOBs or names in these tables.
    await stmt(env,'DELETE FROM gates WHERE key IN (SELECT key FROM gates WHERE expires_at < ? LIMIT 6000)',now).run();
    await stmt(env,'DELETE FROM days WHERE key NOT IN (?,?)','public:'+day,'sync:'+day).run();
  }
}
async function attempt(env, key, max, now) {
  const id = await mac(env.MATCH_KEY,`rate:${key}`);
  const value = await stmt(env,`INSERT INTO gates(key,attempts,failures,expires_at) VALUES(?,1,0,?) ON CONFLICT(key) DO UPDATE SET
    attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,
    failures=CASE WHEN expires_at<=? THEN 0 ELSE failures END,
    expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END
    WHERE expires_at<=? OR (attempts < ? AND failures < ?) RETURNING attempts`,id,now+LIMITS.windowMs,now,now,now,now,max,LIMITS.employeeFailures).first();
  if (!value) throw new Refusal(429);
  return id;
}
async function fail(env, id) {
  await stmt(env,'UPDATE gates SET failures=MIN(failures+1,?),expires_at=CASE WHEN failures+1>=? THEN MAX(expires_at,?) ELSE expires_at END WHERE key=?',LIMITS.employeeFailures,LIMITS.employeeFailures,Date.now()+LIMITS.windowMs,id).run();
}
async function roster(env) {
  const meta = await stmt(env,'SELECT generation,paused FROM metadata WHERE id=1').first();
  if (!meta?.generation || meta.paused) throw new Refusal(503);
  return meta;
}
async function body(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new Refusal(400);
  // Stream limit, not just Content-Length (which an attacker can omit).
  const reader = request.body?.getReader(); if (!reader) throw new Refusal(400);
  const chunks=[]; let length=0;
  try { while (true) { const r=await reader.read(); if(r.done)break; length+=r.value.length; if(length>2048)throw new Refusal(400); chunks.push(r.value); } }
  finally { await reader.cancel().catch(()=>{}); }
  const bytes=new Uint8Array(length); let offset=0; for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  try {return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new Refusal(400);}
}
function response(origin, value, status=200) {
  return new Response(JSON.stringify(value),{status,headers:{
    'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private, max-age=0',
    'Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Origin',
    ...(origin?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'}:{}),
  }});
}

async function sync(env, request, route, input, now) {
  if (env.SYNC_APPROVED !== 'true' && !['/sync/status','/sync/pause','/sync/purge'].includes(route)) throw new Refusal(503);
  const {bearer,subject}=await authorizeStaff(env,request);
  const owner=await mac(env.MATCH_KEY,'staff:'+subject);
  const admin=(env.ADMIN_UIDS || '').split(',').includes(subject)
    || (env.MODE==='local' && env.ADMIN_UIDS==='demo-authorized-staff');
  if (route==='/sync/status') {
    const pending=await stmt(env,'SELECT COUNT(*) n FROM mutations WHERE settled=0').first();
    const meta=await stmt(env,'SELECT generation,paused,entry_count,excluded_count FROM metadata WHERE id=1').first();
    return {admin,pending:pending.n,paused:Boolean(meta.paused),available:Boolean(meta.generation)&&!meta.paused,count:meta.entry_count,excluded:meta.excluded_count};
  }
  if (route==='/sync/prepare') {
    const pending=await stmt(env,'SELECT COUNT(*) n FROM mutations WHERE settled=0').first();
    if (pending.n>=200) throw new Refusal(409);
    const ticket=crypto.randomUUID();
    // Invalidate BEFORE a Firestore write may be sent. Pending writes never
    // expire into permission to publish: an unknown write result stays closed.
    await env.DB.batch([
      stmt(env,'INSERT INTO mutations(ticket,owner,started_at) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM mutations WHERE owner=? AND settled=0) AND (SELECT COUNT(*) FROM mutations WHERE settled=0)<200',ticket,owner,now,owner),
      stmt(env,"UPDATE metadata SET generation='',synced_at=0 WHERE id=1"),
      stmt(env,'DELETE FROM roster'),stmt(env,'DELETE FROM sync_state'),
    ]);
    if (!(await stmt(env,'SELECT ticket FROM mutations WHERE ticket=? AND owner=?',ticket,owner).first())) throw new Refusal(409);
    return {ticket};
  }
  if (route==='/sync/settle') {
    if (!TOKEN_PATTERN.test(input.ticket || '')) throw new Refusal(400);
    const result=await stmt(env,'UPDATE mutations SET settled=1 WHERE ticket=? AND owner=? RETURNING ticket',input.ticket,owner).first();
    if (!result) throw new Refusal(409);
    return {settled:true};
  }
  if (route==='/sync/pause' || route==='/sync/purge') {
    if (!admin) throw new Refusal(403);
    await env.DB.batch([stmt(env,"UPDATE metadata SET paused=1,generation='',synced_at=0 WHERE id=1"),stmt(env,'DELETE FROM roster'),stmt(env,'DELETE FROM sync_state')]);
    // Keep unresolved write barriers and abuse controls; neither contains a
    // copied employee payload. Pause/purge cannot resurrect a late snapshot.
    return {paused:true,purged:true};
  }
  if (route === '/sync/start') {
    if (!admin) {
      if (!TOKEN_PATTERN.test(input.ticket || '') || !(await stmt(env,'SELECT ticket FROM mutations WHERE ticket=? AND owner=? AND settled=1',input.ticket,owner).first())) throw new Refusal(403);
    }
    const meta=await stmt(env,'SELECT paused FROM metadata WHERE id=1').first();
    if (meta.paused && !(admin && input.resume===true)) throw new Refusal(503);
    if (input.recoverConfirmed===true) {
      if (!admin) throw new Refusal(403);
      const recent=await stmt(env,'SELECT COUNT(*) n FROM mutations WHERE settled=0 AND started_at>?',now-10*MINUTE).first();
      if (recent.n) throw new Refusal(409);
      // Explicit administrator confirmation that all writes have settled and
      // Firestore has been reviewed; never a clock-driven automatic recovery.
      await stmt(env,'DELETE FROM mutations WHERE settled=0').run();
    }
    if ((await stmt(env,'SELECT COUNT(*) n FROM mutations WHERE settled=0').first()).n) throw new Refusal(409);
    const generation=crypto.randomUUID(), empty={count:0,excluded:0,reasons:{},cursor:null,readTime:null};
    const encrypted=await encrypt(env.PAYLOAD_KEY,empty,generation);
    // A master update must not leave an old private roster available after a
    // failed sync. Manual entry stays available while synchronization recovers.
    // Latest start supersedes any earlier snapshot, even from another staff
    // member. Every step/publication is guarded by its generation and owner.
    await env.DB.batch([
      stmt(env,`INSERT INTO sync_state(id,generation,owner,encrypted_state,expires_at,busy) SELECT 1,?,?,?,?,1 WHERE NOT EXISTS(SELECT 1 FROM mutations WHERE settled=0) AND EXISTS(SELECT 1 FROM metadata WHERE paused=0 OR ?=1)
        ON CONFLICT(id) DO UPDATE SET generation=excluded.generation,owner=excluded.owner,encrypted_state=excluded.encrypted_state,expires_at=excluded.expires_at,busy=1`,generation,owner,encrypted,now+10*MINUTE,admin&&input.resume===true?1:0),
      stmt(env,"UPDATE metadata SET generation='',synced_at=0 WHERE id=1 AND EXISTS(SELECT 1 FROM sync_state WHERE generation=? AND owner=?)",generation,owner),
      stmt(env,'DELETE FROM roster WHERE EXISTS(SELECT 1 FROM sync_state WHERE generation=? AND owner=?)',generation,owner),
      stmt(env,'UPDATE sync_state SET busy=0 WHERE generation=? AND owner=?',generation,owner),
      stmt(env,'UPDATE metadata SET paused=0 WHERE id=1 AND EXISTS(SELECT 1 FROM sync_state WHERE generation=? AND owner=?)',generation,owner),
    ]);
    if (!(await stmt(env,'SELECT generation FROM sync_state WHERE generation=? AND owner=?',generation,owner).first())) throw new Refusal(409);
    return {session:generation,count:0,excluded:0,done:false};
  }
  if (route !== '/sync/step' || !TOKEN_PATTERN.test(input.session || '')) throw new Refusal(400);
  const claimed=await stmt(env,`UPDATE sync_state SET busy=1 WHERE id=1 AND generation=? AND owner=? AND expires_at > ? AND busy=0 RETURNING encrypted_state`,input.session,owner,now).first();
  if (!claimed) throw new Refusal(409);
  try {
    const state=await decrypt(env.PAYLOAD_KEY,claimed.encrypted_state,input.session);
    const page=await employeePage(env,bearer,state);
    if (!page.document) {
      // Atomic publication: never expose a partially copied roster.
      await env.DB.batch([
        stmt(env,'UPDATE metadata SET generation=?,synced_at=?,entry_count=?,excluded_count=? WHERE id=1 AND paused=0 AND NOT EXISTS(SELECT 1 FROM mutations WHERE settled=0) AND EXISTS(SELECT 1 FROM sync_state WHERE generation=? AND owner=? AND busy=1)',input.session,now,state.count,state.excluded,input.session,owner),
        stmt(env,'DELETE FROM sync_state WHERE generation=? AND owner=?',input.session,owner),
        stmt(env,'DELETE FROM mutations WHERE settled=1 AND (SELECT generation FROM metadata WHERE id=1)=?',input.session),
      ]);
      if ((await stmt(env,'SELECT generation FROM metadata WHERE id=1').first()).generation!==input.session) throw new Refusal(409);
      return {count:state.count,excluded:state.excluded,reasons:state.reasons,done:true};
    }
    if (state.count+state.excluded >= MAX_EMPLOYEES) throw new Refusal(422);
    const raw=decodeFields(page.document.fields || {}), dob=birthDate(raw,now);
    let reason=dob.error, transferred;
    if (!reason) { try {transferred=transferEmployee(raw);} catch {reason='invalidTransferFields';} }
    const statements=[];
    if (reason) {state.excluded++;state.reasons[reason]=(state.reasons[reason]||0)+1;}
    else {
      // Do not use Firestore document IDs as public selection IDs.
      const id=await mac(env.MATCH_KEY,'selection:'+page.document.name);
      const dobMac=await mac(env.MATCH_KEY,`dob:${id}:${dob.digits}`);
      const ciphertext=await encrypt(env.PAYLOAD_KEY,transferred,input.session+':'+id);
      statements.push(stmt(env,'INSERT INTO roster(generation,selection_id,display_name,dob_mac,ciphertext) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM sync_state WHERE generation=? AND owner=? AND busy=1)',input.session,id,raw.nameSei+' '+raw.nameMei,dobMac,ciphertext,input.session,owner));
      state.count++;
    }
    state.cursor=page.document.name; state.readTime ||= page.readTime;
    if (!state.readTime) throw new Refusal(503);
    statements.push(stmt(env,'UPDATE sync_state SET encrypted_state=?,busy=0 WHERE generation=? AND owner=? AND busy=1',await encrypt(env.PAYLOAD_KEY,state,input.session),input.session,owner));
    await env.DB.batch(statements);
    return {count:state.count,excluded:state.excluded,reasons:state.reasons,done:false};
  } finally {await stmt(env,'UPDATE sync_state SET busy=0 WHERE generation=? AND owner=?',input.session,owner).run();}
}

export default {
  async scheduled(_event,env) {
    const now=Date.now();
    // Retain the active roster indefinitely. Only obsolete or expired staging
    // copies and expired abuse-control records are eligible for cleanup.
    await env.DB.batch([
      stmt(env,'DELETE FROM roster WHERE generation NOT IN(SELECT generation FROM sync_state WHERE expires_at>?) AND generation NOT IN(SELECT generation FROM metadata)',now),
      stmt(env,'DELETE FROM sync_state WHERE expires_at<=?',now),
      stmt(env,'DELETE FROM mutations WHERE ticket IN(SELECT ticket FROM mutations WHERE settled=1 AND started_at<? LIMIT 1000)',now-10*MINUTE),
      stmt(env,'DELETE FROM gates WHERE key IN(SELECT key FROM gates WHERE expires_at<? LIMIT 6000)',now),
    ]);
  },
  async fetch(request,env) {
    const origin=request.headers.get('Origin'), allowed=(env.ALLOWED_ORIGINS || '').split(',').map(x=>x.trim());
    if (!origin || !allowed.includes(origin)) return response(null,{error:generic},403);
    if (request.method === 'OPTIONS') return response(origin,{},200);
    const route=new URL(request.url).pathname, now=Date.now();
    try {
      firestoreBase(env); // refuse a mixed demo/production configuration
      if (route.startsWith('/sync/') && request.method === 'POST') {
        await budget(env,'sync',now);
        return response(origin,await sync(env,request,route,await body(request),now));
      }
      if (env.PUBLIC_ENABLED !== 'true') throw new Refusal(503);
      const isList=route === '/candidates' && request.method === 'GET';
      if (!isList && !(route === '/verify' && request.method === 'POST')) throw new Refusal(404);
      const input=isList?{token:new URL(request.url).searchParams.get('token')}:await body(request);
      if (!TOKEN_PATTERN.test(input.token || '')) throw new Refusal(403);
      await budget(env,'public',now);
      const ip=request.headers.get('CF-Connecting-IP') || (env.MODE === 'local' ? 'local-test' : '');
      if (!ip) throw new Refusal(403);
      // Separate list/verification budgets and allow a shared site Wi-Fi/NAT
      // to serve several workers; the stricter employee lock remains global.
      await attempt(env,`ip:${isList?'list':'verify'}:${ip}`,LIMITS.ipAttempts,now);
      await validateQR(env,input.token);
      const meta=await roster(env,now);
      if (isList) {
        const rows=await stmt(env,'SELECT selection_id,display_name FROM roster WHERE generation=? ORDER BY selection_id LIMIT ?',meta.generation,MAX_EMPLOYEES).all();
        return response(origin,{candidates:rows.results.map(r=>({id:r.selection_id,name:r.display_name}))});
      }
      if (!/^[0-9a-f]{64}$/.test(input.employeeId || '') || !/^\d{8}$/.test(input.birthDate || '')) throw new Refusal(403);
      const gate=await attempt(env,'employee:'+input.employeeId,LIMITS.employeeAttempts,now);
      const row=await stmt(env,'SELECT dob_mac,ciphertext FROM roster WHERE generation=? AND selection_id=?',meta.generation,input.employeeId).first();
      const expected=await mac(env.MATCH_KEY,`dob:${input.employeeId}:${input.birthDate}`);
      if (!row || !equalMac(row.dob_mac,expected)) {await fail(env,gate);throw new Refusal(403);}
      const employee=await decrypt(env.PAYLOAD_KEY,row.ciphertext,meta.generation+':'+input.employeeId);
      // Recheck the QR immediately before disclosing private autofill data.
      await validateQR(env,input.token);
      if ((await roster(env,Date.now())).generation !== meta.generation) throw new Refusal(503);
      return response(origin,{employee});
    } catch (error) {
      // Deliberately no console/error telemetry containing IDs, request bodies,
      // Firestore documents, DOBs, names or cryptographic material.
      return response(origin,{error:generic},error instanceof Refusal?error.status:503);
    }
  },
};
