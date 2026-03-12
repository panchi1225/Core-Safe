import React, { useState, useEffect, useRef } from 'react';
import { MasterData, DisasterCouncilReportData, INITIAL_DISASTER_COUNCIL_REPORT, INITIAL_MASTER_DATA } from '../types';
import { getMasterData, saveDraft, fetchEmployees } from '../services/firebaseService';
import { AGENDA_TEMPLATES } from './disasterCouncilTemplates';
import DisasterCouncilPrintLayout from './DisasterCouncilPrintLayout';

interface Props {
  initialData?: any;
  initialDraftId?: string | null;
  initialStep?: number;
  onBackToMenu: () => void;
}

// --- Custom Confirmation Modal ---
interface ConfirmModalProps {
  isOpen: boolean;
  message: string;
  onLeftButtonClick: () => void;
  onRightButtonClick: () => void;
  leftButtonLabel: string;
  rightButtonLabel: string;
  leftButtonClass: string;
  rightButtonClass: string;
}

const ConfirmationModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, message, 
  onLeftButtonClick, onRightButtonClick,
  leftButtonLabel, rightButtonLabel,
  leftButtonClass, rightButtonClass
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-fade-in">
        <h3 className="text-lg font-bold text-gray-800 mb-4">確認</h3>
        <p className="text-gray-600 mb-6 whitespace-pre-wrap font-bold text-red-600">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onLeftButtonClick} className={leftButtonClass}>{leftButtonLabel}</button>
          <button onClick={onRightButtonClick} className={rightButtonClass}>{rightButtonLabel}</button>
        </div>
      </div>
    </div>
  );
};

// --- Complete Modal ---
const CompleteModal: React.FC<{ isOpen: boolean; onOk: () => void }> = ({ isOpen, onOk }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-gray-900 bg-opacity-60 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full p-8 text-center animate-fade-in">
        <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="fa-solid fa-check text-3xl"></i>
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">保存完了</h3>
        <p className="text-gray-600 mb-6">データを保存しました。</p>
        <button 
          onClick={onOk} 
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold shadow hover:bg-blue-700 transition-colors"
        >
          OK（ホームへ戻る）
        </button>
      </div>
    </div>
  );
};

const DisasterCouncilWizard: React.FC<Props> = ({ initialData, initialDraftId, initialStep, onBackToMenu }) => {
  const [step, setStep] = useState(1);
  const [report, setReport] = useState<DisasterCouncilReportData>(initialData || INITIAL_DISASTER_COUNCIL_REPORT);
  const [draftId, setDraftId] = useState<string | null>(initialDraftId || null);
  const initialYearRef = useRef<number>(report.year);
  const initialMonthRef = useRef<number>(report.month);
  const [masterData, setMasterData] = useState<MasterData>(INITIAL_MASTER_DATA);
  const [showPreview, setShowPreview] = useState(initialStep === 99);
  const isDirectPreview = initialStep === 99;
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [previewScale, setPreviewScale] = useState(1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showSealModal, setShowSealModal] = useState(false);
  const [sealEmployees, setSealEmployees] = useState<any[]>([]);


  // ★追加: エラー状態管理
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    onLeftButtonClick: () => void;
    onRightButtonClick: () => void;
    leftButtonLabel: string;
    rightButtonLabel: string;
    leftButtonClass: string;
    rightButtonClass: string;
  }>({ 
    isOpen: false, message: '', 
    onLeftButtonClick: () => {}, onRightButtonClick: () => {}, 
    leftButtonLabel: '', rightButtonLabel: '',
    leftButtonClass: '', rightButtonClass: ''
  });

  useEffect(() => { 
    const loadMaster = async () => { 
      try { 
        const data = await getMasterData(); 
        setMasterData({ ...INITIAL_MASTER_DATA, ...data }); 
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

  const updateReport = (updates: Partial<DisasterCouncilReportData>) => { 
    setReport(prev => ({ ...prev, ...updates })); 
    setSaveStatus('idle'); 
    setHasUnsavedChanges(true);
    
    // ★追加: 入力があったらエラーを解除
    const newErrors = { ...errors };
    Object.keys(updates).forEach(key => {
      if (key === 'project') delete newErrors.project;
      if (key === 'date') delete newErrors.date;
      if (key === 'location') delete newErrors.location;
      if (key === 'hostRole') delete newErrors.hostRole;
      if (key === 'hostName') delete newErrors.hostName;
      if (key === 'nextMeetingDate') delete newErrors.nextMeetingDate;
      if (key === 'reviewerRole') delete newErrors.reviewerRole;
      if (key === 'reviewerName') delete newErrors.reviewerName;
    });
    setErrors(newErrors);
  };
  
  // ★修正: バリデーション付きハンドル
  const handleNext = () => {
    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    if (step === 1) {
      if (!report.project) { newErrors.project = true; hasError = true; }
      if (!report.date) { newErrors.date = true; hasError = true; }
      if (!report.location) { newErrors.location = true; hasError = true; }
      if (!report.hostRole) { newErrors.hostRole = true; hasError = true; }
      if (!report.hostName) { newErrors.hostName = true; hasError = true; }
      // 出席者：少なくとも1行は有効（会社・役職・名前すべて入力済み）が必要
      const hasValidAttendee = report.attendees.some(a => a.company && a.role && a.name);
      if (!hasValidAttendee) { newErrors.attendees = true; hasError = true; }

      if (hasError) {
        setErrors(newErrors);
        alert("未入力の項目があります。\n全ての項目を選択・入力してください。");
        return;
      }
    }
    setErrors({});
    setStep(prev => Math.min(prev + 1, 2));
  };

  const handleBack = () => setStep(prev => Math.max(prev - 1, 1));

  const handleSave = async () => { 
    if (!report.project) {
      alert("保存するには「工事名」の選択が必須です。");
      return;
    }

    let currentDraftId = draftId;
    if (currentDraftId && (report.year !== initialYearRef.current || report.month !== initialMonthRef.current)) {
      currentDraftId = null;
    }
    setSaveStatus('saving'); 
    try { 
      const newId = await saveDraft(currentDraftId, 'DISASTER_COUNCIL', report); 
      setDraftId(newId); 
      initialYearRef.current = report.year;
      initialMonthRef.current = report.month;
      setSaveStatus('saved'); 
      setHasUnsavedChanges(false); 
      
      setShowCompleteModal(true);

    } catch (e) { 
      console.error(e); 
      alert("保存に失敗しました"); 
      setSaveStatus('idle'); 
    } 
  };
  
  const handlePreviewClick = async () => {
    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    // STEP1 必須項目チェック
    if (!report.project) { newErrors.project = true; hasError = true; }
    if (!report.date) { newErrors.date = true; hasError = true; }
    if (!report.location) { newErrors.location = true; hasError = true; }
    if (!report.hostRole) { newErrors.hostRole = true; hasError = true; }
    if (!report.hostName) { newErrors.hostName = true; hasError = true; }
    const hasValidAttendee = report.attendees.some(a => a.company && a.role && a.name);
    if (!hasValidAttendee) { newErrors.attendees = true; hasError = true; }

    // STEP2 必須項目チェック
    if (!report.nextMeetingDate) { newErrors.nextMeetingDate = true; hasError = true; }
    if (!report.reviewerRole) { newErrors.reviewerRole = true; hasError = true; }
    if (!report.reviewerName) { newErrors.reviewerName = true; hasError = true; }

    if (hasError) {
      setErrors(newErrors);
      if (!report.project || !report.date || !report.location || !report.hostRole || !report.hostName || !hasValidAttendee) {
        alert("STEP 1 の必須項目が未入力です。");
      } else {
        alert("STEP 2 の必須項目（次回開催日・確認者）が未入力です。");
      }
      return;
    }

    let currentDraftId = draftId;
    if (currentDraftId && (report.year !== initialYearRef.current || report.month !== initialMonthRef.current)) {
      currentDraftId = null;
    }
    setSaveStatus('saving');
    try {
      const newId = await saveDraft(currentDraftId, 'DISASTER_COUNCIL', report);
      setDraftId(newId);
      initialYearRef.current = report.year;
      initialMonthRef.current = report.month;
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
      setShowPreview(true);
    } catch (e) { alert("エラーが発生しました"); setSaveStatus('idle'); }
  };

  const handlePrint = () => { const prevTitle = document.title; document.title = `災害防止協議会_${report.project}_第${report.count}回`; window.print(); document.title = prevTitle; };
  
  const handleHomeClick = () => { 
    if (hasUnsavedChanges) { 
      setConfirmModal({ 
        isOpen: true, 
        message: "データが保存されていません！\n保存ボタンを押してください！", 
        leftButtonLabel: "ホームに戻る",
        leftButtonClass: "px-4 py-2 bg-gray-200 text-gray-700 rounded font-bold hover:bg-gray-300",
        onLeftButtonClick: () => { 
          setConfirmModal(prev => ({ ...prev, isOpen: false })); 
          onBackToMenu(); 
        },
        rightButtonLabel: "編集を続ける",
        rightButtonClass: "px-4 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700",
        onRightButtonClick: () => {
          setConfirmModal(prev => ({ ...prev, isOpen: false })); 
        }
      }); 
    } else { 
      onBackToMenu(); 
    } 
  };

  // ★共通スタイル定義 (エラー時は赤枠)
  const getErrorClass = (field: string) => {
    return errors[field] 
      ? "w-full h-12 p-3 border-2 border-red-500 bg-red-50 rounded-lg text-black outline-none appearance-none" 
      : "w-full h-12 p-3 border border-gray-300 rounded-lg bg-white text-black outline-none appearance-none";
  };

  // STEP2の個別エラークラス (h-10などサイズが違うため)
  const getStep2ErrorClass = (field: string) => {
    return errors[field]
      ? "border-2 border-red-500 bg-red-50"
      : "border border-gray-200 bg-white";
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800 border-l-4 border-green-600 pl-3">STEP 1: 基本情報</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="form-control">
          <label className="label font-bold text-gray-700">工事名 <span className="text-red-500">*</span></label>
          <select className={getErrorClass('project')} value={report.project} onChange={(e) => updateReport({project: e.target.value})}>
            <option value="">(データを選択してください)</option>
            {masterData.projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-control"><label className="label font-bold text-gray-700">開催回</label><div className="flex items-center"><span className="mr-2">第</span>
          <input type="number" className="w-20 h-12 p-3 border border-gray-300 rounded-lg text-center bg-white text-black outline-none appearance-none" value={report.count} onChange={(e) => updateReport({count: parseInt(e.target.value) || 1})} />
        <span className="ml-2">回</span></div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="form-control"><label className="label font-bold text-gray-700">開催日 <span className="text-red-500">*</span></label><input type="date" className={getErrorClass('date')} value={report.date} onChange={(e) => updateReport({date: e.target.value})} /></div>
        <div className="form-control">
          <label className="label font-bold text-gray-700">開催方法 <span className="text-red-500">*</span></label>
          <select className={getErrorClass('meetingMethod')} value={report.meetingMethod} onChange={(e) => {
            const method = e.target.value;
            updateReport({ meetingMethod: method, location: "" });
          }}>
            <option value="現地開催">現地開催</option>
            <option value="Web開催">Web開催</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="form-control">
          <label className="label font-bold text-gray-700">場所 <span className="text-red-500">*</span></label>
          <select className={getErrorClass('location')} value={report.location} onChange={(e) => updateReport({location: e.target.value})}>
            <option value="">(データを選択してください)</option>
            {report.meetingMethod === "Web開催" ? (
              <>
                <option value="WEB開催（Microsoft Teams使用）">WEB開催（Microsoft Teams使用）</option>
                <option value="WEB開催（Zoom使用）">WEB開催（Zoom使用）</option>
                <option value="WEB開催（Google Meet使用）">WEB開催（Google Meet使用）</option>
              </>
            ) : (
              masterData.locations.map(l => <option key={l} value={l}>{l}</option>)
            )}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="form-control">
          <label className="label font-bold text-gray-700 text-xs sm:text-sm">開始時間</label>
          <select className="w-full h-12 p-3 border border-gray-300 rounded-lg bg-white text-black outline-none appearance-none" value={report.startTime} onChange={(e) => {
            const newStart = e.target.value;
            updateReport({ startTime: newStart });
            // 開始時間変更時、終了時間を+1時間に自動調整（ユーザー未編集時）
            const [h, m] = newStart.split(':').map(Number);
            const endH = Math.min(h + 1, 16);
            updateReport({ startTime: newStart, endTime: `${String(endH).padStart(2,'0')}:${String(m).padStart(2,'0')}` });
          }}>
            {Array.from({ length: 15 }, (_, i) => {
              const h = 9 + Math.floor(i / 2);
              const m = (i % 2) * 30;
              const val = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
              return <option key={val} value={val}>{val}</option>;
            })}
          </select>
        </div>
        <div className="form-control">
          <label className="label font-bold text-gray-700 text-xs sm:text-sm">終了時間</label>
          <select className="w-full h-12 p-3 border border-gray-300 rounded-lg bg-white text-black outline-none appearance-none" value={report.endTime} onChange={(e) => updateReport({endTime: e.target.value})}>
            {Array.from({ length: 15 }, (_, i) => {
              const h = 9 + Math.floor(i / 2);
              const m = (i % 2) * 30;
              const val = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
              return <option key={val} value={val}>{val}</option>;
            })}
          </select>
        </div>
      </div>

      {/* 主催者 */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="font-bold text-gray-700 mb-3">主催者 <span className="text-red-500">*</span></h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label text-sm font-bold text-gray-600">役職</label>
            <select className={getErrorClass('hostRole')} value={report.hostRole} onChange={(e) => updateReport({hostRole: e.target.value})}>
              <option value="">(選択してください)</option>
              {masterData.roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-control">
            <label className="label text-sm font-bold text-gray-600">氏名</label>
            <select className={getErrorClass('hostName')} value={report.hostName} onChange={(e) => updateReport({hostName: e.target.value})}>
              <option value="">(選択してください)</option>
              {masterData.supervisors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* 出席者 */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="font-bold text-gray-700 mb-3">出席者 <span className="text-red-500">*</span> <span className="text-xs text-gray-400 font-normal">（最大10名）</span></h3>
        {errors.attendees && <p className="text-red-500 text-sm mb-2 font-bold">少なくとも1名の出席者が必要です。</p>}
        <div className="space-y-3">
          {report.attendees.map((att, i) => (
            <div key={i} className="flex items-center gap-2 bg-white p-3 rounded border">
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => moveAttendee(i, 'up')} disabled={i === 0} className={`text-xs px-1 ${i === 0 ? 'text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}><i className="fa-solid fa-chevron-up"></i></button>
                <button onClick={() => moveAttendee(i, 'down')} disabled={i === report.attendees.length - 1} className={`text-xs px-1 ${i === report.attendees.length - 1 ? 'text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}><i className="fa-solid fa-chevron-down"></i></button>
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select className="h-10 p-2 border border-gray-300 rounded text-sm outline-none appearance-none" value={att.company} onChange={(e) => updateAttendee(i, 'company', e.target.value)}>
                  <option value="">(会社名)</option>
                  {masterData.contractors.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="h-10 p-2 border border-gray-300 rounded text-sm outline-none appearance-none" value={att.role} onChange={(e) => updateAttendee(i, 'role', e.target.value)}>
                  <option value="">(役職)</option>
                  {masterData.roles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <input type="text" className="h-10 p-2 border border-gray-300 rounded text-sm outline-none" value={att.name} onChange={(e) => updateAttendee(i, 'name', e.target.value)} placeholder="氏名を入力" />
              </div>
              <button onClick={() => removeAttendee(i)} className="text-red-400 hover:text-red-600 shrink-0"><i className="fa-solid fa-trash"></i></button>
            </div>
          ))}
        </div>
        {report.attendees.length < 10 && (
          <button onClick={addAttendee} className="mt-3 px-4 py-2 bg-green-50 text-green-600 border border-green-200 rounded-lg font-bold text-sm hover:bg-green-100">
            <i className="fa-solid fa-plus mr-2"></i>出席者を追加
          </button>
        )}
      </div>

      <div className="form-control"><label className="label font-bold text-gray-700">元請会社名</label><input type="text" className="w-full h-12 p-3 border border-gray-300 rounded-lg bg-gray-100 text-black outline-none appearance-none cursor-not-allowed" value="松浦建設株式会社" readOnly /></div>
    </div>
  );

  // --- 出席者操作 ---
  const addAttendee = () => {
    if (report.attendees.length >= 10) return;
    updateReport({ attendees: [...report.attendees, { company: "", role: "", name: "" }] });
  };

  const removeAttendee = (index: number) => {
    const newAttendees = report.attendees.filter((_, i) => i !== index);
    updateReport({ attendees: newAttendees });
  };

  const updateAttendee = (index: number, field: 'company' | 'role' | 'name', value: string) => {
    const newAttendees = [...report.attendees];
    newAttendees[index] = { ...newAttendees[index], [field]: value };
    updateReport({ attendees: newAttendees });
    // エラー解除
    if (value) {
      const newErrors = { ...errors };
      delete newErrors.attendees;
      setErrors(newErrors);
    }
  };

  const moveAttendee = (index: number, direction: 'up' | 'down') => {
    const newAttendees = [...report.attendees];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newAttendees.length) return;
    [newAttendees[index], newAttendees[targetIndex]] = [newAttendees[targetIndex], newAttendees[index]];
    updateReport({ attendees: newAttendees });
  };

  const renderStep2 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800 border-l-4 border-green-600 pl-3">STEP 2: 議題・確認者</h2>

      {/* テンプレート選択 */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="font-bold text-gray-700 mb-3">テンプレート選択</h3>
        <select
          className="w-full h-12 p-3 border border-gray-300 rounded-lg bg-white text-black outline-none appearance-none"
          onChange={(e) => {
            const template = AGENDA_TEMPLATES.find(t => t.id === e.target.value);
            if (!template || template.id === 'none') return;
            const hasContent = report.agendaItems.some(item => item.content.trim() !== '');
            if (hasContent) {
              setConfirmModal({
                isOpen: true,
                message: "入力済みの議題内容がテンプレートで上書きされます。\nよろしいですか？",
                leftButtonLabel: "キャンセル",
                leftButtonClass: "px-4 py-2 bg-gray-200 text-gray-700 rounded font-bold hover:bg-gray-300",
                onLeftButtonClick: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
                rightButtonLabel: "上書きする",
                rightButtonClass: "px-4 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700",
                onRightButtonClick: () => {
                  const newItems = report.agendaItems.map((item, idx) => ({
                    ...item,
                    content: template.contents[idx] || ""
                  }));
                  updateReport({ agendaItems: newItems });
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
              });
            } else {
              const newItems = report.agendaItems.map((item, idx) => ({
                ...item,
                content: template.contents[idx] || ""
              }));
              updateReport({ agendaItems: newItems });
            }
          }}
        >
          <option value="none">テンプレートを選択...</option>
          {AGENDA_TEMPLATES.filter(t => t.id !== 'none').map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* 議題7項目 */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="font-bold text-gray-700 mb-3">議題</h3>
        <div className="space-y-4">
          {report.agendaItems.map((item, idx) => (
            <div key={idx}>
              <label className="font-bold text-sm text-gray-600 mb-1 block">{item.title}</label>
              <textarea
                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-black outline-none resize-none"
                rows={3}
                value={item.content}
                onChange={(e) => {
                  const newItems = [...report.agendaItems];
                  newItems[idx] = { ...newItems[idx], content: e.target.value };
                  updateReport({ agendaItems: newItems });
                }}
                placeholder="内容を入力..."
              />
            </div>
          ))}
        </div>
      </div>

      {/* 次回開催日・備考 */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="font-bold text-gray-700 mb-3">次回・備考</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label text-sm font-bold text-gray-600">次回開催日 <span className="text-red-500">*</span></label>
            <input type="date" className={getErrorClass('nextMeetingDate')} value={report.nextMeetingDate} onChange={(e) => updateReport({nextMeetingDate: e.target.value})} />
          </div>
          <div className="form-control">
            <label className="label text-sm font-bold text-gray-600">備考</label>
            <input type="text" className="w-full h-12 p-3 border border-gray-300 rounded-lg bg-white text-black outline-none" value={report.remarks} onChange={(e) => updateReport({remarks: e.target.value})} placeholder="任意入力" />
          </div>
        </div>
      </div>

      {/* 確認者 */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="font-bold text-gray-700 mb-3">確認者 <span className="text-red-500">*</span></h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label text-sm font-bold text-gray-600">役職</label>
            <select className={getErrorClass('reviewerRole')} value={report.reviewerRole} onChange={(e) => updateReport({reviewerRole: e.target.value})}>
              <option value="">(選択してください)</option>
              {masterData.roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-control">
            <label className="label text-sm font-bold text-gray-600">氏名</label>
            <select className={getErrorClass('reviewerName')} value={report.reviewerName} onChange={(e) => updateReport({reviewerName: e.target.value})}>
              <option value="">(選択してください)</option>
              {masterData.supervisors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <button
          onClick={() => updateReport({ reviewerRole: report.hostRole, reviewerName: report.hostName })}
          className="mt-3 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg font-bold text-sm hover:bg-blue-100"
        >
          <i className="fa-solid fa-copy mr-2"></i>主催者と同じにする
        </button>
      </div>
    </div>
  );

  const renderPreviewModal = () => {
    if (!showPreview) return null;
    return (<>
      <div className="fixed inset-0 z-[80] bg-white flex flex-col no-print">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 text-white shadow-md shrink-0">
          <button
            onClick={() => {
              if (isDirectPreview) {
                onBackToMenu();
              } else {
                setShowPreview(false);
              }
            }}
            className="flex items-center gap-2 text-white hover:text-gray-300 font-bold text-sm"
          >
            <i className={`fa-solid ${isDirectPreview ? 'fa-house' : 'fa-arrow-left'}`}></i>
            {isDirectPreview ? 'ホームに戻る' : '閉じる'}
          </button>
          <div className="flex items-center gap-3">
            {isDirectPreview && (
              <>
                <button
                  onClick={async () => {
                    const emps = await fetchEmployees();
                    setSealEmployees(emps.filter((e: any) => e.sealImage));
                    setShowSealModal(true);
                  }}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg font-bold text-sm hover:bg-purple-700 transition-colors shadow"
                >
                  <i className="fa-solid fa-stamp mr-2"></i>押印
                </button>
                <button
                  onClick={handlePrint}
                  className="px-6 py-2 bg-pink-600 text-white rounded-lg font-bold text-sm hover:bg-pink-700 transition-colors shadow"
                >
                  <i className="fa-solid fa-print mr-2"></i>印刷
                </button>
              </>
            )}
            {!isDirectPreview && (
              <button
                onClick={handlePrint}
                className="px-6 py-2 bg-pink-600 text-white rounded-lg font-bold text-sm hover:bg-pink-700 transition-colors shadow"
              >
                <i className="fa-solid fa-print mr-2"></i>印刷
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-gray-200 p-4">
          <div className="flex justify-center"><div className="shadow-2xl">
            <DisasterCouncilPrintLayout data={report} />
          </div></div>
        </div>
      </div>

      {/* 押印社員選択モーダル */}
      {showSealModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[90]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="p-4 border-b bg-purple-50">
              <h3 className="font-bold text-lg text-purple-800 text-center">
                <i className="fa-solid fa-stamp mr-2"></i>確認者を選択
              </h3>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {sealEmployees.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <i className="fa-solid fa-exclamation-circle text-2xl mb-2 block"></i>
                  電子印が登録された社員がいません
                </div>
              ) : (
                <div className="space-y-2">
                  {sealEmployees.map((emp: any) => (
                    <button
                      key={emp.id}
                      onClick={async () => {
                        const updated = { ...report, reviewerSealId: emp.id, reviewerSealImage: emp.sealImage };
                        setReport(updated);
                        if (draftId) {
                          await saveDraft(draftId, 'DISASTER_COUNCIL', updated);
                        }
                        setShowSealModal(false);
                        alert(`${emp.nameSei} ${emp.nameMei} の電子印を押印しました`);
                      }}
                      className="w-full text-left border rounded-lg p-3 hover:bg-purple-50 transition-colors flex items-center gap-3"
                    >
                      <img src={emp.sealImage} alt="電子印" style={{ width: '40px', height: '40px', objectFit: 'contain', border: '1px solid #ccc', borderRadius: '4px' }} />
                      <div className="font-bold text-gray-800">{emp.nameSei} {emp.nameMei}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t">
              <button onClick={() => setShowSealModal(false)} className="w-full py-2 bg-gray-200 rounded-lg font-bold text-gray-600 hover:bg-gray-300">キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </>);
  };

  return (
    <>
      <div className="no-print min-h-screen pb-24 bg-gray-50">
        <header className="bg-slate-800 text-white p-4 shadow-md sticky top-0 z-10 flex justify-between items-center"><div className="flex items-center gap-3"><button onClick={handleHomeClick} className="text-white hover:text-gray-300"><i className="fa-solid fa-house"></i></button><h1 className="text-lg font-bold"><i className="fa-solid fa-people-group mr-2"></i>災害防止協議会</h1></div></header>
        <div className="bg-white p-4 shadow-sm mb-4"><div className="flex justify-between text-xs font-bold text-gray-400 mb-2"><span className={step >= 1 ? "text-green-600" : ""}>STEP 1</span><span className={step >= 2 ? "text-green-600" : ""}>STEP 2</span></div><div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden"><div className="bg-green-600 h-full transition-all duration-300" style={{ width: `${step * 50}%` }}></div></div></div>
        <main className="mx-auto p-4 bg-white shadow-lg rounded-lg min-h-[60vh] max-w-3xl">{step === 1 && renderStep1()}{step === 2 && renderStep2()}</main>
        <footer className="fixed bottom-0 left-0 w-full bg-white border-t p-4 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
          <div className="flex items-center gap-2"><button onClick={handleBack} disabled={step === 1} className={`px-4 py-3 rounded-lg font-bold ${step === 1 ? 'text-gray-300' : 'text-gray-600 bg-gray-100'}`}>戻る</button><button onClick={handleSave} className="px-4 py-3 rounded-lg font-bold border border-green-200 text-green-600 bg-green-50 hover:bg-green-100 flex items-center"><i className={`fa-solid ${saveStatus === 'saved' ? 'fa-check' : 'fa-save'} mr-2`}></i>{saveStatus === 'saved' ? '保存完了' : '保存'}</button></div>
          {step < 2 ? (<button onClick={handleNext} className="px-8 py-3 bg-green-600 text-white rounded-lg font-bold shadow hover:bg-green-700 flex items-center">次へ <i className="fa-solid fa-chevron-right ml-2"></i></button>) : (<button onClick={handlePreviewClick} className="px-8 py-3 bg-cyan-600 text-white rounded-lg font-bold shadow hover:bg-cyan-700 flex items-center"><i className="fa-solid fa-file-pdf mr-2"></i> プレビュー</button>)}
        </footer>
      </div>
      
      {/* 完了モーダル */}
      <CompleteModal isOpen={showCompleteModal} onOk={() => { setShowCompleteModal(false); onBackToMenu(); }} />
      
      {showPreview && renderPreviewModal()}
      
      <ConfirmationModal 
        isOpen={confirmModal.isOpen} 
        message={confirmModal.message} 
        onLeftButtonClick={confirmModal.onLeftButtonClick} 
        onRightButtonClick={confirmModal.onRightButtonClick}
        leftButtonLabel={confirmModal.leftButtonLabel}
        rightButtonLabel={confirmModal.rightButtonLabel}
        leftButtonClass={confirmModal.leftButtonClass}
        rightButtonClass={confirmModal.rightButtonClass}
      />
      
      <div className="hidden print:block">
         <DisasterCouncilPrintLayout data={report} />
      </div>
    </>
  );
};

export default DisasterCouncilWizard;
