import React, { useEffect, useRef, useState } from 'react';
import { changeEmployeeAndAutofill, controlEmployeeAutofill, employeeSyncStatus, publicAutofillConfigured, synchronizeEmployeeAutofill } from '../services/employeeAutofillService';
import { EmployeeChangeError } from '../utils/employeeSyncChange';

export function useEmployeeAutofillSync() {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[admin,setAdmin]=useState(false);
  const running=useRef(false),revision=useRef(0);
  useEffect(()=>{
    if (!publicAutofillConfigured) return;
    let current=true;const initialRevision=revision.current;
    employeeSyncStatus().then(s=>{if(current){setAdmin(s.admin);if(revision.current===initialRevision&&!s.available)setMessage(s.pending?'未完了の社員変更があり、公開自動入力は停止しています。管理者に保存結果の確認と復旧を依頼してください。':'公開自動入力は未設定または停止中です。初回設定・復旧は管理者が行います。');}}).catch(()=>{if(current&&revision.current===initialRevision)setMessage('公開用社員情報の接続状態を確認できません。社員変更前の無効化に失敗した場合、変更は開始しません。');});
    return()=>{current=false;};
  },[]);
  const progress=(count:number,excluded:number)=>setMessage(`${count}件を自動同期中、${excluded}件を要確認として処理中…`);
  const change=async(write:(idToken?:string)=>Promise<void>)=>{
    if (running.current) return false;
    running.current=true;revision.current++;setBusy(true);setMessage('旧情報の無効化、社員変更、自動同期を処理中…');
    let copied=0,excluded=0;
    try {await changeEmployeeAndAutofill(write,(count,skipped)=>{copied=count;excluded=skipped;progress(count,skipped);});setMessage(publicAutofillConfigured?`社員変更と自動同期が完了しました。同期${copied}件、要確認${excluded}件。${excluded?'社員名簿の元号・年月日・必要項目を確認してください。':''}`:'社員変更が完了しました。');return true;}
    catch(e){setMessage(e instanceof Error?e.message:'社員変更を確認できませんでした。管理者に確認してください。');return e instanceof EmployeeChangeError && e.saved;}
    finally {running.current=false;setBusy(false);}
  };
  const sync=async()=>{
    if (!publicAutofillConfigured || running.current || !admin) return;
    running.current=true;revision.current++;setBusy(true);setMessage('初回同期／例外時の復旧を処理中…');
    try {
      const status=await employeeSyncStatus();
      const recoverConfirmed=status.pending>0;
      if (recoverConfirmed && !window.confirm('未完了の社員変更があります。全端末の社員変更操作を停止し、Firestoreで保存・削除結果を確認しましたか？確認済みの場合だけ復旧してください。開始から10分未満の処理がある場合は復旧できません。')) {setMessage('復旧を中止しました。公開自動入力は停止したままです。');return;}
      const result=await synchronizeEmployeeAutofill(progress,{resume:true,recoverConfirmed});
      setMessage(`同期完了：${result.count}件。要確認：${result.excluded}件。${result.excluded?'社員名簿の元号・年月日・転記項目を確認してください。':''}日常の再同期操作は不要です。`);
    } catch {setMessage('復旧同期を確認できません。未完了の社員変更、保存結果、通信・権限を確認してください。公開自動入力は停止しています。');}
    finally {running.current=false;setBusy(false);}
  };
  const control=async(action:'pause'|'purge')=>{
    if (running.current || !admin || !window.confirm(action==='purge'?'公開自動入力を停止し、Cloudflareの全社員コピーと同期セッションを消去します。Firestoreの社員マスタは削除しません。実行しますか？':'公開自動入力を停止し、社員コピーを削除します。手入力は継続できます。実行しますか？')) return;
    running.current=true;revision.current++;setBusy(true);
    try {await controlEmployeeAutofill(action);setMessage('公開自動入力を停止し、Cloudflareの社員コピーと同期セッションを消去しました。Firestoreの社員マスタは維持しています。');}
    catch {setMessage('停止・消去を確認できませんでした。Cloudflareの状態を管理者が確認してください。');}
    finally {running.current=false;setBusy(false);}
  };
  return {busy,message,admin,sync,change,control};
}
export default function EmployeeAutofillSync({busy,admin,onSync,onControl}: {busy:boolean;admin:boolean;onSync:()=>void;onControl:(action:'pause'|'purge')=>void}) {
  if (!publicAutofillConfigured) return null;
  return <div className="border rounded-lg bg-green-50 p-4 my-4">
    <p className="text-sm">公開QR用社員情報は登録・変更・削除時に自動反映されます。日常の同期操作は不要です。</p>
    {admin && <details className="mt-3"><summary className="font-bold cursor-pointer">管理者の初回設定・障害復旧・アプリ外変更</summary>
      <p className="text-sm my-3">通常の社員更新には使いません。Firebase Console等で変更するときは先に公開自動入力を停止し、変更後に同期してください。</p>
      <button type="button" disabled={busy} className="border rounded p-3 bg-white font-bold disabled:opacity-50" onClick={onSync}>初回同期／例外時の復旧同期</button>
      <button type="button" disabled={busy} className="border rounded p-3 bg-white ml-2 disabled:opacity-50" onClick={()=>onControl('pause')}>公開自動入力を停止</button>
      <button type="button" disabled={busy} className="border rounded p-3 bg-white ml-2 text-red-700 disabled:opacity-50" onClick={()=>onControl('purge')}>全同期データを消去</button>
    </details>}
  </div>;
}
