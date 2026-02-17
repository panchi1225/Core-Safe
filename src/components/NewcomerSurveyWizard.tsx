import React, { useState, useEffect } from 'react';
import { MasterData, NewcomerSurveyReportData, INITIAL_NEWCOMER_SURVEY_REPORT, Qualifications, INITIAL_MASTER_DATA } from '../types';
import { getMasterData, saveDraft, saveMasterData, deleteDraftsByProject } from '../services/firebaseService';
import SignatureCanvas from './SignatureCanvas';
import NewcomerSurveyPrintLayout from './NewcomerSurveyPrintLayout';

interface Props {
  initialData?: any;
  initialDraftId?: string | null;
  onBackToMenu: () => void;
}

// --- 安全装置: データを完全な形に修復する関数 ---
const sanitizeReportData = (data: any): NewcomerSurveyReportData => {
  if (!data) return INITIAL_NEWCOMER_SURVEY_REPORT;
  const safeQualifications = { ...INITIAL_NEWCOMER_SURVEY_REPORT.qualifications, ...(data.qualifications || {}) };
  return { ...INITIAL_NEWCOMER_SURVEY_REPORT, ...data, qualifications: safeQualifications };
};

// --- Modals ---
interface ConfirmModalProps { isOpen: boolean; message: string; onConfirm: () => void; onCancel: () => void; }
const ConfirmationModal: React.FC<ConfirmModalProps> = ({ isOpen, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">確認</h3>
        <p className="text-gray-600 mb-6 whitespace-pre-wrap">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 font-bold text-gray-600">キャンセル</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold">実行する</button>
        </div>
      </div>
    </div>
  );
};

// --- Master Section ---
const MasterSection: React.FC<{title: string; items: string[]; onUpdate: (items: string[]) => void; onDeleteRequest: (index: number, item: string) => void;}> = ({ title, items, onUpdate, onDeleteRequest }) => {
  const [newItem, setNewItem] = useState("");
  const handleAdd = () => { if (newItem.trim()) { onUpdate([...items, newItem.trim()]); setNewItem(""); } };
  return (
    <div className="border border-gray-200 p-4 rounded-lg bg-white shadow-sm break-inside-avoid">
      <h3 className="font-bold mb-3 text-lg text-gray-800 border-b pb-2 flex justify-between items-center">{title}<span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{items.length}件</span></h3>
      <ul className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
        {items.map((item, idx) => (<li key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded hover:bg-gray-100 transition-colors"><span className="text-sm text-gray-800 break-all mr-2">{item}</span><button type="button" onClick={(e) => { e.stopPropagation(); onDeleteRequest(idx, item); }} className="text-gray-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition-colors"><i className="fa-solid fa-trash"></i></button></li>))}
        {items.length === 0 && <li className="text-gray-400 text-sm italic text-center py-2">データがありません</li>}
      </ul>
      <div className="flex gap-2"><input type="text" className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm bg-white text-black focus:ring-2 focus:ring-blue-500 outline-none" placeholder="新規項目を追加..." value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} /><button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 whitespace-nowrap shadow-sm transition-colors"><i className="fa-solid fa-plus mr-1"></i>追加</button></div>
    </div>
  );
};

const LABEL_MAP: Record<string, string> = { projects: "工事名", supervisors: "実施者（職長・監督）", subcontractors: "協力会社名" };
const RELEVANT_MASTER_KEYS: (keyof MasterData)[] = ['projects', 'supervisors', 'subcontractors'];

const NewcomerSurveyWizard: React.FC<Props> = ({ initialData, initialDraftId, onBackToMenu }) => {
  const [step, setStep] = useState(1);
  const [report, setReport] = useState<NewcomerSurveyReportData>(sanitizeReportData(initialData));
  const [draftId, setDraftId] = useState<string | null>(initialDraftId || null);
  const [masterData, setMasterData] = useState<MasterData>(INITIAL_MASTER_DATA);
  const [isMasterMode, setIsMasterMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [previewScale, setPreviewScale] = useState(1);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: () => {} });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [sigKey, setSigKey] = useState(0);
  const [previewSigUrl, setPreviewSigUrl] = useState<string | null>(null);

  useEffect(() => { const loadMaster = async () => { try { const data = await getMasterData(); setMasterData(data); } catch (e) { console.error("マスタ取得エラー", e); } }; loadMaster(); }, []);
  useEffect(() => { if (!showPreview) return; const handleResize = () => { const A4_WIDTH_PX = 794; const PADDING_PX = 40; const availableWidth = window.innerWidth - PADDING_PX; setPreviewScale(availableWidth < A4_WIDTH_PX ? availableWidth / A4_WIDTH_PX : 1); }; window.addEventListener('resize', handleResize); handleResize(); return () => window.removeEventListener('resize', handleResize); }, [showPreview]);

  useEffect(() => {
    const calculateAge = () => {
      if (report.birthYear === '' || report.birthMonth === '' || report.birthDay === '') return report.age;
      let yearAD = 0;
      if (report.birthEra === 'Showa') yearAD = 1925 + report.birthYear; else if (report.birthEra === 'Heisei') yearAD = 1988 + report.birthYear;
      if (yearAD === 0) return report.age;
      const today = new Date(); const birthDate = new Date(yearAD, report.birthMonth - 1, report.birthDay);
      let age = today.getFullYear() - birthDate.getFullYear(); const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
      return Math.max(0, age);
    };
    const newAge = calculateAge();
    if (newAge !== report.age && report.birthYear !== '' && report.birthMonth !== '' && report.birthDay !== '') setReport(prev => ({ ...prev, age: newAge }));
  }, [report.birthEra, report.birthYear, report.birthMonth, report.birthDay]);

  const updateReport = (updates: Partial<NewcomerSurveyReportData>) => { setReport(prev => ({ ...prev, ...updates })); setSaveStatus('idle'); setHasUnsavedChanges(true); };
  const updateQual = (key: keyof Qualifications, value: any) => { setReport(prev => ({ ...prev, qualifications: { ...prev.qualifications, [key]: value } })); setSaveStatus('idle'); setHasUnsavedChanges(true); };
  
  const handleTempSave = async () => { setSaveStatus('saving'); try { const newId = await saveDraft(draftId, 'NEWCOMER_SURVEY', report); setDraftId(newId); setSaveStatus('saved'); setHasUnsavedChanges(false); setTimeout(() => setSaveStatus('idle'), 2000); } catch (e) { console.error(e); alert("保存に失敗しました"); setSaveStatus('idle'); } };

  const handleSaveAndPrint = async () => {
    setSaveStatus('saving');
    try {
      const newId = await saveDraft(draftId, 'NEWCOMER_SURVEY', report);
      setDraftId(newId);
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
      const prevTitle = document.title;
      const fileName = `新規_${report.company || '未入力'}_${report.name || '未入力'}`;
      document.title = fileName;
      window.print();
      document.title = prevTitle;
    } catch (e) { alert("保存に失敗しました"); setSaveStatus('idle'); }
  };

  const handleHomeClick = () => { if (hasUnsavedChanges) { setConfirmModal({ isOpen: true, message: "保存されていない変更があります。\n保存せずにホームに戻りますか？", onConfirm: () => { setConfirmModal(prev => ({ ...prev, isOpen: false })); onBackToMenu(); } }); } else { onBackToMenu(); } };
  const handleSignatureSave = (dataUrl: string) => { updateReport({ signatureDataUrl: dataUrl }); setSigKey(prev => prev + 1); };

  // --- RENDER STEPS ---
  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800 border-l-4 border-purple-600 pl-3">STEP 1: 基本情報</h2>
      <div className="bg-purple-50 p-4 rounded border border-purple-100 grid grid-cols-1 md:grid-cols-2 gap-4">
         <div className="col-span-1 md:col-span-2 text-sm text-purple-700 font-bold mb-1"><i className="fa-solid fa-circle-info mr-1"></i>はじめに現場を選択してください</div>
         <div><label className="block text-xs font-bold text-gray-700 mb-1">作業所名 (マスタ選択)</label><select className="w-full p-2 border border-purple-300 rounded bg-white font-bold" value={report.project} onChange={(e)=>updateReport({project: e.target.value})}>{masterData.projects.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
         <div><label className="block text-xs font-bold text-gray-700 mb-1">作業所長名 (マスタ選択)</label><select className="w-full p-2 border border-purple-300 rounded bg-white" value={report.director} onChange={(e)=>updateReport({director: e.target.value})}>{masterData.supervisors.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="form-control"><label className="label font-bold text-gray-700">氏名（フリガナ）</label><input type="text" className="w-full p-2 border rounded mb-2" placeholder="氏名" value={report.name} onChange={(e) => updateReport({name: e.target.value})} /><input type="text" className="w-full p-2 border rounded" placeholder="フリガナ" value={report.furigana} onChange={(e) => updateReport({furigana: e.target.value})} /></div><div className="form-control"><label className="label font-bold text-gray-700">生年月日・性別</label><div className="flex gap-2 mb-2 items-center"><select className="p-2 border rounded" value={report.birthEra} onChange={(e)=>updateReport({birthEra: e.target.value as any})}><option value="Showa">昭和</option><option value="Heisei">平成</option></select><input type="number" className="w-14 p-2 border rounded text-center" value={report.birthYear} onChange={(e)=>updateReport({birthYear: e.target.value === '' ? '' : parseInt(e.target.value)})} placeholder="年" /><span>年</span><input type="number" className="w-12 p-2 border rounded text-center" value={report.birthMonth} onChange={(e)=>updateReport({birthMonth: e.target.value === '' ? '' : parseInt(e.target.value)})} placeholder="月" /><span>月</span><input type="number" className="w-12 p-2 border rounded text-center" value={report.birthDay} onChange={(e)=>updateReport({birthDay: e.target.value === '' ? '' : parseInt(e.target.value)})} placeholder="日" /><span>日</span></div><div className="flex gap-4 items-center"><div className="flex gap-2 border p-1 rounded bg-white"><label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={report.gender === 'Male'} onChange={() => updateReport({gender: 'Male'})} />男</label><label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={report.gender === 'Female'} onChange={() => updateReport({gender: 'Female'})} />女</label></div><div className="flex items-center gap-2"><input type="number" className="w-16 p-2 border rounded text-center bg-gray-100" readOnly value={report.age} /><span>歳</span></div></div></div></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="form-control"><label className="label font-bold text-gray-700">所属会社名 (マスタ選択)</label><select className="w-full p-2 border rounded mb-2" value={report.company} onChange={(e) => updateReport({company: e.target.value})}>{masterData.subcontractors.map(c => <option key={c} value={c}>{c}</option>)}</select><div className="flex items-center gap-2 text-sm"><span>(</span><input type="text" className="w-10 border-b text-center" value={report.subcontractorRank} onChange={(e)=>updateReport({subcontractorRank: e.target.value})} /><span>次) 下請け</span></div></div><div className="form-control"><label className="label font-bold text-gray-700">経験年数</label><div className="flex items-center gap-2 mt-2"><input type="number" className="w-16 p-2 border rounded text-center" value={report.experienceYears} onChange={(e)=>updateReport({experienceYears: parseInt(e.target.value)})} /><span>年</span><input type="number" className="w-16 p-2 border rounded text-center" value={report.experienceMonths} onChange={(e)=>updateReport({experienceMonths: parseInt(e.target.value)})} /><span>ヶ月</span></div></div></div>
      <div className="form-control"><label className="label font-bold text-gray-700">職種</label><div className="flex gap-2"><select className="w-1/2 p-2 border rounded" value={report.jobType} onChange={(e) => updateReport({jobType: e.target.value})}><option value="土工">土工</option><option value="鳶">鳶</option><option value="大工">大工</option><option value="オペ">オペ</option><option value="鉄筋工">鉄筋工</option><option value="交通整理人">交通整理人</option><option value="その他">その他</option></select>{report.jobType === 'その他' && (<input type="text" className="flex-1 p-2 border rounded" placeholder="詳細を入力" value={report.jobTypeOther} onChange={(e)=>updateReport({jobTypeOther: e.target.value})} />)}</div></div>
      <div className="form-control"><label className="label font-bold text-gray-700">現住所・電話番号</label><input type="text" className="w-full p-2 border rounded mb-2" placeholder="住所" value={report.address} onChange={(e) => updateReport({address: e.target.value})} /><input type="text" className="w-full p-2 border rounded" placeholder="電話番号" value={report.phone} onChange={(e) => updateReport({phone: e.target.value})} /></div>
      <div className="form-control bg-gray-50 p-3 rounded"><label className="label font-bold text-gray-700 mb-2 block">緊急連絡先</label><div className="mb-2"><label className="text-xs text-gray-500 font-bold mb-1 block">氏名</label><input type="text" className="w-full p-2 border rounded" placeholder="氏名" value={report.emergencyContactName} onChange={(e) => updateReport({emergencyContactName: e.target.value})} /></div><div className="grid grid-cols-2 gap-3"><div><label className="text-xs text-gray-500 font-bold mb-1 block">続柄</label><select className="w-full p-2 border rounded bg-white" value={report.emergencyContactRelation} onChange={(e) => updateReport({emergencyContactRelation: e.target.value})}><option value="">選択してください</option><option value="妻">妻</option><option value="夫">夫</option><option value="父">父</option><option value="母">母</option><option value="子">子</option><option value="兄">兄</option><option value="弟">弟</option><option value="姉">姉</option><option value="妹">妹</option><option value="祖父">祖父</option><option value="祖母">祖母</option><option value="同居人">同居人</option><option value="その他">その他</option></select></div><div><label className="text-xs text-gray-500 font-bold mb-1 block">緊急電話番号</label><input type="text" className="w-full p-2 border rounded" placeholder="090-0000-0000" value={report.emergencyContactPhone} onChange={(e) => updateReport({emergencyContactPhone: e.target.value})} /></div></div></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="form-control"><label className="label font-bold text-gray-700">血液型</label><div className="flex gap-2"><select className="p-2 border rounded" value={report.bloodType} onChange={(e) => updateReport({bloodType: e.target.value})}><option value="A">A</option><option value="B">B</option><option value="O">O</option><option value="AB">AB</option></select><span className="self-center">型</span><span className="self-center ml-2">RH</span><select className="p-2 border rounded" value={report.bloodTypeRh} onChange={(e) => updateReport({bloodTypeRh: e.target.value as any})}><option value="Plus">+</option><option value="Minus">-</option></select></div></div><div className="form-control"><label className="label font-bold text-gray-700">健康診断受診日 (令和)</label><div className="flex gap-1 items-center"><input type="number" className="w-14 p-2 border rounded text-center" value={report.healthCheckYear} onChange={(e)=>updateReport({healthCheckYear: parseInt(e.target.value)})} /><span>年</span><input type="number" className="w-12 p-2 border rounded text-center" value={report.healthCheckMonth} onChange={(e)=>updateReport({healthCheckMonth: parseInt(e.target.value)})} /><span>月</span><input type="number" className="w-12 p-2 border rounded text-center" value={report.healthCheckDay} onChange={(e)=>updateReport({healthCheckDay: parseInt(e.target.value)})} /><span>日</span></div></div></div>
      <div className="form-control"><label className="label font-bold text-gray-700">建退協加入</label><div className="flex gap-4 mt-1"><label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 border rounded shadow-sm"><input type="radio" checked={report.kentaikyo === 'Joined'} onChange={() => updateReport({kentaikyo: 'Joined'})} />加入している</label><label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 border rounded shadow-sm"><input type="radio" checked={report.kentaikyo === 'NotJoined'} onChange={() => updateReport({kentaikyo: 'NotJoined'})} />加入していない</label></div></div>
    </div>
  );

  const renderStep2 = () => {
    const qual = report.qualifications || {};
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-800 border-l-4 border-purple-600 pl-3">STEP 2: 資格</h2>
        <p className="text-sm text-gray-500">保有している資格にチェックを入れてください。</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded border shadow-sm">
             <h3 className="font-bold border-b mb-3">技能講習</h3>
             <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={qual.vehicle_leveling} onChange={(e)=>updateQual('vehicle_leveling', e.target.checked)} />車輌系建設機械（整地、積込運搬等）</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={qual.vehicle_demolition} onChange={(e)=>updateQual('vehicle_demolition', e.target.checked)} />車輌系建設機械（解体用）</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={qual.mobile_crane} onChange={(e)=>updateQual('mobile_crane', e.target.checked)} />小型移動クレーン</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={qual.slinging} onChange={(e)=>updateQual('slinging', e.target.checked)} />玉掛</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={qual.gas_welding} onChange={(e)=>updateQual('gas_welding', e.target.checked)} />ガス溶接</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={qual.earth_retaining} onChange={(e)=>updateQual('earth_retaining', e.target.checked)} />土留め支保工作業主任者</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={qual.excavation} onChange={(e)=>updateQual('excavation', e.target.checked)} />地山掘削作業主任者</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={qual.scaffolding} onChange={(e)=>updateQual('scaffolding', e.target.checked)} />足場組立て等作業主任者</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={qual.formwork} onChange={(e)=>updateQual('formwork', e.target.checked)} />型枠支保工作業主任者</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={qual.oxygen_deficiency} onChange={(e)=>updateQual('oxygen_deficiency', e.target.checked)} />酸素欠乏危険作業主任者</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={qual.rough_terrain} onChange={(e)=>updateQual('rough_terrain', e.target.checked)} />不整地運搬車</label>
             </div>
          </div>
          <div className="space-y-6">
             <div className="bg-white p-4 rounded border shadow-sm">
               <h3 className="font-bold border-b mb-3">特別教育</h3>
               <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={qual.arc_welding} onChange={(e)=>updateQual('arc_welding', e.target.checked)} />アーク溶接</label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={qual.grinding_wheel} onChange={(e)=>updateQual('grinding_wheel', e.target.checked)} />研削といし取替え業務</label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={qual.low_voltage} onChange={(e)=>updateQual('low_voltage', e.target.checked)} />低圧電気取扱</label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={qual.roller} onChange={(e)=>updateQual('roller', e.target.checked)} />ローラー運転業務</label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={qual.asbestos} onChange={(e)=>updateQual('asbestos', e.target.checked)} />石綿取り扱い業務</label>
               </div>
             </div>
             <div className="bg-white p-4 rounded border shadow-sm">
               <h3 className="font-bold border-b mb-3">その他</h3>
               <label className="flex items-center gap-2 cursor-pointer mb-4"><input type="checkbox" checked={qual.foreman} onChange={(e)=>updateQual('foreman', e.target.checked)} />職長教育</label>
               <div className="text-sm font-bold mb-2">上記以外の資格</div>
               <div className="space-y-2">
                  <input type="text" className="w-full p-2 border rounded" placeholder="資格名" value={qual.otherText1} onChange={(e)=>updateQual('otherText1', e.target.value)} />
                  <input type="text" className="w-full p-2 border rounded" placeholder="資格名" value={qual.otherText2} onChange={(e)=>updateQual('otherText2', e.target.value)} />
                  <input type="text" className="w-full p-2 border rounded" placeholder="資格名" value={qual.otherText3} onChange={(e)=>updateQual('otherText3', e.target.value)} />
               </div>
             </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800 border-l-4 border-purple-600 pl-3">STEP 3: 誓約・署名</h2>
      <div className="bg-gray-50 p-6 rounded-lg border leading-relaxed text-gray-800"><h3 className="font-bold text-lg mb-4 text-center">新規入場時誓約</h3><ul className="list-disc pl-5 space-y-2 mb-6"><li>私は当作業所の新規入場時教育を受けました。</li><li>作業所の遵守事項やルールを厳守し作業します。</li><li>どんな小さなケガでも、必ず当日に報告します。</li><li>自分の身を守り、また周囲の人の安全にも気を配ります。</li><li>危険個所を発見したときは、直ちに現場責任者もしくは元請職員に連絡します。</li><li>作業中は有資格者証を携帯します。</li><li>記載した個人情報を緊急時連絡等、労務・安全衛生管理に使用することに同意します。</li><li>上記の事項を相違なく報告します。</li></ul><div className="bg-white p-4 rounded border text-center"><div className="mb-4"><label className="font-bold mr-2">誓約日 (令和)</label><input type="number" className="w-12 p-2 border rounded text-center" value={report.pledgeDateYear} onChange={(e)=>updateReport({pledgeDateYear: parseInt(e.target.value)})} />年<input type="number" className="w-12 p-2 border rounded text-center" value={report.pledgeDateMonth} onChange={(e)=>updateReport({pledgeDateMonth: parseInt(e.target.value)})} />月<input type="number" className="w-12 p-2 border rounded text-center" value={report.pledgeDateDay} onChange={(e)=>updateReport({pledgeDateDay: parseInt(e.target.value)})} />日</div><label className="block font-bold text-gray-700 mb-2">本人署名</label><div className="mx-auto w-full max-w-sm"><SignatureCanvas key={sigKey} onSave={handleSignatureSave} onClear={()=>{ updateReport({signatureDataUrl: null}) }} lineWidth={6} /></div>{report.signatureDataUrl && (<div className="mt-4"><p className="text-xs text-green-600 font-bold mb-1">署名済み</p><div className="cursor-pointer hover:opacity-80 transition-opacity inline-block border border-transparent hover:border-blue-300 rounded p-1" onClick={() => setPreviewSigUrl(report.signatureDataUrl)} title="タップして拡大"><img src={report.signatureDataUrl} alt="Signature" className="h-10 mx-auto border" /></div></div>)}</div></div>
    </div>
  );

  const renderPreviewModal = () => (
    <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-90 flex flex-col no-print">
      <div className="sticky top-0 bg-gray-800 text-white p-4 shadow-lg flex justify-between items-center shrink-0">
        <h2 className="text-lg font-bold"><i className="fa-solid fa-eye mr-2"></i> 印刷プレビュー</h2>
        <div className="flex gap-4">
          <button onClick={() => setShowPreview(false)} className="px-4 py-2 bg-gray-600 rounded">閉じる</button>
          <button onClick={handleSaveAndPrint} className="px-6 py-2 bg-green-600 rounded font-bold shadow-md flex items-center">
            <i className="fa-solid fa-print mr-2"></i> 保存して印刷
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex justify-center">
        <div style={{ width: '794px', transform: `scale(${previewScale})`, transformOrigin: 'top center', marginBottom: `${(previewScale - 1) * 100}%` }}>
          <NewcomerSurveyPrintLayout data={report} />
        </div>
      </div>
    </div>
  );

  if (isMasterMode) return (<> {renderMasterManager()} <ConfirmationModal isOpen={confirmModal.isOpen} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} /> </>);

  // ★変更: classNameに max-w-3xl を適用
  return (
    <>
      <div className="no-print min-h-screen pb-24 bg-gray-50">
        <header className="bg-slate-800 text-white p-4 shadow-md sticky top-0 z-10 flex justify-between items-center">
          <div className="flex items-center gap-3"><button onClick={handleHomeClick} className="text-white hover:text-gray-300"><i className="fa-solid fa-house"></i></button><h1 className="text-lg font-bold"><i className="fa-solid fa-person-circle-question mr-2"></i>新規入場者アンケート</h1></div><button onClick={() => setIsMasterMode(true)} className="text-xs bg-slate-700 px-2 py-1 rounded hover:bg-slate-600 transition-colors"><i className="fa-solid fa-gear mr-1"></i>設定</button>
        </header>
        <div className="bg-white p-4 shadow-sm mb-4"><div className="flex justify-between text-xs font-bold text-gray-400 mb-2"><span className={step >= 1 ? "text-purple-600" : ""}>基本情報</span><span className={step >= 2 ? "text-purple-600" : ""}>資格</span><span className={step >= 3 ? "text-purple-600" : ""}>誓約・署名</span></div><div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden"><div className="bg-purple-600 h-full transition-all duration-300" style={{ width: `${step * 33.3}%` }}></div></div></div>
        
        {/* ★ここを max-w-3xl に固定 */}
        <main className="mx-auto p-4 bg-white shadow-lg rounded-lg min-h-[60vh] max-w-3xl">
           {step === 1 && renderStep1()}
           {step === 2 && renderStep2()}
           {step === 3 && renderStep3()}
        </main>

        <footer className="fixed bottom-0 left-0 w-full bg-white border-t p-4 flex justify-between items-center shadow-md z-20">
          <div className="flex items-center gap-2"><button onClick={() => setStep(prev => Math.max(1, prev - 1))} disabled={step === 1} className={`px-4 py-3 rounded-lg font-bold ${step === 1 ? 'text-gray-300' : 'text-gray-600 bg-gray-100'}`}>戻る</button><button onClick={handleTempSave} className="px-4 py-3 rounded-lg font-bold border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 flex items-center"><i className={`fa-solid ${saveStatus === 'saved' ? 'fa-check' : 'fa-save'} mr-2`}></i>{saveStatus === 'saved' ? '保存完了' : '一時保存'}</button></div>
          {step < 3 ? (<button onClick={() => setStep(prev => prev + 1)} className="px-8 py-3 bg-purple-600 text-white rounded-lg font-bold shadow hover:bg-purple-700 flex items-center">次へ <i className="fa-solid fa-chevron-right ml-2"></i></button>) : (<button onClick={() => setShowPreview(true)} className="px-8 py-3 bg-cyan-600 text-white rounded-lg font-bold shadow hover:bg-cyan-700 flex items-center"><i className="fa-solid fa-file-pdf mr-2"></i> プレビュー</button>)}
        </footer>
      </div>
      
      {previewSigUrl && (<div className="fixed inset-0 z-[100] bg-black bg-opacity-90 flex flex-col items-center justify-center p-4" onClick={() => setPreviewSigUrl(null)}><div className="bg-white p-1 rounded-lg shadow-2xl overflow-hidden max-w-full max-h-[80vh]"><img src={previewSigUrl} alt="Signature Preview" className="max-w-full max-h-[70vh] object-contain" /></div><button className="mt-6 text-white text-lg font-bold flex items-center gap-2 bg-gray-700 px-6 py-2 rounded-full hover:bg-gray-600 transition-colors"><i className="fa-solid fa-xmark"></i> 閉じる</button></div>)}
      {showPreview && renderPreviewModal()}
      <ConfirmationModal isOpen={confirmModal.isOpen} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })} />
      
      <div className="hidden print:block">
         <NewcomerSurveyPrintLayout data={report} />
      </div>
    </>
  );
};

export default NewcomerSurveyWizard;