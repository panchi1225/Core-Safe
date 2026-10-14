import { EmployeeData } from '../types';
import { guardedEmployeeChange } from '../utils/employeeSyncChange';

const configuredURL = import.meta.env?.VITE_PUBLIC_AUTOFILL_URL || '';
function endpoint() {
  if (!configuredURL) throw new Error('社員自動入力は未設定です。各項目を手入力してください。');
  const url = new URL(configuredURL);
  const local = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
  if (local ? url.origin !== 'http://127.0.0.1:18787' : url.protocol !== 'https:') throw new Error('社員自動入力の接続設定が正しくありません。');
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('社員自動入力の接続設定が正しくありません。');
  return url.origin;
}
export const publicAutofillConfigured = Boolean(configuredURL);
export interface EmployeeCandidate { id: string; name: string; }
class AutofillRequestError extends Error {
  constructor(public status:number) {super('確認できませんでした。入力内容を確認し、しばらく待ってからお試しください。手入力でも提出できます。');}
}
async function call(path: string, data?: object, idToken?: string) {
  const response = await fetch(endpoint()+path,{method:data?'POST':'GET',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',
    headers:{...(data?{'Content-Type':'application/json'}:{}),...(idToken?{Authorization:'Bearer '+idToken}:{})},
    ...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new AutofillRequestError(response.status);
  return response.json();
}
export async function getEmployeeCandidates(token: string): Promise<EmployeeCandidate[]> {
  const result=await call('/candidates?token='+encodeURIComponent(token));
  return result.candidates.map((c: EmployeeCandidate)=>({id:c.id,name:c.name}));
}
export async function verifyPublicEmployee(token: string, employeeId: string, birthDate: string): Promise<Partial<EmployeeData>> {
  return (await call('/verify',{token,employeeId,birthDate})).employee;
}
export async function synchronizeEmployeeAutofill(onProgress: (count: number, excluded: number) => void = () => {}, options: object = {}) {
  const { auth } = await import('../firebase');
  const user=auth.currentUser;
  if (!user) throw new Error('社員ログインが必要です。');
  const start=await call('/sync/start',options,await user.getIdToken());
  let result=start;
  // Worker reads one record per request; ID token is never stored in D1.
  for (let i=0;i<=200;i++) {
    if (auth.currentUser?.uid !== user.uid) throw new Error('ログイン状態が変わったため同期を中止しました。');
    result=await call('/sync/step',{session:start.session},await user.getIdToken());
    onProgress(result.count,result.excluded);
    if (result.done) return result as {count:number;excluded:number;reasons:Record<string,number>;done:true};
  }
  throw new Error('同期上限を超えました。管理者へお問い合わせください。');
}
export async function employeeSyncStatus(): Promise<{admin:boolean;pending:number;paused:boolean;available:boolean;count:number;excluded:number}> {
  const { auth }=await import('../firebase');
  if (!auth.currentUser) throw new Error('社員ログインが必要です。');
  return call('/sync/status',{},await auth.currentUser.getIdToken());
}
export async function controlEmployeeAutofill(action: 'pause'|'purge') {
  const { auth }=await import('../firebase');
  if (!auth.currentUser) throw new Error('社員ログインが必要です。');
  return call('/sync/'+action,{},await auth.currentUser.getIdToken());
}
export async function changeEmployeeAndAutofill(write: (idToken?: string) => Promise<void>, onProgress: (count:number,excluded:number)=>void) {
  if (!publicAutofillConfigured) {await write();return;}
  const { auth }=await import('../firebase');
  const user=auth.currentUser;
  if (!user) throw new Error('社員ログインが必要です。');
  const check=()=>{if(auth.currentUser?.uid!==user.uid)throw new Error('ログイン状態が変わりました。');};
  await guardedEmployeeChange({
    prepare:async()=>{check();return call('/sync/prepare',{},await user.getIdToken());},
    write:async()=>{check();await write(await user.getIdToken());},
    settle:async ticket=>{check();await call('/sync/settle',{ticket},await user.getIdToken());},
    synchronize:async ticket=>{
      try {return await synchronizeEmployeeAutofill(onProgress,{ticket});}
      catch(error) {
        // Another staff update may own the newer snapshot. Wait for its safe
        // publication rather than asking either user to press a retry button.
        if (!(error instanceof AutofillRequestError) || ![403,409].includes(error.status)) throw error;
        const deadline=Date.now()+15000;
        do {
          check();const status=await employeeSyncStatus();
          if (status.available && status.pending===0) {onProgress(status.count,status.excluded);return;}
          if (status.paused) throw error;
          await new Promise(resolve=>setTimeout(resolve,750));
        } while (Date.now()<deadline);
        throw error;
      }
    },
  });
}
