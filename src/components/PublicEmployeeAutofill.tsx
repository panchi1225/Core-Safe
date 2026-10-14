import React, { useEffect, useRef, useState } from 'react';
import { EmployeeData } from '../types';
import { EmployeeCandidate, getEmployeeCandidates, publicAutofillConfigured, verifyPublicEmployee } from '../services/employeeAutofillService';

export default function PublicEmployeeAutofill({token,onAutofill,onReset=()=>{}}: {token:string;onAutofill:(employee:Partial<EmployeeData>)=>void;onReset?:()=>void}) {
  const [employeeMode,setEmployeeMode]=useState(false);
  const [candidates,setCandidates]=useState<EmployeeCandidate[]>([]);
  const [selected,setSelected]=useState(''), [birthDate,setBirthDate]=useState('');
  const [busy,setBusy]=useState(false), [message,setMessage]=useState('');
  const requestVersion=useRef(0);
  useEffect(()=>()=>{++requestVersion.current;},[token]);
  const choose=async(mode:boolean)=>{
    const version=++requestVersion.current;
    onReset();
    setEmployeeMode(mode);setSelected('');setBirthDate('');setMessage('');
    if (!mode) {setBusy(false);return;}
    setBusy(true);
    try {const list=await getEmployeeCandidates(token);if(version===requestVersion.current){setCandidates(list);if(!list.length)setMessage('社員一覧が未設定です。手入力をご利用ください。');}}
    catch {if(version===requestVersion.current)setMessage('社員一覧を取得できませんでした。手入力をご利用いただくか、管理者へお問い合わせください。');}
    finally {if(version===requestVersion.current)setBusy(false);}
  };
  const verify=async()=>{
    if (busy || !selected || !/^\d{8}$/.test(birthDate)) return;
    const version=++requestVersion.current;setBusy(true);setMessage('');
    try {
      const employee=await verifyPublicEmployee(token,selected,birthDate);
      if(version===requestVersion.current){onAutofill(employee);setBirthDate('');setMessage('自動入力しました。各項目を確認し、ご本人が署名して提出してください。');}
    } catch {if(version===requestVersion.current)setMessage('確認できませんでした。入力内容を確認し、しばらく待ってからお試しください。手入力でも提出できます。');}
    finally {if(version===requestVersion.current)setBusy(false);}
  };
  if (!publicAutofillConfigured) return <p className="text-sm text-gray-700">松浦建設株式会社の社員の方も、各項目を入力してください。</p>;
  return <section className="bg-green-50 rounded-lg border border-green-200 p-4 space-y-4" aria-label="公開QRの社員自動入力">
    <p className="font-bold text-lg">入力方法を選んでください</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button type="button" aria-pressed={employeeMode} className={`min-h-14 p-4 rounded-lg border-2 text-lg font-bold ${employeeMode?'bg-green-700 text-white':'bg-white'}`} onClick={()=>choose(true)}>松浦建設の社員</button>
      <button type="button" aria-pressed={!employeeMode} className={`min-h-14 p-4 rounded-lg border-2 text-lg font-bold ${!employeeMode?'bg-gray-700 text-white':'bg-white'}`} onClick={()=>choose(false)}>協力会社・手入力</button>
    </div>
    {employeeMode && <>
      <label className="block font-bold text-lg">お名前<select aria-label="社員のお名前" className="block w-full min-h-14 p-3 mt-2 border-2 rounded-lg bg-white text-lg" value={selected} disabled={busy} onChange={e=>{++requestVersion.current;onReset();setSelected(e.target.value);setBirthDate('');setMessage('');}}><option value="">選択してください</option>{candidates.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="block font-bold text-lg">生年月日（西暦8桁）<input aria-label="本人確認用の生年月日" className="block w-full min-h-14 p-3 mt-2 border-2 rounded-lg text-xl" type="text" inputMode="numeric" autoComplete="off" maxLength={8} placeholder="例：19500101" value={birthDate} disabled={busy} onChange={e=>setBirthDate(e.target.value.replace(/[^0-9]/g,''))}/></label>
      <button type="button" disabled={busy || !selected || !/^\d{8}$/.test(birthDate)} onClick={verify} className="w-full min-h-14 p-4 rounded-lg bg-green-700 text-white text-lg font-bold disabled:opacity-50">{busy?'確認中…':'生年月日を確認して自動入力'}</button>
      <p className="text-sm">一覧は氏名だけです。生年月日を照合するまで住所などの情報は取得しません。</p>
    </>}
    {message && <p role="status" className="font-bold whitespace-pre-wrap">{message}</p>}
  </section>;
}
