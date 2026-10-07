import React, { useEffect, useState, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';
import { getMasterData } from '../services/firebaseService';
import { MasterData, INITIAL_MASTER_DATA } from '../types';
import { PublicNewcomerForm } from '../utils/newcomerAccess';
import { deactivatePublicNewcomerForm, issuePublicNewcomerForm, listPublicNewcomerForms } from '../services/publicNewcomerService';

export default function PublicQRManager({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [masterData, setMasterData] = useState<MasterData>(INITIAL_MASTER_DATA);
  const [ready, setReady] = useState(false);
  const printRef = useRef<HTMLElement>(null);
  const print = useReactToPrint({ contentRef: printRef, documentTitle: '新規入場者QR' });
  const [project, setProject] = useState('');
  const [director, setDirector] = useState('');
  const [expiry, setExpiry] = useState('');
  const [forms, setForms] = useState<PublicNewcomerForm[]>([]);
  const [selected, setSelected] = useState<PublicNewcomerForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = async () => { const items = await listPublicNewcomerForms(); setForms(items); return items; };
  useEffect(() => {
    let current = true; setReady(false); setSelected(null);
    if (isOpen) { setError(''); Promise.all([getMasterData(), listPublicNewcomerForms()]).then(([master, items]) => { if (current) { setMasterData(master); setForms(items); setReady(true); } }).catch(() => { if (current) setError('マスタまたは発行済みQRを取得できませんでした。'); }); }
    return () => { current = false; };
  }, [isOpen]);
  if (!isOpen) return null;
  const url = new URL(window.location.href); url.search = ''; url.hash = '';
  url.searchParams.set('form', 'newcomer'); if (selected) url.searchParams.set('token', selected.token);
  const issue = async () => {
    setBusy(true); setError('');
    try {
      const token = await issuePublicNewcomerForm(project, director, new Date(expiry).getTime(), masterData.contractors);
      const items = await refresh(); setSelected(items.find(f => f.token === token) || null);
    } catch { setError('QRを発行できませんでした。入力値・権限・通信状況をご確認ください。'); }
    finally { setBusy(false); }
  };
  const disable = async (form: PublicNewcomerForm) => {
    setBusy(true); setError('');
    try { await deactivatePublicNewcomerForm(form.token); if (selected?.token === form.token) setSelected(null); await refresh(); }
    catch { setError('無効化できませんでした。'); } finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-50 bg-black/60 overflow-auto p-4"><div className="bg-white rounded-xl max-w-3xl mx-auto p-6">
    <div className="flex justify-between mb-4"><h2 className="text-xl font-bold text-purple-800">新規入場者QRの発行・管理</h2><button onClick={onClose}>閉じる</button></div>
    <div className="grid sm:grid-cols-2 gap-4 no-print">
      <label>現場<select className="border rounded p-2 w-full" value={project} onChange={e => setProject(e.target.value)}><option value="">選択してください</option>{masterData.projects.map(p => <option key={p}>{p}</option>)}</select></label>
      <label>作業所長<select className="border rounded p-2 w-full" value={director} onChange={e => setDirector(e.target.value)}><option value="">選択してください</option>{masterData.supervisors.map(p => <option key={p}>{p}</option>)}</select></label>
      <label>有効期限（必須）<input className="border rounded p-2 w-full" type="datetime-local" value={expiry} onChange={e => setExpiry(e.target.value)} /></label>
      <button disabled={!ready || busy || !project || !director || !expiry || !(new Date(expiry).getTime() > Date.now())} className="bg-purple-600 text-white rounded p-3 disabled:opacity-40" onClick={issue}>QRを発行</button>
    </div>
    <p className="text-sm text-gray-600 my-3 no-print">登録済みの協力会社名だけを公開フォームへコピーします。旧方式のQRは再発行してください。</p>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {selected && <section ref={printRef} className="text-center border rounded p-4 my-4"><h3 className="font-bold">{selected.project}</h3><p>作業所長：{selected.director}</p><p>有効期限：{new Date(selected.expiresAt).toLocaleString('ja-JP')}</p><QRCodeCanvas className="mx-auto my-4" value={url.toString()} size={250} level="H" includeMargin /><p>新規入場者アンケート</p><button className="no-print border rounded p-2 mt-3" onClick={() => { const canvas = printRef.current?.querySelector('canvas') as HTMLCanvasElement | null; if (!canvas) return; const a = document.createElement('a'); a.href = canvas.toDataURL(); a.download = '新規入場者QR.png'; a.click(); }}>QR画像を保存</button><button className="no-print border rounded p-2 ml-3" onClick={() => print()}>QRを印刷</button></section>}
    <h3 className="font-bold mt-6 no-print">発行済みQR</h3>
    <div className="space-y-3 no-print">{forms.map(form => <div className="border rounded p-3" key={form.token}><p className="font-bold">{form.project}</p><p>作業所長：{form.director}</p><p className="text-sm">発行：{new Date(form.createdAt).toLocaleString('ja-JP')} ／ 期限：{new Date(form.expiresAt).toLocaleString('ja-JP')}</p><p>{!form.active ? '無効' : form.expiresAt <= Date.now() ? '期限切れ' : '有効'}</p>{form.active && <>{form.expiresAt > Date.now() && <button className="border rounded px-3 py-1 mr-3" onClick={() => setSelected(form)}>QRを表示</button>}<button disabled={busy} className="text-red-600 border rounded px-3 py-1" onClick={() => disable(form)}>無効化</button></>}</div>)}</div>
  </div></div>;
}
