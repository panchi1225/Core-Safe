import React, { useState, useEffect } from 'react';
import { MasterData, DisasterCouncilReportData, INITIAL_DISASTER_COUNCIL_REPORT, SubcontractorAttendee, INITIAL_MASTER_DATA, SavedDraft, SafetyPlanReportData } from '../types';
import { getMasterData, saveDraft, saveMasterData, deleteDraftsByProject, fetchSafetyPlansByProject } from '../services/firebaseService';
import SignatureCanvas from './SignatureCanvas';
import DisasterCouncilPrintLayout from './DisasterCouncilPrintLayout';
import SafetyPlanPrintLayout from './SafetyPlanPrintLayout';

interface Props {
  initialData?: any;
  initialDraftId?: string | null;
  onBackToMenu: () => void;
}

// --- Modals ---
interface ConfirmModalProps { isOpen: boolean; message: string; onConfirm: () => void; onCancel: () => void; }
const ConfirmationModal: React.FC<ConfirmModalProps> = ({ isOpen, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-fade-in">
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

const ProjectDeleteModal: React.FC<{ isOpen: boolean; projectName: string; onConfirm: () => void; onCancel: () => void; }> = ({ isOpen, projectName, onConfirm, onCancel }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { if (isOpen) { setPassword(""); setError(""); } }, [isOpen]);
  if (!isOpen) return null;
  const handleConfirm = () => { if (password === "4043") { onConfirm(); } else { setError("パスワードが間違っています"); } };
  return (
    <div className="fixed inset-0 z-[80] bg-gray-900 bg-opacity-60 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 animate-fade-in border-l-8 border-red-600">
        <h3 className="text-xl font-bold text-red-600 mb-4 flex items-center"><i className="fa-solid fa-triangle-exclamation mr-2"></i>重要：削除の確認</h3>
        <p className="text-gray-800 font-bold mb-2">工事名「{projectName}」を削除しますか？</p>
        <div className="bg-red-50 p-3 rounded mb-4 text-sm text-red-800 leading-relaxed"><strong>【注意】</strong><br/>この操作を行うと、この工事名で保存されている<br/><span className="font-bold underline text-red-600 text-base">すべての一時保存データも同時に削除されます。</span><br/>この操作は取り消せません。</div>
        <div className="mb-6"><label className="block text-xs font-bold text-gray-500 mb-1">管理者パスワードを入力 (4043)</label><input type="password" className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 outline-none text-lg tracking-widest" placeholder="PASS" value={password} onChange={(e) => setPassword(e.target.value)} />{error && <p className="text-red-500 text-xs mt-1 font-bold"><i className="fa-solid fa-circle-exclamation mr-1"></i>{error}</p>}</div>
        <div className="flex justify-end gap-3"><button onClick={onCancel} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 font-bold text-gray-600">キャンセル</button><button onClick={handleConfirm} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold shadow-md">完全削除を実行</button></div>
      </div>
    </div>
  );
};

// --- Master Section (List View) ---
const MasterSection: React.FC<{
  title: string;
  items: string[];
  onUpdate: (items: string[]) => void;
  onDeleteRequest: (index: number, item: string) => void;
  onBack: () => void;
}> = ({ title, items, onUpdate, onDeleteRequest, onBack }) => {
  const [newItem, setNewItem] = useState("");
  const handleAdd = () => { if (newItem.trim()) { onUpdate([...items, newItem.trim()]); setNewItem(""); } };
  return (
    <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
      <div className="p-4 border-b flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-blue-600"><i className="fa-solid fa-arrow-left text-xl"></i></button>
        <h3 className="font-bold text-lg text-gray-800 flex-1">{title} <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full ml-2">{items.length}件</span></h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <ul className="space-y-2">
          {items.map((item, idx) => (
            <li key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded hover:bg-gray-100 transition-colors">
              <span className="text-sm text-gray-800 break-all mr-2">{item}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); onDeleteRequest(idx, item); }} className="text-gray-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition-colors"><i className="fa-solid fa-trash"></i></button>
            </li>
          ))}
          {items.length === 0 && <li className="text-gray-400 text-sm italic text-center py-8">データがありません</li>}
        </ul>
      </div>
      <div className="p-4 border-t bg-gray-50">
        <div className="flex gap-2">
          <input type="text" className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm bg-white text-black outline-none focus:ring-2 focus:ring-blue-500" placeholder="新規項目を追加..." value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
          <button onClick={handleAdd} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 font-bold shadow-md"><i className="fa-solid fa-plus mr-1"></i>追加</button>
        </div>
      </div>
    </div>
  );
};

const LABEL_MAP: Record<string, string> = { 
  projects: "工事名", contractors: "会社名", supervisors: "現場責任者", locations: "場所", workplaces: "作業所名",
  subcontractors: "協力会社名", roles: "役職", topics: "安全訓練内容", jobTypes: "工種", goals: "安全衛生目標", predictions: "予想災害", countermeasures: "防止対策",
  processes: "作業工程", cautions: "注意事項"
};
const MASTER_GROUPS = { 
  BASIC: ['projects', 'contractors', 'supervisors', 'locations', 'workplaces'], 
  TRAINING: ['roles', 'topics', 'jobTypes', 'goals', 'predictions', 'countermeasures'] 
};
const RELEVANT_MASTER_KEYS: (keyof MasterData)[] = ['projects', 'contractors', 'locations', 'supervisors', 'subcontractors'];

// ★固定役職の定義
const FIXED_ROLES = ["統括安全衛生責任者", "副統括安全衛生責任者", "書記", "安全委員"];

const DisasterCouncilWizard: React.FC<Props> = ({ initialData, initialDraftId, onBackToMenu }) => {
  const [step, setStep] = useState(1);
  const [report, setReport] = useState<DisasterCouncilReportData>(initialData || INITIAL_DISASTER_COUNCIL_REPORT);
  const [draftId, setDraftId] = useState<string | null>(initialDraftId || null);
  const [masterData, setMasterData] = useState<MasterData>(INITIAL_MASTER_DATA);
  const [isMasterMode, setIsMasterMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [previewScale, setPreviewScale] = useState(1);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: () => {} });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [previewSigUrl, setPreviewSigUrl] = useState<string | null>(null);
  const [tempCompany, setTempCompany] = useState("");
  const [tempRole, setTempRole] = useState("職長");
  const [sigKey, setSigKey] = useState(0);

  // マスタ管理ステート
  const [masterTab, setMasterTab] = useState<'BASIC' | 'TRAINING'>('BASIC');
  const [selectedMasterKey, setSelectedMasterKey] = useState<keyof MasterData | null>(null);
  const [projectDeleteTarget, setProjectDeleteTarget] = useState<{index: number, name: string} | null>(null);

  const [planSelectionModal, setPlanSelectionModal] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<SavedDraft[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SafetyPlanReportData | null>(null);

  useEffect(() => { 
    const loadMaster = async () => { 
      try { 
        const data = await getMasterData(); 
        setMasterData(data); 
        if (data.subcontractors.length > 0) { setTempCompany(data.subcontractors[0]); } 
        if (data.roles.length > 0) { setTempRole(data.roles[0]); }
      } catch (e) { console.error("マスタ取得エラー", e); } 
    }; 
    loadMaster(); 
  }, []);

  // 初期データロード時に固定役職をセットする（初回作成時のみ）
  useEffect(() => {
    if (!initialData) {
      const newAttendees = [...report.gcAttendees];
      FIXED_ROLES.forEach((role, idx) => {
        if (newAttendees[idx]) {
          newAttendees[idx] = { ...newAttendees[idx], role: role };
        }
      });
      // 状態更新はuseEffect内で行うと無限ループの危険があるため、
      // ここでは簡易的に初期値としてセットされていることを期待するが、
      // 強制的に上書きが必要な場合は setReport を呼ぶ
      // setReport(prev => ({ ...prev, gcAttendees: newAttendees }));
    }
  }, []);

  useEffect(() => { if (masterData.subcontractors.length > 0 && !masterData.subcontractors.includes(tempCompany) && tempCompany !== "") { setTempCompany(masterData.subcontractors[0]); } }, [masterData.subcontractors, tempCompany]);
  useEffect(() => { if (!showPreview) return; const handleResize = () => { const A4_WIDTH_PX = 794; const PADDING_PX = 40; const availableWidth = window.innerWidth - PADDING_PX; setPreviewScale(availableWidth < A4_WIDTH_PX ? availableWidth / A4_WIDTH_PX : 1); }; window.addEventListener('resize', handleResize); handleResize(); return () => window.removeEventListener('resize', handleResize); }, [showPreview]);

  const updateReport = (field: keyof DisasterCouncilReportData, value: any) => { setReport(prev => ({ ...prev, [field]: value })); setSaveStatus('idle'); setHasUnsavedChanges(true); };
  
  // 元請出席者の更新ロジック
  const updateGCAttendee = (index: number, field: 'role' | 'name', value: string) => { 
    const newAttendees = [...report.gcAttendees]; 
    if (!newAttendees[index]) newAttendees[index] = { role: '', name: '' }; 
    newAttendees[index][field] = value; 
    updateReport('gcAttendees', newAttendees); 
  };

  const handleAddSubcontractor = (signatureDataUrl: string) => { const newSub: SubcontractorAttendee = { id: Date.now().toString(), company: tempCompany, role: tempRole, name: "Signed", signatureDataUrl }; setReport(prev => ({ ...prev, subcontractorAttendees: [...prev.subcontractorAttendees, newSub] })); setSigKey(prev => prev + 1); setSaveStatus('idle'); setHasUnsavedChanges(true); };
  const handleTempSave = async () => { setSaveStatus('saving'); try { const newId = await saveDraft(draftId, 'DISASTER_COUNCIL', report); setDraftId(newId); setSaveStatus('saved'); setHasUnsavedChanges(false); setTimeout(() => setSaveStatus('idle'), 2000); } catch (e) { console.error(e); alert("保存に失敗しました"); setSaveStatus('idle'); } };

  const handlePreviewClick = async () => {
    setSaveStatus('saving');
    try {
      const newId = await saveDraft(draftId, 'DISASTER_COUNCIL', report);
      setDraftId(newId);
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveStatus('idle'), 2000);

      const plans = await fetchSafetyPlansByProject(report.project);
      
      if (plans.length === 0) {
        alert(`工事名「${report.project}」の安全管理計画表が見つかりません。\n\nホーム画面に戻って、先に「安全管理計画表」を作成・保存してください。`);
        return; 
      }

      setAvailablePlans(plans);
      setPlanSelectionModal(true);

    } catch (e) {
      alert("エラーが発生しました");
      setSaveStatus('idle');
    }
  };

  const confirmPlanSelection = (plan: SavedDraft) => {
    setSelectedPlan(plan.data as SafetyPlanReportData);
    setPlanSelectionModal(false);
    setShowPreview(true);
  };

  // ファイル名自動設定
  const handlePrint = () => {
    const d = new Date(report.date);
    const m = d.getMonth() + 1; 
    const prevTitle = document.title;
    document.title = `災防協_${report.project}_${m}月度`;
    window.print();
    document.title = prevTitle;
  };

  const handleHomeClick = () => { if (hasUnsavedChanges) { setConfirmModal({ isOpen: true, message: "保存されていない変更があります。\n保存せずにホームに戻りますか？", onConfirm: () => { setConfirmModal(prev => ({ ...prev, isOpen: false })); onBackToMenu(); } }); } else { onBackToMenu(); } };

  // --- Renders ---
  const renderMasterManager = () => (
    <div className="p-4 max-w-4xl mx-auto bg-gray-50 min-h-screen flex flex-col">
      <div className="flex justify-between items-center mb-6 sticky top-0 bg-gray-50 py-4 z-10 border-b">
        <h2 className="text-2xl font-bold text-gray-800"><i className="fa-solid fa-database mr-2"></i>マスタ管理</h2>
        <button onClick={() => { setIsMasterMode(false); setSelectedMasterKey(null); }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-bold"><i className="fa-solid fa-xmark mr-1"></i>閉じる</button>
      </div>
      
      {/* タブボタン */}
      <div className="flex gap-4 mb-6">
        <button 
          onClick={() => setMasterTab('BASIC')} 
          className={`flex-1 py-3 rounded-lg font-bold transition-colors ${masterTab === 'BASIC' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border'}`}
        >
          <i className="fa-solid fa-house-chimney mr-2"></i>基本・共通マスタ
        </button>
        <button 
          onClick={() => setMasterTab('TRAINING')} 
          className={`flex-1 py-3 rounded-lg font-bold transition-colors ${masterTab === 'TRAINING' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border'}`}
        >
          <i className="fa-solid fa-clipboard-check mr-2"></i>各種項目マスタ
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
        {selectedMasterKey ? (
          <div className="flex-1 overflow-hidden col-span-2">
            <MasterSection 
              title={LABEL_MAP[selectedMasterKey]} 
              items={masterData[selectedMasterKey]} 
              onBack={() => setSelectedMasterKey(null)}
              onUpdate={async (newItems) => { const newData = { ...masterData, [selectedMasterKey]: newItems }; setMasterData(newData); await saveMasterData(newData); }} 
              onDeleteRequest={(index, item) => {
                if (selectedMasterKey === 'projects') { setProjectDeleteTarget({ index, name: item }); } 
                else { setConfirmModal({ isOpen: true, message: `「${item}」を削除しますか？`, onConfirm: async () => { const newItems = [...masterData[selectedMasterKey]]; newItems.splice(index, 1); const newData = { ...masterData, [selectedMasterKey]: newItems }; setMasterData(newData); await saveMasterData(newData); setConfirmModal(prev => ({ ...prev, isOpen: false })); } }); }
              }} 
            />
          </div>
        ) : (
          MASTER_GROUPS[masterTab].map((key) => {
            const list = masterData[key as keyof MasterData] || [];
            return (
              <button 
                key={key}
                onClick={() => setSelectedMasterKey(key as keyof MasterData)}
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all text-left flex justify-between items-center group"
              >
                <div>
                  <h3 className="font-bold text-lg text-gray-800 mb-1">{LABEL_MAP[key]}</h3>
                  <p className="text-xs text-gray-500">{list.length} 件の登録</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                  <i className="fa-solid fa-chevron-right"></i>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800 border-l-4 border-green-600 pl-3">STEP 1: 表紙情報</h2>
      <div className="form-control"><label className="label font-bold text-gray-700">開催回数</label><div className="flex items-center gap-2"><span className="text-gray-600">第</span><select className="w-24 p-2 border border-gray-300 rounded text-center text-lg bg-white appearance-none" value={report.count} onChange={(e) => updateReport('count', parseInt(e.target.value) || 0)}>{Array.from({ length: 100 }, (_, i) => i + 1).map(num => (<option key={num} value={num}>{num}</option>))}</select><span className="text-gray-600">回</span></div></div>
      <div className="form-control"><label className="label font-bold text-gray-700">工事名 (マスタ選択)</label><select className="w-full p-3 border border-gray-300 rounded-lg bg-white appearance-none" value={report.project} onChange={(e) => updateReport('project', e.target.value)}>{masterData.projects.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
      <div className="form-control"><label className="label font-bold text-gray-700">開催日</label><input type="date" className="w-full p-3 border border-gray-300 rounded-lg bg-white appearance-none" value={report.date} onChange={(e) => updateReport('date', e.target.value)} /></div>
      <div className="form-control"><label className="label font-bold text-gray-700">施工者名 (マスタ選択)</label><select className="w-full p-3 border border-gray-300 rounded-lg bg-white appearance-none" value={report.contractor} onChange={(e) => updateReport('contractor', e.target.value)}>{masterData.contractors.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-8">
      <h2 className="text-xl font-bold text-gray-800 border-l-4 border-green-600 pl-3">STEP 2: 出席者名簿</h2>
      <div className="bg-gray-50 p-4 rounded border"><h3 className="font-bold text-gray-700 mb-3">開催情報</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-xs font-bold text-gray-500">場所 (マスタ選択)</label><select className="w-full p-2 border border-gray-300 rounded bg-white appearance-none" value={report.location} onChange={(e) => updateReport('location', e.target.value)}>{masterData.locations.map(s => <option key={s} value={s}>{s}</option>)}</select></div><div><label className="text-xs font-bold text-gray-500">時間</label><div className="flex items-center gap-2"><input type="time" className="p-2 border rounded appearance-none" value={report.startTime} onChange={(e) => updateReport('startTime', e.target.value)} /><span>～</span><input type="time" className="p-2 border rounded appearance-none" value={report.endTime} onChange={(e) => updateReport('endTime', e.target.value)} /></div></div></div></div>
      <div className="bg-white p-4 rounded border shadow-sm"><h3 className="font-bold text-gray-700 mb-3 border-b pb-1">元請出席者</h3>
        {/* ★変更: 最初の4人は固定職務名、それ以外はマスタ選択式 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {report.gcAttendees.map((attendee, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              {idx < 4 ? (
                // 固定職務名 (編集不可、または初期値として表示)
                <div className="w-1/3 p-2 border border-gray-300 rounded text-xs bg-gray-100 font-bold truncate">
                  {FIXED_ROLES[idx]}
                </div>
              ) : (
                // 5人目以降はマスタから選択
                <select 
                  className="w-1/3 p-2 border border-gray-300 rounded text-sm bg-white appearance-none"
                  value={attendee.role}
                  onChange={(e) => updateGCAttendee(idx, 'role', e.target.value)}
                >
                  <option value="">(職務選択)</option>
                  {masterData.roles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              )}
              
              <select 
                className="flex-1 p-2 border border-gray-300 rounded text-sm appearance-none"
                value={attendee.name}
                onChange={(e) => updateGCAttendee(idx, 'name', e.target.value)}
              >
                <option value="">(選択してください)</option>
                {masterData.supervisors.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
      
      <div className="bg-white p-4 rounded border shadow-sm"><h3 className="font-bold text-gray-700 mb-3 border-b pb-1">専門工事会社（署名）</h3><div className="mb-6 p-4 bg-gray-50 rounded"><div className="grid grid-cols-2 gap-3 mb-3"><div><label className="block text-xs font-bold text-gray-500 mb-1">会社名 (マスタ選択)</label><select className="w-full p-2 border border-gray-300 rounded appearance-none" value={tempCompany} onChange={(e) => setTempCompany(e.target.value)}>{masterData.subcontractors.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
      
      {/* ★変更: 専門工事会社の役職もマスタ選択式に変更 */}
      <div>
        <label className="block text-xs font-bold text-gray-500 mb-1">役職</label>
        <select 
          className="w-full p-2 border border-gray-300 rounded appearance-none"
          value={tempRole}
          onChange={(e) => setTempRole(e.target.value)}
        >
          {masterData.roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      
      </div><div className="mb-2"><label className="block text-xs font-bold text-gray-500 mb-1 text-center">氏名 (手書き署名)</label><SignatureCanvas key={sigKey} onSave={handleAddSubcontractor} onClear={() => {}} lineWidth={6} /></div></div><div className="divide-y border rounded max-h-48 overflow-y-auto">{report.subcontractorAttendees.map((sub, idx) => (<div key={sub.id} className="p-2 flex justify-between items-center bg-white"><div className="text-sm"><div className="font-bold">{sub.company}</div><div className="text-xs text-gray-500">{sub.role}</div></div><div className="flex items-center gap-3"><div className="h-10 cursor-pointer hover:opacity-80 transition-opacity border border-transparent hover:border-blue-300 rounded px-1" onClick={() => setPreviewSigUrl(sub.signatureDataUrl)} title="タップして拡大"><img src={sub.signatureDataUrl} alt="sig" className="h-full object-contain" /></div><button onClick={() => { const newList = report.subcontractorAttendees.filter(item => item.id !== sub.id); updateReport('subcontractorAttendees', newList); }} className="text-red-400 hover:text-red-600"><i className="fa-solid fa-trash"></i></button></div></div>))}</div></div>
    </div>
  );

  // --- PREVIEW ---
  const renderPreviewModal = () => (
    <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-90 flex flex-col no-print">
      <div className="sticky top-0 bg-gray-800 text-white p-4 shadow-lg flex justify-between items-center shrink-0">
        <h2 className="text-lg font-bold"><i className="fa-solid fa-eye mr-2"></i> 印刷プレビュー</h2>
        <div className="flex gap-4">
          <button onClick={() => setShowPreview(false)} className="px-4 py-2 bg-gray-600 rounded">閉じる</button>
          <button onClick={handlePrint} className="px-6 py-2 bg-green-600 rounded font-bold shadow-md flex items-center">
            <i className="fa-solid fa-print mr-2"></i> 保存して印刷
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center gap-10 bg-gray-800">
        <div className="bg-white shadow-2xl" style={{ width: '794px', transform: `scale(${previewScale})`, transformOrigin: 'top center' }}>
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

  if (isMasterMode) return (
    <>
      {renderMasterManager()}
      <ConfirmationModal isOpen={confirmModal.isOpen} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })} />
      {projectDeleteTarget && (
        <ProjectDeleteModal 
          isOpen={!!projectDeleteTarget} 
          projectName={projectDeleteTarget.name}
          onCancel={() => setProjectDeleteTarget(null)}
          onConfirm={async () => {
            const items = [...masterData.projects];
            items.splice(projectDeleteTarget.index, 1);
            await deleteDraftsByProject(projectDeleteTarget.name);
            const newData = { ...masterData, projects: items };
            setMasterData(newData);
            await saveMasterData(newData);
            setProjectDeleteTarget(null);
          }}
        />
      )}
    </>
  );

  return (
    <>
      <div className="no-print min-h-screen pb-24 bg-gray-50">
        <header className="bg-slate-800 text-white p-4 shadow-md sticky top-0 z-10 flex justify-between items-center"><div className="flex items-center gap-3"><button onClick={handleHomeClick} className="text-white hover:text-gray-300"><i className="fa-solid fa-house"></i></button><h1 className="text-lg font-bold"><i className="fa-solid fa-users-rectangle mr-2"></i>災害防止協議会</h1></div><button onClick={() => setIsMasterMode(true)} className="text-xs bg-slate-700 px-2 py-1 rounded hover:bg-slate-600 transition-colors"><i className="fa-solid fa-gear mr-1"></i>設定</button></header>
        <div className="bg-white p-4 shadow-sm mb-4"><div className="flex justify-between text-xs font-bold text-gray-400 mb-2"><span className={step >= 1 ? "text-green-600" : ""}>STEP 1</span><span className={step >= 2 ? "text-green-600" : ""}>STEP 2</span></div><div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden"><div className="bg-green-600 h-full transition-all duration-300" style={{ width: `${step * 50}%` }}></div></div></div>
        <main className="mx-auto p-4 bg-white shadow-lg rounded-lg max-w-3xl min-h-[60vh]">{step === 1 && renderStep1()}{step === 2 && renderStep2()}</main>
        <footer className="fixed bottom-0 left-0 w-full bg-white border-t p-4 flex justify-between items-center shadow-md z-20">
          <div className="flex items-center gap-2"><button onClick={() => setStep(prev => Math.max(1, prev - 1))} disabled={step === 1} className={`px-4 py-3 rounded-lg font-bold ${step === 1 ? 'text-gray-300' : 'text-gray-600 bg-gray-100'}`}>戻る</button><button onClick={handleTempSave} className="px-4 py-3 rounded-lg font-bold border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 flex items-center"><i className={`fa-solid ${saveStatus === 'saved' ? 'fa-check' : 'fa-save'} mr-2`}></i>{saveStatus === 'saved' ? '保存完了' : '一時保存'}</button></div>
          {step === 1 ? (<button onClick={() => setStep(2)} className="px-8 py-3 bg-green-600 text-white rounded-lg font-bold shadow hover:bg-green-700 flex items-center">次へ <i className="fa-solid fa-chevron-right ml-2"></i></button>) : (<button onClick={handlePreviewClick} className="px-8 py-3 bg-cyan-600 text-white rounded-lg font-bold shadow hover:bg-cyan-700 flex items-center"><i className="fa-solid fa-file-pdf mr-2"></i> プレビュー</button>)}
        </footer>
      </div>
      {previewSigUrl && (<div className="fixed inset-0 z-[100] bg-black bg-opacity-90 flex flex-col items-center justify-center p-4" onClick={() => setPreviewSigUrl(null)}><div className="bg-white p-1 rounded-lg shadow-2xl overflow-hidden max-w-full max-h-[80vh]"><img src={previewSigUrl} alt="Signature Preview" className="max-w-full max-h-[70vh] object-contain" /></div><button className="mt-6 text-white text-lg font-bold flex items-center gap-2 bg-gray-700 px-6 py-2 rounded-full hover:bg-gray-600 transition-colors"><i className="fa-solid fa-xmark"></i> 閉じる</button></div>)}
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