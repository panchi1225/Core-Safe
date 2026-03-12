import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react'; // QRコード描画用
import SafetyTrainingWizard from './components/SafetyTrainingWizard';
import DisasterCouncilWizard from './components/DisasterCouncilWizard';
import SafetyPlanWizard from './components/SafetyPlanWizard';
import NewcomerSurveyWizard from './components/NewcomerSurveyWizard';
import DailySafetyWizard from './components/DailySafetyWizard';
import MasterSettings from './components/MasterSettings';

// Firebase機能
import { fetchDrafts, removeDraft, getMasterData, fetchEmployees } from './services/firebaseService';
import { SavedDraft, ReportData, DisasterCouncilReportData, ReportTypeString, NewcomerSurveyReportData, DailySafetyReportData, MasterData, INITIAL_MASTER_DATA, EmployeeData } from './types';

// --- 確認用モーダル ---
interface ConfirmModalProps {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmModalProps> = ({ isOpen, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[70] bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 no-print">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-fade-in">
        <h3 className="text-lg font-bold text-gray-800 mb-4">確認</h3>
        <p className="text-gray-600 mb-6 whitespace-pre-wrap">{message}</p>
        <div className="flex justify-end gap-3">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 font-bold"
          >
            キャンセル
          </button>
          <button 
            onClick={onConfirm}
            className="px-4 py-2 text-white bg-red-600 rounded hover:bg-red-700 font-bold"
          >
            実行する
          </button>
        </div>
      </div>
    </div>
  );
};

// --- QRコード表示・印刷モーダル ---
interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  masterData: MasterData;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, url, masterData }) => {
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedManager, setSelectedManager] = useState("");

  // モーダルが開くたびに状態をリセット
  useEffect(() => {
    if (isOpen) {
      setShowPrintSettings(false);
      if (masterData.projects.length > 0) setSelectedProject("");
      if (masterData.supervisors.length > 0) setSelectedManager("");
    }
  }, [isOpen, masterData]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (!selectedProject || !selectedManager) {
      alert("印刷するには「現場名」と「作業所長名」を選択してください。");
      return;
    }
    window.print();
  };

  return (
    <>
      {/* 画面表示用モーダル (印刷時は非表示) */}
      <div className="fixed inset-0 z-[80] bg-gray-900 bg-opacity-80 flex items-center justify-center p-4 no-print" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full flex flex-col items-center animate-fade-in" onClick={e => e.stopPropagation()}>
          
          {!showPrintSettings ? (
            /* --- STEP 1: QRコード表示画面 --- */
            <>
              <h3 className="text-xl font-bold text-gray-800 mb-2">新規入場者用 入力フォーム</h3>
              <p className="text-sm text-gray-500 mb-6 text-center">入場者自身の端末で読み取ってください。<br/>自動的に入力画面が開きます。</p>
              
              <div className="p-4 border-4 border-gray-200 rounded-lg bg-white mb-6">
                <QRCodeCanvas value={url} size={250} level={"H"} includeMargin={true} />
              </div>
              
              <div className="w-full flex flex-col gap-3">
                <button 
                  onClick={() => setShowPrintSettings(true)} 
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-print"></i> ポスターを印刷
                </button>
                <button onClick={onClose} className="w-full py-3 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700">閉じる</button>
              </div>
            </>
          ) : (
            /* --- STEP 2: 印刷設定画面 --- */
            <>
              <div className="w-full flex items-center mb-4">
                <button onClick={() => setShowPrintSettings(false)} className="text-gray-400 hover:text-gray-600 mr-2"><i className="fa-solid fa-arrow-left"></i></button>
                <h3 className="text-xl font-bold text-gray-800">印刷設定</h3>
              </div>
              <p className="text-sm text-gray-500 mb-6 text-center">印刷するポスターに表示する情報を選択してください。</p>
              
              <div className="w-full space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">現場名 <span className="text-red-500">*</span></label>
                  <select 
                    className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-black outline-none appearance-none"
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                  >
                    <option value="">(選択してください)</option>
                    {masterData.projects.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">作業所長名 <span className="text-red-500">*</span></label>
                  <select 
                    className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-black outline-none appearance-none"
                    value={selectedManager}
                    onChange={(e) => setSelectedManager(e.target.value)}
                  >
                    <option value="">(選択してください)</option>
                    {masterData.supervisors.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="w-full flex flex-col gap-3">
                <button 
                  onClick={handlePrint} 
                  className={`w-full py-3 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${(!selectedProject || !selectedManager) ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                  disabled={!selectedProject || !selectedManager}
                >
                  <i className="fa-solid fa-print"></i> 印刷実行 (A4縦)
                </button>
                <button onClick={onClose} className="w-full py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">キャンセル</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 印刷用レイアウト (画面上は非表示) */}
      <div className="hidden print:flex fixed inset-0 z-[100] bg-white flex-col items-center justify-start p-0 m-0 w-full h-full">
        <style>{`@media print { @page { size: A4 portrait; margin: 0; } body { background: white; } }`}</style>
        <div className="w-[210mm] h-[297mm] p-[20mm] flex flex-col items-center text-center border-0">
          
          {/* ヘッダー */}
          <div className="w-full border-b-4 border-black mb-10 pb-4">
            <h1 className="text-4xl font-extrabold tracking-widest text-black">新規入場者アンケート</h1>
            <p className="text-xl mt-2 font-bold text-gray-700">Web入力フォーム</p>
          </div>

          {/* 現場情報 */}
          <div className="w-full mb-12 text-left space-y-6">
            <div className="border-2 border-black rounded-lg p-6">
              <p className="text-sm text-gray-500 font-bold mb-1">工事名</p>
              <p className="text-2xl font-bold leading-tight min-h-[2rem]">{selectedProject}</p>
            </div>
            <div className="border-2 border-black rounded-lg p-6">
              <p className="text-sm text-gray-500 font-bold mb-1">作業所長</p>
              <p className="text-3xl font-bold min-h-[2.5rem]">{selectedManager}</p>
            </div>
          </div>

          {/* QRコードエリア */}
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            <div className="border-8 border-black p-4 bg-white rounded-xl mb-6">
              <QRCodeCanvas value={url} size={400} level={"H"} includeMargin={false} />
            </div>
            <p className="text-2xl font-bold text-black mb-2">スマートフォンで読み取ってください</p>
            <p className="text-lg text-gray-600">
              ※iPhone/Android対応<br/>
              ※アプリのインストールは不要です
            </p>
          </div>

          {/* フッター */}
          <div className="w-full mt-auto pt-8 border-t-2 border-gray-300">
            <p className="text-sm text-gray-500 font-bold">Core Safe -安全書類作成支援システム-</p>
            <p className="text-lg font-bold mt-1">松浦建設株式会社</p>
          </div>
        </div>
      </div>
    </>
  );
};

// ViewState 型: 'HOME' | すべてのReportTypeString | 'SETTINGS'
type ViewState = 'HOME' | ReportTypeString | 'SETTINGS';

// ============================
// 【修正3】安全衛生日誌ドラフトから月を抽出するヘルパー関数
// workDate → meetingDate → lastModified の優先順で月を取得
// ============================
function extractMonthFromDiary(draft: SavedDraft): number {
  const data = draft.data as DailySafetyReportData;
  // workDate を優先
  if (data.workDate) {
    const d = new Date(data.workDate + 'T00:00:00');
    if (!isNaN(d.getTime())) return d.getMonth() + 1;
  }
  // meetingDate を次に使用
  if (data.meetingDate) {
    const d = new Date(data.meetingDate + 'T00:00:00');
    if (!isNaN(d.getTime())) return d.getMonth() + 1;
  }
  // どちらもなければ lastModified から取得
  if (draft.lastModified) {
    const d = new Date(draft.lastModified);
    if (!isNaN(d.getTime())) return d.getMonth() + 1;
  }
  return 0; // 取得不可
}

function extractYearFromDiary(draft: SavedDraft): number {
  const data = draft.data as DailySafetyReportData;
  if (data.workDate) {
    const d = new Date(data.workDate + 'T00:00:00');
    if (!isNaN(d.getTime())) return d.getFullYear();
  }
  if (data.meetingDate) {
    const d = new Date(data.meetingDate + 'T00:00:00');
    if (!isNaN(d.getTime())) return d.getFullYear();
  }
  if (draft.lastModified) {
    const d = new Date(draft.lastModified);
    if (!isNaN(d.getTime())) return d.getFullYear();
  }
  return 0;
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('HOME');
  
  // Selection Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<ReportTypeString | null>(null);
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [selectedDraftProject, setSelectedDraftProject] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);

  // QRモーダル開閉ステート
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  
  // マスタデータ（App全体で保持し、QRモーダル等へ渡す）
  const [masterData, setMasterData] = useState<MasterData>(INITIAL_MASTER_DATA);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
  });
  
  // Data to pass to Wizard
  const [wizardInitialData, setWizardInitialData] = useState<any>(undefined);
  const [wizardDraftId, setWizardDraftId] = useState<string | null>(null);

  // 【修正3】安全衛生日誌モーダルの3階層ナビゲーション用state
  const [diarySelectionStep, setDiarySelectionStep] = useState<'project' | 'month' | 'date'>('project');
  const [selectedDiaryProject, setSelectedDiaryProject] = useState<string | null>(null);
  const [selectedDiaryMonth, setSelectedDiaryMonth] = useState<number | null>(null);
  const [diaryActionModal, setDiaryActionModal] = useState<{ isOpen: boolean; draft: SavedDraft | null }>({ isOpen: false, draft: null });
  const [generalActionModal, setGeneralActionModal] = useState<{ isOpen: boolean; draft: SavedDraft | null }>({ isOpen: false, draft: null });
  const [wizardInitialStep, setWizardInitialStep] = useState<number>(1);
  const [sealSelectModal, setSealSelectModal] = useState<{ isOpen: boolean; draft: SavedDraft | null }>({ isOpen: false, draft: null });
  const [sealEmployees, setSealEmployees] = useState<EmployeeData[]>([]);


  // URLパラメータ判定（QRコードからのアクセス時）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const formType = params.get('form');
    
    if (formType === 'newcomer') {
      // パラメータがある場合、直接新規入場者アンケートを開く
      setWizardInitialData(undefined);
      setWizardDraftId(null);
      setCurrentView('NEWCOMER_SURVEY');
    }
  }, []);

  // マスタデータの読み込み（QRモーダル用）
  useEffect(() => {
    if (isQRModalOpen) {
      const loadMaster = async () => {
        try {
          const data = await getMasterData();
          setMasterData(data);
        } catch (e) {
          console.error("マスタ取得エラー", e);
        }
      };
      loadMaster();
    }
  }, [isQRModalOpen]);

  // Firebaseからドラフトデータを読み込む処理
  useEffect(() => {
    if (isModalOpen) {
      const loadDrafts = async () => {
        setIsLoading(true);
        try {
          const data = await fetchDrafts();
          setDrafts(data);
        } catch (error) {
          console.error("Failed to load drafts", error);
          alert("保存データの読み込みに失敗しました。");
        } finally {
          setIsLoading(false);
        }
      };
      
      loadDrafts();
      setSelectedDraftProject(null);
      // 【修正3】モーダルが開くたびに安全衛生日誌用stateもリセット
      setDiarySelectionStep('project');
      setSelectedDiaryProject(null);
      setSelectedDiaryMonth(null);
    }
  }, [isModalOpen]);

  // Handlers
  const openSelectionModal = (type: ReportTypeString) => {
    setSelectedReportType(type);
    setIsModalOpen(true);
  };

  // 【修正3】モーダルを閉じる際に安全衛生日誌用stateもリセット
  const closeSelectionModal = () => {
    setIsModalOpen(false);
    setDiarySelectionStep('project');
    setSelectedDiaryProject(null);
    setSelectedDiaryMonth(null);
  };

  const handleStartNew = () => {
    if (!selectedReportType) return;
    setWizardInitialData(undefined);
    setWizardDraftId(null);
    setCurrentView(selectedReportType as ViewState);
    closeSelectionModal();
  };

  const handleResumeDraft = (draft: SavedDraft) => {
    if (draft.type === 'DAILY_SAFETY') {
      setDiaryActionModal({ isOpen: true, draft });
    } else {
      setGeneralActionModal({ isOpen: true, draft });
    }
  };

  const handleDeleteDraft = (id: string) => {
    setConfirmModal({
      isOpen: true,
      message: 'この一時保存データを削除しますか？',
      onConfirm: async () => {
        try {
          await removeDraft(id);
          const newDrafts = await fetchDrafts();
          setDrafts(newDrafts);
          
          // 【修正3】安全衛生日誌の場合は3階層用のstateで残データチェック
          if (selectedReportType === 'DAILY_SAFETY' && selectedDiaryProject) {
            const remainingForProject = newDrafts.filter(d =>
              d.type === 'DAILY_SAFETY' && (d.data.project || '名称未設定') === selectedDiaryProject
            );
            if (remainingForProject.length === 0) {
              // このプロジェクトのデータがなくなったら階層1に戻る
              setDiarySelectionStep('project');
              setSelectedDiaryProject(null);
              setSelectedDiaryMonth(null);
            } else if (selectedDiaryMonth) {
              // 選択中の月のデータがなくなったら階層2に戻る
              const remainingForMonth = remainingForProject.filter(d => extractMonthFromDiary(d) === selectedDiaryMonth);
              if (remainingForMonth.length === 0) {
                setDiarySelectionStep('month');
                setSelectedDiaryMonth(null);
              }
            }
          } else if (selectedDraftProject && selectedReportType) {
            // 他の帳票の場合は既存ロジック
            const remaining = newDrafts.filter(d => 
              d.type === selectedReportType && (d.data.project || '名称未設定') === selectedDraftProject
            );
            if (remaining.length === 0) {
              setSelectedDraftProject(null);
            }
          }
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          console.error("Failed to delete draft", error);
          alert("削除に失敗しました。");
        }
      }
    });
  };

  const handleGoToSettings = () => {
    setCurrentView('SETTINGS');
  };

  // Routing Logic
  if (currentView === 'SAFETY_TRAINING') {
    return (
      <SafetyTrainingWizard
        initialData={wizardInitialData}
        initialDraftId={wizardDraftId}
        initialStep={wizardInitialStep}
        onBackToMenu={() => setCurrentView('HOME')}
      />
    );
  }

  if (currentView === 'DISASTER_COUNCIL') {
    return (
      <DisasterCouncilWizard
        initialData={wizardInitialData}
        initialDraftId={wizardDraftId}
        initialStep={wizardInitialStep}
        onBackToMenu={() => setCurrentView('HOME')}
      />
    );
  }

  if (currentView === 'SAFETY_PLAN') {
    return (
      <SafetyPlanWizard 
         initialData={wizardInitialData}
         initialDraftId={wizardDraftId}
         initialStep={wizardInitialStep}
         onBackToMenu={() => setCurrentView('HOME')}
      />
    );
  }

  if (currentView === 'NEWCOMER_SURVEY') {
    return (
      <NewcomerSurveyWizard
        initialData={wizardInitialData}
        initialDraftId={wizardDraftId}
        initialStep={wizardInitialStep}
        onBackToMenu={() => setCurrentView('HOME')}
      />
    );
  }

  if (currentView === 'DAILY_SAFETY') {
    return (
      <DailySafetyWizard
        initialData={wizardInitialData}
        initialDraftId={wizardDraftId}
        initialStep={wizardInitialStep}
        onBackToMenu={() => { setCurrentView('HOME'); setWizardInitialStep(1); }}
      />
    );
  }

  if (currentView === 'SETTINGS') {
    return <MasterSettings onBackToMenu={() => setCurrentView('HOME')} />;
  }

  // --- Modal Component ---
  const renderSelectionModal = () => {
    if (!isModalOpen || !selectedReportType) return null;

    // 型不一致を防ぐためフィルタリング時にキャスト
    const currentDrafts = drafts.filter(d => d.type === (selectedReportType as string));
    
    // Group drafts by project
    const draftsByProject = currentDrafts.reduce((acc, draft) => {
      const projectKey = draft.data.project || '名称未設定';
      
      if (!acc[projectKey]) {
        acc[projectKey] = [];
      }
      acc[projectKey].push(draft);
      return acc;
    }, {} as Record<string, SavedDraft[]>);

    // ============================
    // 【修正3】安全衛生日誌専用の3階層モーダルレンダリング
    // ============================
    if (selectedReportType === 'DAILY_SAFETY') {
      return (
        <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-80 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* ヘッダー */}
            <div className="bg-pink-600 text-white p-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                {/* 戻るボタン: 階層2以降で表示 */}
                {diarySelectionStep !== 'project' && (
                  <button
                    onClick={() => {
                      if (diarySelectionStep === 'date') {
                        setDiarySelectionStep('month');
                        setSelectedDiaryMonth(null);
                      } else if (diarySelectionStep === 'month') {
                        setDiarySelectionStep('project');
                        setSelectedDiaryProject(null);
                      }
                    }}
                    className="mr-1 text-pink-200 hover:text-white"
                  >
                    <i className="fa-solid fa-arrow-left"></i>
                  </button>
                )}
                <h3 className="font-bold text-lg">
                  {diarySelectionStep === 'project' && '安全衛生日誌'}
                  {diarySelectionStep === 'month' && '対象月の選択'}
                  {diarySelectionStep === 'date' && '対象データの選択'}
                </h3>
              </div>
              <button onClick={closeSelectionModal} className="text-pink-200 hover:text-white">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              {isLoading ? (
                <div className="flex justify-center items-center py-10">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-600"></div>
                  <span className="ml-3 text-gray-500">データを読み込み中...</span>
                </div>
              ) : (
                <>
                  {/* ============================
                      階層1: 現場名選択
                      ============================ */}
                  {diarySelectionStep === 'project' && (
                    <>
                      <div className="mb-8 space-y-3">
                        <button
                          onClick={handleStartNew}
                          className="w-full py-4 bg-pink-600 text-white rounded-lg font-bold shadow-md hover:bg-pink-700 flex items-center justify-center gap-2 transition-transform transform hover:scale-[1.01]"
                        >
                          <i className="fa-solid fa-file-circle-plus text-xl"></i>
                          新規作成
                        </button>
                      </div>

                      <div className="border-t pt-4">
                        <h4 className="text-gray-500 text-sm font-bold mb-3 uppercase tracking-wide">一時保存データから再開</h4>

                        {Object.keys(draftsByProject).length === 0 ? (
                          <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg">
                            保存されたデータはありません
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {Object.entries(draftsByProject).map(([projectName, projectDrafts]) => (
                              <button
                                key={projectName}
                                onClick={() => {
                                  setSelectedDiaryProject(projectName);
                                  setDiarySelectionStep('month');
                                }}
                                className="w-full text-left border rounded-lg p-4 hover:bg-pink-50 transition-colors flex justify-between items-center group shadow-sm"
                              >
                                <div>
                                  <div className="font-bold text-gray-800 text-sm mb-1">{projectName}</div>
                                  <div className="text-xs text-gray-500">
                                    <i className="fa-regular fa-folder-open mr-1"></i>
                                    {projectDrafts.length} 件のデータ
                                  </div>
                                </div>
                                <i className="fa-solid fa-chevron-right text-gray-300 group-hover:text-pink-400"></i>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* ============================
                      階層2: 対象月選択
                      ============================ */}
                  {diarySelectionStep === 'month' && selectedDiaryProject && (
                    <>
                      {/* 選択中の現場名 */}
                      <div className="bg-pink-50 p-3 rounded border border-pink-200 text-sm text-pink-800 mb-4 font-bold">
                        <i className="fa-solid fa-building mr-2"></i>
                        {selectedDiaryProject}
                      </div>

                      <h4 className="text-gray-500 text-sm font-bold mb-3 uppercase tracking-wide">対象月を選択</h4>

                      {(() => {
                        // 選択した現場名のドラフトを取得
                        const projectDrafts = draftsByProject[selectedDiaryProject] || [];
                        // 月を抽出してユニーク化・降順ソート
                        const monthSet = new Set<number>();
                        projectDrafts.forEach(draft => {
                          const month = extractMonthFromDiary(draft);
                          if (month > 0) monthSet.add(month);
                        });
                        const months = Array.from(monthSet).sort((a, b) => b - a);

                        if (months.length === 0) {
                          return (
                            <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg">
                              対象データがありません
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            {months.map(month => {
                              // この月のデータ件数
                              const count = projectDrafts.filter(d => extractMonthFromDiary(d) === month).length;
                              return (
                                <button
                                  key={month}
                                  onClick={() => {
                                    setSelectedDiaryMonth(month);
                                    setDiarySelectionStep('date');
                                  }}
                                  className="w-full text-left border rounded-lg p-4 hover:bg-pink-50 transition-colors flex justify-between items-center group shadow-sm"
                                >
                                  <div>
                                    <div className="font-bold text-gray-800 text-lg">
                                      <i className="fa-regular fa-calendar mr-2 text-pink-500"></i>
                                      {(() => { const d = projectDrafts.find(x => extractMonthFromDiary(x) === month); return d ? extractYearFromDiary(d) : ''; })()}年{month}月
                                    </div>
                                    <div className="text-xs text-gray-500 ml-7">
                                      {count} 件のデータ
                                    </div>
                                  </div>
                                  <i className="fa-solid fa-chevron-right text-gray-300 group-hover:text-pink-400"></i>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </>
                  )}

                  {/* ============================
                      階層3: 日付選択
                      ============================ */}
                  {diarySelectionStep === 'date' && selectedDiaryProject && selectedDiaryMonth && (
                    <>
                      {/* 選択中の現場名と月 */}
                      <div className="bg-pink-50 p-3 rounded border border-pink-200 text-sm text-pink-800 mb-4 font-bold">
                        <i className="fa-solid fa-building mr-2"></i>
                        {selectedDiaryProject}
                        <span className="ml-3 text-pink-600">
                          <i className="fa-regular fa-calendar mr-1"></i>
                          {(() => { const pj = selectedDiaryProject || ''; const ds = draftsByProject[pj] || []; const d = ds.find(x => extractMonthFromDiary(x) === selectedDiaryMonth); return d ? extractYearFromDiary(d) : ''; })()}年{selectedDiaryMonth}月
                        </span>
                      </div>

                      <h4 className="text-gray-500 text-sm font-bold mb-2 uppercase tracking-wide">対象データを選択</h4>

                      {(() => {
                        // 選択した現場名 + 月のドラフトを取得し、日付降順でソート
                        const projectDrafts = draftsByProject[selectedDiaryProject] || [];
                        const monthDrafts = projectDrafts
                          .filter(d => extractMonthFromDiary(d) === selectedDiaryMonth)
                          .sort((a, b) => {
                            // workDate で降順ソート
                            const dateA = (a.data as DailySafetyReportData).workDate || (a.data as DailySafetyReportData).meetingDate || '';
                            const dateB = (b.data as DailySafetyReportData).workDate || (b.data as DailySafetyReportData).meetingDate || '';
                            return dateB.localeCompare(dateA);
                          });

                        if (monthDrafts.length === 0) {
                          return (
                            <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg">
                              対象データがありません
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            {monthDrafts.map(draft => {
                              const data = draft.data as DailySafetyReportData;
                              // 表示用の日付（MM/DD形式）
                              const dateStr = data.workDate || data.meetingDate || '';
                              let displayDate = '';
                              if (dateStr) {
                                const d = new Date(dateStr + 'T00:00:00');
                                if (!isNaN(d.getTime())) {
                                  displayDate = `${d.getMonth() + 1}月${d.getDate()}日`;
                                }
                              }
                              if (!displayDate) {
                                displayDate = '日付不明';
                              }

                              return (
                                <div key={draft.id} className="border rounded-lg p-3 hover:bg-pink-50 transition-colors flex justify-between items-center group bg-white shadow-sm">
                                  <div className="cursor-pointer flex-1" onClick={() => handleResumeDraft(draft)}>
                                    <div className="font-bold text-pink-800 text-lg">
                                      <i className="fa-regular fa-calendar-check mr-2"></i>
                                      {displayDate} 
                                    </div>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteDraft(draft.id);
                                    }}
                                    className="ml-3 p-3 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                                    title="削除"
                                  >
                                    <i className="fa-solid fa-trash"></i>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      );
    }

    // ============================
    // 安全衛生日誌以外の帳票は従来のモーダル（変更なし）
    // ============================
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-80 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="bg-gray-800 text-white p-4 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              {selectedDraftProject && (
                <button 
                  onClick={() => setSelectedDraftProject(null)}
                  className="mr-1 text-gray-300 hover:text-white"
                >
                  <i className="fa-solid fa-arrow-left"></i>
                </button>
              )}
              <h3 className="font-bold text-lg">
                {selectedDraftProject ? '対象データの選択' : '作成方法の選択'}
              </h3>
            </div>
            <button onClick={closeSelectionModal} className="text-gray-400 hover:text-white">
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="flex justify-center items-center py-10">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-500">データを読み込み中...</span>
              </div>
            ) : (
              !selectedDraftProject ? (
                /* --- VIEW 1: Project List --- */
                <>
                  <div className="mb-8 space-y-3">
                    <button 
                      onClick={handleStartNew}
                      className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700 flex items-center justify-center gap-2 transition-transform transform hover:scale-[1.01]"
                    >
                      <i className="fa-solid fa-file-circle-plus text-xl"></i>
                      新規作成
                    </button>

                    {/* QRコードボタン (新規入場者アンケートの場合のみ) */}
                    {selectedReportType === 'NEWCOMER_SURVEY' && (
                      <button 
                        onClick={() => setIsQRModalOpen(true)}
                        className="w-full py-4 bg-purple-600 text-white rounded-lg font-bold shadow-md hover:bg-purple-700 flex items-center justify-center gap-2 transition-transform transform hover:scale-[1.01]"
                      >
                        <i className="fa-solid fa-qrcode text-xl"></i>
                        新規入場者用QRコードを表示
                      </button>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="text-gray-500 text-sm font-bold mb-3 uppercase tracking-wide">一時保存データから再開</h4>
                    
                    {Object.keys(draftsByProject).length === 0 ? (
                      <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg">
                        保存されたデータはありません
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {Object.entries(draftsByProject).map(([projectName, projectDrafts]) => (
                          <button
                            key={projectName}
                            onClick={() => setSelectedDraftProject(projectName)}
                            className="w-full text-left border rounded-lg p-4 hover:bg-blue-50 transition-colors flex justify-between items-center group shadow-sm"
                          >
                            <div>
                              <div className="font-bold text-gray-800 text-sm mb-1">{projectName}</div>
                              <div className="text-xs text-gray-500">
                                <i className="fa-regular fa-folder-open mr-1"></i>
                                {projectDrafts.length} 件のデータ
                              </div>
                            </div>
                            <i className="fa-solid fa-chevron-right text-gray-300 group-hover:text-blue-400"></i>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* --- VIEW 2: Draft Details --- */
                <div className="space-y-4">
                  <div className="bg-gray-50 p-3 rounded border text-sm text-gray-600 mb-4">
                    <i className="fa-solid fa-building mr-2"></i>
                    {selectedDraftProject}
                  </div>

                  <h4 className="text-gray-500 text-sm font-bold mb-2 uppercase tracking-wide">対象データを選択</h4>

                  <div className="space-y-3">
                    {draftsByProject[selectedDraftProject].map(draft => (
                      <div key={draft.id} className="border rounded-lg p-3 hover:bg-blue-50 transition-colors flex justify-between items-center group bg-white shadow-sm">
                        <div className="cursor-pointer flex-1" onClick={() => handleResumeDraft(draft)}>
                          <div className="font-bold text-blue-800 text-lg">
                            <i className="fa-regular fa-calendar-check mr-2"></i>
                            {draft.type === 'SAFETY_TRAINING' ? `${(draft.data as ReportData).month}月度` : 
                             draft.type === 'DISASTER_COUNCIL' ? `第${(draft.data as DisasterCouncilReportData).count}回` :
                             draft.type === 'NEWCOMER_SURVEY' ? ((draft.data as NewcomerSurveyReportData).name || '氏名未入力') :
                             `${(draft.data as any).month}月度 計画表`}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 pl-7">
                            最終更新: {new Date(draft.lastModified).toLocaleString('ja-JP')}
                          </div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDraft(draft.id);
                          }}
                          className="ml-3 p-3 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                          title="削除"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    );
  };

  const qrUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?form=newcomer`;

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
      <header className="bg-slate-800 text-white p-6 shadow-md flex justify-center items-center relative no-print">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-wide">安全書類作成支援システム</h1>
          <p className="text-xs text-gray-400 font-normal mt-1">各種書類をPC.スマホ.タブレットから作成可能</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 mt-8 no-print">
        <h2 className="text-xl font-bold mb-6 text-gray-700 border-l-4 border-slate-800 pl-3">
          作成する帳票を選択してください
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 0: Safety Health Diary (Pink, Top) */}
          <button 
            onClick={() => openSelectionModal('DAILY_SAFETY')}
            className="flex flex-col items-center p-8 bg-white rounded-xl shadow-md hover:shadow-xl transition-all transform hover:-translate-y-1 border-t-4 border-pink-500 group"
          >
            <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-pink-100 transition-colors">
              <i className="fa-solid fa-book-medical text-4xl text-pink-500"></i>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">安全衛生日誌</h3>
            <p className="text-xs text-gray-500 text-center">
              日々の安全衛生日誌を作成します。<br />※電子印対応
            </p>
          </button>

          {/* Card 1: Safety Training */}
          <button 
            onClick={() => openSelectionModal('SAFETY_TRAINING')}
            className="flex flex-col items-center p-8 bg-white rounded-xl shadow-md hover:shadow-xl transition-all transform hover:-translate-y-1 border-t-4 border-blue-600 group"
          >
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
              <i className="fa-solid fa-helmet-safety text-4xl text-blue-600"></i>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">安全訓練</h3>
            <p className="text-xs text-gray-500 text-center">
              安全訓練の実施報告書を作成します。<br />※電子署名対応
            </p>
          </button>

          {/* Card 2: Disaster Council */}
          <button 
            onClick={() => openSelectionModal('DISASTER_COUNCIL')}
            className="flex flex-col items-center p-8 bg-white rounded-xl shadow-md hover:shadow-xl transition-all transform hover:-translate-y-1 border-t-4 border-green-600 group"
          >
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-green-100 transition-colors">
              <i className="fa-solid fa-users-rectangle text-4xl text-green-600"></i>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">災害防止協議会</h3>
            <p className="text-xs text-gray-500 text-center">
              災害防止協議会の報告書を作成します。<br />※電子署名対応
            </p>
          </button>

          {/* Card 3: Safety Plan */}
          <button 
            onClick={() => openSelectionModal('SAFETY_PLAN')}
            className="flex flex-col items-center p-8 bg-white rounded-xl shadow-md hover:shadow-xl transition-all transform hover:-translate-y-1 border-t-4 border-orange-500 group"
          >
            <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-orange-100 transition-colors">
              <i className="fa-solid fa-clipboard-list text-4xl text-orange-500"></i>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">安全管理計画表</h3>
            <p className="text-xs text-gray-500 text-center">
              安全訓練・災防協に添付する工程表を作成します。<br />※PCでの作成推奨
            </p>
          </button>

          {/* Card 4: Newcomer Survey */}
          <button 
            onClick={() => openSelectionModal('NEWCOMER_SURVEY')}
            className="flex flex-col items-center p-8 bg-white rounded-xl shadow-md hover:shadow-xl transition-all transform hover:-translate-y-1 border-t-4 border-purple-600 group"
          >
            <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-100 transition-colors">
              <i className="fa-solid fa-person-circle-question text-4xl text-purple-600"></i>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">新規入場者アンケート</h3>
            <p className="text-xs text-gray-500 text-center">
              新規入場者書類を作成します。<br />※QRコードから作成可能
            </p>
          </button>

          {/* Card 5: Master Settings */}
          <button 
            onClick={handleGoToSettings}
            className="flex flex-col items-center p-8 bg-white rounded-xl shadow-md hover:shadow-xl transition-all transform hover:-translate-y-1 border-t-4 border-gray-500 group"
          >
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-gray-200 transition-colors">
              <i className="fa-solid fa-gear text-4xl text-gray-600"></i>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">マスタ管理設定</h3>
            <p className="text-xs text-gray-500 text-center">
              各種項目のデータ追加・削除できます。
            </p>
          </button>
        </div>
      </main>

      <footer className="mt-12 text-center text-gray-400 text-sm pb-8 no-print">
        <div>&copy; 2026 Matsuura Construction App</div>
        <div className="mt-1 flex items-center justify-center gap-2">
          <span>Core Safe</span>
          <span>Ver.2.0.5</span>
        </div>
      </footer>

      {renderSelectionModal()}
      
      <ConfirmationModal 
        isOpen={confirmModal.isOpen} 
        message={confirmModal.message} 
        onConfirm={confirmModal.onConfirm} 
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* QRコード表示・印刷モーダル */}
      <QRCodeModal 
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        url={qrUrl}
        masterData={masterData}
      />

      {/* 安全衛生日誌アクション選択モーダル */}
      {diaryActionModal.isOpen && diaryActionModal.draft && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="p-4 border-b bg-pink-50">
              <h3 className="font-bold text-lg text-pink-800 text-center">
                <i className="fa-solid fa-clipboard-list mr-2"></i>操作を選択
              </h3>
            </div>
            <div className="p-4 space-y-3">
              <button
                onClick={() => {
                  const draft = diaryActionModal.draft!;
                  setWizardInitialData(draft.data);
                  setWizardDraftId(draft.id);
                  setWizardInitialStep(1);
                  setCurrentView(draft.type as ViewState);
                  setDiaryActionModal({ isOpen: false, draft: null });
                  closeSelectionModal();
                }}
                className="w-full text-left border rounded-lg p-4 hover:bg-blue-50 transition-colors flex items-center gap-3 shadow-sm"
              >
                <i className="fa-solid fa-pen-to-square text-blue-500 text-xl w-8 text-center"></i>
                <div>
                  <div className="font-bold text-gray-800">作業内容を修正（STEP1）</div>
                  <div className="text-xs text-gray-500">作業内容・主要機械・安全指示事項を編集</div>
                </div>
              </button>
              <button
                onClick={() => {
                  const draft = diaryActionModal.draft!;
                  setWizardInitialData(draft.data);
                  setWizardDraftId(draft.id);
                  setWizardInitialStep(3);
                  setCurrentView(draft.type as ViewState);
                  setDiaryActionModal({ isOpen: false, draft: null });
                  closeSelectionModal();
                }}
                className="w-full text-left border rounded-lg p-4 hover:bg-green-50 transition-colors flex items-center gap-3 shadow-sm"
              >
                <i className="fa-solid fa-clipboard-check text-green-500 text-xl w-8 text-center"></i>
                <div>
                  <div className="font-bold text-gray-800">当日作業確認・巡視（STEP3）</div>
                  <div className="text-xs text-gray-500">実施人数・追加作業・巡視点検を入力</div>
                </div>
              </button>
              <button
                onClick={() => {
                  const draft = diaryActionModal.draft!;
                  setWizardInitialData(draft.data);
                  setWizardDraftId(draft.id);
                  setWizardInitialStep(99);
                  setCurrentView(draft.type as ViewState);
                  setDiaryActionModal({ isOpen: false, draft: null });
                  closeSelectionModal();
                }}
                className="w-full text-left border rounded-lg p-4 hover:bg-orange-50 transition-colors flex items-center gap-3 shadow-sm"
              >
                <i className="fa-solid fa-print text-orange-500 text-xl w-8 text-center"></i>
                <div>
                  <div className="font-bold text-gray-800">印刷プレビュー</div>
                  <div className="text-xs text-gray-500">帳票を確認・PDF出力</div>
                </div>
              </button>
            </div>
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setDiaryActionModal({ isOpen: false, draft: null })}
                className="w-full py-2 bg-gray-200 rounded-lg font-bold text-gray-600 hover:bg-gray-300"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {generalActionModal.isOpen && generalActionModal.draft && (
        <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-800">操作を選択</h3>
            </div>
            <div className="p-4 space-y-3">
              <button
                onClick={() => {
                  const draft = generalActionModal.draft!;
                  setWizardInitialData(draft.data);
                  setWizardDraftId(draft.id);
                  setWizardInitialStep(1);
                  setCurrentView(draft.type as ViewState);
                  setGeneralActionModal({ isOpen: false, draft: null });
                  closeSelectionModal();
                }}
                className="w-full text-left border rounded-lg p-4 hover:bg-blue-50 transition-colors flex items-center gap-3 shadow-sm"
              >
                <i className="fa-solid fa-pen-to-square text-blue-500 text-xl w-8 text-center"></i>
                <div>
                  <div className="font-bold text-gray-800">内容を修正</div>
                  <div className="text-xs text-gray-500">入力内容を編集します</div>
                </div>
              </button>
              <button
                onClick={() => {
                  const draft = generalActionModal.draft!;
                  setWizardInitialData(draft.data);
                  setWizardDraftId(draft.id);
                  setWizardInitialStep(99);
                  setCurrentView(draft.type as ViewState);
                  setGeneralActionModal({ isOpen: false, draft: null });
                  closeSelectionModal();
                }}
                className="w-full text-left border rounded-lg p-4 hover:bg-orange-50 transition-colors flex items-center gap-3 shadow-sm"
              >
                <i className="fa-solid fa-print text-orange-500 text-xl w-8 text-center"></i>
                <div>
                  <div className="font-bold text-gray-800">印刷プレビュー</div>
                  <div className="text-xs text-gray-500">帳票を確認・印刷します</div>
                </div>
              </button>
            </div>
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setGeneralActionModal({ isOpen: false, draft: null })}
                className="w-full py-2 bg-gray-200 rounded-lg font-bold text-gray-600 hover:bg-gray-300"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
