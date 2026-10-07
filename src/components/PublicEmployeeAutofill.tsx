import React, { useEffect, useRef, useState } from 'react';
import { listPublicEmployeeCandidates, verifyEmployeeAutofill } from '../services/publicEmployeeAutofillService';
import type { EmployeeAutofillData, PublicEmployeeCandidate } from '../services/publicEmployeeAutofillService';

export default function PublicEmployeeAutofill({ token, onVerified }: { token: string; onVerified: (data: EmployeeAutofillData) => void }) {
  const [candidates, setCandidates] = useState<PublicEmployeeCandidate[]>([]);
  const [selected, setSelected] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const version = useRef(0);
  const inFlight = useRef<number | null>(null);
  useEffect(() => {
    const request = ++version.current;
    inFlight.current = null;
    setLoading(true); setBusy(false); setCandidates([]); setSelected(''); setBirthDate(''); setMessage(''); setLoadFailed(false);
    listPublicEmployeeCandidates(token).then(data => { if (request === version.current) setCandidates(data); })
      .catch(() => { if (request === version.current) { setLoadFailed(true); setMessage('社員情報を読み込めませんでした。手入力でも提出できます。'); } })
      .finally(() => { if (request === version.current) setLoading(false); });
    return () => { version.current++; };
  }, [token, reload]);
  const verify = async () => {
    if (inFlight.current !== null || !selected) return;
    if (!/^\d{8}$/.test(birthDate)) { setMessage('生年月日を西暦8桁の数字で入力してください。'); return; }
    const request = ++version.current;
    inFlight.current = request;
    setBusy(true); setMessage('');
    try {
      const data = await verifyEmployeeAutofill(token, selected, birthDate);
      if (request !== version.current) return;
      onVerified(data); setMessage('社員情報を読み込みました。');
    } catch (error) {
      if (request !== version.current) return;
      const code = (error as { code?: string }).code;
      setMessage(code === 'functions/resource-exhausted' ? '短時間の試行回数が上限に達しました。1分ほど待つか、手入力をご利用ください。' : '本人確認ができませんでした。氏名と生年月日を確認してください。手入力でも提出できます。');
    } finally { if (inFlight.current === request) inFlight.current = null; if (request === version.current) { setBusy(false); setBirthDate(''); } }
  };
  return <section className="bg-green-50 p-4 rounded border border-green-200 w-full" aria-label="公開社員自動入力">
    <h3 className="font-bold text-green-800 mb-2">松浦建設株式会社の社員の方</h3>
    <p className="text-sm mb-3">自動入力を使わず、手入力でも提出できます。</p>
    {loading ? <p role="status">氏名一覧を読み込み中…</p> : loadFailed ? <button type="button" className="border rounded p-2" onClick={() => setReload(n => n + 1)}>氏名一覧を再読込</button> : <>
      <label className="block font-bold">氏名<select aria-label="本人確認する社員氏名" disabled={busy} className="w-full border rounded p-2 bg-white mt-1 mb-3" value={selected} onChange={e => { version.current++; setSelected(e.target.value); setBirthDate(''); setMessage(''); }}>
        <option value="">自分の氏名を選択してください</option>{candidates.map(c => <option key={c.employeePublicId} value={c.employeePublicId}>{c.displayName}</option>)}
      </select></label>
      <p className="text-sm">本人確認のため、生年月日を西暦8桁の数字で入力してください。</p>
      <p className="text-sm">例：1995年1月1日 → 19950101</p>
      <p className="text-sm mb-2">※「-」や「/」は入力しません。</p>
      <label className="block font-bold">生年月日<input aria-label="本人確認用の生年月日" type="text" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} autoComplete="off" disabled={busy} value={birthDate} className="w-full border rounded p-2 bg-white mt-1 mb-3" onChange={e => setBirthDate(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))} /></label>
      <button type="button" disabled={busy || !selected || birthDate.length !== 8} onClick={verify} className="bg-green-700 text-white rounded px-4 py-2 disabled:opacity-40">{busy ? '本人確認中…' : '社員情報を自動入力'}</button>
      <button type="button" disabled={busy} onClick={() => setReload(n => n + 1)} className="border rounded px-3 py-2 mt-2 sm:mt-0 sm:ml-2">氏名一覧を再読込</button>
      {candidates.length === 0 && <p className="text-sm mt-2">自分の氏名がない場合は手入力をご利用ください。</p>}
    </>}
    {message && <p role="status" className="text-sm mt-3">{message}</p>}
  </section>;
}
