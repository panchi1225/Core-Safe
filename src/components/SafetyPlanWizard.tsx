import React, { useState, useEffect, useMemo } from 'react';
import { 
  MasterData, SafetyPlanReportData, INITIAL_SAFETY_PLAN_REPORT, INITIAL_MASTER_DATA 
} from '../types';
import { getMasterData, saveDraft, fetchSafetyPlansByProject } from '../services/firebaseService';
import { getDaysInMonth, getDay } from 'date-fns';

interface Props {
  initialData?: any;
  initialDraftId?: string | null;
  onBackToMenu: () => void;
  onGoToSettings: () => void; // Added
}

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

// RELEVANT_MASTER_KEYSなどは削除（マスタ管理機能削除のため）
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
const SafetyPlanWizard: React.FC<Props> = ({ initialData, initialDraftId, onBackToMenu, onGoToSettings }) => {
  const [report, setReport] = useState<SafetyPlanReportData>(initialData || INITIAL_SAFETY_PLAN_REPORT);
  const [draftId, setDraftId] = useState<string | null>(initialDraftId || null);
  const [masterData, setMasterData] = useState<MasterData>(INITIAL_MASTER_DATA);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: () => {} });
  const [showPreview, setShowPreview] = useState(false);
  const [drawingRowId, setDrawingRowId] = useState<string | null>(null);
  const [drawStartDay, setDrawStartDay] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [previewScale, setPreviewScale] = useState(1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  useEffect(() => { const loadMaster = async () => { try { const data = await getMasterData(); setMasterData(data); } catch (e) { console.error("マスタ取得エラー", e); } }; loadMaster(); }, []);
  useEffect(() => { const handleResize = () => { const A4_WIDTH_MM = 297; const MM_TO_PX = 3.78; const A4_WIDTH_PX = A4_WIDTH_MM * MM_TO_PX; const MARGIN = 40; const availableWidth = window.innerWidth - MARGIN; let scale = availableWidth / A4_WIDTH_PX; if (scale > 1.2) scale = 1.2; setPreviewScale(scale); }; window.addEventListener('resize', handleResize); handleResize(); return () => window.removeEventListener('resize', handleResize); }, []);

  // 行数が12行未満の場合、自動的に空行を追加して12行にする
  useEffect(() => {
    if (report.processRows.length < 12) {
      const currentLength = report.processRows.length;
      const newRows = [...report.processRows];
      for (let i = 0; i < 12 - currentLength; i++) {
        newRows.push({
          id: `row-${Date.now()}-${i}`, // ユニークIDを生成
          category: '',
          name: '',
          bars: []
        });
      }
      setReport(prev => ({ ...prev, processRows: newRows }));
    }
  }, [report.processRows.length]);

  const daysInMonth = useMemo(() => { const date = new Date(report.year, report.month - 1, 1); const totalDays = getDaysInMonth(date); const days = []; for (let i = 1; i <= totalDays; i++) { const current = new Date(report.year, report.month - 1, i); const isSun = getDay(current) === 0; const isSat = getDay(current) === 6; const isHol = isJapaneseHoliday(current); let colorClass = ""; let bgClass = ""; if (isSun || isHol) { colorClass = "text-red-600"; bgClass = "bg-red-50"; } else if (isSat) { colorClass = "text-blue-600"; bgClass = "bg-blue-50"; } days.push({ date: i, dayOfWeek: WEEKDAYS[getDay(current)], colorClass, bgClass }); } return days; }, [report.year, report.month]);
  const bottomColSpans = useMemo(() => { const totalDays = daysInMonth.length; const baseSpan = Math.floor(totalDays / 5); const remainder = totalDays % 5; return Array.from({length: 5}).map((_, i) => baseSpan + (i < remainder ? 1 : 0)); }, [daysInMonth.length]);

  const updateReport = (updates: Partial<SafetyPlanReportData>) => { setReport(prev => ({ ...prev, ...updates })); setSaveStatus('idle'); setHasUnsavedChanges(true); };
  const handleSave = async () => { setSaveStatus('saving'); try { const newId = await saveDraft(draftId, 'SAFETY_PLAN', report); setDraftId(newId); setSaveStatus('saved'); setHasUnsavedChanges(false); setTimeout(() => setSaveStatus('idle'), 2000); } catch (e) { console.error(e); alert("保存に失敗しました"); setSaveStatus('idle'); } };
  
  const handlePrint = async () => { 
    setSaveStatus('saving'); 
    try { 
      const newId = await saveDraft(draftId, 'SAFETY_PLAN', report); 
      setDraftId(newId); 
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
  
  const handleHomeClick = () => { if (hasUnsavedChanges) { setConfirmModal({ isOpen: true, message: "保存されていない変更があります。\n保存せずにホームに戻りますか？", onConfirm: () => { setConfirmModal(prev => ({ ...prev, isOpen: false })); onBackToMenu(); } }); } else { onBackToMenu(); } };

  // Settings Button Handler
  const handleSettingsClick = () => {
    if (hasUnsavedChanges) {
      setConfirmModal({
        isOpen: true,
        message: "保存されていない変更があります。\n設定画面へ移動すると変更内容は失われる可能性があります。\n移動しますか？",
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          onGoToSettings();
        }
      });
    } else {
      onGoToSettings();
    }
  };

  const handleCellClick = (rowId: string, day: number) => { if (drawingRowId === null) { setDrawingRowId(rowId); setDrawStartDay(day); } else { if (drawingRowId !== rowId) { setDrawingRowId(rowId); setDrawStartDay(day); } else { if (drawStartDay !== null) { const start = Math.min(drawStartDay, day); const end = Math.max(drawStartDay, day); const newRows = report.processRows.map(row => { if (row.id === rowId) { const cleanedBars = row.bars.filter(b => b.endDay < start || b.startDay > end); return { ...row, bars: [...cleanedBars, { startDay: start, endDay: end }] }; } return row; }); updateReport({ processRows: newRows }); } setDrawingRowId(null); setDrawStartDay(null); } } };
  const isCellActive = (rowId: string, day: number) => { const row = report.processRows.find(r => r.id === rowId); if (!row) return false; return row.bars.some(b => day >= b.startDay && day <= b.endDay); };
  const isCellInDraft = (rowId: string, day: number) => { if (drawingRowId !== rowId || drawStartDay === null) return false; return day === drawStartDay; };

  const borderOuter = "border-2 border-black"; const borderThin = "border border-black"; const headerBg = "bg-cyan-100"; const inputBase = "w-full h-full bg-transparent outline-none text-center font-serif"; const selectBase = "w-full h-full bg-transparent outline-none text-center appearance-none font-serif text-center-last";

  const renderReportSheet = (isPreview: boolean = false) => (
    <div className="p-[5mm] pt-[10mm] w-full h-full flex flex-col font-serif justify-start">
      <div className="flex justify-between items-start mb-1 h-[32mm]">
        <div className="flex-1 flex flex-col justify-center pb-2 h-full">
           <div className="flex items-end mb-4 pl-4">
             <span className="text-xl">令和</span>
             {isPreview ? <span className="text-xl mx-1 font-bold">{report.year - 2018}</span> : <select className="w-12 text-center text-xl border-b border-black outline-none mx-1 bg-transparent appearance-none" value={report.year - 2018} onChange={(e)=>updateReport({year: 2018 + parseInt(e.target.value||'0')})}>{Array.from({length: 30}, (_, i) => i + 1).map(y => (<option key={y} value={y}>{y}</option>))}</select>}
             <span className="text-xl mr-4">年</span>
             {isPreview ? <span className="text-xl mx-1 font-bold">{report.month}</span> : <select className="w-10 text-center text-xl border-b border-black outline-none mx-1 bg-transparent appearance-none" value={report.month} onChange={(e)=>updateReport({month: parseInt(e.target.value||'0')})}>{Array.from({length: 12}, (_, i) => i + 1).map(m => (<option key={m} value={m}>{m}</option>))}</select>}
             <span className="text-xl mr-2">月度</span>
             <h1 className="text-3xl font-bold border-b-2 border-black ml-4 px-2 tracking-widest">工事施工安全管理計画表</h1>
           </div>
           <div className="flex flex-col gap-1 pl-4 text-sm">
             <div className="flex items-center">
               <span className="font-bold mr-2 w-16 text-right">工事名 :</span>
               {isPreview ? <span className="min-w-[300px] max-w-[500px] px-1">{report.project}</span> : <select className="outline-none bg-transparent appearance-none min-w-[300px] max-w-[500px]" value={report.project} onChange={(e)=>updateReport({project: e.target.value})}>{masterData.projects.map(p => <option key={p} value={p}>{p}</option>)}</select>}
             </div>
             <div className="flex items-center">
               <span className="font-bold mr-2 w-16 text-right">作業所 :</span>
               {isPreview ? <span className="min-w-[200px] px-1">{report.location}</span> : <select className="outline-none bg-transparent appearance-none min-w-[200px]" value={report.location} onChange={(e)=>updateReport({location: e.target.value})}>{masterData.locations.map(p => <option key={p} value={p}>{p}</option>)}</select>}
             </div>
           </div>
        </div>
        <div className="w-[115mm] h-full flex flex-col justify-end">
          <div className="flex justify-end items-center mb-0.5 text-[10px]">
            <span>（作成日：</span>
            {isPreview ? <span className="ml-1">{report.createdDate.replace(/-/g, '/')}</span> : <input type="date" className="bg-transparent text-[10px] w-auto text-left font-serif ml-1" value={report.createdDate} onChange={(e)=>updateReport({createdDate: e.target.value})} />}
            <span className="ml-2">作成者：</span>
            {isPreview ? <span className="w-20 text-[10px] inline-block text-center">{report.author}</span> : <select className="border-b border-black outline-none bg-transparent w-20 text-[10px]" value={report.author} onChange={(e)=>updateReport({author: e.target.value})}>{masterData.supervisors.map(s=><option key={s} value={s}>{s}</option>)}</select>}
            <span>）</span>
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
                <td className={`${borderThin} text-center`}>{isPreview ? report.trainingLeader : <select className={selectBase} value={report.trainingLeader} onChange={(e)=>updateReport({trainingLeader: e.target.value})}>{masterData.supervisors.map(s=><option key={s} value={s}>{s}</option>)}</select>}</td>
              </tr>
              <tr>
                <td className={`${borderThin} text-center`}>災害防止協議会</td>
                <td className={`${borderThin} text-center`}>{isPreview ? (report.councilDate ? report.councilDate.replace(/-/g, '/') : '') : <input type="date" className={inputBase} value={report.councilDate} onChange={(e)=>updateReport({councilDate: e.target.value})} />}</td>
                <td className={`${borderThin} text-center`}>副統括安全衛生責任者</td>
                <td className={`${borderThin} text-center`}>{isPreview ? report.councilLeader : <select className={selectBase} value={report.councilLeader} onChange={(e)=>updateReport({councilLeader: e.target.value})}>{masterData.supervisors.map(s=><option key={s} value={s}>{s}</option>)}</select>}</td>
              </tr>
              <tr>
                <td className={`${borderThin} text-center`}>社内パトロール</td>
                <td className={`${borderThin} text-center`}>{isPreview ? (report.patrolDate ? report.patrolDate.replace(/-/g, '/') : '') : <input type="date" className={inputBase} value={report.patrolDate} onChange={(e)=>updateReport({patrolDate: e.target.value})} />}</td>
                <td className={`${borderThin} bg-gray-100`}></td><td className={`${borderThin} bg-gray-100`}></td>
              </tr>
              <tr><td className={`${borderThin} bg-gray-100`}></td><td className={`${borderThin} bg-gray-100`}></td><td className={`${borderThin} bg-gray-100`}></td><td className={`${borderThin} bg-gray-100`}></td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex-1 flex flex-col border-2 border-black overflow-hidden relative">
         <table className="w-full h-full border-collapse table-fixed text-[10px]">
           <colgroup><col className="w-[35mm]" />{daysInMonth.map(d => <col key={d.date} />)}<col className="w-[10mm]" /></colgroup>
           <thead>
             <tr className="h-[8mm]"><th className={`${borderThin} ${headerBg} font-normal`}>今月の安全衛生目標</th><th className={`${borderThin} ${headerBg}`} colSpan={daysInMonth.length}><div className="flex justify-around text-xs font-bold"><span>重機災害防止</span><span>重機転倒災害防止</span><span>第三者災害防止</span></div></th><th className={`${borderThin} ${headerBg} font-normal`} rowSpan={4}>備　考</th></tr>
             <tr className="h-[5mm]"><th className={`${borderThin} bg-gray-50 font-normal`} rowSpan={2}>月日</th><th className={`${borderThin} font-normal text-center`} colSpan={daysInMonth.length}>{report.month}月</th></tr>
             <tr className="h-[5mm]">{daysInMonth.map(d => (<th key={d.date} className={`${borderThin} font-normal text-center ${d.colorClass} ${d.bgClass}`}>{d.date}</th>))}</tr>
             <tr className="h-[5mm]"><th className={`${borderThin} bg-gray-50 font-normal`}>工 程</th>{daysInMonth.map(d => (<th key={d.date} className={`${borderThin} font-normal text-center ${d.colorClass} ${d.bgClass}`}>{d.dayOfWeek}</th>))}</tr>
           </thead>
           <tbody>
              {report.processRows.map((row) => (
                <tr key={row.id} className="h-[6mm]">
                  <td className={`${borderThin} px-0 align-middle`}>
                    {isPreview ? (
                      <span className="w-full h-full flex items-center pl-1 font-bold text-[9px] truncate text-left">{row.name}</span>
                    ) : (
                      <select
                        className="w-full h-full bg-transparent text-[9px] outline-none appearance-none font-bold text-left pl-1 cursor-pointer"
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
                  {daysInMonth.map(d => { const active = isCellActive(row.id, d.date); const isDraft = isCellInDraft(row.id, d.date); return (<td key={d.date} className={`${borderThin} p-0 relative ${isPreview ? '' : 'cursor-pointer hover:bg-yellow-50'} ${d.bgClass}`} onClick={() => !isPreview && handleCellClick(row.id, d.date)}>{active && <div className="absolute inset-y-[30%] left-0 right-0 bg-blue-600"></div>}{isDraft && <div className="absolute inset-y-[30%] left-0 right-0 bg-blue-300 opacity-50"></div>}</td>); })}
                  <td className={`${borderThin}`}></td>
                </tr>
              ))}
           </tbody>
           <tfoot>
              <tr className="h-[10mm]">
                <td className={`${borderThin} ${headerBg} text-center font-normal`}>予想される災害</td>
                {bottomColSpans.map((span, i) => (
                  <td key={i} colSpan={span} className={`${borderThin} align-top p-0`}>
                    {isPreview ? <div className="w-full h-full p-1 text-[9px] leading-tight">{report.predictions[i]}</div> : <select className="w-full h-full bg-transparent text-[9px] outline-none px-1 appearance-none" value={report.predictions[i] || ''} onChange={(e) => { const n = [...report.predictions]; n[i] = e.target.value; updateReport({predictions: n}); }}><option value="">-</option><option value="重機との接触事故">重機との接触事故</option><option value="ダンプトラックとの接触事故">ダンプトラックとの接触事故</option><option value="第三者との接触事故">第三者との接触事故</option><option value="墜落・転落">墜落・転落</option><option value="土砂崩壊">土砂崩壊</option></select>}
                  </td>
                ))}
                <td className={`${borderThin}`}></td>
              </tr>
              <tr className="h-[15mm]">
                <td className={`${borderThin} ${headerBg} text-center font-normal leading-tight`}>予想される災害<br/>への防止対策</td>
                {bottomColSpans.map((span, i) => (
                  <td key={i} colSpan={span} className={`${borderThin} align-top p-0`}>
                    {isPreview ? <div className="w-full h-full p-1 text-[9px] leading-tight whitespace-pre-wrap">{report.countermeasures[i]}</div> : <textarea className="w-full h-full bg-transparent text-[9px] outline-none resize-none p-1 leading-tight" value={report.countermeasures[i] || ''} onChange={(e) => { const n = [...report.countermeasures]; n[i] = e.target.value; updateReport({countermeasures: n}); }} />}
                  </td>
                ))}
                <td className={`${borderThin}`}></td>
              </tr>
              <tr className="h-[10mm]">
                <td className={`${borderThin} ${headerBg} text-center font-normal leading-tight`}>重点点検項目</td>
                {bottomColSpans.map((span, i) => (
                  <td key={i} colSpan={span} className={`${borderThin} align-top p-0`}>
                    {isPreview ? <div className="w-full h-full p-1 text-[9px] leading-tight">{report.inspectionItems[i]}</div> : <input className="w-full h-full bg-transparent text-[9px] outline-none px-1" value={report.inspectionItems[i] || ''} onChange={(e) => { const n = [...report.inspectionItems]; n[i] = e.target.value; updateReport({inspectionItems: n}); }} />}
                  </td>
                ))}
                <td className={`${borderThin}`}></td>
              </tr>
              <tr className="h-[6mm]">
                <td className={`${borderThin} ${headerBg} text-center font-normal`}>安全当番</td>
                {daysInMonth.map(d => (
                  <td key={d.date} className={`${borderThin} p-0 text-center`}>
                    {isPreview ? <div className="w-full h-full text-[8px] flex items-center justify-center">{report.safetyDuty[d.date]}</div> : <input className="w-full h-full text-[8px] text-center bg-transparent outline-none p-0" value={report.safetyDuty[d.date] || ''} onChange={(e) => updateReport({ safetyDuty: { ...report.safetyDuty, [d.date]: e.target.value }})} />}
                  </td>
                ))}
                <td className={`${borderThin}`}></td>
              </tr>
              <tr className="h-[10mm]">
                <td className={`${borderThin} ${headerBg} text-center font-normal`}>前月の反省</td>
                <td colSpan={daysInMonth.length + 1} className={`${borderThin} p-0`}>
                  {isPreview ? <div className="w-full h-full p-1 text-[10px] leading-tight whitespace-pre-wrap">{report.lastMonthReflection}</div> : <textarea className="w-full h-full p-1 text-[10px] bg-transparent outline-none resize-none leading-tight" value={report.lastMonthReflection} onChange={(e) => updateReport({ lastMonthReflection: e.target.value })} />}
                </td>
              </tr>
           </tfoot>
         </table>
      </div>
    </div>
  );

  return (
    <>
      <div className="no-print min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-slate-800 text-white p-4 shadow-md sticky top-0 z-30 flex justify-between items-center shrink-0"><div className="flex items-center gap-3"><button onClick={handleHomeClick} className="text-white hover:text-gray-300 transition-colors"><i className="fa-solid fa-house"></i></button><h1 className="text-lg font-bold"><i className="fa-solid fa-clipboard-list mr-2"></i>安全管理計画表</h1></div><button onClick={handleSettingsClick} className="text-xs bg-slate-700 px-3 py-2 rounded hover:bg-slate-600 transition-colors ml-2 shadow-sm"><i className="fa-solid fa-gear mr-1"></i>設定</button></header>
        <div className="flex gap-2 p-4 justify-end no-print"><button onClick={handleSave} className="px-4 py-2 rounded font-bold border border-blue-400 text-white bg-blue-600 hover:bg-blue-500 flex items-center text-sm transition-colors shadow-sm"><i className={`fa-solid ${saveStatus === 'saved' ? 'fa-check' : 'fa-save'} mr-2`}></i>{saveStatus === 'saved' ? '保存完了' : '一時保存'}</button><button onClick={() => setShowPreview(true)} className="px-4 py-2 bg-cyan-600 text-white rounded font-bold hover:bg-cyan-500 flex items-center text-sm transition-colors shadow-sm"><i className="fa-solid fa-file-pdf mr-2"></i> プレビュー</button></div>
        <main className="flex-1 overflow-auto p-4 bg-gray-100 flex justify-center"><div className="bg-white shadow-xl origin-top" style={{ width: '297mm', minHeight: '210mm' }}>{renderReportSheet(false)}</div></main>
      </div>
      {showPreview && (<div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-95 flex flex-col no-print"><div className="sticky top-0 bg-gray-800 text-white p-4 shadow-lg flex justify-between items-center shrink-0"><h2 className="text-lg font-bold"><i className="fa-solid fa-eye mr-2"></i>印刷プレビュー</h2><div className="flex gap-4"><button onClick={() => setShowPreview(false)} className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500 transition-colors">閉じる</button><button onClick={handlePrint} className="px-6 py-2 bg-green-600 rounded font-bold shadow-md flex items-center hover:bg-green-500 transition-colors"><i className="fa-solid fa-print mr-2"></i> 保存して印刷</button></div></div><div className="flex-1 overflow-y-auto p-8 flex justify-center items-start bg-gray-800"><div style={{ width: '297mm', transform: `scale(${previewScale})`, transformOrigin: 'top center', marginBottom: `${(previewScale - 1) * 100}%` }}><div className="bg-white shadow-2xl">{renderReportSheet(true)}</div></div></div></div>)}
      <div className="hidden print:block"><style>{`@media print { @page { size: landscape; } }`}</style><div className="print-page-landscape">{renderReportSheet(true)}</div></div>
      <ConfirmationModal isOpen={confirmModal.isOpen} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })} />
    </>
  );
};

export default SafetyPlanWizard;
