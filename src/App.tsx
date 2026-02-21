import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react'; // QRコード描画用
import SafetyTrainingWizard from './components/SafetyTrainingWizard';
import DisasterCouncilWizard from './components/DisasterCouncilWizard';
import SafetyPlanWizard from './components/SafetyPlanWizard';
import NewcomerSurveyWizard from './components/NewcomerSurveyWizard';
import MasterSettings from './components/MasterSettings';

// Firebase機能
import { fetchDrafts, removeDraft } from './services/firebaseService'; 
import { SavedDraft, ReportData, DisasterCouncilReportData, ReportTypeString, NewcomerSurveyReportData } from './types';

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
    <div className="fixed inset-0 z-[70] bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
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

// --- QRコード表示モーダル ---
const QRCodeModal: React.FC<{ isOpen: boolean; onClose: () => void; url: string }> = ({ isOpen, onClose, url }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-gray-900 bg-opacity-80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full flex flex-col items-center animate-fade-in" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-gray-800 mb-2">新規入場者用 入力フォーム</h3>
        <p className="text-sm text-gray-500 mb-6 text-center">入場者自身の端末で読み取ってください。<br/>自動的に入力画面が開きます。</p>
        <div className="p-4 border-4 border-gray-200 rounded-lg bg-white mb-6">
          <QRCodeCanvas value={url} size={250} level={"H"} includeMargin={true} />
        </div>
        <p className="text-xs text-gray-400 break-all text-center mb-6">{url}</p>
        <button onClick={onClose} className="w-full py-3 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700">閉じる</button>
      </div>
    </div>
  );
};

type ViewState = 'HOME' | ReportTypeString | 'SETTINGS';

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

  // Firebaseからデータを読み込む処理
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
    }
  }, [isModalOpen]);

  // Handlers
  const openSelectionModal = (type: ReportTypeString) => {
    setSelectedReportType(type);
    setIsModalOpen(true);
  };

  const handleStartNew = () => {
    if (!selectedReportType) return;
    setWizardInitialData(undefined);
    setWizardDraftId(null);
    setCurrentView(selectedReportType);
    setIsModalOpen(false);
  };

  const handleResumeDraft = (draft: SavedDraft) => {
    setWizardInitialData(draft.data);
    setWizardDraftId(draft.id);
    setCurrentView(draft.type);
    setIsModalOpen(false);
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
          
          if (selectedDraftProject && selectedReportType) {
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
  // ★修正: onGoToSettings プロップスを削除
  if (currentView === 'SAFETY_TRAINING') {
    return (
      <SafetyTrainingWizard 
        initialData={wizardInitialData}
        initialDraftId={wizardDraftId}
        onBackToMenu={() => setCurrentView('HOME')} 
      />
    );
  }

  if (currentView === 'DISASTER_COUNCIL') {
    return (
      <DisasterCouncilWizard
        initialData={wizardInitialData}
        initialDraftId={wizardDraftId}
        onBackToMenu={() => setCurrentView('HOME')}
      />
    );
  }

  if (currentView === 'SAFETY_PLAN') {
    return (
      <SafetyPlanWizard 
         initialData={wizardInitialData}
         initialDraftId={wizardDraftId}
         onBackToMenu={() => setCurrentView('HOME')}
      />
    );
  }

  if (currentView === 'NEWCOMER_SURVEY') {
    return (
      <NewcomerSurveyWizard
        initialData={wizardInitialData}
        initialDraftId={wizardDraftId}
        onBackToMenu={() => setCurrentView('HOME')}
      />
    );
  }

  if (currentView === 'SETTINGS') {
    return <MasterSettings onBackToMenu={() => setCurrentView('HOME')} />;
  }

  // --- Modal Component ---
  const renderSelectionModal = () => {
    if (!isModalOpen || !selectedReportType) return null;

    const currentDrafts = drafts.filter(d => d.type === selectedReportType);
    
    // Group drafts by project
    const draftsByProject = currentDrafts.reduce((acc, draft) => {
      const projectKey = draft.data.project || '名称未設定';
      
      if (!acc[projectKey]) {
        acc[projectKey] = [];
      }
      acc[projectKey].push(draft);
      return acc;
    }, {} as Record<string, SavedDraft[]>);

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
            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
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
      <header className="bg-slate-800 text-white p-6 shadow-md flex justify-center items-center relative">
        <div className="text-center">
          {/* ★修正: タイトルレイアウト */}
          <h1 className="text-2xl font-bold tracking-wide">Core Safe</h1>
          <p className="text-sm text-gray-400 font-normal mt-1">-安全書類作成支援システム-</p>
        </div>
        {/* 設定ボタン */}
        <button 
          onClick={handleGoToSettings} 
          className="bg-slate-700 px-4 py-2 rounded hover:bg-slate-600 transition-colors text-sm absolute right-6"
        >
          <i className="fa-solid fa-gear mr-2"></i>設定
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-6 mt-8">
        <h2 className="text-xl font-bold mb-6 text-gray-700 border-l-4 border-slate-800 pl-3">
          作成する帳票を選択してください
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Safety Training */}
          <button 
            onClick={() => openSelectionModal('SAFETY_TRAINING')}
            className="flex flex-col items-center p-8 bg-white rounded-xl shadow-md hover:shadow-xl transition-all transform hover:-translate-y-1 border-t-4 border-blue-600 group"
          >
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
              <i className="fa-solid fa-helmet-safety text-4xl text-blue-600"></i>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">安全訓練報告書</h3>
            <p className="text-xs text-gray-500 text-center">
              安全訓練の実施報告書を作成します。電子署名対応。
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
              災害防止協議会の報告書を作成します。電子署名対応。
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
              安全管理計画表を作成します。報告書に自動添付。
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
              新規入場者アンケートを作成します。QRコードから作成可能。
            </p>
          </button>
        </div>
      </main>

      <footer className="mt-12 text-center text-gray-400 text-sm pb-8">
        <div>&copy; 2026 Matsuura Construction App</div>
        {/* ★修正: バージョン表記 */}
        <div className="mt-1">Ver.1.3.4</div>
      </footer>

      {renderSelectionModal()}
      
      <ConfirmationModal 
        isOpen={confirmModal.isOpen} 
        message={confirmModal.message} 
        onConfirm={confirmModal.onConfirm} 
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* QRコード表示モーダル */}
      <QRCodeModal 
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        url={qrUrl}
      />
    </div>
  );
};

export default App;
