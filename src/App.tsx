import React, { useState, useEffect } from 'react';
import SafetyTrainingWizard from './components/SafetyTrainingWizard';
import DisasterCouncilWizard from './components/DisasterCouncilWizard';
import SafetyPlanWizard from './components/SafetyPlanWizard';
import NewcomerSurveyWizard from './components/NewcomerSurveyWizard';
import { fetchDrafts, removeDraft } from './services/firebaseService';
import { SavedDraft, ReportData, DisasterCouncilReportData, ReportTypeString, NewcomerSurveyReportData } from './types';
import { QRCodeCanvas } from 'qrcode.react';

// --- Confirmation Modal ---
const ConfirmationModal: React.FC<{
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isOpen, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-fade-in">
        <h3 className="text-lg font-bold text-gray-800 mb-4">確認</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 text-gray-600 font-bold">キャンセル</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold">削除する</button>
        </div>
      </div>
    </div>
  );
};

// --- QR Code Modal ---
const QRCodeModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  url: string;
}> = ({ isOpen, onClose, url }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-gray-900 bg-opacity-80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white p-6 rounded-xl shadow-2xl flex flex-col items-center" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4 text-gray-800">作業員用 QRコード</h3>
        <div className="bg-white p-2 border-2 border-gray-200 rounded mb-4">
          <QRCodeCanvas value={url} size={256} level={"H"} includeMargin={true} />
        </div>
        <p className="text-sm text-gray-500 mb-6 text-center break-all w-full max-w-xs">{url}</p>
        <button onClick={onClose} className="px-8 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700">閉じる</button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'HOME' | ReportTypeString>('HOME');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<ReportTypeString | null>(null);
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [selectedDraftProject, setSelectedDraftProject] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen:false, message:'', onConfirm:()=>{} });
  const [wizardInitialData, setWizardInitialData] = useState<any>(undefined);
  const [wizardDraftId, setWizardDraftId] = useState<string | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  // URLパラメータチェック (作業員用直リンク)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const formType = params.get('form');
    if (formType === 'newcomer') {
      setCurrentView('NEWCOMER_SURVEY');
    }
  }, []);

  const qrUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?form=newcomer`;

  useEffect(() => { if (isModalOpen) { setIsLoading(true); fetchDrafts().then(setDrafts).catch(err=>{console.error(err);alert('保存データの読み込みに失敗しました。');}).finally(()=>setIsLoading(false)); setSelectedDraftProject(null); } }, [isModalOpen]);

  const openSelectionModal = (type:ReportTypeString)=>{ setSelectedReportType(type); setIsModalOpen(true); };
  const handleStartNew = ()=>{ if(!selectedReportType) return; setWizardInitialData(undefined); setWizardDraftId(null); setCurrentView(selectedReportType); setIsModalOpen(false); };
  const handleResumeDraft = (draft:SavedDraft)=>{ setWizardInitialData(draft.data); setWizardDraftId(draft.id); setCurrentView(draft.type); setIsModalOpen(false); };
  const handleDeleteDraft = (id:string)=>{ setConfirmModal({ isOpen:true, message:'この一時保存データを削除しますか？', onConfirm: async()=>{ try{ await removeDraft(id); const newDrafts=await fetchDrafts(); setDrafts(newDrafts); if(selectedDraftProject && selectedReportType){ const remaining=newDrafts.filter(d=>d.type===selectedReportType && (d.data.project||'名称未設定')===selectedDraftProject); if(remaining.length===0) setSelectedDraftProject(null); } }catch(e){console.error(e);alert('削除に失敗しました。');} setConfirmModal(prev=>({...prev,isOpen:false})); } } });

  // Routing
  if(currentView==='SAFETY_TRAINING') return <SafetyTrainingWizard initialData={wizardInitialData} initialDraftId={wizardDraftId} onBackToMenu={()=>setCurrentView('HOME')} />;
  if(currentView==='DISASTER_COUNCIL') return <DisasterCouncilWizard initialData={wizardInitialData} initialDraftId={wizardDraftId} onBackToMenu={()=>setCurrentView('HOME')} />;
  if(currentView==='SAFETY_PLAN') return <SafetyPlanWizard initialData={wizardInitialData} initialDraftId={wizardDraftId} onBackToMenu={()=>setCurrentView('HOME')} />;
  if(currentView==='NEWCOMER_SURVEY') return <NewcomerSurveyWizard initialData={wizardInitialData} initialDraftId={wizardDraftId} onBackToMenu={()=>setCurrentView('HOME')} />;

  // Group drafts by project
  const groupedDrafts = drafts.filter(d => d.type === selectedReportType).reduce((acc, draft) => {
    // 新規入場者アンケートの場合は氏名を表示、それ以外は工事名
    let key = '';
    if (draft.type === 'NEWCOMER_SURVEY') {
       key = (draft.data as NewcomerSurveyReportData).project || '工事名未設定';
    } else {
       key = (draft.data.project || '名称未設定');
    }
    if (!acc[key]) acc[key] = [];
    acc[key].push(draft);
    return acc;
  }, {} as Record<string, SavedDraft[]>);

  const renderSelectionModal = () => {
    if (!isModalOpen) return null;
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-60 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full h-[80vh] flex flex-col overflow-hidden animate-scale-in">
          <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
            <h2 className="text-xl font-bold flex items-center"><i className="fa-solid fa-folder-open mr-2"></i>保存データの選択</h2>
            <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-full hover:bg-gray-600 transition-colors"><i className="fa-solid fa-xmark"></i></button>
          </div>
          
          <div className="flex-1 overflow-hidden flex">
            <div className="w-1/3 bg-gray-50 border-r border-gray-200 overflow-y-auto p-2">
              <button onClick={() => setSelectedDraftProject(null)} className={`w-full text-left p-3 rounded-lg mb-2 transition-colors font-bold ${selectedDraftProject === null ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400' : 'bg-white hover:bg-gray-100 text-gray-700 shadow-sm'}`}><i className="fa-solid fa-plus-circle mr-2"></i>新規作成</button>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2 mt-4">一時保存済み ({Object.keys(groupedDrafts).length})</div>
              {Object.keys(groupedDrafts).length === 0 && <div className="text-center py-8 text-gray-400 text-sm">保存データなし</div>}
              {Object.keys(groupedDrafts).map(project => (
                <button key={project} onClick={() => setSelectedDraftProject(project)} className={`w-full text-left p-3 rounded-lg mb-2 transition-colors text-sm font-medium ${selectedDraftProject === project ? 'bg-blue-600 text-white shadow-md' : 'bg-white hover:bg-gray-100 text-gray-700 shadow-sm'}`}>
                  {project} <span className="float-right bg-black bg-opacity-20 px-2 py-0.5 rounded-full text-xs">{groupedDrafts[project].length}</span>
                </button>
              ))}
            </div>
            
            <div className="w-2/3 p-6 overflow-y-auto bg-white">
              {selectedDraftProject === null ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-6"><i className="fa-solid fa-file-pen text-4xl"></i></div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">新しい書類を作成</h3>
                  <p className="text-gray-500 mb-8">最初からデータ入力を行います。</p>
                  <button onClick={handleStartNew} className="px-8 py-3 bg-blue-600 text-white rounded-full font-bold shadow-lg hover:bg-blue-500 hover:shadow-xl transition-all transform hover:-translate-y-1"><i className="fa-solid fa-play mr-2"></i>作成スタート</button>
                  
                  {/* QRコードボタン (新規入場者アンケートの場合のみ) */}
                  {selectedReportType === 'NEWCOMER_SURVEY' && (
                    <button onClick={() => setIsQRModalOpen(true)} className="mt-6 px-6 py-2 bg-slate-100 text-slate-600 border border-slate-300 rounded-full font-bold hover:bg-slate-200 transition-colors flex items-center text-sm">
                      <i className="fa-solid fa-qrcode mr-2"></i> 作業員用QRコードを表示
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 sticky top-0 bg-white z-10"><i className="fa-solid fa-history mr-2 text-gray-400"></i>「{selectedDraftProject}」の保存データ</h3>
                  <div className="space-y-3">
                    {groupedDrafts[selectedDraftProject]?.map(draft => (
                      <div key={draft.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all bg-gray-50 group">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              {/* 表示名を調整 */}
                              {draft.type === 'NEWCOMER_SURVEY' 
                                ? ((draft.data as NewcomerSurveyReportData).name || '氏名未入力')
                                : (draft.data.date ? new Date(draft.data.date).toLocaleDateString() : '日付なし')
                              }
                            </span>
                            <div className="text-xs text-gray-400 mt-1">最終更新: {new Date(draft.lastModified).toLocaleString()}</div>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteDraft(draft.id); }} className="text-gray-300 hover:text-red-500 p-2 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                        </div>
                        <button onClick={() => handleResumeDraft(draft)} className="w-full py-2 bg-white border border-blue-200 text-blue-600 rounded font-bold hover:bg-blue-600 hover:text-white transition-colors">再開する</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
      {/* 更新確認用のバージョン表示 */}
      <div className="absolute top-0 left-0 bg-red-600 text-white text-[10px] px-2 py-1 z-50 font-bold">v2.0</div>

      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white"><i className="fa-solid fa-shield-halved"></i></div>
            <h1 className="text-xl font-bold tracking-tight text-gray-800">安全教育・訓練報告書システム</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          <div onClick={() => openSelectionModal('SAFETY_TRAINING')} className="bg-white p-8 rounded-2xl shadow-sm border-2 border-transparent hover:border-blue-500 hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
            <div className="relative z-10">
              <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 text-3xl group-hover:rotate-12 transition-transform"><i className="fa-solid fa-helmet-safety"></i></div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">安全訓練報告書</h2>
              <p className="text-gray-500">安全訓練の実施記録を作成・出力します。</p>
            </div>
          </div>

          <div onClick={() => openSelectionModal('DISASTER_COUNCIL')} className="bg-white p-8 rounded-2xl shadow-sm border-2 border-transparent hover:border-emerald-500 hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
            <div className="relative z-10">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 text-3xl group-hover:rotate-12 transition-transform"><i className="fa-solid fa-people-group"></i></div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">災害防止協議会</h2>
              <p className="text-gray-500">月例協議会の議事録を作成・出力します。</p>
            </div>
          </div>

          <div onClick={() => openSelectionModal('SAFETY_PLAN')} className="bg-white p-8 rounded-2xl shadow-sm border-2 border-transparent hover:border-orange-500 hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
            <div className="relative z-10">
              <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mb-6 text-3xl group-hover:rotate-12 transition-transform"><i className="fa-solid fa-calendar-days"></i></div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">安全管理計画表</h2>
              <p className="text-gray-500">月間の安全管理計画を作成・出力します。</p>
            </div>
          </div>

          <div onClick={() => openSelectionModal('NEWCOMER_SURVEY')} className="bg-white p-8 rounded-2xl shadow-sm border-2 border-transparent hover:border-purple-500 hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
            <div className="relative z-10">
              <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6 text-3xl group-hover:rotate-12 transition-transform"><i className="fa-solid fa-user-plus"></i></div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">新規入場者アンケート</h2>
              <p className="text-gray-500">新規入場時のアンケートを作成・出力します。</p>
            </div>
          </div>
        </div>
      </main>

      {renderSelectionModal()}
      <ConfirmationModal isOpen={confirmModal.isOpen} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={()=>setConfirmModal(prev=>({...prev,isOpen:false}))} />
      <QRCodeModal isOpen={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} url={qrUrl} />
    </div>
  );
};

export default App;
