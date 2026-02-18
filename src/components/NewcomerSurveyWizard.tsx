import React, { useState, useEffect, useRef } from 'react';
import { NewcomerSurveyReportData, INITIAL_NEWCOMER_SURVEY_REPORT, MasterData, INITIAL_MASTER_DATA } from '../types';
import { saveDraft, getMasterData, saveMasterData, deleteDraftsByProject } from '../services/firebaseService';
import SignatureCanvas from 'react-signature-canvas';
import NewcomerSurveyPrintLayout from './NewcomerSurveyPrintLayout';

interface Props {
  initialData?: NewcomerSurveyReportData;
  initialDraftId?: string | null;
  onBackToMenu: () => void;
}

// -----------------------------------------------------------------------------
// 定数・マスタ定義
// -----------------------------------------------------------------------------
const LABEL_MAP: Record<string, string> = {
  projects: '工事名',
  companies: '会社名',
  bosses: '現場責任者',
  jobTypes: '職種',
  roles: '役職',
  workplaces: '作業所名',
};

const MASTER_GROUPS = {
  BASIC: ['projects', 'companies', 'bosses', 'workplaces'],
  SURVEY: ['jobTypes', 'roles']
};

const JOB_TYPES = ["土工","鳶","大工","オペ","鉄筋工","交通整理人","その他"];
const BLOOD_TYPES = ["A","B","O","AB"];
const RH_TYPES = [
  { value: 'Plus', label: '＋' },
  { value: 'Minus', label: '-' },
  { value: 'Unknown', label: '不明' },
];

// -----------------------------------------------------------------------------
// 内部コンポーネント: 削除確認モーダル (Password付き)
// -----------------------------------------------------------------------------
const ProjectDeleteModal: React.FC<{
  isOpen: boolean;
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isOpen, projectName, onConfirm, onCancel }) => {
  const [pass, setPass] = useState('');
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-fade-in border-2 border-red-500">
        <h3 className="text-lg font-bold mb-4 text-red-600">⚠ 警告: 工事名の削除</h3>
        <p className="mb-4 text-sm text-gray-700">
          工事名「<span className="font-bold">{projectName}</span>」を削除しようとしています。<br/><br/>
          <span className="font-bold text-red-600">実行すると、この工事名に関連するすべての一時保存データも同時に削除されます。</span><br/>
          この操作は取り消せません。
        </p>
        <p className="mb-2 text-sm font-bold">パスワードを入力してください (4043)</p>
        <input 
          type="password" 
          className="w-full border p-2 rounded mb-4"
          value={pass}
          onChange={(e)=>setPass(e.target.value)}
        />
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded text-sm">キャンセル</button>
          <button 
            onClick={()=>{ if(pass==='4043') onConfirm(); else alert('パスワードが違います'); }}
            className="px-4 py-2 bg-red-600 text-white rounded text-sm font-bold"
          >
            完全削除を実行
          </button>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 内部コンポーネント: 通常の確認モーダル
// -----------------------------------------------------------------------------
const ConfirmationModal: React.FC<{ isOpen: boolean; message: string; onConfirm: () => void; onCancel: () => void; }> = ({ isOpen, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-fade-in">
        <h3 className="text-lg font-bold mb-4">確認</h3>
        <p className="mb-6 whitespace-pre-wrap">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-100 rounded">キャンセル</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-blue-600 text-white rounded">OK</button>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 内部コンポーネント: マスタ管理セクション
// -----------------------------------------------------------------------------
const MasterSection: React.FC<{
  masterData: MasterData;
  onUpdate: (newData: MasterData) => Promise<void>;
}> = ({ masterData, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'BASIC' | 'SURVEY'>('BASIC');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [newItem, setNewItem] = useState('');
  
  const [deleteModal, setDeleteModal] = useState<{isOpen:boolean, index:number, item:string}>({isOpen:false, index:-1, item:''});
  const [projectDeleteTarget, setProjectDeleteTarget] = useState<{index:number, name:string} | null>(null);

  const handleAddItem = async () => {
    if (!selectedKey || !newItem.trim()) return;
    const currentList = (masterData as any)[selectedKey] || [];
    if (currentList.includes(newItem.trim())) {
      alert('その項目は既に存在します');
      return;
    }
    const updated = { ...masterData, [selectedKey]: [...currentList, newItem.trim()] };
    await onUpdate(updated);
    setNewItem('');
  };

  const handleDeleteRequest = (index: number, item: string) => {
    if (selectedKey === 'projects') {
      setProjectDeleteTarget({ index, name: item });
    } else {
      setDeleteModal({ isOpen: true, index, item });
    }
  };

  const executeDelete = async () => {
    if (!selectedKey) return;
    const currentList = (masterData as any)[selectedKey] || [];
    const updatedList = currentList.filter((_: any, i: number) => i !== deleteModal.index);
    const updated = { ...masterData, [selectedKey]: updatedList };
    await onUpdate(updated);
    setDeleteModal({ isOpen: false, index: -1, item: '' });
  };

  const executeProjectDelete = async () => {
    if (!selectedKey || !projectDeleteTarget) return;
    const currentList = (masterData as any)[selectedKey] || [];
    const updatedList = currentList.filter((_: any, i: number) => i !== projectDeleteTarget.index);
    const updated = { ...masterData, [selectedKey]: updatedList };
    try {
      await deleteDraftsByProject(projectDeleteTarget.name);
      await onUpdate(updated);
      setProjectDeleteTarget(null);
    } catch (error) {
      console.error(error);
      alert('削除に失敗しました');
    }
  };

  return (
    <div className="mb-8 border rounded-lg bg-white shadow-sm overflow-hidden">
      <div className="bg-gray-100 p-3 border-b flex justify-between items-center">
        <h3 className="font-bold text-gray-700 flex items-center gap-2">
          <i className="fa-solid fa-database"></i> マスタデータ管理
        </h3>
      </div>
      <div className="flex border-b">
        <button 
          onClick={() => { setActiveTab('BASIC'); setSelectedKey(null); }}
          className={`flex-1 py-3 text-sm font-bold ${activeTab==='BASIC' ? 'bg-white border-b-2 border-blue-600 text-blue-600' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
        >
          基本・共通マスタ
        </button>
        <button 
          onClick={() => { setActiveTab('SURVEY'); setSelectedKey(null); }}
          className={`flex-1 py-3 text-sm font-bold ${activeTab==='SURVEY' ? 'bg-white border-b-2 border-purple-600 text-purple-600' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
        >
          各種項目マスタ
        </button>
      </div>
      <div className="p-4 bg-gray-50 min-h-[300px]">
        {!selectedKey ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {MASTER_GROUPS[activeTab].map(key => (
              <button 
                key={key} 
                onClick={() => setSelectedKey(key)}
                className="bg-white p-4 rounded border shadow-sm hover:shadow-md hover:bg-blue-50 transition text-left"
              >
                <div className="font-bold text-gray-700">{LABEL_MAP[key] || key}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {((masterData as any)[key] || []).length} 件登録済み
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setSelectedKey(null)} className="text-sm text-blue-600 hover:underline">&lt; 戻る</button>
              <h4 className="font-bold text-lg">{LABEL_MAP[selectedKey]} のリスト編集</h4>
            </div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="新しい項目を追加"
                className="flex-1 border rounded px-3 py-2"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
              />
              <button onClick={handleAddItem} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">追加</button>
            </div>
            <div className="bg-white border rounded max-h-60 overflow-y-auto">
              {((masterData as any)[selectedKey] || []).length === 0 ? (
                <div className="p-4 text-center text-gray-400 text-sm">データがありません</div>
              ) : (
                <ul className="divide-y">
                  {((masterData as any)[selectedKey] || []).map((item: string, idx: number) => (
                    <li key={idx} className="p-2 flex justify-between items-center hover:bg-gray-50">
                      <span>{item}</span>
                      <button onClick={() => handleDeleteRequest(idx, item)} className="text-red-500 hover:text-red-700 px-2"><i className="fa-solid fa-trash"></i></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
      <ConfirmationModal 
        isOpen={deleteModal.isOpen} 
        message={`「${deleteModal.item}」を削除しますか？`} 
        onConfirm={executeDelete} 
        onCancel={() => setDeleteModal({ isOpen: false, index: -1, item: '' })} 
      />
      {projectDeleteTarget && (
        <ProjectDeleteModal
          isOpen={!!projectDeleteTarget}
          projectName={projectDeleteTarget.name}
          onConfirm={executeProjectDelete}
          onCancel={() => setProjectDeleteTarget(null)}
        />
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// メインコンポーネント: NewcomerSurveyWizard
// -----------------------------------------------------------------------------
const NewcomerSurveyWizard: React.FC<Props> = ({ initialData, initialDraftId, onBackToMenu }) => {
  const sanitizeReportData = (data?: any): NewcomerSurveyReportData => {
    const base = { ...INITIAL_NEWCOMER_SURVEY_REPORT };
    if (!data) return base;
    const merged = { ...base, ...data };
    
    // Name migration
    if (data.name && (!data.nameSei || !data.nameMei)) {
      const parts = data.name.trim().split(/[\s　]+/);
      merged.nameSei = parts[0] || data.name;
      merged.nameMei = parts.length > 1 ? parts.slice(1).join(' ') : '';
    }
    // Furigana migration
    if (data.furigana && (!data.furiganaSei || !data.furiganaMei)) {
      const parts = data.furigana.trim().split(/[\s　]+/);
      merged.furiganaSei = parts[0] || data.furigana;
      merged.furiganaMei = parts.length > 1 ? parts.slice(1).join(' ') : '';
    }
    // Emergency Contact migration
    if (data.emergencyContactName && (!data.emergencyContactNameSei || !data.emergencyContactNameMei)) {
      const parts = data.emergencyContactName.trim().split(/[\s　]+/);
      merged.emergencyContactNameSei = parts[0] || data.emergencyContactName;
      merged.emergencyContactNameMei = parts.length > 1 ? parts.slice(1).join(' ') : '';
    }

    merged.qualifications = { ...(base.qualifications || {}), ...(data.qualifications || {}) };
    return merged;
  };

  const [step, setStep] = useState(1);
  const [report, setReport] = useState<NewcomerSurveyReportData>(sanitizeReportData(initialData));
  const [draftId, setDraftId] = useState<string | null>(initialDraftId || null);
  const [masterData, setMasterData] = useState<MasterData>(INITIAL_MASTER_DATA);
  const [showMasterManager, setShowMasterManager] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.7);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const sigCanvas = useRef<SignatureCanvas>(null);
  const [showSigModal, setShowSigModal] = useState(false);

  useEffect(() => {
    getMasterData().then(setMasterData).catch(console.error);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setPreviewScale(width < 640 ? 0.45 : width < 1024 ? 0.6 : 0.8);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const updateReport = (updates: Partial<NewcomerSurveyReportData>) => {
    setReport(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
    if (Object.keys(errors).length > 0) {
      const newErrors = { ...errors };
      Object.keys(updates).forEach(key => delete newErrors[key]);
      setErrors(newErrors);
    }
  };

  const handleMasterUpdate = async (newData: MasterData) => {
    try {
      await saveMasterData(newData);
      setMasterData(newData);
    } catch (err) { console.error(err); alert('マスタ保存に失敗しました'); }
  };

  const validateStep1 = () => {
    const newErrors: Record<string, boolean> = {};
    const requiredKeys = [
      'project', 'director', 'company', 'workplace',
      'nameSei', 'nameMei', 'furiganaSei', 'furiganaMei', 'birthDate', 'bloodType',
      'address', 'phone', 
      'emergencyContactNameSei', 'emergencyContactNameMei', 'emergencyContactRelation', 'emergencyContactPhone',
      'role', 'jobType', 'experienceYears', 
      'healthCheckDate', 'bloodPressureHigh', 'bloodPressureLow'
    ];
    
    requiredKeys.forEach(key => {
      if (!(report as any)[key]) newErrors[key] = true;
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) {
        setStep(2);
        window.scrollTo(0, 0);
      } else {
        alert('未入力の必須項目があります。赤枠の箇所を確認してください。');
        window.scrollTo(0, 0);
      }
    } else if (step === 2) {
      setStep(3);
      window.scrollTo(0, 0);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleTempSave = async () => {
    if (!report.project) { alert('工事名は必須です'); return; }
    try {
      setIsSaving(true);
      const savedId = await saveDraft('NEWCOMER_SURVEY', report, draftId);
      setDraftId(savedId);
      setHasUnsavedChanges(false);
      alert('一時保存しました');
    } catch (err) { console.error(err); alert('保存に失敗しました'); } finally { setIsSaving(false); }
  };

  const handleSaveAndPrint = async () => {
    if (!report.project) { alert('工事名は必須です'); return; }
    try {
      setIsSaving(true);
      const savedId = await saveDraft('NEWCOMER_SURVEY', report, draftId);
      setDraftId(savedId);
      setHasUnsavedChanges(false);

      const originalTitle = document.title;
      const fullName = (report.nameSei || '') + (report.nameMei || '');
      const companyName = report.company || '未入力';
      document.title = `新規_${companyName}_${fullName || '未入力'}`;

      window.print();
      setTimeout(() => { document.title = originalTitle; }, 500);
    } catch (err) { console.error(err); alert('保存・印刷処理に失敗しました'); } finally { setIsSaving(false); }
  };

  const handleHomeClick = () => {
    if (hasUnsavedChanges) setShowHomeConfirm(true);
    else onBackToMenu();
  };

  const saveSignature = () => {
    if (sigCanvas.current) {
      updateReport({ signatureDataUrl: sigCanvas.current.getTrimmedCanvas().toDataURL('image/png') });
      setShowSigModal(false);
    }
  };

  const getErrorClass = (field: string) => errors[field] ? 'border-red-500 bg-red-50' : 'border-gray-300';

  // ---------------------------------------------------------------------------
  // UI レンダリング
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-100 pb-20 font-sans text-gray-800">
      <div className="bg-white shadow-sm sticky top-0 z-40 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={handleHomeClick} className="text-gray-500 hover:text-gray-700"><i className="fa-solid fa-house"></i></button>
          <h2 className="font-bold text-lg hidden sm:block">新規入場者アンケート作成</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowMasterManager(!showMasterManager)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"><i className="fa-solid fa-gear mr-1"></i>設定</button>
          <button onClick={() => setShowPreview(true)} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"><i className="fa-solid fa-eye mr-1"></i>プレビュー</button>
          <button onClick={handleTempSave} disabled={isSaving} className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"><i className="fa-solid fa-floppy-disk mr-1"></i>一時保存</button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4">
        {showMasterManager && <MasterSection masterData={masterData} onUpdate={handleMasterUpdate} />}

        <div className="mb-6 flex items-center justify-between px-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step>=1?'bg-blue-600 text-white':'bg-gray-300 text-gray-600'}`}>1</div>
          <div className={`flex-1 h-1 mx-2 ${step>=2?'bg-blue-600':'bg-gray-300'}`}></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step>=2?'bg-blue-600 text-white':'bg-gray-300 text-gray-600'}`}>2</div>
          <div className={`flex-1 h-1 mx-2 ${step>=3?'bg-blue-600':'bg-gray-300'}`}></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step>=3?'bg-blue-600 text-white':'bg-gray-300 text-gray-600'}`}>3</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          {/* STEP 1: 基本情報 */}
          {step === 1 && (
            <div className="animate-fade-in space-y-6">
              <div className="border-b pb-2 mb-4">
                <h3 className="text-xl font-bold">基本情報入力</h3>
                <p className="text-xs text-red-500 mt-1">※視認性を考慮し項目をグループ分けしています。すべての項目が必須です。</p>
              </div>

              {/* グループ1: 現場・所属情報 */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2 border-b pb-2">
                  <i className="fa-solid fa-building text-blue-600"></i> 現場・所属情報
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">工事名 <span className="text-red-500 text-xs">※必須</span></label>
                    <select 
                      value={report.project} onChange={e => updateReport({ project: e.target.value })} 
                      className={`w-full h-11 border rounded px-3 bg-white appearance-none ${getErrorClass('project')}`}
                    >
                      <option value="">選択してください</option>
                      {(masterData.projects || []).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">作業所名 <span className="text-red-500 text-xs">※必須</span></label>
                    <select 
                      value={report.workplace} onChange={e => updateReport({ workplace: e.target.value })} 
                      className={`w-full h-11 border rounded px-3 bg-white appearance-none ${getErrorClass('workplace')}`}
                    >
                      <option value="">選択してください</option>
                      {(masterData.workplaces || []).map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">現場責任者 <span className="text-red-500 text-xs">※必須</span></label>
                    <select 
                      value={report.director} onChange={e => updateReport({ director: e.target.value })} 
                      className={`w-full h-11 border rounded px-3 bg-white appearance-none ${getErrorClass('director')}`}
                    >
                      <option value="">選択してください</option>
                      {(masterData.bosses || []).map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">所属会社 <span className="text-red-500 text-xs">※必須</span></label>
                    <select 
                      value={report.company} onChange={e => updateReport({ company: e.target.value })} 
                      className={`w-full h-11 border rounded px-3 bg-white appearance-none ${getErrorClass('company')}`}
                    >
                      <option value="">選択してください</option>
                      {(masterData.companies || []).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* グループ2: 本人情報 */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2 border-b pb-2">
                  <i className="fa-solid fa-user text-green-600"></i> 本人情報
                </h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">氏名 (姓)</label>
                      <input 
                        type="text" value={report.nameSei || ''} onChange={e => updateReport({ nameSei: e.target.value })} 
                        className={`w-full h-11 border rounded px-3 ${getErrorClass('nameSei')}`} placeholder="例: 山田"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">氏名 (名)</label>
                      <input 
                        type="text" value={report.nameMei || ''} onChange={e => updateReport({ nameMei: e.target.value })} 
                        className={`w-full h-11 border rounded px-3 ${getErrorClass('nameMei')}`} placeholder="例: 太郎"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">フリガナ (セイ)</label>
                      <input 
                        type="text" value={report.furiganaSei || ''} onChange={e => updateReport({ furiganaSei: e.target.value })} 
                        className={`w-full h-11 border rounded px-3 ${getErrorClass('furiganaSei')}`} placeholder="例: ヤマダ"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">フリガナ (メイ)</label>
                      <input 
                        type="text" value={report.furiganaMei || ''} onChange={e => updateReport({ furiganaMei: e.target.value })} 
                        className={`w-full h-11 border rounded px-3 ${getErrorClass('furiganaMei')}`} placeholder="例: タロウ"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">生年月日</label>
                      <input 
                        type="date" value={report.birthDate} onChange={e => updateReport({ birthDate: e.target.value })} 
                        className={`w-full h-11 border rounded px-3 ${getErrorClass('birthDate')}`} 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">血液型</label>
                      <div className="flex gap-2">
                        <select 
                          value={report.bloodType} onChange={e => updateReport({ bloodType: e.target.value })} 
                          className={`flex-1 h-11 border rounded px-3 bg-white appearance-none ${getErrorClass('bloodType')}`}
                        >
                          <option value="">型</option>
                          {BLOOD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select 
                          value={report.bloodTypeRh} onChange={e => updateReport({ bloodTypeRh: e.target.value as any })} 
                          className="flex-1 h-11 border rounded px-3 bg-white appearance-none"
                        >
                          {RH_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* グループ3: 連絡先 */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2 border-b pb-2">
                  <i className="fa-solid fa-address-book text-orange-600"></i> 連絡先
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">現住所 <span className="text-red-500 text-xs">※必須</span></label>
                    <input 
                      type="text" value={report.address} onChange={e => updateReport({ address: e.target.value })} 
                      className={`w-full h-11 border rounded px-3 ${getErrorClass('address')}`} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">電話番号 <span className="text-red-500 text-xs">※必須</span></label>
                    <input 
                      type="tel" value={report.phone} onChange={e => updateReport({ phone: e.target.value })} 
                      className={`w-1/2 md:max-w-xs h-11 border rounded px-3 ${getErrorClass('phone')}`} placeholder="090-0000-0000"
                    />
                  </div>
                </div>
              </div>

              {/* グループ4: 緊急連絡先 (赤枠強調) */}
              <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                <h4 className="font-bold text-red-800 mb-4 flex items-center gap-2 border-b border-red-200 pb-2">
                  <i className="fa-solid fa-bell text-red-600"></i> 緊急連絡先
                </h4>
                <div className="grid grid-cols-1 gap-3 max-w-lg">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">氏名 (姓)</label>
                      <input 
                        type="text" value={report.emergencyContactNameSei || ''} onChange={e => updateReport({ emergencyContactNameSei: e.target.value })} 
                        className={`w-full h-11 border rounded px-3 ${getErrorClass('emergencyContactNameSei')}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">氏名 (名)</label>
                      <input 
                        type="text" value={report.emergencyContactNameMei || ''} onChange={e => updateReport({ emergencyContactNameMei: e.target.value })} 
                        className={`w-full h-11 border rounded px-3 ${getErrorClass('emergencyContactNameMei')}`}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">続柄</label>
                      <input 
                        type="text" value={report.emergencyContactRelation} onChange={e => updateReport({ emergencyContactRelation: e.target.value })} 
                        className={`w-full h-11 border rounded px-3 ${getErrorClass('emergencyContactRelation')}`} placeholder="例: 父"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">緊急電話番号</label>
                      <input 
                        type="tel" value={report.emergencyContactPhone} onChange={e => updateReport({ emergencyContactPhone: e.target.value })} 
                        className={`w-full h-11 border rounded px-3 ${getErrorClass('emergencyContactPhone')}`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* グループ5: 職務・資格・経験 */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2 border-b pb-2">
                  <i className="fa-solid fa-helmet-safety text-gray-600"></i> 職務・資格・経験
                </h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">役職 <span className="text-red-500 text-xs">※必須</span></label>
                      <select 
                        value={report.role} onChange={e => updateReport({ role: e.target.value })} 
                        className={`w-full h-11 border rounded px-3 bg-white appearance-none ${getErrorClass('role')}`}
                      >
                        <option value="">選択してください</option>
                        {(masterData.roles || []).map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">経験年数 (年) <span className="text-red-500 text-xs">※必須</span></label>
                      <input 
                        type="number" value={report.experienceYears} onChange={e => updateReport({ experienceYears: e.target.value })} 
                        className={`w-full h-11 border rounded px-3 ${getErrorClass('experienceYears')}`} 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">職種 <span className="text-red-500 text-xs">※必須</span></label>
                    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 border p-2 rounded bg-white ${errors.jobType ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                      {JOB_TYPES.map(job => (
                        <label key={job} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
                          <input 
                            type="radio" name="jobType" value={job} checked={report.jobType === job} 
                            onChange={e => updateReport({ jobType: e.target.value })} 
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-sm">{job}</span>
                        </label>
                      ))}
                    </div>
                    {report.jobType === 'その他' && (
                      <input 
                        type="text" value={report.jobTypeOther || ''} onChange={e => updateReport({ jobTypeOther: e.target.value })} 
                        placeholder="職種を入力" className="mt-2 w-full h-11 border rounded px-3" 
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* グループ6: 健康診断 */}
              <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                <h4 className="font-bold text-blue-800 mb-4 flex items-center gap-2 border-b border-blue-200 pb-2">
                  <i className="fa-solid fa-heart-pulse text-blue-600"></i> 健康診断
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">受診年月</label>
                    <input 
                      type="month" value={report.healthCheckDate} onChange={e => updateReport({ healthCheckDate: e.target.value })} 
                      className={`w-full h-11 border rounded px-3 bg-white ${getErrorClass('healthCheckDate')}`} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">血圧 (上)</label>
                    <input 
                      type="number" value={report.bloodPressureHigh} onChange={e => updateReport({ bloodPressureHigh: e.target.value })} 
                      className={`w-full h-11 border rounded px-3 bg-white ${getErrorClass('bloodPressureHigh')}`} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">血圧 (下)</label>
                    <input 
                      type="number" value={report.bloodPressureLow} onChange={e => updateReport({ bloodPressureLow: e.target.value })} 
                      className={`w-full h-11 border rounded px-3 bg-white ${getErrorClass('bloodPressureLow')}`} 
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* STEP 2: 資格情報 */}
          {step === 2 && (
            <div className="animate-fade-in space-y-6">
              <h3 className="text-xl font-bold border-b pb-2 mb-4">資格情報</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-gray-50 p-3 rounded">
                  <h4 className="font-bold text-sm mb-2 text-center bg-gray-200 py-1">技能講習</h4>
                  <div className="space-y-2">
                    {[
                      {k:'vehicle_leveling', l:'車輌系建設機械(整地)'},
                      {k:'vehicle_excavation', l:'車輌系建設機械(解体)'},
                      {k:'vehicle_foundation', l:'車輌系建設機械(基礎)'},
                      {k:'aerial_work_platform', l:'高所作業車(10m以上)'},
                      {k:'crane_5t_plus', l:'小型移動式クレーン'},
                      {k:'forklift', l:'フォークリフト'},
                      {k:'slinging', l:'玉掛'},
                      {k:'scaffolding_chief', l:'足場組立作業主任者'},
                      {k:'excavation_chief', l:'地山掘削作業主任者'},
                      {k:'steel_frame_chief', l:'鉄骨組立作業主任者'},
                      {k:'concrete_chief', l:'コンクリート造工作物'},
                      {k:'formwork_chief', l:'型枠支保工組立作業主任者'},
                      {k:'wooden_building_chief', l:'木造建築物組立作業主任者'},
                    ].map(q => (
                      <label key={q.k} className="flex items-center space-x-2">
                        <input 
                          type="checkbox" checked={(report.qualifications as any)?.[q.k] || false} 
                          onChange={e => updateReport({ qualifications: { ...report.qualifications, [q.k]: e.target.checked } })}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm">{q.l}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <h4 className="font-bold text-sm mb-2 text-center bg-gray-200 py-1">特別教育</h4>
                  <div className="space-y-2">
                    {[
                      {k:'arc_welding', l:'アーク溶接'},
                      {k:'grindstone', l:'自由研削砥石'},
                      {k:'winch', l:'巻上げ機(ウインチ)'},
                      {k:'low_voltage', l:'低圧電気取扱'},
                      {k:'dust_mask', l:'防塵マスク使用'},
                      {k:'vibration_tools', l:'振動工具取扱'},
                      {k:'circular_saw', l:'丸のこ等取扱'},
                      {k:'aerial_work_under_10m', l:'高所作業車(10m未満)'},
                      {k:'roller', l:'ローラー(締固め用機械)'},
                      {k:'full_harness', l:'フルハーネス型墜落制止用器具'},
                    ].map(q => (
                      <label key={q.k} className="flex items-center space-x-2">
                        <input 
                          type="checkbox" checked={(report.qualifications as any)?.[q.k] || false} 
                          onChange={e => updateReport({ qualifications: { ...report.qualifications, [q.k]: e.target.checked } })}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm">{q.l}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded flex flex-col">
                  <h4 className="font-bold text-sm mb-2 text-center bg-gray-200 py-1">その他</h4>
                  <div className="space-y-2 mb-4">
                    <label className="flex items-center space-x-2">
                      <input 
                        type="checkbox" checked={report.qualifications?.foreman || false} 
                        onChange={e => updateReport({ qualifications: { ...report.qualifications, foreman: e.target.checked } })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm">職長教育</span>
                    </label>
                  </div>
                  <div className="mt-auto">
                    <p className="text-xs font-bold text-gray-500 mb-1">その他（自由記入）</p>
                    <input 
                      type="text" className="w-full border rounded mb-2 px-2 py-1 text-sm" 
                      value={report.qualifications?.otherText1 || ''}
                      onChange={e => updateReport({ qualifications: { ...report.qualifications, otherText1: e.target.value } })}
                    />
                    <input 
                      type="text" className="w-full border rounded mb-2 px-2 py-1 text-sm" 
                      value={report.qualifications?.otherText2 || ''}
                      onChange={e => updateReport({ qualifications: { ...report.qualifications, otherText2: e.target.value } })}
                    />
                    <input 
                      type="text" className="w-full border rounded px-2 py-1 text-sm" 
                      value={report.qualifications?.otherText3 || ''}
                      onChange={e => updateReport({ qualifications: { ...report.qualifications, otherText3: e.target.value } })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: 誓約・署名 */}
          {step === 3 && (
            <div className="animate-fade-in space-y-6">
              <h3 className="text-xl font-bold border-b pb-2 mb-4">誓約・署名</h3>
              <div className="bg-gray-50 p-4 rounded border text-sm leading-relaxed text-gray-700 mb-6">
                <p>私は、貴作業所の建設工事に従事するに当たり、労働安全衛生法及び関係法令を遵守することはもとより、貴作業所の安全衛生管理計画書及び作業所の決まり事項を守り、災害防止に努めることを誓います。</p>
                <p className="mt-2">万一、私の不注意により事故を惹起した場合は、私の責任において処理し、貴社及び元請負人には一切ご迷惑をお掛け致しません。</p>
                <p className="mt-2">尚、貴作業所の規律を乱し、または指示に従わない時は、退場を命じられても異存ありません。</p>
              </div>
              <div className="text-center">
                <p className="mb-2 font-bold">署名</p>
                {report.signatureDataUrl ? (
                  <div className="inline-block relative group">
                    <img src={report.signatureDataUrl} alt="Signature" className="border rounded h-32 mx-auto" />
                    <button onClick={() => updateReport({ signatureDataUrl: undefined })} className="absolute top-0 right-0 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center -mt-2 -mr-2 shadow-md hover:bg-red-600"><i className="fa-solid fa-xmark text-xs"></i></button>
                  </div>
                ) : (
                  <button onClick={() => setShowSigModal(true)} className="w-full max-w-sm py-8 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 hover:border-blue-500 hover:text-blue-500 transition flex flex-col items-center justify-center gap-2">
                    <i className="fa-solid fa-pen-nib text-2xl"></i>
                    <span>タップして署名する</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="mt-6 flex justify-between">
          <button onClick={handleBack} disabled={step === 1} className="px-6 py-3 rounded-lg bg-gray-200 text-gray-700 disabled:opacity-50 hover:bg-gray-300 transition font-bold">戻る</button>
          {step < 3 ? (
            <button onClick={handleNext} className="px-8 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-lg transition font-bold flex items-center gap-2">次へ <i className="fa-solid fa-arrow-right"></i></button>
          ) : (
            <button onClick={handleSaveAndPrint} disabled={isSaving} className="px-8 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 shadow-lg transition font-bold flex items-center gap-2 disabled:opacity-70">
              {isSaving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> 保存中...</> : <><i className="fa-solid fa-print"></i> 保存して印刷</>}
            </button>
          )}
        </div>
      </div>

      {showSigModal && (
        <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-90 flex flex-col">
          <div className="flex justify-between items-center p-4 text-white">
            <h3 className="font-bold">署名を記入</h3>
            <button onClick={() => setShowSigModal(false)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark text-2xl"></i></button>
          </div>
          <div className="flex-1 bg-white p-4 flex items-center justify-center overflow-hidden relative">
             <SignatureCanvas ref={sigCanvas} penColor="black" canvasProps={{ className: 'border-2 border-gray-300 rounded w-full h-full' }} />
             <div className="absolute bottom-4 left-4 text-gray-400 text-xs pointer-events-none">枠内に大きくサインしてください</div>
          </div>
          <div className="p-4 bg-gray-800 flex justify-between">
            <button onClick={() => sigCanvas.current?.clear()} className="px-6 py-3 text-white border border-gray-600 rounded">クリア</button>
            <button onClick={saveSignature} className="px-8 py-3 bg-blue-600 text-white rounded font-bold">確定</button>
          </div>
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-90 flex flex-col no-print">
          <div className="p-4 flex justify-between items-center text-white bg-gray-800">
            <h3 className="font-bold text-lg"><i className="fa-solid fa-eye mr-2"></i>プレビュー</h3>
            <div className="flex gap-4">
              <button onClick={handleSaveAndPrint} className="px-4 py-2 bg-green-600 rounded font-bold hover:bg-green-700">保存して印刷</button>
              <button onClick={() => setShowPreview(false)} className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500"><i className="fa-solid fa-xmark"></i></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-gray-700">
            <div className="bg-white shadow-xl origin-top transition-transform" style={{ transform: `scale(${previewScale})` }}>
              <NewcomerSurveyPrintLayout data={report} />
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showHomeConfirm}
        message="保存されていない変更があります。保存せずにホームに戻りますか？"
        onConfirm={onBackToMenu}
        onCancel={() => setShowHomeConfirm(false)}
      />

      <div className="hidden print:block">
        <NewcomerSurveyPrintLayout data={report} />
      </div>
    </div>
  );
};

export default NewcomerSurveyWizard;
