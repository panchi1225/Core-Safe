import type { EmployeeData } from '../types';

function value(raw: any): any {
  if (raw===null) return {nullValue:null};
  if (typeof raw==='string') return {stringValue:raw};
  if (typeof raw==='boolean') return {booleanValue:raw};
  if (typeof raw==='number' && Number.isFinite(raw)) return Number.isInteger(raw)?{integerValue:String(raw)}:{doubleValue:raw};
  if (Array.isArray(raw)) return {arrayValue:{values:raw.map(value)}};
  if (raw && typeof raw==='object') return {mapValue:{fields:fields(raw)}};
  throw new Error('社員データの形式が正しくありません。');
}
export const fields = (raw: object) => Object.fromEntries(Object.entries(raw).map(([key,v])=>[key,value(v)]));
function masks(raw: object, prefix: string[] = []): string[] {
  return Object.entries(raw).flatMap(([key,v])=>{
    const part=/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)?key:'`'+key.replaceAll('\\','\\\\').replaceAll('`','\\`')+'`';
    const path=[...prefix,part];
    return v && typeof v==='object' && !Array.isArray(v) && Object.keys(v).length?masks(v,path):[path.join('.')];
  });
}
export function employeeWriteBody(project: string, employee: EmployeeData | string) {
  const id=typeof employee==='string'?employee:(employee.id || String(Date.now()));
  if (!id || id.includes('/')) throw new Error('社員IDが正しくありません。');
  const name=`projects/${project}/databases/(default)/documents/employees/${id}`;
  if (typeof employee==='string') return {writes:[{delete:name}]};
  const data=JSON.parse(JSON.stringify({...employee,id},(_key,v)=>v===undefined?null:v));
  // Same merge semantics as the existing setDoc; unrelated fields stay intact.
  return {writes:[{update:{name,fields:fields(data)},updateMask:{fieldPaths:masks(data)}}]};
}
export async function writeEmployeeOnServer(employee: EmployeeData | string, idToken: string) {
  const { app }=await import('../firebase');
  const project=app.options.projectId;
  const local=import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS==='true';
  if (project!==(local?'demo-core-safe':'core-safe')) throw new Error('接続先の確認に失敗しました。');
  const base=local?'http://127.0.0.1:18080/v1':'https://firestore.googleapis.com/v1';
  // REST commit obeys the existing Rules and never persists a deferred offline
  // write. Timeout/ambiguous response leaves the Worker barrier closed.
  const response=await fetch(`${base}/projects/${project}/databases/(default)/documents:commit`,{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+idToken},
    body:JSON.stringify(employeeWriteBody(project,employee)),credentials:'omit',cache:'no-store',
    redirect:'error',signal:AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Firestoreへの社員変更を確認できませんでした。');
}
