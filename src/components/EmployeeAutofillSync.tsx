import React, { useState } from 'react';
import { publicAutofillConfigured, synchronizeEmployeeAutofill } from '../services/employeeAutofillService';

export function useEmployeeAutofillSync() {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const sync=async()=>{
    if (!publicAutofillConfigured || busy) return;
    setBusy(true);setMessage('公開QR用社員情報を同期中…');
    try {
      const result=await synchronizeEmployeeAutofill((count,excluded)=>setMessage(`${count}件同期、${excluded}件を要確認として処理中…`));
      setMessage(`同期完了：${result.count}件。要確認：${result.excluded}件。${result.excluded?'生年月日の元号・年月日、必須転記項目を社員名簿で確認して修正後に再同期してください。':''}`);
    } catch {
      setMessage('公開QR用社員情報の同期に失敗しました。Firestoreの社員保存結果は維持されます。公開自動入力は利用できない場合があります。「公開QR用社員情報を再同期」で再実行してください。');
    } finally {setBusy(false);}
  };
  return {busy,message,sync};
}
export default function EmployeeAutofillSync({busy,message,onSync}: {busy:boolean;message:string;onSync:()=>void}) {
  if (!publicAutofillConfigured) return null;
  return <div className="border rounded-lg bg-green-50 p-4 my-4">
    <p className="text-sm mb-3">公開QRの社員自動入力用に、管理者が承認したCloudflare保存先へ転記項目を同期します。署名・電子印はコピーしません。</p>
    <button type="button" disabled={busy} className="border rounded p-3 bg-white font-bold disabled:opacity-50" onClick={onSync}>公開QR用社員情報を再同期</button>
    {message && <p role="status" className="mt-3 font-bold">{message}</p>}
  </div>;
}
