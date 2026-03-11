import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { MasterData, NewcomerSurveyReportData, INITIAL_NEWCOMER_SURVEY_REPORT, Qualifications, INITIAL_MASTER_DATA, EmployeeData } from '../types';
import { getMasterData, saveDraft, deleteDraftsByProject, fetchEmployees } from '../services/firebaseService';
import SignatureCanvas, { SignatureCanvasHandle } from './SignatureCanvas';
import NewcomerSurveyPrintLayout from './NewcomerSurveyPrintLayout';

interface Props {
  initialData?: any;
  initialDraftId?: string | null;
  initialStep?: number;
  onBackToMenu: () => void;
}

// --- Helper ---
const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);

// --- 固定職種リスト ---
const PRESET_JOB_TYPES = ["土工", "鳶", "大工", "オペ", "鉄筋工", "交通整理人"];

// --- 安全装置 ---
const sanitizeReportData = (data: any): NewcomerSurveyReportData => {
  let base = INITIAL_NEWCOMER_SURVEY_REPORT;
  if (data) {
    const safeQualifications = { ...INITIAL_NEWCOMER_SURVEY_REPORT.qualifications, ...(data.qualifications || {}) };
    base = { ...INITIAL_NEWCOMER_SURVEY_REPORT, ...data, qualifications: safeQualifications };
  } else {
    // 新規作成時初期化
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
    
    // 当日日付の自動設定
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

const NewcomerSurveyWizard: React.FC<Props> = ({ initialData, initialDraftId, initialStep, onBackToMenu }) => {
  const [step, setStep] = useState(1);
  const [report, setReport] = useState<NewcomerSurveyReportData>(sanitizeReportData(initialData));
  const [draftId, setDraftId] = useState<string | null>(initialDraftId || null);
  const [masterData, setMasterData] = useState<MasterData>(INITIAL_MASTER_DATA);
  const [showPreview, setShowPreview] = useState(initialStep === 99);
  const isDirectPreview = initialStep === 99;
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
  
  const sigPadRef = useRef<SignatureCanvasHandle>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  useEffect(() => { 
    const loadData = async () => { 
      try { 
        const mData = await getMasterData(); 
        setMasterData({ ...INITIAL_MASTER_DATA, ...mData }); 
        const eData = await fetchEmployees();
        setEmployees(eData);
      } catch (e) { console.error("データ取得エラー", e); } 
    }; 
    loadData(); 
  }, []);

  useEffect(() => { if (!showPreview) return; const handleResize = () => { const A4_WIDTH_PX = 794; const PADDING_PX = 40; const availableWidth = window.innerWidth - PADDING_PX; setPreviewScale(availableWidth < A4_WIDTH_PX ? availableWidth / A4_WIDTH_PX : 1); }; window.addEventListener('resize', handleResize); handleResize(); return () => window.removeEventListener('resize', handleResize); }, [showPreview]);

  useEffect(() => {
    const calculateAge = () => {
      if (report.birthYear === '' || report.birthMonth === '' || report.birthDay === '') return report.age;
      let yearAD = 0;
      if (report.birthEra === 'Showa') yearAD = 1925 + report.birthYear; else if (report.birthEra === 'Heisei') yearAD = 1988 + report.birthYear;
      else if (report.birthEra === 'Reiwa') yearAD = 2018 + report.birthYear;
      if (yearAD === 0) return report.age;
      const today = new Date(); const birthDate = new Date(yearAD, report.birthMonth - 1, report.birthDay);
      let age = today.getFullYear() - birthDate.getFullYear(); const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
      return Math.max(0, age);
    };
    const newAge = calculateAge();
    if (newAge !== report.age && report.birthYear !== '' && report.birthMonth !== '' && report.birthDay !== '') setReport(prev => ({ ...prev, age: newAge }));
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
  
  const updateQual = (key: keyof Qualifications, value: any) => { setReport(prev => ({ ...prev, qualifications: { ...prev.qualifications, [key]: value } })); setSaveStatus('idle'); setHasUnsavedChanges(true); };
  
  const handleEmployeeSelect = (empId: string) => {
    setSelectedEmployeeId(empId);
    if (!empId) return;
    
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    
    let currentExpYears = emp.experienceYears;
    let currentExpMonths = emp.experienceMonths;
    // 2026年4月1日を基準日として経験年数を逆算
    const baseDate = new Date(2026, 3, 1); // 2026年4月1日
    const now = new Date();
    let monthsDiff = (now.getFullYear() - baseDate.getFullYear()) * 12 + (now.getMonth() - baseDate.getMonth());
    if (now.getDate() < baseDate.getDate()) {
      monthsDiff--;
    }
    if (monthsDiff > 0) {
      const totalMonths = currentExpYears * 12 + currentExpMonths + monthsDiff;
      currentExpYears = Math.floor(totalMonths / 12);
      currentExpMonths = totalMonths % 12;
    } else if (monthsDiff < 0) {
      const totalMonths = currentExpYears * 12 + currentExpMonths + monthsDiff;
      currentExpYears = Math.max(0, Math.floor(totalMonths / 12));
      currentExpMonths = Math.max(0, totalMonths % 12);
    }

    const isPreset = PRESET_JOB_TYPES.includes(emp.jobType);
    const finalJobType = isPreset ? emp.jobType : (emp.jobType ? 'その他' : '');
    const finalJobTypeOther = isPreset ? '' : emp.jobType;

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
      jobType: finalJobType,
      jobTypeOther: finalJobTypeOther,
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

  // --- RENDER STEPS ---
  const renderStep1 = () => {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-800 border-l-4 border-purple-600 pl-3">STEP 1: 基本情報</h2>
        <p className="text-sm text-red-500 font-bold"><i className="fa-solid fa-circle-exclamation mr-1"></i>全ての項目が必須です</p>
        
        {/* 現場・作業所選択 */}
        <div className="bg-purple-50 p-4 rounded border border-purple-100 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
           <div className="col-span-1 md:col-span-2 text-sm text-purple-700 font-bold mb-1"><i className="fa-solid fa-circle-info mr-1"></i>はじめに現場を選択してください</div>
           
           <div className="w-full overflow-hidden">
             <label className="block text-xs font-bold text-gray-700 mb-1">作業所名 (マスタ選択)</label>
             <select 
               className={`w-full p-2 border rounded font-bold max-w-full text-ellipsis ${getErrorClass('project')}`} 
               value={report.project} 
               onChange={(e)=>updateReport({project: e.target.value})}
             >
               <option value="">選択してください</option>
               {masterData.projects.map(p => <option key={p} value={p}>{p}</option>)}
             </select>
           </div>
           
           <div className="w-full overflow-hidden">
             <label className="block text-xs font-bold text-gray-700 mb-1">作業所長名 (マスタ選択)</label>
             <select 
               className={`w-full p-2 border rounded max-w-full text-ellipsis ${getErrorClass('director')}`} 
               value={report.director} 
               onChange={(e)=>updateReport({director: e.target.value})}
             >
               {/* 修正: 空の選択肢を追加 */}
               <option value="">選択してください</option>
               {masterData.supervisors.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
           </div>
        </div>

        {/* 社員自動入力 */}
        <div className="bg-green-50 p-4 rounded border border-green-200 w-full">
           <div className="text-sm text-green-700 font-bold mb-2">
             <i className="fa-solid fa-circle-info mr-1"></i>「松浦建設株式会社」の社員はこちらから名前を選択してください。
           </div>
           <div className="w-full overflow-hidden">
             <select 
               className="w-full p-2 border border-gray-300 rounded bg-white"
               value={selectedEmployeeId}
               onChange={(e) => handleEmployeeSelect(e.target.value)}
             >
               <option value="">選択してください</option>
               {employees.map(emp => (
                 <option key={emp.id} value={emp.id}>{emp.nameSei} {emp.nameMei}</option>
               ))}
             </select>
           </div>
        </div>

        {/* Name */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label font-bold text-gray-700">氏名（フリガナ）</label>
            <div className="flex gap-2 mb-2">
              <input type="text" className={`w-1/2 p-2 border rounded max-w-full ${getErrorClass('nameSei')}`} placeholder="氏" value={report.nameSei} onChange={(e) => updateReport({nameSei: e.target.value})} />
              <input type="text" className={`w-1/2 p-2 border rounded max-w-full ${getErrorClass('nameMei')}`} placeholder="名" value={report.nameMei} onChange={(e) => updateReport({nameMei: e.target.value})} />
            </div>
            <div className="flex gap-2">
              <input type="text" className={`w-1/2 p-2 border rounded max-w-full ${getErrorClass('furiganaSei')}`} placeholder="セイ" value={report.furiganaSei} onChange={(e) => updateReport({furiganaSei: e.target.value})} />
              <input type="text" className={`w-1/2 p-2 border rounded max-w-full ${getErrorClass('furiganaMei')}`} placeholder="メイ" value={report.furiganaMei} onChange={(e) => updateReport({furiganaMei: e.target.value})} />
            </div>
          </div>
          
          <div className="form-control">
            <label className="label font-bold text-gray-700">生年月日・性別</label>
            <div className="flex gap-2 mb-2 items-center">
              <select className="p-2 border rounded bg-white" value={report.birthEra} onChange={(e)=>updateReport({birthEra: e.target.value as any})}><option value="Showa">昭和</option><option value="Heisei">平成</option><option value="Reiwa">令和</option></select>
              <select className={`w-16 p-2 border rounded ${getErrorClass('birthYear')}`} value={report.birthYear} onChange={(e)=>updateReport({birthYear:parseInt(e.target.value)||''})}><option value="">-</option>{range(1, 64).map(y=><option key={y} value={y}>{y}</option>)}</select><span>年</span>
              <select className={`w-14 p-2 border rounded ${getErrorClass('birthMonth')}`} value={report.birthMonth} onChange={(e)=>updateReport({birthMonth:parseInt(e.target.value)||''})}><option value="">-</option>{range(1, 12).map(m=><option key={m} value={m}>{m}</option>)}</select><span>月</span>
              <select className={`w-14 p-2 border rounded ${getErrorClass('birthDay')}`} value={report.birthDay} onChange={(e)=>updateReport({birthDay:parseInt(e.target.value)||''})}><option value="">-</option>{range(1, 31).map(d=><option key={d} value={d}>{d}</option>)}</select><span>日</span>
            </div>
            <div className="flex gap-4 items-center">
              <div className="flex gap-2 border p-1 rounded bg-white">
                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={report.gender === 'Male'} onChange={() => updateReport({gender: 'Male'})} />男</label>
                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={report.gender === 'Female'} onChange={() => updateReport({gender: 'Female'})} />女</label>
              </div>
              <div className="flex items-center gap-2"><input type="number" className="w-16 p-2 border rounded text-center bg-gray-100" readOnly value={report.age} /><span>歳</span></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label font-bold text-gray-700">所属会社名 (マスタ選択)</label>
            <select className={`w-full p-2 border rounded mb-2 max-w-full text-ellipsis ${getErrorClass('company')}`} value={report.company} onChange={(e) => updateReport({company: e.target.value})}><option value="">選択してください</option>{masterData.contractors.map(c => <option key={c} value={c}>{c}</option>)}</select>
            <div className="flex items-center gap-2 text-sm"><span>(</span><input type="text" className={`w-10 border-b text-center ${getErrorClass('subcontractorRank')}`} value={report.subcontractorRank} onChange={(e)=>updateReport({subcontractorRank: e.target.value})} /><span>次) 下請け</span></div>
          </div>
          <div className="form-control">
            <label className="label font-bold text-gray-700">経験年数</label>
            <div className="flex items-center gap-2 mt-2">
              <select className={`w-16 p-2 border rounded text-center bg-white appearance-none ${getErrorClass('experienceYears')}`} value={report.experienceYears ?? ''} onChange={(e)=>updateReport({experienceYears: e.target.value === '' ? null : parseInt(e.target.value)})}>
                 <option value="">-</option>{range(0, 60).map(y => <option key={y} value={y}>{y}</option>)}
              </select><span>年</span>
              <select className="w-16 p-2 border rounded text-center bg-white appearance-none" value={report.experienceMonths ?? ''} onChange={(e)=>updateReport({experienceMonths: e.target.value === '' ? null : parseInt(e.target.value)})}>
                 <option value="">-</option>{range(0, 11).map(m => <option key={m} value={m}>{m}</option>)}
              </select><span>ヶ月</span>
            </div>
          </div>
        </div>

        <div className="form-control">
          <label className="label font-bold text-gray-700">職種</label>
          <div className="flex gap-2">
            <select 
              className={`w-1/2 p-2 border rounded ${getErrorClass('jobType')}`} 
              value={report.jobType} 
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'その他') updateReport({jobType: 'その他'});
                else updateReport({jobType: val, jobTypeOther: ''});
              }}
            >
              <option value="">選択</option>
              {PRESET_JOB_TYPES.map(j=><option key={j} value={j}>{j}</option>)}
              <option value="その他">その他</option>
            </select>
            {report.jobType === 'その他' && (
              <input 
                type="text" 
                className={`flex-1 p-2 border rounded max-w-full ${getErrorClass('jobTypeOther')}`} 
                placeholder="詳細を入力" 
                value={report.jobTypeOther} 
                onChange={(e)=>updateReport({jobTypeOther: e.target.value})} 
              />
            )}
          </div>
        </div>

        <div className="form-control">
          <label className="label font-bold text-gray-700">現住所・電話番号</label>
          <input type="text" className={`w-full p-2 border rounded mb-2 max-w-full ${getErrorClass('address')}`} placeholder="住所" value={report.address} onChange={(e) => updateReport({address: e.target.value})} />
          <input type="text" className={`w-48 p-2 border rounded max-w-full ${getErrorClass('phone')}`} placeholder="090-0000-0000" value={report.phone} onChange={(e) => updateReport({phone: e.target.value})} />
        </div>

        <div className="form-control bg-gray-50 p-3 rounded border-2 border-red-500 w-full">
          <label className="label font-bold text-gray-700 mb-2 block">緊急連絡先</label>
          <div className="mb-2">
            <label className="text-xs text-gray-500 font-bold mb-1 block">氏名</label>
            <div className="flex gap-2">
              <input type="text" className={`w-1/2 p-2 border rounded max-w-full ${getErrorClass('emergencyContactSei')}`} placeholder="氏" value={report.emergencyContactSei} onChange={(e) => updateReport({emergencyContactSei: e.target.value})} />
              <input type="text" className={`w-1/2 p-2 border rounded max-w-full ${getErrorClass('emergencyContactMei')}`} placeholder="名" value={report.emergencyContactMei} onChange={(e) => updateReport({emergencyContactMei: e.target.value})} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="w-full sm:flex-1">
              <label className="text-xs text-gray-500 font-bold mb-1 block">続柄</label>
              <select className={`w-full p-2 border rounded max-w-full ${getErrorClass('emergencyContactRelation')}`} value={report.emergencyContactRelation} onChange={(e) => updateReport({emergencyContactRelation: e.target.value})}>
                <option value="">選択してください</option><option value="妻">妻</option><option value="夫">夫</option><option value="父">父</option><option value="母">母</option><option value="子">子</option><option value="兄">兄</option><option value="弟">弟</option><option value="姉">姉</option><option value="妹">妹</option><option value="祖父">祖父</option><option value="祖母">祖母</option><option value="同居人">同居人</option><option value="その他">その他</option>
              </select>
            </div>
            <div className="w-full sm:flex-1">
              <label className="text-xs text-gray-500 font-bold mb-1 block">緊急電話番号</label>
              <input type="text" className={`w-full p-2 border rounded max-w-full ${getErrorClass('emergencyContactPhone')}`} placeholder="090-0000-0000" value={report.emergencyContactPhone} onChange={(e) => updateReport({emergencyContactPhone: e.target.value})} />
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label font-bold text-gray-700">血液型</label>
            <div className="flex gap-2">
              <select className="p-2 border rounded bg-white" value={report.bloodType} onChange={(e) => updateReport({bloodType: e.target.value})}><option value="A">A</option><option value="B">B</option><option value="O">O</option><option value="AB">AB</option></select>
              <span className="self-center">型</span><span className="self-center ml-2">RH</span>
              <select className="p-2 border rounded bg-white" value={report.bloodTypeRh} onChange={(e) => updateReport({bloodTypeRh: e.target.value as any})}><option value="Unknown">不明</option><option value="Plus">+</option><option value="Minus">-</option></select>
            </div>
          </div>
          <div className="form-control">
            <label className="label font-bold text-gray-700">健康診断受診日 (令和)</label>
            <div className="flex gap-1 items-center">
              <select className={`w-16 p-2 border rounded text-center bg-white appearance-none ${isExpired ? 'border-2 border-red-500 bg-red-50' : getErrorClass('healthCheckYear')}`} value={report.healthCheckYear ?? ''} onChange={(e)=>updateReport({healthCheckYear: e.target.value === '' ? null : parseInt(e.target.value)})}>
                <option value="">-</option>{range(1, 30).map(y => <option key={y} value={y}>{y}</option>)}
              </select><span>年</span>
              <select className={`w-14 p-2 border rounded text-center bg-white appearance-none ${isExpired ? 'border-2 border-red-500 bg-red-50' : getErrorClass('healthCheckMonth')}`} value={report.healthCheckMonth ?? ''} onChange={(e)=>updateReport({healthCheckMonth: e.target.value === '' ? null : parseInt(e.target.value)})}>
                <option value="">-</option>{range(1, 12).map(m => <option key={m} value={m}>{m}</option>)}
              </select><span>月</span>
              <select className={`w-14 p-2 border rounded text-center bg-white appearance-none ${isExpired ? 'border-2 border-red-500 bg-red-50' : getErrorClass('healthCheckDay')}`} value={report.healthCheckDay ?? ''} onChange={(e)=>updateReport({healthCheckDay: e.target.value === '' ? null : parseInt(e.target.value)})}>
                <option value="">-</option>{range(1, 31).map(d => <option key={d} value={d}>{d}</option>)}
              </select><span>日</span>
            </div>
            {isExpired && <p className="text-xs text-red-600 font-bold mt-1">※最終受診から1年以上経過しています</p>}
          </div>
        </div>
        <div className="form-control"><label className="label font-bold text-gray-700">建設退職金制度加入状況</label><div className="flex gap-4 mt-1"><label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 border rounded shadow-sm"><input type="radio" checked={report.kentaikyo === 'Joined'} onChange={() => updateReport({kentaikyo: 'Joined'})} />加入している</label><label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 border rounded shadow-sm"><input type="radio" checked={report.kentaikyo === 'NotJoined'} onChange={() => updateReport({kentaikyo: 'NotJoined'})} />加入していない</label></div></div>
      </div>
    );
  };

  const renderStep2 = () => {
    const qual = report.qualifications || {};
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-800 border-l-4 border-purple-600 pl-3">STEP 2: 資格</h2>
        <div className="bg-white p-4 rounded border shadow-sm">
          <h3 className="font-bold border-b mb-3">技能講習</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              {k:'vehicle_leveling',l:'車輌系建設機械(整地)'}, {k:'vehicle_demolition',l:'車輌系建設機械(解体)'}, {k:'mobile_crane',l:'小型移動クレーン'},
              {k:'slinging',l:'玉掛'}, {k:'gas_welding',l:'ガス溶接'}, {k:'earth_retaining',l:'土留め支保工作業主任者'},
              {k:'excavation',l:'地山掘削作業主任者'}, {k:'scaffolding',l:'足場組立て等作業主任者'}, {k:'formwork',l:'型枠支保工作業主任者'},
              {k:'oxygen_deficiency',l:'酸素欠乏危険作業主任者'}, {k:'rough_terrain',l:'不整地運搬車'}
            ].map(q => <label key={q.k} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={(qual as any)[q.k]} onChange={e=>updateQual(q.k as any, e.target.checked)} />{q.l}</label>)}
          </div>
        </div>
        <div className="bg-white p-4 rounded border shadow-sm">
          <h3 className="font-bold border-b mb-3">特別教育・その他</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
            {[
              {k:'arc_welding',l:'アーク溶接'}, {k:'grinding_wheel',l:'研削といし'}, {k:'low_voltage',l:'低圧電気取扱'},
              {k:'roller',l:'ローラー運転'}, {k:'asbestos',l:'石綿取り扱い'}, {k:'chainsaw',l:'伐木等の業務（チェーンソー）'}, {k:'foreman',l:'職長教育'},
              {k:'electrician',l:'電気工事士'}
            ].map(q => <label key={q.k} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={(qual as any)[q.k]} onChange={e=>updateQual(q.k as any, e.target.checked)} />{q.l}</label>)}
          </div>
          <div className="border-t pt-2 mb-2"><h4 className="font-bold text-sm mb-2">運転免許</h4>
            {[
              {k:'license_regular',l:'普通自動車免許'}, {k:'license_large',l:'大型自動車免許'},
              {k:'license_large_special',l:'大型特殊自動車免許'}, {k:'license_towing',l:'牽引自動車免許'}
            ].map(q => <label key={q.k} className="flex items-center gap-2 cursor-pointer mb-1"><input type="checkbox" checked={(qual as any)[q.k]} onChange={e=>updateQual(q.k as any, e.target.checked)} />{q.l}</label>)}
          </div>
          
          {/* ★修正: その他資格入力欄を3つに戻す */}
          <div className="mt-2 text-sm font-bold mb-2">上記以外の資格</div>
          <div className="space-y-2">
             <input type="text" className="w-full p-2 border rounded" placeholder="資格名" value={qual.otherText1||''} onChange={e=>updateQual('otherText1', e.target.value)} />
             <input type="text" className="w-full p-2 border rounded" placeholder="資格名" value={qual.otherText2||''} onChange={e=>updateQual('otherText2', e.target.value)} />
             <input type="text" className="w-full p-2 border rounded" placeholder="資格名" value={qual.otherText3||''} onChange={e=>updateQual('otherText3', e.target.value)} />
          </div>
        </div>
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800 border-l-4 border-purple-600 pl-3">STEP 3: 誓約・署名</h2>
      
      {/* 誓約文: 詳細版 */}
      <div className="bg-gray-50 p-6 rounded-lg border leading-relaxed text-gray-800">
        <h3 className="font-bold text-lg mb-4 text-center">新規入場時誓約</h3>
        <ul className="list-disc pl-5 space-y-2 mb-6">
          <li>私は当作業所の新規入場時教育を受けました。</li>
          <li>作業所の遵守事項やルールを厳守し作業します。</li>
          <li>どんな小さなケガでも、必ず当日に報告します。</li>
          <li>自分の身を守り、また周囲の人の安全にも気を配ります。</li>
          <li>危険個所を発見したときは、直ちに現場責任者もしくは元請職員に連絡します。</li>
          <li>作業中は有資格者証を携帯します。</li>
          <li>記載した個人情報を労務・安全衛生管理に使用することに同意します。</li>
          <li>上記の事項を相違なく報告します。</li>
        </ul>
        <div className="bg-white p-4 rounded border text-center">
          {/* 誓約日 */}
          <div className="mb-4 flex flex-row items-center justify-center gap-1 flex-nowrap">
            <label className="font-bold whitespace-nowrap text-sm md:text-base">誓約日(令和)</label>
            <select className="w-14 md:w-16 p-2 border rounded text-center text-sm md:text-base bg-white appearance-none" value={report.pledgeDateYear??''} onChange={e=>updateReport({pledgeDateYear:parseInt(e.target.value)})}>
               <option value="">-</option>{range(1, 30).map(y => <option key={y} value={y}>{y}</option>)}
            </select><span className="text-sm md:text-base">年</span>
            <select className="w-14 md:w-16 p-2 border rounded text-center text-sm md:text-base bg-white appearance-none" value={report.pledgeDateMonth??''} onChange={e=>updateReport({pledgeDateMonth:parseInt(e.target.value)})}>
               <option value="">-</option>{range(1, 12).map(m=><option key={m} value={m}>{m}</option>)}
            </select><span className="text-sm md:text-base">月</span>
            <select className="w-14 md:w-16 p-2 border rounded text-center text-sm md:text-base bg-white appearance-none" value={report.pledgeDateDay??''} onChange={e=>updateReport({pledgeDateDay:parseInt(e.target.value)})}>
               <option value="">-</option>{range(1, 31).map(d=><option key={d} value={d}>{d}</option>)}
            </select><span className="text-sm md:text-base">日</span>
          </div>
          
          <label className="block font-bold text-gray-700 mb-2">本人署名</label>
          <div className="mx-auto w-full max-w-sm">
            {report.signatureDataUrl ? (
              <div className="mt-4">
                <p className="text-xs text-green-600 font-bold mb-1">署名済み</p>
                <div className="cursor-pointer hover:opacity-80 transition-opacity inline-block border border-transparent hover:border-blue-300 rounded p-1" onClick={() => setPreviewSigUrl(report.signatureDataUrl)} title="タップして拡大">
                  <img src={report.signatureDataUrl} alt="Signature" className="h-10 mx-auto border" />
                </div>
                <button onClick={()=>updateReport({signatureDataUrl: null})} className="ml-4 text-xs text-red-500 underline">削除</button>
              </div>
            ) : (
              <div className="w-full">
                <SignatureCanvas 
                  ref={sigPadRef}
                  onSave={handleSignatureSave} 
                  onClear={() => updateReport({signatureDataUrl: null})} 
                  canvasProps={{ className: 'w-full h-40' }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderPreviewModal = () => (
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
            onClick={handleSaveAndPrint}
            className="px-6 py-2 bg-pink-600 text-white rounded-lg font-bold text-sm hover:bg-pink-700 transition-colors shadow"
          >
            <i className="fa-solid fa-print mr-2"></i>印刷
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-gray-200 p-4">
        <div className="flex justify-center"><div className="shadow-2xl">
          <NewcomerSurveyPrintLayout data={report} />
        </div></div>
      </div>
    </div>
  );

  return (
    <>
      <div className="no-print min-h-screen pb-24 bg-gray-50">
        <header className="bg-slate-800 text-white p-4 shadow-md sticky top-0 z-10 flex justify-between items-center">
          <div className="flex items-center gap-3"><button onClick={handleHomeClick} className="text-white hover:text-gray-300"><i className="fa-solid fa-house"></i></button><h1 className="text-lg font-bold"><i className="fa-solid fa-person-circle-question mr-2"></i>新規入場者アンケート</h1></div>
          {/* 設定ボタン削除済み */}
        </header>
        <div className="bg-white p-4 shadow-sm mb-4"><div className="flex justify-between text-xs font-bold text-gray-400 mb-2"><span className={step >= 1 ? "text-purple-600" : ""}>基本情報</span><span className={step >= 2 ? "text-purple-600" : ""}>資格</span><span className={step >= 3 ? "text-purple-600" : ""}>誓約・署名</span></div><div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden"><div className="bg-purple-600 h-full transition-all duration-300" style={{ width: `${step * 33.3}%` }}></div></div></div>
        <main className="mx-auto p-4 bg-white shadow-lg rounded-lg max-w-3xl min-h-[60vh]">
           {step === 1 && renderStep1()}{step === 2 && renderStep2()}{step === 3 && renderStep3()}</main>
        <footer className="fixed bottom-0 left-0 w-full bg-white border-t p-4 flex justify-between items-center shadow-md z-20">
          <div className="flex items-center gap-2"><button onClick={() => setStep(prev => Math.max(1, prev - 1))} disabled={step === 1} className={`px-4 py-3 rounded-lg font-bold ${step === 1 ? 'text-gray-300' : 'text-gray-600 bg-gray-100'}`}>戻る</button></div>
          {step < 3 ? (
             <button onClick={handleNext} className="px-8 py-3 bg-purple-600 text-white rounded-lg font-bold shadow hover:bg-purple-700 flex items-center">次へ <i className="fa-solid fa-chevron-right ml-2"></i></button>
          ) : (
             <div className="flex gap-4">
               <button onClick={handleSave} className="px-8 py-3 bg-red-600 text-white rounded-lg font-bold shadow hover:bg-red-700 flex items-center"><i className="fa-solid fa-save mr-2"></i> 保存</button>
               <button onClick={handlePreviewClick} className="px-8 py-3 bg-cyan-600 text-white rounded-lg font-bold shadow hover:bg-cyan-700 flex items-center"><i className="fa-solid fa-file-pdf mr-2"></i> プレビュー</button>
             </div>
          )}
        </footer>
      </div>
      
      {/* 完了モーダル */}
      <CompleteModal isOpen={showCompleteModal} onOk={() => { setShowCompleteModal(false); onBackToMenu(); }} />

      {previewSigUrl && (<div className="fixed inset-0 z-[100] bg-black bg-opacity-90 flex flex-col items-center justify-center p-4" onClick={() => setPreviewSigUrl(null)}><div className="bg-white p-1 rounded-lg shadow-2xl overflow-hidden max-w-full max-h-[80vh]"><img src={previewSigUrl} alt="Signature Preview" className="max-w-full max-h-[70vh] object-contain" /></div><button className="mt-6 text-white text-lg font-bold flex items-center gap-2 bg-gray-700 px-6 py-2 rounded-full hover:bg-gray-600 transition-colors"><i className="fa-solid fa-xmark"></i> 閉じる</button></div>)}
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
         <NewcomerSurveyPrintLayout data={report} />
      </div>
    </>
  );
};

// --- ProjectDeleteModal ---
const ProjectDeleteModal: React.FC<{ isOpen: boolean; projectName: string; onConfirm: () => void; onCancel: () => void }> = ({ isOpen, projectName, onConfirm, onCancel }) => {
  const [pass, setPass] = useState('');
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 border-2 border-red-500">
        <h3 className="text-lg font-bold mb-4 text-red-600">⚠ 警告</h3>
        <p className="mb-4 text-sm text-gray-700">工事名「{projectName}」を削除します。<br/>関連データも全削除されます。</p>
        <p className="mb-2 text-sm font-bold">PASS (4043)</p>
        <input type="password" className="w-full border p-2 rounded mb-4" value={pass} onChange={(e)=>setPass(e.target.value)} />
        <div className="flex justify-end gap-3"><button onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded">キャンセル</button><button onClick={()=>{ if(pass==='4043') onConfirm(); else alert('PASS不一致'); }} className="px-4 py-2 bg-red-600 text-white rounded font-bold">実行</button></div>
      </div>
    </div>
  );
};

export default NewcomerSurveyWizard;
