import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { 
  MasterData, NewcomerSurveyReportData, INITIAL_NEWCOMER_SURVEY_REPORT, 
  Qualifications, INITIAL_MASTER_DATA, EmployeeData 
} from '../types';
import { 
  getMasterData, saveDraft, fetchEmployees, 
  fetchDrafts, compressImage 
} from '../services/firebaseService';
import SignatureCanvas from 'react-signature-canvas';

interface Props {
  initialData?: any;
  initialDraftId?: string | null;
  onBackToMenu: () => void;
}

// --- 固定職種リスト ---
const PRESET_JOB_TYPES = [
  "土工", "鳶", "大工", "オペ", "鉄筋工", "交通整理人"
];

// --- Helper ---
const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);

const toJapaneseEra = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();

  if (y > 2018) return `令和${y - 2018}年${m}月${day}日`;
  if (y > 1988) return `平成${y - 1988}年${m}月${day}日`;
  if (y > 1925) return `昭和${y - 1925}年${m}月${day}日`;
  return `${y}年${m}月${day}日`;
};

// --- 安全装置 ---
const sanitizeReportData = (data: any): NewcomerSurveyReportData => {
  let base = INITIAL_NEWCOMER_SURVEY_REPORT;
  if (data) {
    const safeQualifications = { ...INITIAL_NEWCOMER_SURVEY_REPORT.qualifications, ...(data.qualifications || {}) };
    base = { ...INITIAL_NEWCOMER_SURVEY_REPORT, ...data, qualifications: safeQualifications };
  } else {
    base = {
      ...base,
      experienceYears: null as any,
      experienceMonths: null as any,
      healthCheckYear: null as any,
      healthCheckMonth: null as any,
      healthCheckDay: null as any,
      pledgeDateYear: null as any,
      pledgeDateMonth: null as any,
      pledgeDateDay: null as any,
      project: "",
      director: "",
      company: ""
    };
    
    const today = new Date();
    const reiwaYear = today.getFullYear() - 2018; 
    base.pledgeDateYear = reiwaYear;
    base.pledgeDateMonth = today.getMonth() + 1;
    base.pledgeDateDay = today.getDate();
  }
  return base;
};

// --- Modals ---
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

const CompleteModal: React.FC<{ isOpen: boolean; onOk: () => void }> = ({ isOpen, onOk }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-gray-900 bg-opacity-60 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full p-8 text-center animate-fade-in">
        <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="fa-solid fa-check text-3xl"></i>
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">保存完了</h3>
        <p className="text-gray-600 mb-6">データの保存が完了しました。</p>
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

// --- Main Wizard Component ---
const NewcomerSurveyWizard: React.FC<Props> = ({ initialData, initialDraftId, onBackToMenu }) => {
  const [step, setStep] = useState(1);
  const [report, setReport] = useState<NewcomerSurveyReportData>(sanitizeReportData(initialData));
  const [draftId, setDraftId] = useState<string | null>(initialDraftId || null);
  const [masterData, setMasterData] = useState<MasterData>(INITIAL_MASTER_DATA);
  const [showPreview, setShowPreview] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [previewScale, setPreviewScale] = useState(1);
  
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

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

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [sigKey, setSigKey] = useState(0);
  const [previewSigUrl, setPreviewSigUrl] = useState<string | null>(null);
  
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const sigPadRef = useRef<SignatureCanvas>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  useEffect(() => { 
    const loadData = async () => { 
      try { 
        const mData = await getMasterData(); 
        setMasterData(mData); 
        const eData = await fetchEmployees();
        setEmployees(eData);
      } catch (e) { console.error("データ取得エラー", e); } 
    }; 
    loadData(); 
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
    const calculateAge = () => {
      if (report.birthYear === '' || report.birthMonth === '' || report.birthDay === '') return report.age;
      let yearAD = 0;
      if (report.birthEra === 'Showa') yearAD = 1925 + report.birthYear; 
      else if (report.birthEra === 'Heisei') yearAD = 1988 + report.birthYear;
      else if (report.birthEra === 'Reiwa') yearAD = 2018 + report.birthYear;
      
      if (yearAD === 0) return report.age;
      const today = new Date(); 
      const birthDate = new Date(yearAD, report.birthMonth - 1, report.birthDay);
      let age = today.getFullYear() - birthDate.getFullYear(); 
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
      return Math.max(0, age);
    };
    const newAge = calculateAge();
    if (newAge !== report.age && report.birthYear !== '' && report.birthMonth !== '' && report.birthDay !== '') {
      setReport(prev => ({ ...prev, age: newAge }));
    }
  }, [report.birthEra, report.birthYear, report.birthMonth, report.birthDay]);

  useEffect(() => {
    if (report.contractor !== "松浦建設株式会社") {
      updateReport({ contractor: "松浦建設株式会社" });
    }
  }, [report.contractor]);

  const updateReport = (updates: Partial<NewcomerSurveyReportData>) => { 
    setReport(prev => ({ ...prev, ...updates })); 
    setSaveStatus('idle'); 
    setHasUnsavedChanges(true); 
    const newErrors = { ...errors };
    Object.keys(updates).forEach(key => delete newErrors[key]);
    setErrors(newErrors);
  };
  
  const updateQual = (key: keyof Qualifications, value: any) => { 
    setReport(prev => ({ ...prev, qualifications: { ...prev.qualifications, [key]: value } })); 
    setSaveStatus('idle'); 
    setHasUnsavedChanges(true); 
  };
  
  const handleEmployeeSelect = (empId: string) => {
    setSelectedEmployeeId(empId);
    if (!empId) return;
    
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    
    let currentExpYears = emp.experienceYears;
    let currentExpMonths = emp.experienceMonths;
    if (emp.lastUpdatedExperience) {
      const lastUpdate = new Date(emp.lastUpdatedExperience);
      const now = new Date();
      let monthsDiff = (now.getFullYear() - lastUpdate.getFullYear()) * 12 + (now.getMonth() - lastUpdate.getMonth());
      if (now.getDate() < lastUpdate.getDate()) monthsDiff--;
      if (monthsDiff > 0) {
        const totalMonths = currentExpYears * 12 + currentExpMonths + monthsDiff;
        currentExpYears = Math.floor(totalMonths / 12);
        currentExpMonths = totalMonths % 12;
      }
    }

    updateReport({
      company: "松浦建設株式会社",
      nameSei: emp.nameSei,
      nameMei: emp.nameMei,
      furiganaSei: emp.furiganaSei,
      furiganaMei: emp.furiganaMei,
      birthEra: emp.birthEra,
      birthYear: emp.birthYear,
      birthMonth: emp.birthMonth,
      birthDay: emp.birthDay,
      bloodType: emp.bloodType,
      bloodTypeRh: emp.bloodTypeRh,
      gender: emp.gender,
      address: emp.address,
      phone: emp.phone,
      emergencyContactSei: emp.emergencyContactSei,
      emergencyContactMei: emp.emergencyContactMei,
      emergencyContactRelation: emp.emergencyContactRelation,
      emergencyContactPhone: emp.emergencyContactPhone,
      healthCheckYear: emp.healthCheckYear,
      healthCheckMonth: emp.healthCheckMonth,
      healthCheckDay: emp.healthCheckDay,
      experienceYears: currentExpYears,
      experienceMonths: currentExpMonths,
      jobType: emp.jobType, 
      jobTypeOther: emp.jobType === 'その他' ? '' : '', 
      qualifications: { ...INITIAL_NEWCOMER_SURVEY_REPORT.qualifications, ...emp.qualifications }
    });
  };

  const validateStep1 = () => {
    const newErrors: Record<string, boolean> = {};
    const r = report;

    if (!r.project) newErrors.project = true;
    if (!r.director) newErrors.director = true;
    if (!r.nameSei) newErrors.nameSei = true;
    if (!r.nameMei) newErrors.nameMei = true;
    if (!r.furiganaSei) newErrors.furiganaSei = true;
    if (!r.furiganaMei) newErrors.furiganaMei = true;
    if (!r.birthYear) newErrors.birthYear = true;
    if (!r.birthMonth) newErrors.birthMonth = true;
    if (!r.birthDay) newErrors.birthDay = true;
    if (!r.company) newErrors.company = true;
    
    if (r.experienceYears === undefined || r.experienceYears === null) newErrors.experienceYears = true;
    
    if (!r.jobType) newErrors.jobType = true;
    if (r.jobType === 'その他' && !r.jobTypeOther) newErrors.jobTypeOther = true;
    
    if (!r.address) newErrors.address = true;
    if (!r.phone) newErrors.phone = true;
    if (!r.emergencyContactSei) newErrors.emergencyContactSei = true;
    if (!r.emergencyContactMei) newErrors.emergencyContactMei = true;
    if (!r.emergencyContactRelation) newErrors.emergencyContactRelation = true;
    if (!r.emergencyContactPhone) newErrors.emergencyContactPhone = true;
    if (!r.healthCheckYear) newErrors.healthCheckYear = true;
    if (!r.healthCheckMonth) newErrors.healthCheckMonth = true;
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1) {
      if (!validateStep1()) {
        alert("未入力の必須項目があります。\n赤枠の項目を確認してください。");
        return;
      }
    }
    setStep(prev => Math.min(prev + 1, 3));
  };

  const handleBack = () => setStep(prev => Math.max(prev - 1, 1));
  
  const handleSave = async () => { 
    if (!report.signatureDataUrl) {
      alert("署名がありません。\n署名を行ってください。");
      return;
    }
    setSaveStatus('saving'); 
    try { 
      const fullName = (report.nameSei || '') + (report.nameMei || '');
      const dataToSave = { ...report, name: fullName || '氏名未入力' };
      const newId = await saveDraft(draftId, 'NEWCOMER_SURVEY', dataToSave); 
      setDraftId(newId); 
      setSaveStatus('saved'); 
      setHasUnsavedChanges(false); 
      setShowCompleteModal(true);
    } catch (e) { 
      console.error(e); 
      alert("保存に失敗しました"); 
      setSaveStatus('idle'); 
    } 
  };

  const handlePreviewClick = () => {
    if (!report.signatureDataUrl) {
      alert("署名がありません。\n署名を行ってください。");
      return;
    }
    setShowPreview(true);
  };

  const handleSaveAndPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `新規入場者アンケート_${report.nameSei || ''}${report.nameMei || ''}`,
    onAfterPrint: () => {}
  });

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
  
  const handleSignatureSave = (dataUrl: string) => { 
    updateReport({ signatureDataUrl: dataUrl }); 
    setSigKey(prev => prev + 1); 
  };

  const getErrorClass = (key: string) => errors[key] ? "border-red-500 bg-red-50 ring-1 ring-red-500" : "border-gray-300 bg-white";

  const isHealthCheckExpired = () => {
    if (!report.healthCheckYear || !report.healthCheckMonth || !report.healthCheckDay) return false;
    const yearAD = 2018 + report.healthCheckYear; 
    const checkDate = new Date(yearAD, report.healthCheckMonth - 1, report.healthCheckDay);
    const today = new Date();
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    return checkDate < oneYearAgo;
  };

  const isExpired = isHealthCheckExpired();

  // --- Render ---
  return (
    <>
      <div className="no-print min-h-screen pb-24 bg-gray-50">
        <header className="bg-slate-800 text-white p-4 shadow-md sticky top-0 z-10 flex justify-between items-center">
          <div className="flex items-center gap-3"><button onClick={handleHomeClick} className="text-white hover:text-gray-300"><i className="fa-solid fa-house"></i></button><h1 className="text-lg font-bold"><i className="fa-solid fa-person-circle-question mr-2"></i>新規入場者アンケート</h1></div>
        </header>
        <div className="bg-white p-4 shadow-sm mb-4"><div className="flex justify-between text-xs font-bold text-gray-400 mb-2"><span className={step >= 1 ? "text-purple-600" : ""}>基本情報</span><span className={step >= 2 ? "text-purple-600" : ""}>資格</span><span className={step >= 3 ? "text-purple-600" : ""}>誓約・署名</span></div><div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden"><div className="bg-purple-600 h-full transition-all duration-300" style={{ width: `${step * 33.3}%` }}></div></div></div>
        
        <main className="mx-auto p-4 bg-white shadow-lg rounded-lg max-w-3xl min-h-[60vh]">
           {step === 1 && (
             <div className="space-y-6">
               <h2 className="text-xl font-bold text-gray-800 border-l-4 border-purple-600 pl-3">STEP 1: 基本情報</h2>
               <div className="bg-purple-50 p-4 rounded border border-purple-100 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <div className="w-full"><label className="block text-xs font-bold text-gray-700 mb-1">作業所名</label><select className={`w-full p-2 border rounded ${getErrorClass('project')}`} value={report.project} onChange={(e)=>updateReport({project: e.target.value})}><option value="">選択してください</option>{masterData.projects.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                  <div className="w-full"><label className="block text-xs font-bold text-gray-700 mb-1">作業所長名</label><select className={`w-full p-2 border rounded ${getErrorClass('director')}`} value={report.director} onChange={(e)=>updateReport({director: e.target.value})}><option value="">選択してください</option>{masterData.supervisors.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
               </div>
               <div className="bg-green-50 p-4 rounded border border-green-200 w-full"><div className="text-sm text-green-700 font-bold mb-2">「松浦建設株式会社」の社員はこちらから</div><select className="w-full p-2 border border-gray-300 rounded bg-white" value={selectedEmployeeId} onChange={(e) => handleEmployeeSelect(e.target.value)}><option value="">選択してください</option>{employees.map(emp => <option key={emp.id} value={emp.id}>{emp.nameSei} {emp.nameMei}</option>)}</select></div>
               {/* 入力フォーム */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div><label className="label font-bold text-gray-700">氏名</label><div className="flex gap-2"><input type="text" className={`w-1/2 p-2 border rounded ${getErrorClass('nameSei')}`} placeholder="氏" value={report.nameSei} onChange={(e)=>updateReport({nameSei:e.target.value})} /><input type="text" className={`w-1/2 p-2 border rounded ${getErrorClass('nameMei')}`} placeholder="名" value={report.nameMei} onChange={(e)=>updateReport({nameMei:e.target.value})} /></div></div>
                 <div><label className="label font-bold text-gray-700">フリガナ</label><div className="flex gap-2"><input type="text" className={`w-1/2 p-2 border rounded ${getErrorClass('furiganaSei')}`} placeholder="セイ" value={report.furiganaSei} onChange={(e)=>updateReport({furiganaSei:e.target.value})} /><input type="text" className={`w-1/2 p-2 border rounded ${getErrorClass('furiganaMei')}`} placeholder="メイ" value={report.furiganaMei} onChange={(e)=>updateReport({furiganaMei:e.target.value})} /></div></div>
                 <div className="md:col-span-2">
                   <label className="label font-bold text-gray-700">生年月日</label>
                   <div className="flex gap-2 items-center">
                     <select className="p-2 border rounded" value={report.birthEra} onChange={(e)=>updateReport({birthEra:e.target.value as any})}><option value="Showa">昭和</option><option value="Heisei">平成</option><option value="Reiwa">令和</option></select>
                     <select className={`w-16 p-2 border rounded ${getErrorClass('birthYear')}`} value={report.birthYear} onChange={(e)=>updateReport({birthYear:parseInt(e.target.value)||''})}><option value="">-</option>{range(1, 64).map(y=><option key={y} value={y}>{y}</option>)}</select><span>年</span>
                     <select className={`w-14 p-2 border rounded ${getErrorClass('birthMonth')}`} value={report.birthMonth} onChange={(e)=>updateReport({birthMonth:parseInt(e.target.value)||''})}><option value="">-</option>{range(1,12).map(m=><option key={m} value={m}>{m}</option>)}</select><span>月</span>
                     <select className={`w-14 p-2 border rounded ${getErrorClass('birthDay')}`} value={report.birthDay} onChange={(e)=>updateReport({birthDay:parseInt(e.target.value)||''})}><option value="">-</option>{range(1,31).map(d=><option key={d} value={d}>{d}</option>)}</select><span>日</span>
                     <span className="ml-2">({report.age}歳)</span>
                   </div>
                 </div>
                 <div><label className="label font-bold text-gray-700">会社名</label><select className={`w-full p-2 border rounded ${getErrorClass('company')}`} value={report.company} onChange={(e)=>updateReport({company:e.target.value})}><option value="">選択してください</option>{masterData.contractors.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                 
                 <div>
                   <label className="label font-bold text-gray-700">職種</label>
                   <div className="flex flex-col gap-2">
                     <select 
                       className={`w-full p-2 border rounded ${getErrorClass('jobType')}`} 
                       value={report.jobType} 
                       onChange={(e) => {
                         const val = e.target.value;
                         if (val === "その他") {
                           updateReport({ jobType: "その他" }); 
                         } else {
                           updateReport({ jobType: val, jobTypeOther: "" }); 
                         }
                       }}
                     >
                       <option value="">選択してください</option>
                       {PRESET_JOB_TYPES.map(j => <option key={j} value={j}>{j}</option>)}
                       <option value="その他">その他</option>
                     </select>
                     {/* その他選択時に表示 */}
                     {report.jobType === 'その他' && (
                       <input 
                         type="text" 
                         className={`w-full p-2 border rounded ${getErrorClass('jobTypeOther')}`} 
                         placeholder="職種を入力してください" 
                         value={report.jobTypeOther || ""} 
                         onChange={(e)=>updateReport({jobTypeOther: e.target.value})} 
                       />
                     )}
                   </div>
                 </div>

                 <div>
                   <label className="label font-bold text-gray-700">経験年数</label>
                   <div className="flex gap-2">
                     <select className={`w-20 p-2 border rounded ${getErrorClass('experienceYears')}`} value={report.experienceYears??''} onChange={(e)=>updateReport({experienceYears:parseInt(e.target.value)||0})}><option value="">-</option>{range(0,60).map(y=><option key={y} value={y}>{y}</option>)}</select><span>年</span>
                     <select className="w-16 p-2 border rounded" value={report.experienceMonths??''} onChange={(e)=>updateReport({experienceMonths:parseInt(e.target.value)||0})}><option value="">-</option>{range(0,11).map(m=><option key={m} value={m}>{m}</option>)}</select><span>ヶ月</span>
                   </div>
                 </div>
                 
                 <div className="md:col-span-2">
                   <label className="label font-bold text-gray-700">緊急連絡先</label>
                   <div className="grid grid-cols-2 gap-2">
                     <input type="text" className={`p-2 border rounded ${getErrorClass('emergencyContactSei')}`} placeholder="氏" value={report.emergencyContactSei} onChange={e=>updateReport({emergencyContactSei:e.target.value})} />
                     <input type="text" className={`p-2 border rounded ${getErrorClass('emergencyContactMei')}`} placeholder="名" value={report.emergencyContactMei} onChange={e=>updateReport({emergencyContactMei:e.target.value})} />
                     <select className={`p-2 border rounded ${getErrorClass('emergencyContactRelation')}`} value={report.emergencyContactRelation} onChange={e=>updateReport({emergencyContactRelation:e.target.value})}><option value="">続柄</option><option value="妻">妻</option><option value="夫">夫</option><option value="父">父</option><option value="母">母</option><option value="子">子</option><option value="その他">その他</option></select>
                     <input type="text" className={`p-2 border rounded ${getErrorClass('emergencyContactPhone')}`} placeholder="電話番号" value={report.emergencyContactPhone} onChange={e=>updateReport({emergencyContactPhone:e.target.value})} />
                   </div>
                 </div>
                 <div className="md:col-span-2"><label className="label font-bold text-gray-700">住所</label><input type="text" className={`w-full p-2 border rounded ${getErrorClass('address')}`} value={report.address} onChange={e=>updateReport({address:e.target.value})} /></div>
                 <div><label className="label font-bold text-gray-700">電話番号</label><input type="text" className={`w-full p-2 border rounded ${getErrorClass('phone')}`} value={report.phone} onChange={e=>updateReport({phone:e.target.value})} /></div>
                 <div>
                   <label className="label font-bold text-gray-700">健康診断 (令和)</label>
                   <div className="flex gap-1 items-center">
                     <select className={`w-16 p-2 border rounded ${getErrorClass('healthCheckYear')}`} value={report.healthCheckYear??''} onChange={e=>updateReport({healthCheckYear:parseInt(e.target.value)||0})}><option value="">-</option>{range(1,30).map(y=><option key={y} value={y}>{y}</option>)}</select>年
                     <select className={`w-14 p-2 border rounded ${getErrorClass('healthCheckMonth')}`} value={report.healthCheckMonth??''} onChange={e=>updateReport({healthCheckMonth:parseInt(e.target.value)||0})}><option value="">-</option>{range(1,12).map(m=><option key={m} value={m}>{m}</option>)}</select>月
                   </div>
                   {isExpired && <p className="text-red-500 text-xs mt-1 font-bold">※1年以上経過しています</p>}
                 </div>
               </div>
             </div>
           )}
           {step === 2 && (
             <div className="space-y-6">
               <h2 className="text-xl font-bold text-gray-800 border-l-4 border-purple-600 pl-3">STEP 2: 資格</h2>
               <div className="bg-white p-4 rounded border shadow-sm">
                 <h3 className="font-bold border-b mb-3">技能講習・特別教育・その他</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                      {k:'vehicle_leveling',l:'車輌系建設機械(整地)'}, {k:'vehicle_demolition',l:'車輌系建設機械(解体)'}, {k:'mobile_crane',l:'小型移動クレーン'},
                      {k:'slinging',l:'玉掛'}, {k:'gas_welding',l:'ガス溶接'}, {k:'scaffolding',l:'足場組立て'}, {k:'foreman',l:'職長教育'},
                      {k:'arc_welding',l:'アーク溶接'}, {k:'electrician',l:'電気工事士'}, {k:'license_regular',l:'普通自動車免許'}, {k:'license_large',l:'大型自動車免許'}
                    ].map(q => (
                      <label key={q.k} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={(report.qualifications as any)[q.k]} onChange={e=>updateQual(q.k as any, e.target.checked)} />{q.l}</label>
                    ))}
                 </div>
                 <div className="mt-4"><label className="block text-sm font-bold mb-1">その他資格</label><input type="text" className="w-full p-2 border rounded" value={report.qualifications.otherText1 || ''} onChange={e=>updateQual('otherText1', e.target.value)} /></div>
               </div>
             </div>
           )}
           {step === 3 && (
             <div className="space-y-6">
               <h2 className="text-xl font-bold text-gray-800 border-l-4 border-purple-600 pl-3">STEP 3: 誓約・署名</h2>
               <div className="bg-gray-50 p-6 rounded-lg border text-sm leading-relaxed"><ul className="list-disc pl-5"><li>諸規定及び指示事項を堅く守り、安全作業に従事致します。</li><li>暴力団排除条例に基づき、反社会的勢力ではないことを確約致します。</li></ul></div>
               <div className="text-center">
                 <div className="mb-2 font-bold">誓約日 (令和)</div>
                 <div className="flex justify-center gap-2 mb-6">
                   <select className="p-2 border rounded" value={report.pledgeDateYear??''} onChange={e=>updateReport({pledgeDateYear:parseInt(e.target.value)})}><option value="">-</option>{range(1,30).map(y=><option key={y} value={y}>{y}</option>)}</select>年
                   <select className="p-2 border rounded" value={report.pledgeDateMonth??''} onChange={e=>updateReport({pledgeDateMonth:parseInt(e.target.value)})}><option value="">-</option>{range(1,12).map(m=><option key={m} value={m}>{m}</option>)}</select>月
                   <select className="p-2 border rounded" value={report.pledgeDateDay??''} onChange={e=>updateReport({pledgeDateDay:parseInt(e.target.value)})}><option value="">-</option>{range(1,31).map(d=><option key={d} value={d}>{d}</option>)}</select>日
                 </div>
                 <div className="border-2 border-dashed border-gray-300 rounded bg-white"><SignatureCanvas ref={sigPadRef} canvasProps={{ className: 'w-full h-40' }} onEnd={()=>{if(sigPadRef.current) updateReport({signatureDataUrl:sigPadRef.current.toDataURL()})}} /></div>
                 <button onClick={()=>sigPadRef.current?.clear()} className="mt-2 text-sm text-red-500 underline">クリア</button>
               </div>
             </div>
           )}
        </main>
        
        <footer className="fixed bottom-0 left-0 w-full bg-white border-t p-4 flex justify-between items-center shadow-md z-20">
          <button onClick={handleBack} disabled={step===1} className={`px-4 py-3 rounded-lg font-bold ${step===1?'text-gray-300':'bg-gray-100'}`}>戻る</button>
          {step<3 ? <button onClick={handleNext} className="px-8 py-3 bg-purple-600 text-white rounded-lg font-bold">次へ</button> : 
            <div className="flex gap-4">
              <button onClick={handleSave} className="px-8 py-3 bg-red-600 text-white rounded-lg font-bold">保存</button>
              <button onClick={handlePreviewClick} className="px-8 py-3 bg-cyan-600 text-white rounded-lg font-bold">プレビュー</button>
            </div>
          }
        </footer>
      </div>
      
      <CompleteModal isOpen={showCompleteModal} onOk={() => { setShowCompleteModal(false); onBackToMenu(); }} />
      <ConfirmationModal isOpen={confirmModal.isOpen} message={confirmModal.message} onLeftButtonClick={confirmModal.onLeftButtonClick} onRightButtonClick={confirmModal.onRightButtonClick} leftButtonLabel={confirmModal.leftButtonLabel} rightButtonLabel={confirmModal.rightButtonLabel} leftButtonClass={confirmModal.leftButtonClass} rightButtonClass={confirmModal.rightButtonClass} />
      
      {showPreview && (
        <div className="fixed inset-0 z-[100] bg-gray-900 bg-opacity-90 flex flex-col no-print">
          <div className="p-4 flex justify-between text-white"><h2 className="font-bold">プレビュー</h2><div className="flex gap-4"><button onClick={()=>setShowPreview(false)} className="bg-gray-600 px-4 py-2 rounded">閉じる</button><button onClick={handleSaveAndPrint} className="bg-green-600 px-6 py-2 rounded font-bold">印刷</button></div></div>
          <div className="flex-1 overflow-y-auto flex justify-center p-4"><div style={{ width: '794px', transform: `scale(${previewScale})`, transformOrigin: 'top center' }} ref={printRef}><NewcomerSurveyPrintLayout data={report} /></div></div>
        </div>
      )}
      <div className="hidden print:block"><NewcomerSurveyPrintLayout data={report} /></div>
    </>
  );
};

// --- 印刷用レイアウト (内部定義) ---
const NewcomerSurveyPrintLayout: React.FC<{ data: NewcomerSurveyReportData }> = ({ data }) => {
  const checkbox = (checked: boolean) => <span className={`inline-block w-4 h-4 border border-black mr-1 text-center leading-3 ${checked ? 'bg-black text-white' : 'bg-white'}`}>{checked && "✓"}</span>;
  const circle = (checked: boolean) => <span className="inline-block w-4 h-4 border border-black rounded-full mr-1 relative">{checked && <span className="absolute inset-1 bg-black rounded-full"></span>}</span>;

  // 職種判定ロジック
  const isPreset = PRESET_JOB_TYPES.includes(data.jobType);
  const isOther = !isPreset && data.jobType !== "";
  // その他の場合の表示テキスト: jobTypeOtherが優先、なければjobType (古いデータ用)
  const otherText = data.jobTypeOther || (isOther ? data.jobType : "");

  return (
    <div className="w-[210mm] h-[297mm] bg-white p-[15mm] text-black text-sm relative">
       <h1 className="text-center text-2xl font-bold border-b-2 border-black pb-2 mb-4">新規入場者アンケート</h1>
       <div className="flex justify-between mb-2">
         <div>現場名: <span className="font-bold text-lg underline ml-2">{data.project}</span></div>
         <div>日付: {toJapaneseEra(`${data.pledgeDateYear ? data.pledgeDateYear + 2018 : new Date().getFullYear()}-${data.pledgeDateMonth}-${data.pledgeDateDay}`)}</div>
       </div>
       <table className="w-full border-collapse border border-black mb-4">
         <tbody>
           <tr><td className="border border-black p-2 bg-gray-100 w-24">氏名</td><td className="border border-black p-2 w-48 font-bold text-lg">{data.nameSei} {data.nameMei}</td><td className="border border-black p-2 bg-gray-100 w-16">フリガナ</td><td className="border border-black p-2">{data.furiganaSei} {data.furiganaMei}</td></tr>
           <tr><td className="border border-black p-2 bg-gray-100">生年月日</td><td className="border border-black p-2">{data.birthEra === 'Showa' ? '昭和' : data.birthEra === 'Heisei' ? '平成' : '令和'}{data.birthYear}年{data.birthMonth}月{data.birthDay}日 (満{data.age}歳)</td><td className="border border-black p-2 bg-gray-100">血液型</td><td className="border border-black p-2">{data.bloodType}型 {data.bloodTypeRh === 'Plus' ? '+' : '-'}</td></tr>
           <tr><td className="border border-black p-2 bg-gray-100">現住所</td><td colSpan={3} className="border border-black p-2">{data.address}</td></tr>
           <tr><td className="border border-black p-2 bg-gray-100">電話番号</td><td colSpan={3} className="border border-black p-2">{data.phone}</td></tr>
           <tr><td className="border border-black p-2 bg-gray-100" rowSpan={2}>緊急連絡先</td><td className="border border-black p-2" colSpan={3}>氏名: <span className="font-bold mr-4">{data.emergencyContactSei} {data.emergencyContactMei}</span> 続柄: <span className="font-bold">{data.emergencyContactRelation}</span></td></tr>
           <tr><td className="border border-black p-2" colSpan={3}>電話: <span className="font-bold">{data.emergencyContactPhone}</span></td></tr>
         </tbody>
       </table>
       
       <div className="border border-black p-4 mb-4">
          <h3 className="font-bold border-b border-black inline-block mb-2">職種・経験・健康</h3>
          <div className="mb-2">
            <span className="font-bold mr-2">職種:</span>
            {PRESET_JOB_TYPES.map(j => <span key={j} className="mr-3">{circle(data.jobType === j)} {j}</span>)}
            {/* 修正: その他の丸印とテキスト表示 */}
            <span>{circle(isOther || data.jobType === 'その他')} その他 ( <span className="underline decoration-dotted">{otherText}</span> )</span>
          </div>
          <div className="mb-2"><span className="font-bold mr-2">経験年数:</span> {data.experienceYears}年 {data.experienceMonths}ヶ月</div>
          <div><span className="font-bold mr-2">健康診断:</span> 令和{data.healthCheckYear}年{data.healthCheckMonth}月{data.healthCheckDay}日</div>
       </div>

       <div className="border border-black p-4 mb-4">
          <h3 className="font-bold border-b border-black inline-block mb-2">保有資格</h3>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <span>{checkbox(data.qualifications.vehicle_leveling)} 車両系(整地)</span>
            <span>{checkbox(data.qualifications.vehicle_demolition)} 車両系(解体)</span>
            <span>{checkbox(data.qualifications.mobile_crane)} 小型移動式クレーン</span>
            <span>{checkbox(data.qualifications.slinging)} 玉掛</span>
            <span>{checkbox(data.qualifications.foreman)} 職長教育</span>
            <span>{checkbox(data.qualifications.scaffolding)} 足場の組立て</span>
            <span>{checkbox(data.qualifications.license_regular)} 普通自動車</span>
            <span>{checkbox(data.qualifications.license_large)} 大型自動車</span>
          </div>
          {data.qualifications.otherText1 && <div className="mt-2 text-xs">その他: <span className="underline">{data.qualifications.otherText1}</span></div>}
       </div>

       <div className="border border-black p-4 mb-8">
          <h3 className="font-bold border-b border-black inline-block mb-2">誓約書</h3>
          <p className="mb-2 text-xs">私は、貴作業所に入場するにあたり、下記事項を遵守することを誓約致します。</p>
          <ul className="list-decimal pl-5 text-xs space-y-1 mb-4">
             <li>労働安全衛生法及び関係法令、貴作業所の安全衛生管理計画・規定を遵守します。</li>
             <li>暴力団排除条例に基づき、反社会的勢力との関係は一切ありません。</li>
          </ul>
          <div className="flex justify-end items-end gap-4 mt-8">
             <div>令和{data.pledgeDateYear}年{data.pledgeDateMonth}月{data.pledgeDateDay}日</div>
             <div className="text-center">
                <div className="border-b border-black w-48 h-12 flex items-end justify-center">{data.signatureDataUrl && <img src={data.signatureDataUrl} alt="署名" className="h-10" />}</div>
                <p>署名</p>
             </div>
          </div>
       </div>
       <div className="absolute bottom-5 right-5 text-xs text-gray-500">System by Core Safe</div>
    </div>
  );
};

export default NewcomerSurveyWizard;
