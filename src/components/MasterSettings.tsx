import React, { useState, useEffect } from 'react';
import { MasterData, INITIAL_MASTER_DATA, EmployeeData, Qualifications, INITIAL_NEWCOMER_SURVEY_REPORT } from '../types';
import { 
  getMasterData, saveMasterData, deleteDraftsByProject,
  fetchEmployees, saveEmployee, deleteEmployee // ★追加
} from '../services/firebaseService';

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
          {safeItems.map((item, idx) => (
            <li key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded hover:bg-gray-100 transition-colors">
              <span className="text-sm text-gray-800 break-all mr-2">{item}</span>
              <button onClick={(e) => { e.stopPropagation(); onDeleteRequest(idx, item); }} className="text-gray-400 hover:text-red-600 p-2 rounded hover:bg-red-50"><i className="fa-solid fa-trash"></i></button>
            </li>
          ))}
          {safeItems.length === 0 && <li className="text-gray-400 text-sm italic text-center py-8">データがありません</li>}
        </ul>
      </div>
      <div className="p-4 border-t bg-gray-50">
        <div className="flex gap-2">
          <input type="text" className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="新規項目を追加..." value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
          <button onClick={handleAdd} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 font-bold shadow-md"><i className="fa-solid fa-plus mr-1"></i>追加</button>
        </div>
      </div>
    </div>
  );
};

// ★追加: 社員編集フォーム
const EmployeeEditForm: React.FC<{ 
  employee: EmployeeData; 
  onSave: (data: EmployeeData) => void; 
  onCancel: () => void; 
  onDelete: () => void 
}> = ({ employee, onSave, onCancel, onDelete }) => {
  const [data, setData] = useState<EmployeeData>(employee);

  const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const handleChange = (key: keyof EmployeeData, value: any) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  const handleQualChange = (key: keyof Qualifications, checked: boolean) => {
    setData(prev => ({
      ...prev,
      qualifications: {
        ...prev.qualifications,
        [key]: checked
      }
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow-sm h-full flex flex-col animate-fade-in">
      <div className="p-4 border-b flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="text-gray-500 hover:text-blue-600"><i className="fa-solid fa-arrow-left text-xl"></i></button>
          <h3 className="font-bold text-lg text-gray-800">{data.id ? '社員情報編集' : '新規社員登録'}</h3>
        </div>
        {data.id && (
          <button onClick={onDelete} className="text-red-500 hover:bg-red-50 px-3 py-1 rounded font-bold text-sm"><i className="fa-solid fa-trash mr-1"></i>削除</button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="space-y-6 max-w-3xl mx-auto">
          
          {/* 基本情報 */}
          <section>
            <h4 className="font-bold text-gray-700 border-l-4 border-blue-500 pl-2 mb-4">基本情報</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">氏名 (漢字)</label>
                <div className="flex gap-2">
                  <input type="text" className="w-1/2 p-2 border rounded" placeholder="氏" value={data.nameSei} onChange={e => handleChange('nameSei', e.target.value)} />
                  <input type="text" className="w-1/2 p-2 border rounded" placeholder="名" value={data.nameMei} onChange={e => handleChange('nameMei', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">氏名 (フリガナ)</label>
                <div className="flex gap-2">
                  <input type="text" className="w-1/2 p-2 border rounded" placeholder="セイ" value={data.furiganaSei} onChange={e => handleChange('furiganaSei', e.target.value)} />
                  <input type="text" className="w-1/2 p-2 border rounded" placeholder="メイ" value={data.furiganaMei} onChange={e => handleChange('furiganaMei', e.target.value)} />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">生年月日</label>
                <div className="flex gap-1 items-center">
                  <select className="p-2 border rounded text-sm" value={data.birthEra} onChange={e => handleChange('birthEra', e.target.value)}>
                    <option value="Showa">昭和</option><option value="Heisei">平成</option>
                  </select>
                  <input type="number" className="w-14 p-2 border rounded text-center" value={data.birthYear} onChange={e => handleChange('birthYear', parseInt(e.target.value))} />
                  <span>年</span>
                  <input type="number" className="w-12 p-2 border rounded text-center" value={data.birthMonth} onChange={e => handleChange('birthMonth', parseInt(e.target.value))} />
                  <span>月</span>
                  <input type="number" className="w-12 p-2 border rounded text-center" value={data.birthDay} onChange={e => handleChange('birthDay', parseInt(e.target.value))} />
                  <span>日</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">性別・血液型</label>
                <div className="flex gap-4">
                  <select className="p-2 border rounded text-sm" value={data.gender} onChange={e => handleChange('gender', e.target.value)}>
                    <option value="Male">男</option><option value="Female">女</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <select className="p-2 border rounded text-sm" value={data.bloodType} onChange={e => handleChange('bloodType', e.target.value)}>
                      <option value="A">A</option><option value="B">B</option><option value="O">O</option><option value="AB">AB</option>
                    </select>
                    <span className="text-xs">型</span>
                    <select className="p-2 border rounded text-sm" value={data.bloodTypeRh} onChange={e => handleChange('bloodTypeRh', e.target.value)}>
                      <option value="Unknown">不明</option><option value="Plus">+</option><option value="Minus">-</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 職務・連絡先 */}
          <section>
            <h4 className="font-bold text-gray-700 border-l-4 border-blue-500 pl-2 mb-4">職務・連絡先</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">職種</label>
                <input type="text" className="w-full p-2 border rounded" value={data.jobType} onChange={e => handleChange('jobType', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">経験年数 (入力時点)</label>
                <div className="flex gap-2 items-center">
                  <input type="number" className="w-20 p-2 border rounded text-center" value={data.experienceYears} onChange={e => handleChange('experienceYears', parseInt(e.target.value))} />
                  <span>年</span>
                  <input type="number" className="w-16 p-2 border rounded text-center" value={data.experienceMonths} onChange={e => handleChange('experienceMonths', parseInt(e.target.value))} />
                  <span>ヶ月</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">※自動計算の基準となります</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">現住所</label>
                <input type="text" className="w-full p-2 border rounded" value={data.address} onChange={e => handleChange('address', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">電話番号</label>
                <input type="text" className="w-full p-2 border rounded" value={data.phone} onChange={e => handleChange('phone', e.target.value)} />
              </div>
            </div>
          </section>

          {/* 緊急連絡先 */}
          <section>
            <h4 className="font-bold text-gray-700 border-l-4 border-red-500 pl-2 mb-4">緊急連絡先</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-red-50 p-4 rounded border border-red-100">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">氏名</label>
                <div className="flex gap-2">
                  <input type="text" className="w-1/2 p-2 border rounded" placeholder="氏" value={data.emergencyContactSei} onChange={e => handleChange('emergencyContactSei', e.target.value)} />
                  <input type="text" className="w-1/2 p-2 border rounded" placeholder="名" value={data.emergencyContactMei} onChange={e => handleChange('emergencyContactMei', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">続柄</label>
                <input type="text" className="w-full p-2 border rounded" value={data.emergencyContactRelation} onChange={e => handleChange('emergencyContactRelation', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">緊急電話番号</label>
                <input type="text" className="w-full p-2 border rounded" value={data.emergencyContactPhone} onChange={e => handleChange('emergencyContactPhone', e.target.value)} />
              </div>
            </div>
          </section>

          {/* 健康診断 */}
          <section>
            <h4 className="font-bold text-gray-700 border-l-4 border-green-500 pl-2 mb-4">健康診断</h4>
            <div className="flex gap-1 items-center bg-green-50 p-4 rounded border border-green-100">
              <span className="text-sm font-bold mr-2">受診日 (令和):</span>
              <input type="number" className="w-16 p-2 border rounded text-center" value={data.healthCheckYear} onChange={e => handleChange('healthCheckYear', parseInt(e.target.value))} />
              <span>年</span>
              <input type="number" className="w-14 p-2 border rounded text-center" value={data.healthCheckMonth} onChange={e => handleChange('healthCheckMonth', parseInt(e.target.value))} />
              <span>月</span>
              <input type="number" className="w-14 p-2 border rounded text-center" value={data.healthCheckDay} onChange={e => handleChange('healthCheckDay', parseInt(e.target.value))} />
              <span>日</span>
            </div>
          </section>

          {/* 資格 */}
          <section>
            <h4 className="font-bold text-gray-700 border-l-4 border-purple-500 pl-2 mb-4">保有資格</h4>
            <div className="bg-purple-50 p-4 rounded border border-purple-100 grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-sm">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={data.qualifications.vehicle_leveling} onChange={(e)=>handleQualChange('vehicle_leveling', e.target.checked)} />車輌系建設機械（整地）</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={data.qualifications.vehicle_demolition} onChange={(e)=>handleQualChange('vehicle_demolition', e.target.checked)} />車輌系建設機械（解体）</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={data.qualifications.mobile_crane} onChange={(e)=>handleQualChange('mobile_crane', e.target.checked)} />小型移動クレーン</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={data.qualifications.slinging} onChange={(e)=>handleQualChange('slinging', e.target.checked)} />玉掛</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={data.qualifications.gas_welding} onChange={(e)=>handleQualChange('gas_welding', e.target.checked)} />ガス溶接</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={data.qualifications.earth_retaining} onChange={(e)=>handleQualChange('earth_retaining', e.target.checked)} />土留め支保工作業主任者</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={data.qualifications.excavation} onChange={(e)=>handleQualChange('excavation', e.target.checked)} />地山掘削作業主任者</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={data.qualifications.scaffolding} onChange={(e)=>handleQualChange('scaffolding', e.target.checked)} />足場組立て等作業主任者</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={data.qualifications.formwork} onChange={(e)=>handleQualChange('formwork', e.target.checked)} />型枠支保工作業主任者</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={data.qualifications.oxygen_deficiency} onChange={(e)=>handleQualChange('oxygen_deficiency', e.target.checked)} />酸素欠乏危険作業主任者</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={data.qualifications.rough_terrain} onChange={(e)=>handleQualChange('rough_terrain', e.target.checked)} />不整地運搬車</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={data.qualifications.arc_welding} onChange={(e)=>handleQualChange('arc_welding', e.target.checked)} />アーク溶接</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={data.qualifications.grinding_wheel} onChange={(e)=>handleQualChange('grinding_wheel', e.target.checked)} />研削といし</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={data.qualifications.low_voltage} onChange={(e)=>handleQualChange('low_voltage', e.target.checked)} />低圧電気取扱</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={data.qualifications.roller} onChange={(e)=>handleQualChange('roller', e.target.checked)} />ローラー運転</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={data.qualifications.asbestos} onChange={(e)=>handleQualChange('asbestos', e.target.checked)} />石綿取り扱い</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={data.qualifications.foreman} onChange={(e)=>handleQualChange('foreman', e.target.checked)} />職長教育</label>
            </div>
          </section>

        </div>
      </div>
      <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
        <button onClick={onCancel} className="px-6 py-2 bg-gray-200 rounded-lg font-bold text-gray-600 hover:bg-gray-300">キャンセル</button>
        <button onClick={() => onSave(data)} className="px-8 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md"><i className="fa-solid fa-save mr-2"></i>保存する</button>
      </div>
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
  TRAINING: ['roles', 'topics', 'jobTypes', 'goals', 'predictions', 'countermeasures'] 
};

// ★修正: タブ型定義を追加
type TabType = 'BASIC' | 'TRAINING' | 'EMPLOYEES';

const MasterSettings: React.FC<Props> = ({ onBackToMenu }) => {
  const [masterData, setMasterData] = useState<MasterData>(INITIAL_MASTER_DATA);
  const [masterTab, setMasterTab] = useState<TabType>('BASIC');
  const [selectedMasterKey, setSelectedMasterKey] = useState<keyof MasterData | null>(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: () => {} });
  const [projectDeleteTarget, setProjectDeleteTarget] = useState<{index: number, name: string} | null>(null);

  // 社員データ用State
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [isEditingEmployee, setIsEditingEmployee] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeData | null>(null);

  useEffect(() => { 
    const load = async () => { 
      try { 
        const data = await getMasterData(); 
        setMasterData(data); 
        // 社員データもロード
        const emps = await fetchEmployees();
        setEmployees(emps);
      } catch (e) { console.error(e); } 
    }; 
    load(); 
  }, []);

  const handleUpdate = async (key: keyof MasterData, newItems: string[]) => {
    const newData = { ...masterData, [key]: newItems };
    setMasterData(newData);
    await saveMasterData(newData);
  };

  // 社員編集開始（新規）
  const handleNewEmployee = () => {
    setEditingEmployee({
      id: '',
      nameSei: '', nameMei: '', furiganaSei: '', furiganaMei: '',
      birthEra: 'Heisei', birthYear: 0, birthMonth: 0, birthDay: 0, gender: 'Male',
      bloodType: 'A', bloodTypeRh: 'Plus',
      address: '', phone: '',
      emergencyContactSei: '', emergencyContactMei: '', emergencyContactRelation: '', emergencyContactPhone: '',
      jobType: '', experienceYears: 0, experienceMonths: 0, lastUpdatedExperience: Date.now(),
      healthCheckYear: 0, healthCheckMonth: 0, healthCheckDay: 0,
      qualifications: { ...INITIAL_NEWCOMER_SURVEY_REPORT.qualifications }
    });
    setIsEditingEmployee(true);
  };

  // 社員編集開始（既存）
  const handleEditEmployee = (emp: EmployeeData) => {
    setEditingEmployee(emp);
    setIsEditingEmployee(true);
  };

  // 社員保存
  const handleSaveEmployee = async (data: EmployeeData) => {
    // 必須チェック（氏名のみ）
    if (!data.nameSei || !data.nameMei) {
      alert("氏名は必須です");
      return;
    }
    
    // 入力時のタイムスタンプを保存（経験年数計算用）
    const dataToSave = { ...data, lastUpdatedExperience: Date.now() };
    
    await saveEmployee(dataToSave);
    const newEmps = await fetchEmployees();
    setEmployees(newEmps);
    setIsEditingEmployee(false);
    setEditingEmployee(null);
  };

  // 社員削除
  const handleDeleteEmployee = async () => {
    if (!editingEmployee || !editingEmployee.id) return;
    setConfirmModal({
      isOpen: true,
      message: `${editingEmployee.nameSei} ${editingEmployee.nameMei} を削除してもよろしいですか？`,
      onConfirm: async () => {
        await deleteEmployee(editingEmployee.id);
        const newEmps = await fetchEmployees();
        setEmployees(newEmps);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsEditingEmployee(false);
        setEditingEmployee(null);
      }
    });
  };

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col no-print">
      <header className="bg-slate-800 text-white p-4 shadow-md sticky top-0 z-10 flex justify-between items-center">
        <h1 className="text-lg font-bold"><i className="fa-solid fa-gear mr-2"></i>マスタ管理設定</h1>
        <div className="flex gap-2">
          <button onClick={onBackToMenu} className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500 font-bold text-sm">メニューに戻る</button>
        </div>
      </header>
      
      <div className="p-4 max-w-4xl mx-auto w-full flex-1 flex flex-col">
        {/* 社員編集中ならフォームを表示 */}
        {isEditingEmployee && editingEmployee ? (
          <div className="flex-1 overflow-hidden h-full">
            <EmployeeEditForm 
              employee={editingEmployee}
              onSave={handleSaveEmployee}
              onCancel={() => { setIsEditingEmployee(false); setEditingEmployee(null); }}
              onDelete={handleDeleteEmployee}
            />
          </div>
        ) : selectedMasterKey ? (
          <div className="flex-1 overflow-hidden h-full">
            <MasterSection 
              title={LABEL_MAP[selectedMasterKey]} 
              items={masterData[selectedMasterKey]} 
              onBack={() => setSelectedMasterKey(null)}
              onUpdate={(items) => handleUpdate(selectedMasterKey, items)}
              onDeleteRequest={(index, item) => {
                if (selectedMasterKey === 'projects') { 
                  setProjectDeleteTarget({ index, name: item }); 
                } else { 
                  setConfirmModal({ 
                    isOpen: true, 
                    message: `「${item}」を削除しますか？`, 
                    onConfirm: async () => { 
                      const items = [...masterData[selectedMasterKey]]; 
                      items.splice(index, 1); 
                      handleUpdate(selectedMasterKey, items); 
                      setConfirmModal({ ...confirmModal, isOpen: false }); 
                    } 
                  }); 
                }
              }} 
            />
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-6 shrink-0 bg-white p-1 rounded-lg shadow-sm border border-gray-200">
              <button onClick={() => setMasterTab('BASIC')} className={`flex-1 py-3 rounded-md font-bold transition-colors ${masterTab === 'BASIC' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'}`}><i className="fa-solid fa-house-chimney mr-2"></i>基本・共通</button>
              <button onClick={() => setMasterTab('TRAINING')} className={`flex-1 py-3 rounded-md font-bold transition-colors ${masterTab === 'TRAINING' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'}`}><i className="fa-solid fa-list-check mr-2"></i>各種項目</button>
              <button onClick={() => setMasterTab('EMPLOYEES')} className={`flex-1 py-3 rounded-md font-bold transition-colors ${masterTab === 'EMPLOYEES' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'}`}><i className="fa-solid fa-users mr-2"></i>社員名簿</button>
            </div>

            {/* 社員名簿タブ */}
            {masterTab === 'EMPLOYEES' ? (
              <div className="bg-white rounded-lg shadow-sm h-full flex flex-col animate-fade-in border border-gray-200">
                <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                  <h3 className="font-bold text-lg text-gray-800">登録済み社員一覧 <span className="text-xs font-normal text-gray-500 bg-white px-2 py-1 rounded-full ml-2 border">{employees.length}名</span></h3>
                  <button onClick={handleNewEmployee} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 font-bold shadow-md"><i className="fa-solid fa-plus mr-1"></i>新規登録</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {employees.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <p className="mb-2">社員データがありません。</p>
                      <p className="text-sm">「新規登録」ボタンから追加してください。</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {employees.map((emp) => (
                        <button key={emp.id} onClick={() => handleEditEmployee(emp)} className="flex items-center p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all text-left group">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3 shrink-0">
                            {emp.nameSei.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-800 text-lg">{emp.nameSei} {emp.nameMei}</div>
                            <div className="text-xs text-gray-500">{emp.furiganaSei} {emp.furiganaMei}</div>
                          </div>
                          <i className="fa-solid fa-pen text-gray-300 group-hover:text-blue-500"></i>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* マスタ項目一覧 (BASIC / TRAINING) */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
                {(MASTER_GROUPS[masterTab as 'BASIC' | 'TRAINING']).map((key) => {
                  const list = masterData[key as keyof MasterData] || [];
                  // 配列かどうかチェック（型安全のため）
                  const count = Array.isArray(list) ? list.length : 0;
                  return (
                    <button key={key} onClick={() => setSelectedMasterKey(key as keyof MasterData)} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all text-left flex justify-between items-center group">
                      <div><h3 className="font-bold text-lg text-gray-800 mb-1">{LABEL_MAP[key]}</h3><p className="text-xs text-gray-500">{count} 件の登録</p></div>
                      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors"><i className="fa-solid fa-chevron-right"></i></div>
                    </button>
                  )
                })}
              </div>
            )}
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