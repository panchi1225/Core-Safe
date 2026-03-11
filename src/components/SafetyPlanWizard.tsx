import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  MasterData, SafetyPlanReportData, INITIAL_SAFETY_PLAN_REPORT, INITIAL_MASTER_DATA 
} from '../types';
import { getMasterData, saveDraft, deleteDraftsByProject } from '../services/firebaseService';
import { getDaysInMonth, getDay } from 'date-fns';

interface Props {
  initialData?: any;
  initialDraftId?: string | null;
  initialStep?: number;
  onBackToMenu: () => void;
}

// --- Custom Confirmation Modal (拡張版) ---
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

// --- Firebase保存用：ネスト配列 ↔ 文字列配列 変換 ---
const SEPARATOR = '|||';

const flattenNestedArrays = (report: SafetyPlanReportData): any => {
  return {
    ...report,
    predictions: report.predictions.map(arr => Array.isArray(arr) ? arr.join(SEPARATOR) : arr),
    countermeasures: report.countermeasures.map(arr => Array.isArray(arr) ? arr.join(SEPARATOR) : arr),
    inspectionItems: report.inspectionItems.map(arr => Array.isArray(arr) ? arr.join(SEPARATOR) : arr),
  };
};

const restoreNestedArrays = (data: any): any => {
  return {
    ...data,
    predictions: Array.isArray(data.predictions)
      ? data.predictions.map((v: any) => typeof v === 'string' ? v.split(SEPARATOR) : v)
      : Array(5).fill(null).map(() => ['', '']),
    countermeasures: Array.isArray(data.countermeasures)
      ? data.countermeasures.map((v: any) => typeof v === 'string' ? v.split(SEPARATOR) : v)
      : Array(5).fill(null).map(() => ['', '', '', '', '']),
    inspectionItems: Array.isArray(data.inspectionItems)
      ? data.inspectionItems.map((v: any) => typeof v === 'string' ? v.split(SEPARATOR) : v)
      : Array(5).fill(null).map(() => ['', '', '']),
  };
};
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// --- Helpers for Holidays ---
const isJapaneseHoliday = (date: Date): boolean => {
  const year = date.getFullYear(); const month = date.getMonth() + 1; const day = date.getDate();
  if (month === 1 && day === 1) return true; if (month === 2 && day === 11) return true; if (month === 2 && day === 23) return true; if (month === 4 && day === 29) return true; if (month === 5 && day === 3) return true; if (month === 5 && day === 4) return true; if (month === 5 && day === 5) return true; if (month === 8 && day === 11) return true; if (month === 11 && day === 3) return true; if (month === 11 && day === 23) return true;
  const getNthMonday = (y: number, m: number, n: number) => { const firstDay = new Date(y, m - 1, 1).getDay(); const offset = firstDay === 1 ? 0 : (8 - firstDay) % 7; return 1 + offset + (n - 1) * 7; };
  if (month === 1 && day === getNthMonday(year, 1, 2)) return true; if (month === 7 && day === getNthMonday(year, 7, 3)) return true; if (month === 9 && day === getNthMonday(year, 9, 3)) return true; if (month === 10 && day === getNthMonday(year, 10, 2)) return true;
  const vernal = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)); const autumnal = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  if (month === 3 && day === vernal) return true; if (month === 9 && day === autumnal) return true;
  return false;
};

// --- Main Wizard Component ---
const SafetyPlanWizard: React.FC<Props> = ({ initialData, initialDraftId, initialStep, onBackToMenu }) => {
  // 初期データに safetyGoals がない場合のフォールバックを追加
  const [report, setReport] = useState<SafetyPlanReportData>(() => {
    const raw = initialData || INITIAL_SAFETY_PLAN_REPORT;
    const base = initialData ? restoreNestedArrays(raw) : raw;
    return {
      ...base,
      safetyGoals: base.safetyGoals || ["", "", ""],
      predictions: Array.isArray(base.predictions?.[0]) ? base.predictions : Array(5).fill(null).map(() => ["", ""]),
      countermeasures: Array.isArray(base.countermeasures?.[0]) ? base.countermeasures : Array(5).fill(null).map(() => ["", "", "", "", ""]),
      inspectionItems: Array.isArray(base.inspectionItems?.[0]) ? base.inspectionItems : Array(5).fill(null).map(() => ["", "", ""]),
    };
  });
  const [draftId, setDraftId] = useState<string | null>(initialDraftId || null);
  const initialYearRef = useRef<number>(report.year);
  const initialMonthRef = useRef<number>(report.month);
  const [masterData, setMasterData] = useState<MasterData>(INITIAL_MASTER_DATA);
  const [showPreview, setShowPreview] = useState(initialStep === 99);
  const isDirectPreview = initialStep === 99;
  const [ganttMode, setGanttMode] = useState<'idle' | 'selectStart' | 'selectEnd'>('idle');
  const [ganttRowId, setGanttRowId] = useState<string | null>(null);
  const [ganttStartDay, setGanttStartDay] = useState<number | null>(null);
  const [ganttMessage, setGanttMessage] = useState<string>('');
  const [barActionModal, setBarActionModal] = useState<{
    isOpen: boolean;
    rowId: string;
    barIndex: number;
    bar: { startDay: number; endDay: number } | null;
  }>({ isOpen: false, rowId: '', barIndex: -1, bar: null });
  const [editingBarInfo, setEditingBarInfo] = useState<{
    rowId: string;
    barIndex: number;
    originalBar: { startDay: number; endDay: number };
  } | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [previewScale, setPreviewScale] = useState(1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // モーダルステート
  const [showCompleteModal, setShowCompleteModal] = useState(false);
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
        setMasterData(data); 
      } catch (e) { 
        console.error("マスタ取得エラー", e); 
      } 
    }; 
    loadMaster(); 
  }, []);

  useEffect(() => { 
    const handleResize = () => { 
      const A4_WIDTH_MM = 297; const MM_TO_PX = 3.78; const A4_WIDTH_PX = A4_WIDTH_MM * MM_TO_PX; const MARGIN = 40; 
      const availableWidth = window.innerWidth - MARGIN; 
      let scale = availableWidth / A4_WIDTH_PX; 
      if (scale > 1.2) scale = 1.2; 
      setPreviewScale(scale); 
    }; 
    window.addEventListener('resize', handleResize); 
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize); 
  }, []);

  useEffect(() => {
    if (report.processRows.length < 12) {
      const newRows = [...report.processRows];
      for (let i = report.processRows.length; i < 12; i++) {
        newRows.push({
          id: `row-${Date.now()}-${i}`,
          category: '',
          name: '',
          bars: []
        });
      }
      setReport(prev => ({ ...prev, processRows: newRows }));
    }
  }, [report.processRows.length]);

  const daysInMonth = useMemo(() => { 
    const date = new Date(report.year, report.month - 1, 1); 
    const totalDays = getDaysInMonth(date); 
    const days = []; 
    for (let i = 1; i <= totalDays; i++) { 
      const current = new Date(report.year, report.month - 1, i); 
      const isSun = getDay(current) === 0; 
      const isSat = getDay(current) === 6; 
      const isHol = isJapaneseHoliday(current); 
      let colorClass = ""; 
      let bgClass = ""; 
      if (isSun || isHol) { colorClass = "text-red-600"; bgClass = ""; }
      else if (isSat) { colorClass = "text-blue-600"; bgClass = ""; }
      else if (isSat) { colorClass = "text-blue-600"; bgClass = "bg-blue-50"; } 
      days.push({ date: i, dayOfWeek: WEEKDAYS[getDay(current)], colorClass, bgClass }); 
    } 
    return days; 
  }, [report.year, report.month]);

  const bottomColSpans = useMemo(() => { 
    const totalDays = daysInMonth.length; 
    // 月曜始まり〜日曜終わりで週を分割
    const rawWeeks: number[] = [];
    let dayCount = 0;
    for (let d = 1; d <= totalDays; d++) {
      dayCount++;
      const currentDate = new Date(report.year, report.month - 1, d);
      const isSunday = getDay(currentDate) === 0;
      const isLastDay = d === totalDays;
      if (isSunday || isLastDay) {
        rawWeeks.push(dayCount);
        dayCount = 0;
      }
    }
    // 最初の週が4日以内なら第2週と合体
    if (rawWeeks.length >= 2 && rawWeeks[0] <= 3) {
      rawWeeks[1] = rawWeeks[0] + rawWeeks[1];
      rawWeeks.shift();
    }
    // 最後の週が4日以内なら前の週と合体
    if (rawWeeks.length >= 2 && rawWeeks[rawWeeks.length - 1] <= 3) {
      rawWeeks[rawWeeks.length - 2] = rawWeeks[rawWeeks.length - 2] + rawWeeks[rawWeeks.length - 1];
      rawWeeks.pop();
    }
    return rawWeeks;
  }, [daysInMonth.length, report.year, report.month]);

  const updateReport = (updates: Partial<SafetyPlanReportData>) => { 
    setReport(prev => ({ ...prev, ...updates })); 
    setSaveStatus('idle'); 
    setHasUnsavedChanges(true); 
  };
  
  // 保存ボタン
  const handleSave = async () => {
    if (!report.project || !report.location) {
      alert("工事名と作業所を選択してください。");
      return;
    }
    let currentDraftId = draftId;
    if (currentDraftId && (report.year !== initialYearRef.current || report.month !== initialMonthRef.current)) {
      currentDraftId = null;
    }
    setSaveStatus('saving'); 
    try { 
      const newId = await saveDraft(currentDraftId, 'SAFETY_PLAN', flattenNestedArrays(report));
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
  
  const handlePrint = async () => { 
    if (!report.project || !report.location) { alert("工事名と作業所を選択してください。"); return; }
    let currentDraftId = draftId;
    if (currentDraftId && (report.year !== initialYearRef.current || report.month !== initialMonthRef.current)) {
      currentDraftId = null;
    }
    setSaveStatus('saving'); 
    try { 
      const newId = await saveDraft(currentDraftId, 'SAFETY_PLAN', flattenNestedArrays(report));
      setDraftId(newId); 
      initialYearRef.current = report.year;
      initialMonthRef.current = report.month;
      setSaveStatus('saved'); 
      setHasUnsavedChanges(false); 
      setTimeout(() => setSaveStatus('idle'), 2000); 
      
      const prevTitle = document.title;
      document.title = `${report.project}_${report.month}月度_安全管理計画表`;
      setTimeout(() => {
        window.print();
        document.title = prevTitle;
      }, 100); 
    } catch (e) { 
      alert("保存に失敗しました"); 
      setSaveStatus('idle'); 
    } 
  };
  
  // ホームに戻る処理（モーダル設定）
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

  const handleCellClick = (rowId: string, day: number) => {
    const row = report.processRows.find(r => r.id === rowId);

    // 期間変更モード中
    if (editingBarInfo && editingBarInfo.rowId === rowId) {
      if (ganttMode === 'selectStart') {
        setGanttStartDay(day);
        setGanttMode('selectEnd');
        setGanttMessage(`終了日をタップしてください（開始日: ${day}日）`);
        return;
      }
      if (ganttMode === 'selectEnd' && ganttStartDay !== null) {
        const start = Math.min(ganttStartDay, day);
        const end = Math.max(ganttStartDay, day);
        const newRows = report.processRows.map(r => {
          if (r.id === rowId) {
            const newBars = r.bars.map((b, idx) =>
              idx === editingBarInfo.barIndex ? { startDay: start, endDay: end } : b
            );
            return { ...r, bars: newBars };
          }
          return r;
        });
        updateReport({ processRows: newRows });
        setGanttMode('idle');
        setGanttRowId(null);
        setGanttStartDay(null);
        setGanttMessage('');
        setEditingBarInfo(null);
        return;
      }
    }

    // 既存バーをタップした場合（通常モード時）
    if (row && ganttMode === 'idle') {
      const barIdx = row.bars.findIndex(b => day >= b.startDay && day <= b.endDay);
      if (barIdx !== -1) {
        setBarActionModal({ isOpen: true, rowId, barIndex: barIdx, bar: row.bars[barIdx] });
        return;
      }
    }

    // 通常の新規作成フロー
    if (ganttMode === 'idle') {
      // 1タップ目 = 開始日確定 → 即座に終了日選択モードへ
      setGanttMode('selectEnd');
      setGanttRowId(rowId);
      setGanttStartDay(day);
      setGanttMessage(`終了日をタップしてください（開始日: ${day}日）`);
    } else if (ganttMode === 'selectEnd') {
      if (ganttRowId !== rowId) {
        // 別の行をタップ → その行で開始日として扱う
        setGanttRowId(rowId);
        setGanttStartDay(day);
        setEditingBarInfo(null);
        setGanttMessage(`終了日をタップしてください（開始日: ${day}日）`);
        return;
      }
      if (ganttStartDay !== null) {
        const start = Math.min(ganttStartDay, day);
        const end = Math.max(ganttStartDay, day);
        const newRows = report.processRows.map(r => {
          if (r.id === rowId) {
            return { ...r, bars: [...r.bars, { startDay: start, endDay: end }] };
          }
          return r;
        });
        updateReport({ processRows: newRows });
      }
      setGanttMode('idle');
      setGanttRowId(null);
      setGanttStartDay(null);
      setGanttMessage('');
    }
  };

  const cancelGantt = () => {
    setGanttMode('idle');
    setGanttRowId(null);
    setGanttStartDay(null);
    setGanttMessage('');
    setEditingBarInfo(null);
  };

  const handleBarDelete = () => {
    const { rowId, barIndex } = barActionModal;
    const newRows = report.processRows.map(r => {
      if (r.id === rowId) {
        const newBars = r.bars.filter((_, idx) => idx !== barIndex);
        return { ...r, bars: newBars };
      }
      return r;
    });
    updateReport({ processRows: newRows });
    setBarActionModal({ isOpen: false, rowId: '', barIndex: -1, bar: null });
  };

  const handleBarEdit = () => {
    const { rowId, barIndex, bar } = barActionModal;
    if (!bar) return;
    const row = report.processRows.find(r => r.id === rowId);
    setEditingBarInfo({ rowId, barIndex, originalBar: { ...bar } });
    setBarActionModal({ isOpen: false, rowId: '', barIndex: -1, bar: null });
    setGanttMode('selectStart');
    setGanttRowId(rowId);
    setGanttStartDay(null);
    setGanttMessage(`「${row?.name || '工程'}」の新しい開始日をタップしてください`);
  };

  const isCellActive = (rowId: string, day: number) => { 
    const row = report.processRows.find(r => r.id === rowId); 
    if (!row) return false; 
    return row.bars.some(b => day >= b.startDay && day <= b.endDay); 
  };

  const isCellInDraft = (rowId: string, day: number) => { 
    if (ganttRowId !== rowId) return false;
    if (ganttMode === 'selectEnd' && ganttStartDay !== null) {
      return day === ganttStartDay;
    }
    return false;
  };

  const isCellInRange = (rowId: string, day: number) => {
    if (ganttRowId !== rowId || ganttMode !== 'selectEnd' || ganttStartDay === null) return false;
    return day === ganttStartDay;
  };

  const isCellEditing = (rowId: string, day: number) => {
    if (!editingBarInfo || editingBarInfo.rowId !== rowId) return false;
    const { originalBar } = editingBarInfo;
    return day >= originalBar.startDay && day <= originalBar.endDay;
  };

  const borderOuter = "border-2 border-black"; const borderThin = "border border-black"; const headerBg = "bg-cyan-100"; const inputBase = "w-full h-full bg-transparent outline-none text-center font-serif"; const selectBase = "w-full h-full bg-transparent outline-none text-center appearance-none font-serif text-center-last";

  const renderReportSheet = (isPreview: boolean = false) => (
    <div className="p-[5mm] pt-[15mm] w-full h-full flex flex-col font-serif justify-start">
      <div className="flex justify-between items-start mb-1 h-[32mm]">
        <div className="flex-1 flex flex-col justify-center pb-2 h-full">
           <div className="flex items-end mb-4 pl-4">
             <span className="text-xl">令和</span>
             {isPreview ? <span className="text-xl mx-1 font-bold">{report.year - 2018}</span> : <select className="w-12 text-center text-xl border-b border-black outline-none mx-1 bg-transparent appearance-none" value={report.year - 2018} onChange={(e)=>updateReport({year: 2018 + parseInt(e.target.value||'0')})}>{Array.from({length: 30}, (_, i) => i + 1).map(y => (<option key={y} value={y}>{y}</option>))}</select>}
             <span className="text-xl mr-1">年</span>
             {isPreview ? <span className="text-xl font-bold">{report.month}</span> : <select className="w-10 text-center text-xl border-b border-black outline-none bg-transparent appearance-none" value={report.month} onChange={(e)=>updateReport({month: parseInt(e.target.value||'0')})}>{Array.from({length: 12}, (_, i) => i + 1).map(m => (<option key={m} value={m}>{m}</option>))}</select>}
             <span className="text-xl mr-2">月度</span>
             <h1 className="text-3xl font-bold border-b-2 border-black ml-4 px-2 tracking-widest">工事施工安全管理計画表</h1>
           </div>
           <div className="flex flex-col gap-1 pl-4 text-sm">
             <div className="flex items-center">
               <span className="font-bold mr-2 w-16 text-right">工事名 :</span>
               {isPreview ? (
                 <span className="min-w-[300px] max-w-[500px] px-1">{report.project}</span>
               ) : (
                 <select className={`outline-none bg-transparent appearance-none min-w-[300px] max-w-[500px] ${!report.project ? 'bg-red-50' : ''}`} value={report.project} onChange={(e)=>updateReport({project: e.target.value})}>
                   <option value="">選択してください</option>
                   {masterData.projects.map(p => <option key={p} value={p}>{p}</option>)}
                 </select>
               )}
             </div>
             <div className="flex items-center">
               <span className="font-bold mr-2 w-16 text-right">作業所 :</span>
               {isPreview ? (
                 <span className="min-w-[200px] px-1">{report.location}</span>
               ) : (
                 <select className={`outline-none bg-transparent appearance-none min-w-[200px] ${!report.location ? 'bg-red-50' : ''}`} value={report.location} onChange={(e)=>updateReport({location: e.target.value})}>
                   <option value="">選択してください</option>
                   {masterData.workplaces.map(p => <option key={p} value={p}>{p}</option>)}
                 </select>
               )}
             </div>
           </div>
        </div>
        <div className="w-[115mm] h-full flex flex-col justify-end">
          <div className="flex justify-end items-center mb-0.5 text-[10px]">
            <span>作成日：</span>
            {isPreview ? <span className="ml-1">{report.createdDate.replace(/-/g, '/')}</span> : <input type="date" className="bg-transparent text-[10px] w-auto text-left font-serif ml-1" value={report.createdDate} onChange={(e)=>updateReport({createdDate: e.target.value})} />}
            <span className="ml-2">作成者：</span>
            {isPreview ? (
              <span className="text-[10px] inline-block text-left">{report.author}</span>
            ) : (
              <select className="border-b border-black outline-none bg-transparent w-20 text-[10px] text-left" value={report.author} onChange={(e)=>updateReport({author: e.target.value})}>
                <option value="">(選択)</option>
                {masterData.supervisors.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </div>
          <table className={`w-full ${borderOuter} text-[10px] border-collapse`}>
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[20%]" />
              <col className="w-[33%]" />
              <col className="w-[25%]" />
            </colgroup>
            <thead><tr className={headerBg}><th className={`${borderThin} py-0.5 font-normal`}>行事予定</th><th className={`${borderThin} py-0.5 font-normal`}>月日</th><th className={`${borderThin} py-0.5 font-normal`}>役職</th><th className={`${borderThin} py-0.5 font-normal`}>氏名</th></tr></thead>
            <tbody>
              <tr>
                <td className={`${borderThin} text-center`}>安全訓練</td>
                <td className={`${borderThin} text-center`}>{isPreview ? (report.trainingDate ? report.trainingDate.replace(/-/g, '/') : '') : <input type="date" className={inputBase} value={report.trainingDate} onChange={(e)=>updateReport({trainingDate: e.target.value})} />}</td>
                <td className={`${borderThin} text-center`}>統括安全衛生責任者</td>
                <td className={`${borderThin} text-center`}>
                  {isPreview ? report.trainingLeader : (
                    <select className={selectBase} value={report.trainingLeader} onChange={(e)=>updateReport({trainingLeader: e.target.value})}>
                      <option value="">(選択)</option>
                      {masterData.supervisors.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </td>
              </tr>
              <tr>
                <td className={`${borderThin} text-center`}>災害防止協議会</td>
                <td className={`${borderThin} text-center`}>{isPreview ? (report.councilDate ? report.councilDate.replace(/-/g, '/') : '') : <input type="date" className={inputBase} value={report.councilDate} onChange={(e)=>updateReport({councilDate: e.target.value})} />}</td>
                <td className={`${borderThin} text-center`}>副統括安全衛生責任者</td>
                <td className={`${borderThin} text-center`}>
                  {isPreview ? report.councilLeader : (
                    <select className={selectBase} value={report.councilLeader} onChange={(e)=>updateReport({councilLeader: e.target.value})}>
                      <option value="">(選択)</option>
                      {masterData.supervisors.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </td>
              </tr>
              <tr>
                <td className={`${borderThin} text-center`}>社内パトロール</td>
                <td className={`${borderThin} text-center`}>{isPreview ? (report.patrolDate ? report.patrolDate.replace(/-/g, '/') : '') : <input type="date" className={inputBase} value={report.patrolDate} onChange={(e)=>updateReport({patrolDate: e.target.value})} />}</td>
                <td className={`${borderThin} bg-gray-100`}></td><td className={`${borderThin} bg-gray-100`}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex-1 flex flex-col border-2 border-black overflow-hidden relative">
         <table className="w-full h-full border-collapse table-fixed text-[10px]">
           <colgroup><col className="w-[30mm]" />{daysInMonth.map(d => <col key={d.date} />)}</colgroup>
           <thead>
             {/* ★修正: 安全衛生目標の表示部分 */}
             <tr className="h-[8mm]">
               <th className={`${borderThin} ${headerBg} font-normal`}>今月の安全衛生目標</th>
               <th className={`${borderThin} ${headerBg}`} colSpan={daysInMonth.length}>
                 <div className="flex justify-around text-xs font-bold items-center h-full">
                   {[0, 1, 2].map(idx => (
                     <div key={idx} className="flex items-center justify-center min-w-[30%]">
                       <span className="mr-1">{idx + 1}.</span>
                       {isPreview ? (
                         <span>{report.safetyGoals[idx]}</span>
                       ) : (
                         <select 
                           className="bg-transparent outline-none appearance-none font-bold min-w-[150px] border-b border-gray-400 border-dotted"
                           value={report.safetyGoals[idx]}
                           onChange={(e) => {
                             const newGoals = [...report.safetyGoals];
                             newGoals[idx] = e.target.value;
                             updateReport({ safetyGoals: newGoals });
                           }}
                         >
                           <option value="">(選択)</option>
                           {masterData.goals.map(g => <option key={g} value={g}>{g}</option>)}
                         </select>
                       )}
                     </div>
                   ))}
                 </div>
               </th>
             </tr>
             <tr className="h-[5mm]"><th className={`${borderThin} bg-gray-50 font-normal`} rowSpan={2}>月日</th><th className={`${borderThin} font-normal text-center`} colSpan={daysInMonth.length}>{report.month}月</th></tr>
             <tr className="h-[5mm]">{daysInMonth.map(d => (<th key={d.date} className={`${borderThin} font-normal text-center ${d.colorClass} ${d.bgClass}`}>{d.date}</th>))}</tr>
             <tr className="h-[5mm]"><th className={`${borderThin} bg-gray-50 font-normal`}>工 程</th>{daysInMonth.map(d => (<th key={d.date} className={`${borderThin} font-normal text-center ${d.colorClass} ${d.bgClass}`}>{d.dayOfWeek}</th>))}</tr>
           </thead>
           <tbody>
              {report.processRows.map((row) => (
                <tr key={row.id} className={`h-[6mm] ${!isPreview && ganttMode !== 'idle' && ganttRowId === row.id ? 'bg-yellow-50' : ''}`}>
                  <td className={`${borderThin} px-0 align-middle`}>
                    {isPreview ? (
                      <span className="w-full h-full flex items-center pl-[1em] font-bold text-[9px] truncate text-left">{row.name}</span>
                    ) : (
                      <select
                        className="w-full h-full bg-transparent text-[9px] outline-none appearance-none font-bold text-left pl-[1em] cursor-pointer"
                        value={row.name}
                        onChange={(e) => {
                          const newRows = report.processRows.map(r => r.id === row.id ? { ...r, name: e.target.value } : r);
                          updateReport({ processRows: newRows });
                        }}
                      >
                        <option value=""></option>
                        {masterData.jobTypes.map(job => <option key={job} value={job}>{job}</option>)}
                      </select>
                    )}
                  </td>
                  {daysInMonth.map(d => { const active = isCellActive(row.id, d.date); const isDraft = isCellInDraft(row.id, d.date); const isStart = isCellInRange(row.id, d.date); const isEditing = isCellEditing(row.id, d.date); return (<td key={d.date} className={`${borderThin} p-0 relative ${isPreview ? '' : 'cursor-pointer hover:bg-yellow-100'} ${d.bgClass} ${isStart ? 'bg-green-200' : ''}`} onClick={() => !isPreview && handleCellClick(row.id, d.date)}>{active && !isEditing && <div className="absolute inset-y-[30%] left-0 right-0 bg-blue-600"></div>}{isEditing && <div className="absolute inset-y-[30%] left-0 right-0 bg-green-500 opacity-70"></div>}{isDraft && <div className="absolute inset-y-[30%] left-0 right-0 bg-green-400 opacity-70"></div>}</td>); })}
                </tr>
              ))}
           </tbody>
           <tfoot>
              <tr className="h-[12mm]">
                <td className={`${borderThin} ${headerBg} text-center font-normal`}>予想される災害</td>
                {bottomColSpans.map((span, i) => (
                  <td key={i} colSpan={span} className={`${borderThin} align-top p-0`}>
                    <div className="flex flex-col h-full">
                      {[0, 1].map(j => (
                        <div key={j} className="flex-1">
                          {isPreview ? (
                            <div className={`w-full h-full text-[8px] leading-tight flex items-center ${span >= 5 ? 'pl-[1em]' : 'pl-[0.5em]'}`}>{(report.predictions[i] || [])[j]}</div>
                          ) : (
                            <select className={`w-full h-full bg-transparent text-[8px] outline-none appearance-none ${span >= 5 ? 'pl-[1em]' : 'pl-[0.5em]'}`} value={(report.predictions[i] || [])[j] || ''} onChange={(e) => { const n = report.predictions.map(a => [...(a || ["", ""])]); if (!n[i]) n[i] = ["", ""]; n[i][j] = e.target.value; updateReport({predictions: n}); }}>
                              <option value="">-</option>
                              {masterData.predictions.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
              <tr className="h-[25mm]">
                <td className={`${borderThin} ${headerBg} text-center font-normal leading-tight`}>予想される災害<br/>への防止対策</td>
                {bottomColSpans.map((span, i) => (
                  <td key={i} colSpan={span} className={`${borderThin} align-top p-0`}>
                    <div className="flex flex-col h-full">
                      {[0, 1, 2, 3, 4].map(j => (
                        <div key={j} className="flex-1">
                          {isPreview ? (
                            <div className={`w-full h-full text-[8px] leading-tight flex items-center ${span >= 5 ? 'pl-[1em]' : 'pl-[0.5em]'}`}>{(report.countermeasures[i] || [])[j]}</div>
                          ) : (
                            <select className={`w-full h-full bg-transparent text-[8px] outline-none appearance-none ${span >= 5 ? 'pl-[1em]' : 'pl-[0.5em]'}`} value={(report.countermeasures[i] || [])[j] || ''} onChange={(e) => { const n = report.countermeasures.map(a => [...(a || ["", "", "", "", ""])]); if (!n[i]) n[i] = ["", "", "", "", ""]; n[i][j] = e.target.value; updateReport({countermeasures: n}); }}>
                              <option value="">-</option>
                              {masterData.countermeasures.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
              <tr className="h-[15mm]">
                <td className={`${borderThin} ${headerBg} text-center font-normal leading-tight`}>重点点検項目</td>
                {bottomColSpans.map((span, i) => (
                  <td key={i} colSpan={span} className={`${borderThin} align-top p-0`}>
                    <div className="flex flex-col h-full">
                      {[0, 1, 2].map(j => (
                        <div key={j} className="flex-1">
                          {isPreview ? (
                            <div className={`w-full h-full text-[8px] leading-tight flex items-center ${span >= 5 ? 'pl-[1em]' : 'pl-[0.5em]'}`}>{(report.inspectionItems[i] || [])[j] ? `${j + 1}. ${(report.inspectionItems[i] || [])[j]}` : ''}</div>
                          ) : (
                            <div className="flex items-center h-full">
                              <span className={`text-[8px] shrink-0 ${span >= 5 ? 'pl-[1em]' : 'pl-[0.5em]'}`}>{j + 1}.</span>
                              <select className={`w-full h-full bg-transparent text-[8px] outline-none appearance-none ${span >= 5 ? 'pl-[0.5em]' : 'pl-[0.3em]'}`} value={(report.inspectionItems[i] || [])[j] || ''} onChange={(e) => { const n = report.inspectionItems.map(a => [...(a || ["", "", ""])]); if (!n[i]) n[i] = ["", "", ""]; n[i][j] = e.target.value; updateReport({inspectionItems: n}); }}>
                                <option value="">-</option>
                                {masterData.countermeasures.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
              <tr className="h-[6mm]">
                <td className={`${borderThin} ${headerBg} text-center font-normal`}>安全当番</td>
                {bottomColSpans.map((span, i) => (
                  <td key={i} colSpan={span} className={`${borderThin} p-0 text-center`}>
                    {isPreview ? (
                      <div className="w-full h-full text-[9px] flex items-center justify-center">{report.safetyDuty[i]}</div>
                    ) : (
                      <select className="w-full h-full text-[9px] text-center bg-transparent outline-none appearance-none" value={report.safetyDuty[i] || ''} onChange={(e) => updateReport({ safetyDuty: { ...report.safetyDuty, [i]: e.target.value }})}>
                        <option value="">-</option>
                        {masterData.supervisors.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </td>
                ))}
              </tr>
           </tfoot>
         </table>
      </div>
    </div>
  );

  return (
    <>
      <div className="no-print min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-slate-800 text-white p-4 shadow-md sticky top-0 z-30 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={handleHomeClick} className="text-white hover:text-gray-300 transition-colors"><i className="fa-solid fa-house"></i></button>
            <h1 className="text-lg font-bold"><i className="fa-solid fa-clipboard-list mr-2"></i>安全管理計画表</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-4 py-2 rounded font-bold border border-blue-400 text-white bg-blue-600 hover:bg-blue-500 flex items-center text-sm transition-colors shadow-sm">
              <i className={`fa-solid ${saveStatus === 'saved' ? 'fa-check' : 'fa-save'} mr-2`}></i>
              {saveStatus === 'saved' ? '保存完了' : '保存'}
            </button>
            <button onClick={() => setShowPreview(true)} className="px-4 py-2 bg-cyan-600 text-white rounded font-bold hover:bg-cyan-500 flex items-center text-sm transition-colors shadow-sm">
              <i className="fa-solid fa-file-pdf mr-2"></i> プレビュー
            </button>
          </div>
        </header>
        
        <div className={`${ganttMode !== 'idle' ? (editingBarInfo ? 'bg-orange-500' : 'bg-blue-600') : 'bg-gray-500'} text-white px-4 py-2 flex items-center justify-between shadow-md sticky top-[56px] z-20`}>
          <div className="flex items-center gap-2">
            <i className={`fa-solid ${ganttMode !== 'idle' ? 'fa-pencil' : 'fa-circle-info'}`}></i>
            <span className="font-bold text-sm">
              {ganttMode !== 'idle' ? ganttMessage : '「工程」の開始日をタップしてください'}
            </span>
          </div>
          {ganttMode !== 'idle' && (
            <button onClick={cancelGantt} className="px-3 py-1 bg-white text-gray-700 rounded font-bold text-sm hover:bg-gray-100 transition-colors">
              キャンセル
            </button>
          )}
        </div>
        <main className="flex-1 overflow-auto p-4 bg-gray-100 flex justify-center">
          <div className="bg-white shadow-xl origin-top" style={{ width: '297mm', minHeight: '210mm' }}>
            {renderReportSheet(false)}
          </div>
        </main>
      </div>

      {barActionModal.isOpen && (
        <div className="fixed inset-0 z-[60] bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-xs w-full p-6 animate-fade-in">
            <h3 className="text-lg font-bold text-gray-800 mb-2">工程線の操作</h3>
            <p className="text-sm text-gray-600 mb-4">
              {barActionModal.bar ? `${barActionModal.bar.startDay}日 〜 ${barActionModal.bar.endDay}日` : ''}
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={handleBarDelete} className="w-full py-3 bg-red-600 text-white rounded-lg font-bold shadow hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                <i className="fa-solid fa-trash"></i> この線を削除する
              </button>
              <button onClick={handleBarEdit} className="w-full py-3 bg-orange-500 text-white rounded-lg font-bold shadow hover:bg-orange-600 transition-colors flex items-center justify-center gap-2">
                <i className="fa-solid fa-pen-to-square"></i> 期間を変更する
              </button>
              <button onClick={() => setBarActionModal({ isOpen: false, rowId: '', barIndex: -1, bar: null })} className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showPreview && (
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
              <button
                onClick={handlePrint}
                className="px-6 py-2 bg-pink-600 text-white rounded-lg font-bold text-sm hover:bg-pink-700 transition-colors shadow"
              >
                <i className="fa-solid fa-print mr-2"></i>印刷
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-gray-200 p-4">
            <div className="flex justify-center"><div className="shadow-2xl">
              {renderReportSheet(true)}
            </div></div>
          </div>
        </div>
      )}

      <CompleteModal 
        isOpen={showCompleteModal} 
        onOk={() => { 
          setShowCompleteModal(false); 
          onBackToMenu(); 
        }} 
      />
      
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
         <style>{`@media print { @page { size: landscape; } }`}</style>
         <div className="print-page-landscape">
           {renderReportSheet(true)}
         </div>
      </div>
    </>
  );
};

export default SafetyPlanWizard;
