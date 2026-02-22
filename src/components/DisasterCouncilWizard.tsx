import React, { useState, useEffect } from 'react';
import { MasterData, DisasterCouncilReportData, INITIAL_DISASTER_COUNCIL_REPORT, INITIAL_MASTER_DATA, SavedDraft, SafetyPlanReportData } from '../types';
import { getMasterData, saveDraft, fetchSafetyPlansByProject } from '../services/firebaseService';
import SignatureCanvas from './SignatureCanvas';
import DisasterCouncilPrintLayout from './DisasterCouncilPrintLayout';
import SafetyPlanPrintLayout from './SafetyPlanPrintLayout';

interface Props {
  initialData?: any;
  initialDraftId?: string | null;
  onBackToMenu: () => void;
}

// --- Custom Confirmation Modal ---
interface ConfirmModalProps {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}
const ConfirmationModal: React.FC<ConfirmModalProps> = ({ isOpen, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-fade-in">
        <h3 className="text-lg font-bold text-gray-800 mb-4">確認</h3>
        <p className="text-gray-600 mb-6 whitespace-pre-wrap">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 font-bold">キャンセル</button>
          <button onClick={onConfirm} className="px-4 py-2 text-white bg-red-600 rounded hover:bg-red-700 font-bold">実行する</button>
        </div>
      </div>
    </div>
  );
};

const TOP_FIXED_ROLES = [
  "統括安全衛生責任者",
  "副統括安全衛生責任者",
  "書記",
  "安全委員"
];

const DisasterCouncilWizard: React.FC<Props> = ({ initialData, initialDraftId, onBackToMenu }) => {
  const [step, setStep] = useState(1);
  const [report, setReport] = useState<DisasterCouncilReportData>(initialData || INITIAL_DISASTER_COUNCIL_REPORT);
  const [draftId, setDraftId] = useState<string | null>(initialDraftId || null);
  const [masterData, setMasterData] = useState<MasterData>(INITIAL_MASTER_DATA);
  const [showPreview, setShowPreview] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [previewScale, setPreviewScale] = useState(1);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: () => {} });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [planSelectionModal, setPlanSelectionModal] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<SavedDraft[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SafetyPlanReportData | null>(null);

  useEffect(() => { 
    const loadMaster = async () => { 
      try { 
        const data = await getMasterData(); 
        setMasterData(data); 
      } catch (e) { 
        console.error("マスタ取得エラー", e); 
      } 
    }; 
    loadMaster(); 
  }, []);

  useEffect(() => { 
    if (!showPreview) return; 
    const handleResize = () => { 
      const A4_WIDTH_PX = 794; 
      const PADDING_PX = 40; 
      const availableWidth = window.innerWidth - PADDING_PX; 
      setPreviewScale(availableWidth < A4_WIDTH_PX ? availableWidth / A4_WIDTH_PX : 1); 
    }; 
    window.addEventListener('resize', handleResize); 
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize); 
  }, [showPreview]);

  useEffect(() => {
    if (report.contractor !== "松浦建設株式会社") {
      updateReport({ contractor: "松浦建設株式会社" });
    }
  }, [report.contractor]);

  useEffect(() => {
    let hasChanged = false;
    const nextAttendees = [...report.gcAttendees];
    while(nextAttendees.length < 8) {
      nextAttendees.push({ role: "", name: "" });
      hasChanged = true;
    }
    TOP_FIXED_ROLES.forEach((role, idx) => {
      if (nextAttendees[idx].role !== role) {
        nextAttendees[idx] = { ...nextAttendees[idx], role: role };
        hasChanged = true;
      }
    });
    if (hasChanged) {
      updateReport({ gcAttendees: nextAttendees });
    }
  }, [report.gcAttendees]);

  const updateReport = (updates: Partial<DisasterCouncilReportData>) => { setReport(prev => ({ ...prev, ...updates })); setSaveStatus('idle'); setHasUnsavedChanges(true); };
  
  // ★修正: バリデーション付きの次へボタン処理
  const handleNext = () => {
    if (step === 1) {
      if (!report.project || !report.date || !report.location) {
        alert("未入力の項目があります。\n全ての項目を選択・入力してください。");
        return;
      }
    }
    setStep(prev => Math.min(prev + 1, 2));
  };

  const handleBack = () => setStep(prev => Math.max(prev - 1, 1));

  const handleTempSave = async () => { 
    setSaveStatus('saving'); 
    try { 
      const newId = await saveDraft(draftId, 'DISASTER_COUNCIL', report); 
      setDraftId(newId); 
      setSaveStatus('saved'); 
      setHasUnsavedChanges(false); 
      setTimeout(() => setSaveStatus('idle'), 2000); 
    } catch (e) { 
      console.error(e); 
      alert("保存に失敗しました"); 
      setSaveStatus('idle'); 
    } 
  };
  
  const handlePreviewClick = async () => {
    setSaveStatus('saving');
    try {
      const newId = await saveDraft(draftId, 'DISASTER_COUNCIL', report); 
      setDraftId(newId); 
      setSaveStatus('saved'); 
      setHasUnsavedChanges(false); 
      setTimeout(() => setSaveStatus('idle'), 2000);
      
      const plans = await fetchSafetyPlansByProject(report.project);
      if (plans.length === 0) { alert(`工事名「${report.project}」の安全管理計画表が見つかりません。\n\nホーム画面に戻って、先に「安全管理計画表」を作成・保存してください。`); return; }
      setAvailablePlans(plans); setPlanSelectionModal(true);
    } catch (e) { alert("エラーが発生しました"); setSaveStatus('idle'); }
  };

  const confirmPlanSelection = (plan: SavedDraft) => { setSelectedPlan(plan.data as SafetyPlanReportData); setPlanSelectionModal(false); setShowPreview(true); };
  const handlePrint = () => { const prevTitle = document.title; document.title = `災害防止協議会_${report.project}_第${report.count}回`; window.print(); document.title = prevTitle; };
  
  const handleHomeClick = () => { if (hasUnsavedChanges) { setConfirmModal({ isOpen: true, message: "保存されていない変更があります。\n保存せずにホームに戻りますか？", onConfirm: () => { setConfirmModal(prev => ({ ...prev, isOpen: false })); onBackToMenu(); } }); } else { onBackToMenu(); } };

  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800 border-l-4 border-green-600 pl-3">STEP 1: 基本情報</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="form-control">
          <label className="label font-bold text-gray-700">工事名 <span className="text-red-500">*</span></label>
          <select className={`w-full p-3 border rounded-lg bg-white text-black outline-none appearance-none ${!report.project ? 'border-red-300' : 'border-gray-300'}`} value={report.project} onChange={(e) => updateReport({project: e.target.value})}>
            <option value="">(データを選択してください)</option>
            {masterData.projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-control"><label className="label font-bold text-gray-700">開催回</label><div className="flex items-center"><span className="mr-2">第</span><input type="number" className="w-20 p-3 border border-gray-300 rounded-lg text-center" value={report.count} onChange={(e) => updateReport({count: parseInt(e.target.value)})} /><span className="ml-2">回</span></div></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="form-control"><label className="label font-bold text-gray-700">開催日 <span className="text-red-500">*</span></label><input type="date" className="w-full p-3 border border-gray-300 rounded-lg bg-white text-black outline-none appearance-none" value={report.date} onChange={(e) => updateReport({date: e.target.value})} /></div>
        <div className="form-control">
          <label className="label font-bold text-gray-700">場所 <span className="text-red-500">*</span></label>
          <select className={`w-full p-3 border rounded-lg bg-white text-black outline-none appearance-none ${!report.location ? 'border-red-300' : 'border-gray-300'}`} value={report.location} onChange={(e) => updateReport({location: e.target.value})}>
            <option value="">(データを選択してください)</option>
            {masterData.locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="form-control"><label className="label font-bold text-gray-700">開始時間</label><input type="time" className="w-full p-3 border border-gray-300 rounded-lg" value={report.startTime} onChange={(e) => updateReport({startTime: e.target.value})} /></div>
        <div className="form-control"><label className="label font-bold text-gray-700">終了時間</label><input type="time" className="w-full p-3 border border-gray-300 rounded-lg" value={report.endTime} onChange={(e) => updateReport({endTime: e.target.value})} /></div>
      </div>
      <div className="form-control"><label className="label font-bold text-gray-700">元請会社名</label><input type="text" className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 text-black outline-none cursor-not-allowed font-bold" value="松浦建設株式会社" readOnly /></div>
    </div>
  );

  const updateGCAttendee = (index: number, field: 'role' | 'name', value: string) => {
    const newAttendees = [...report.gcAttendees];
    if (!newAttendees[index]) newAttendees[index] = { role: '', name: '' };
    newAttendees[index] = { ...newAttendees[index], [field]: value };
    updateReport({ gcAttendees: newAttendees });
  };

  const [tempSubRole, setTempSubRole] = useState("");
  const [tempSubCompany, setTempSubCompany] = useState("");
  const [sigKey, setSigKey] = useState(0); 
  
  const addSubAttendee = (signatureDataUrl: string) => {
    if (!tempSubCompany || !tempSubRole) return;
    const newAttendee = {
      id: Date.now().toString(),
      company: tempSubCompany,
      role: tempSubRole,
      name: "", 
      signatureDataUrl
    };
    updateReport({ subcontractorAttendees: [...report.subcontractorAttendees, newAttendee] });
    setSigKey(prev => prev + 1);
  };

  const renderStep2 = () => (
    <div className="space-y-8">
      <h2 className="text-xl font-bold text-gray-800 border-l-4 border-green-600 pl-3">STEP 2: 出席者</h2>
      
      {/* GC Attendees */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="font-bold text-gray-700 mb-3">元請 出席者</h3>
        <div className="grid grid-cols-1 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              {i < 4 ? (
                <span className="w-40 h-10 flex items-center justify-center text-xs font-bold bg-gray-50 px-2 border rounded text-gray-700">{TOP_FIXED_ROLES[i]}</span>
              ) : (
                <select className="w-40 h-10 text-xs font-bold bg-white px-2 border rounded text-center outline-none appearance-none" value={report.gcAttendees[i]?.role || ""} onChange={(e) => updateGCAttendee(i, 'role', e.target.value)}>
                  <option value="">(役職選択)</option>
                  {masterData.roles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              )}
              <select className="flex-1 h-10 p-2 border rounded text-sm bg-white text-black outline-none appearance-none" value={report.gcAttendees[i]?.name || ""} onChange={(e) => updateGCAttendee(i, 'name', e.target.value)}>
                <option value="">選択してください</option>
                {masterData.supervisors.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Subcontractor Attendees */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="font-bold text-gray-700 mb-3 text-center">協力会社 出席者登録</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-bold text-gray-500">会社名 <span className="text-red-500">*</span></label>
            <select className={`w-full p-2 border rounded bg-white text-black outline-none appearance-none ${!tempSubCompany ? 'border-red-300' : 'border-gray-300'}`} value={tempSubCompany} onChange={(e) => setTempSubCompany(e.target.value)}>
              <option value="">(データを選択してください)</option>
              {masterData.contractors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500">役職</label>
            <select className="w-full p-2 border rounded bg-white text-black outline-none appearance-none" value={tempSubRole} onChange={(e) => setTempSubRole(e.target.value)}>
              <option value="">(データを選択してください)</option>
              {masterData.roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="mb-3">
          <label className="text-xs font-bold text-gray-500 mb-1 block">署名</label>
          {/* ★修正: 会社名未選択時は署名できないように制御 */}
          <div className={`border rounded border-gray-300 relative ${!tempSubCompany ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
            <SignatureCanvas key={sigKey} onSave={(data) => addSubAttendee(data)} onClear={() => {}} lineWidth={4} keepOpenOnSave={true} />
            {!tempSubCompany && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-red-100 text-red-600 px-3 py-1 rounded text-xs font-bold border border-red-300">会社名を選択してください</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <div>
        <h3 className="font-bold text-gray-700 mb-2">登録済み協力会社一覧 ({report.subcontractorAttendees.length}名)</h3>
        <div className="space-y-2">
          {report.subcontractorAttendees.map((att) => (
            <div key={att.id} className="flex justify-between items-center p-3 bg-white border rounded shadow-sm">
              <div><div className="font-bold text-sm">{att.company}</div><div className="flex items-center gap-2 mt-1"><span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{att.role}</span>{att.signatureDataUrl && (<img src={att.signatureDataUrl} alt="sig" className="h-6 object-contain border border-gray-200 bg-white" />)}</div></div><button onClick={() => updateReport({ subcontractorAttendees: report.subcontractorAttendees.filter(a => a.id !== att.id) })} className="text-red-400 hover:text-red-600"><i className="fa-solid fa-trash"></i></button>
            </div>
          ))}
          {report.subcontractorAttendees.length === 0 && <div className="text-center text-gray-400 text-sm py-4">登録なし</div>}
        </div>
      </div>
    </div>
  );

  const renderPlanSelectionModal = () => {
    if (!planSelectionModal) return null;
    return (
      <div className="fixed inset-0 z-[70] bg-gray-900 bg-opacity-80 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 animate-fade-in">
          <h3 className="text-lg font-bold text-gray-800 mb-4">添付する安全管理計画表を選択</h3>
          <p className="text-sm text-gray-600 mb-4">工事名「{report.project}」の計画表が見つかりました。</p>
          <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
             {availablePlans.map(plan => { const d = plan.data as SafetyPlanReportData; return ( <button key={plan.id} onClick={() => confirmPlanSelection(plan)} className="w-full text-left border rounded p-3 hover:bg-blue-50 transition-colors flex justify-between items-center"><div><div className="font-bold text-blue-800">{d.month}月度 計画表</div><div className="text-xs text-gray-500">更新: {new Date(plan.lastModified).toLocaleString('ja-JP')}</div></div><i className="fa-solid fa-chevron-right text-gray-400"></i></button> ) })}
          </div>
          <button onClick={() => setPlanSelectionModal(false)} className="w-full py-2 bg-gray-200 text-gray-700 rounded font-bold">キャンセル</button>
        </div>
      </div>
    );
  };

  const renderPreviewModal = () => {
    if (!showPreview) return null;
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-90 flex flex-col no-print">
        <div className="sticky top-0 bg-gray-800 text-white p-4 shadow-lg flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold"><i className="fa-solid fa-eye mr-2"></i> 印刷プレビュー</h2>
          <div className="flex gap-4">
            <button onClick={() => setShowPreview(false)} className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500">閉じる</button>
            <button onClick={handlePrint} className="px-6 py-2 bg-green-600 rounded font-bold hover:bg-green-500 shadow-md flex items-center"><i className="fa-solid fa-print mr-2"></i> 印刷する</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center gap-10 bg-gray-800">
          <div className="bg-white shadow-2xl" style={{ width: '210mm', transform: `scale(${previewScale})`, transformOrigin: 'top center' }}>
            <DisasterCouncilPrintLayout data={report} />
          </div>
          {selectedPlan && (
            <div className="bg-white shadow-2xl" style={{ width: '1123px', height: '794px', transform: `scale(${previewScale * 0.7})`, transformOrigin: 'top center' }}>
               <SafetyPlanPrintLayout data={selectedPlan} />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="no-print min-h-screen pb-24 bg-gray-50">
        <header className="bg-slate-800 text-white p-4 shadow-md sticky top-0 z-10 flex justify-between items-center"><div className="flex items-center gap-3"><button onClick={handleHomeClick} className="text-white hover:text-gray-300"><i className="fa-solid fa-house"></i></button><h1 className="text-lg font-bold"><i className="fa-solid fa-people-group mr-2"></i>災害防止協議会</h1></div>
        </header>
        <div className="bg-white p-4 shadow-sm mb-4"><div className="flex justify-between text-xs font-bold text-gray-400 mb-2"><span className={step >= 1 ? "text-green-600" : ""}>STEP 1</span><span className={step >= 2 ? "text-green-600" : ""}>STEP 2</span></div><div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden"><div className="bg-green-600 h-full transition-all duration-300" style={{ width: `${step * 50}%` }}></div></div></div>
        <main className="mx-auto p-4 bg-white shadow-lg rounded-lg min-h-[60vh] max-w-3xl">{step === 1 && renderStep1()}{step === 2 && renderStep2()}</main>
        <footer className="fixed bottom-0 left-0 w-full bg-white border-t p-4 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
          <div className="flex items-center gap-2"><button onClick={handleBack} disabled={step === 1} className={`px-4 py-3 rounded-lg font-bold ${step === 1 ? 'text-gray-300' : 'text-gray-600 bg-gray-100'}`}>戻る</button><button onClick={handleTempSave} className="px-4 py-3 rounded-lg font-bold border border-green-200 text-green-600 bg-green-50 hover:bg-green-100 flex items-center"><i className={`fa-solid ${saveStatus === 'saved' ? 'fa-check' : 'fa-save'} mr-2`}></i>{saveStatus === 'saved' ? '保存完了' : '一時保存'}</button></div>
          {/* ★修正: handleNextを使用 */}
          {step < 2 ? (<button onClick={handleNext} className="px-8 py-3 bg-green-600 text-white rounded-lg font-bold shadow hover:bg-green-700 flex items-center">次へ <i className="fa-solid fa-chevron-right ml-2"></i></button>) : (<button onClick={handlePreviewClick} className="px-8 py-3 bg-cyan-600 text-white rounded-lg font-bold shadow hover:bg-cyan-700 flex items-center"><i className="fa-solid fa-file-pdf mr-2"></i> プレビュー</button>)}
        </footer>
      </div>
      {showPreview && renderPreviewModal()}
      {renderPlanSelectionModal()}
      <ConfirmationModal isOpen={confirmModal.isOpen} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })} />
      <div className="hidden print:block">
         <DisasterCouncilPrintLayout data={report} />
         {selectedPlan && (
            <>
               <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }}></div>
               <div style={{ width: '297mm', height: '210mm', transform: 'rotate(90deg) translate(0, -210mm)', transformOrigin: 'top left', position: 'absolute', overflow: 'hidden' }}>
                  <SafetyPlanPrintLayout data={selectedPlan} />
               </div>
            </>
         )}
      </div>
    </>
  );
};

export default DisasterCouncilWizard;
