import React, { useState, useEffect } from 'react';
import { MasterData, INITIAL_MASTER_DATA } from '../types';
import { getMasterData, saveMasterData, deleteDraftsByProject } from '../services/firebaseService';

interface Props {
  onBackToMenu: () => void;
}

// --- Components ---
const ConfirmationModal: React.FC<{ isOpen: boolean; message: string; onConfirm: () => void; onCancel: () => void }> = ({ isOpen, message, onConfirm, onCancel }) => {
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

const ProjectDeleteModal: React.FC<{ isOpen: boolean; projectName: string; onConfirm: () => void; onCancel: () => void }> = ({ isOpen, projectName, onConfirm, onCancel }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { if (isOpen) { setPassword(""); setError(""); } }, [isOpen]);
  if (!isOpen) return null;
  const handleConfirm = () => { if (password === "4043") onConfirm(); else setError("パスワードが間違っています"); };
  return (
    <div className="fixed inset-0 z-[80] bg-gray-900 bg-opacity-60 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 animate-fade-in border-l-8 border-red-600">
        <h3 className="text-xl font-bold text-red-600 mb-4"><i className="fa-solid fa-triangle-exclamation mr-2"></i>重要：削除の確認</h3>
        <p className="text-gray-800 font-bold mb-2">工事名「{projectName}」を削除しますか？</p>
        <div className="bg-red-50 p-3 rounded mb-4 text-sm text-red-800"><strong>【注意】</strong><br/>この操作を行うと、この工事名で保存されている<br/><span className="font-bold underline text-red-600 text-base">すべての一時保存データも同時に削除されます。</span></div>
        <div className="mb-6"><label className="block text-xs font-bold text-gray-500 mb-1">管理者パスワード (4043)</label><input type="password" className="w-full p-2 border rounded" value={password} onChange={(e) => setPassword(e.target.value)} />{error && <p className="text-red-500 text-xs mt-1 font-bold">{error}</p>}</div>
        <div className="flex justify-end gap-3"><button onClick={onCancel} className="px-4 py-2 bg-gray-100 rounded font-bold text-gray-600">キャンセル</button><button onClick={handleConfirm} className="px-4 py-2 bg-red-600 text-white rounded font-bold shadow-md">完全削除を実行</button></div>
      </div>
    </div>
  );
};

const MasterSection: React.FC<{ title: string; items: string[]; onUpdate: (items: string[]) => void; onDeleteRequest: (index: number, item: string) => void; onBack: () => void }> = ({ title, items, onUpdate, onDeleteRequest, onBack }) => {
  const [newItem, setNewItem] = useState("");
  const safeItems = items || [];
  const handleAdd = () => { if (newItem.trim()) { onUpdate([...safeItems, newItem.trim()]); setNewItem(""); } };
  return (
    <div className="bg-white rounded-lg shadow-sm h-full flex flex-col animate-fade-in">
      <div className="p-4 border-b flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-blue-600"><i className="fa-solid fa-arrow-left text-xl"></i></button>
        <h3 className="font-bold text-lg text-gray-800 flex-1">{title} <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full ml-2">{safeItems.length}件</span></h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <ul className="space-y-2">
          {safeItems.map((item, idx) => (<li key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded hover:bg-gray-100 transition-colors"><span className="text-sm text-gray-800 break-all mr-2">{item}</span><button onClick={(e) => { e.stopPropagation(); onDeleteRequest(idx, item); }} className="text-gray-400 hover:text-red-600 p-2 rounded hover:bg-red-50"><i className="fa-solid fa-trash"></i></button></li>))}
          {safeItems.length === 0 && <li className="text-gray-400 text-sm italic text-center py-8">データがありません</li>}
        </ul>
      </div>
      <div className="p-4 border-t bg-gray-50"><div className="flex gap-2"><input type="text" className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="新規項目を追加..." value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} /><button onClick={handleAdd} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 font-bold shadow-md"><i className="fa-solid fa-plus mr-1"></i>追加</button></div></div>
    </div>
  );
};

const LABEL_MAP: Record<string, string> = { 
  projects: "工事名", contractors: "会社名", supervisors: "現場責任者", locations: "場所", workplaces: "作業所名",
  roles: "役職", topics: "安全訓練内容", jobTypes: "工種", goals: "安全衛生目標", predictions: "予想災害", countermeasures: "防止対策",
  processes: "作業工程", cautions: "注意事項"
};

const MASTER_GROUPS = { 
  BASIC: ['projects', 'contractors', 'supervisors', 'locations', 'workplaces'], 
  TRAINING: ['roles', 'topics', 'jobTypes', 'goals', 'predictions', 'countermeasures', 'processes', 'cautions'] 
};

const MasterSettings: React.FC<Props> = ({ onBackToMenu }) => {
  const [masterData, setMasterData] = useState<MasterData>(INITIAL_MASTER_DATA);
  const [masterTab, setMasterTab] = useState<'BASIC' | 'TRAINING'>('BASIC');
  const [selectedMasterKey, setSelectedMasterKey] = useState<keyof MasterData | null>(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: () => {} });
  const [projectDeleteTarget, setProjectDeleteTarget] = useState<{index: number, name: string} | null>(null);

  useEffect(() => { const load = async () => { try { const data = await getMasterData(); setMasterData(data); } catch (e) { console.error(e); } }; load(); }, []);

  const handleUpdate = async (key: keyof MasterData, newItems: string[]) => {
    const newData = { ...masterData, [key]: newItems };
    setMasterData(newData);
    await saveMasterData(newData);
  };

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col no-print">
      <header className="bg-slate-800 text-white p-4 shadow-md sticky top-0 z-10 flex justify-between items-center">
        <h1 className="text-lg font-bold"><i className="fa-solid fa-gear mr-2"></i>マスタ管理設定</h1>
        <button onClick={onBackToMenu} className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500 font-bold text-sm">メニューに戻る</button>
      </header>
      <div className="p-4 max-w-4xl mx-auto w-full flex-1 flex flex-col">
        {selectedMasterKey ? (
          <div className="flex-1 overflow-hidden h-full">
            <MasterSection 
              title={LABEL_MAP[selectedMasterKey]} 
              items={masterData[selectedMasterKey]} 
              onBack={() => setSelectedMasterKey(null)}
              onUpdate={(items) => handleUpdate(selectedMasterKey, items)}
              onDeleteRequest={(index, item) => {
                if (selectedMasterKey === 'projects') { setProjectDeleteTarget({ index, name: item }); } 
                else { setConfirmModal({ isOpen: true, message: `「${item}」を削除しますか？`, onConfirm: async () => { const items = [...masterData[selectedMasterKey]]; items.splice(index, 1); handleUpdate(selectedMasterKey, items); setConfirmModal({ ...confirmModal, isOpen: false }); } }); }
              }} 
            />
          </div>
        ) : (
          <>
            <div className="flex gap-4 mb-6 shrink-0">
              <button onClick={() => setMasterTab('BASIC')} className={`flex-1 py-3 rounded-lg font-bold transition-colors ${masterTab === 'BASIC' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border'}`}><i className="fa-solid fa-house-chimney mr-2"></i>基本・共通マスタ</button>
              <button onClick={() => setMasterTab('TRAINING')} className={`flex-1 py-3 rounded-lg font-bold transition-colors ${masterTab === 'TRAINING' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border'}`}><i className="fa-solid fa-list-check mr-2"></i>各種項目マスタ</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
              {MASTER_GROUPS[masterTab].map((key) => {
                const list = masterData[key as keyof MasterData] || [];
                return (
                  <button key={key} onClick={() => setSelectedMasterKey(key as keyof MasterData)} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all text-left flex justify-between items-center group">
                    <div><h3 className="font-bold text-lg text-gray-800 mb-1">{LABEL_MAP[key]}</h3><p className="text-xs text-gray-500">{list.length} 件の登録</p></div>
                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors"><i className="fa-solid fa-chevron-right"></i></div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
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
            handleUpdate('projects', items);
            setProjectDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
};

export default MasterSettings;
