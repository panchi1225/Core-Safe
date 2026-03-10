// src/components/DailySafetyWizard.tsx
// 安全衛生日誌（作業打合せ及び安全衛生日誌）ウィザード
// STEP1: 作業内容入力、STEP2: 配置図・略図、STEP3: 当日作業確認、STEP4: 巡視記録、STEP5: 点検チェックリスト
// 【追加】STEP5プレビュー・印刷機能

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MasterData,
  DailySafetyReportData,
  WorkEntry,
  DiagramImage,
  AdditionalWorkEntry,
  Step3ConfirmationItems,
  Step3SiteConfirmationItems,
  Step5InspectionChecklist,
  Step5InspectionItem,
  PatrolRecord,
  INITIAL_DAILY_SAFETY_REPORT,
  INITIAL_MASTER_DATA,
  getJapaneseDayOfWeek,
  getNextBusinessDay,
} from '../types';
import {
  getMasterData,
  compressImage,
  compressDiagramImage,
  saveDraft,
  saveDiagramImage,
  fetchDiagramImages,
  removeDiagramImage,
} from '../services/firebaseService';
import DailySafetyPrintLayout from './DailySafetyPrintLayout';

// ============================
// STEP4: 巡視時間の選択肢（30分刻み 8:00〜16:00 の17個）
// ============================
const PATROL_TIME_OPTIONS: string[] = [
  '8:00', '8:30', '9:00', '9:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00',
];

// ============================
// STEP5: 点検チェックリストの大分類定義
// 【修正】タイトル表示名を仕様に合わせて変更
// ============================
const STEP5_CATEGORIES: { key: keyof Step5InspectionChecklist; title: string }[] = [
  { key: 'management', title: '管理' },
  { key: 'machinery', title: '重機・機械' },
  { key: 'electrical', title: '電気' },
  { key: 'falling', title: '墜落・転落' },           // 【修正】「墜落転落」→「墜落・転落」
  { key: 'debris', title: '飛来・落下・崩壊・転倒' }, // 【修正】「飛来・落下崩壊・転倒」→「飛来・落下・崩壊・転倒」
  { key: 'environment', title: '作業環境' },
  { key: 'others', title: 'その他' },
];

// STEP5: 評価ドロップダウンの選択肢
const INSPECTION_VALUES: ('○' | '△' | '×' | '◎' | '')[] = ['', '○', '△', '×', '◎'];

// ============================
// Props
// ============================
interface Props {
  initialData?: DailySafetyReportData;
  initialDraftId?: string | null;
  onBackToMenu: () => void;
}

// ============================
// 確認モーダル
// ============================
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
  isOpen,
  message,
  onLeftButtonClick,
  onRightButtonClick,
  leftButtonLabel,
  rightButtonLabel,
  leftButtonClass,
  rightButtonClass,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-fade-in">
        <h3 className="text-lg font-bold text-gray-800 mb-4">確認</h3>
        <p className="text-gray-600 mb-6 whitespace-pre-wrap font-bold text-red-600">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onLeftButtonClick} className={leftButtonClass}>
            {leftButtonLabel}
          </button>
          <button onClick={onRightButtonClick} className={rightButtonClass}>
            {rightButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================
// 保存完了モーダル
// ============================
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
          className="w-full py-3 bg-pink-600 text-white rounded-lg font-bold shadow hover:bg-pink-700 transition-colors"
        >
          OK（ホームへ戻る）
        </button>
      </div>
    </div>
  );
};

// ============================
// 【修正1】保存済み配置図選択モーダル
// 削除確認をインライン表示に変更（z-index問題を解消）
// ============================
interface DiagramPickerModalProps {
  isOpen: boolean;
  images: DiagramImage[];
  isLoading: boolean;
  onSelect: (image: DiagramImage) => void;
  onDelete: (imageId: string) => Promise<void>;
  onClose: () => void;
}

const DiagramPickerModal: React.FC<DiagramPickerModalProps> = ({
  isOpen,
  images,
  isLoading,
  onSelect,
  onDelete,
  onClose,
}) => {
  const [deletingDiagramId, setDeletingDiagramId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setDeletingDiagramId(null);
      setIsDeleting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatDate = (ms: number): string => {
    const d = new Date(ms);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
  };

  const handleConfirmDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      await onDelete(id);
    } catch (err) {
      console.error('配置図の削除に失敗:', err);
      alert('配置図の削除に失敗しました。');
    } finally {
      setDeletingDiagramId(null);
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col animate-fade-in">
        <div className="p-4 border-b flex items-center justify-between shrink-0">
          <h3 className="text-lg font-bold text-gray-800">
            <i className="fa-solid fa-images mr-2 text-pink-500"></i>
            保存済みの配置図
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-500 text-sm font-bold">読み込み中...</p>
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-12">
              <i className="fa-solid fa-folder-open text-4xl text-gray-300 mb-4 block"></i>
              <p className="text-gray-400 font-bold text-sm">
                この現場の保存済み配置図はありません
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="border border-gray-200 rounded-lg p-3 hover:border-pink-300 hover:shadow-md transition-all bg-gray-50"
                >
                  {deletingDiagramId === img.id ? (
                    <div className="flex flex-col items-center justify-center py-4">
                      <p className="text-sm font-bold text-red-600 mb-3">
                        <i className="fa-solid fa-triangle-exclamation mr-1"></i>
                        削除しますか？
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleConfirmDelete(img.id)}
                          disabled={isDeleting}
                          className="px-4 py-2 bg-red-600 text-white rounded font-bold text-xs hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          {isDeleting ? '削除中...' : 'はい'}
                        </button>
                        <button
                          onClick={() => setDeletingDiagramId(null)}
                          disabled={isDeleting}
                          className="px-4 py-2 bg-gray-200 text-gray-600 rounded font-bold text-xs hover:bg-gray-300 transition-colors disabled:opacity-50"
                        >
                          いいえ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-center mb-2">
                        <img
                          src={img.imageDataUrl}
                          alt={img.fileName}
                          className="w-24 h-24 object-cover rounded border border-gray-200 bg-white"
                        />
                      </div>
                      <p className="text-xs text-gray-700 font-bold truncate text-center mb-1" title={img.fileName}>
                        {img.fileName}
                      </p>
                      <p className="text-[10px] text-gray-400 text-center mb-2">
                        {formatDate(img.createdAt)}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onSelect(img)}
                          className="flex-1 py-2 bg-pink-600 text-white rounded font-bold text-xs hover:bg-pink-700 transition-colors"
                        >
                          <i className="fa-solid fa-check mr-1"></i>選択
                        </button>
                        <button
                          onClick={() => setDeletingDiagramId(img.id)}
                          className="px-3 py-2 bg-gray-200 text-gray-500 rounded font-bold text-xs hover:bg-red-100 hover:text-red-600 transition-colors"
                          title="削除"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-100 text-gray-600 rounded-lg font-bold text-sm hover:bg-gray-200 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================
// ユニークID生成
// ============================
function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

// ============================
// 【修正1】空の作業内容エントリ生成 — machine2 を追加
// ============================
function createEmptyWorkEntry(): WorkEntry {
  return {
    id: generateId(),
    workContent: '',
    company: '',
    plannedWorkers: 1,
    actualWorkers: 0,
    machine: '',
    machine2: '',  // 【修正1】機械2の初期値
    isAdditional: false,
  };
}

// ============================
// 空の追加作業エントリ生成（STEP3用）
// ============================
function createEmptyAdditionalWorkEntry(): AdditionalWorkEntry {
  return {
    id: generateId(),
    description: '',
    company: '',
    actualWorkers: 1,
    machines: [],
  };
}

// ============================
// 【修正】安全衛生指示事項の固定数: 7個→10個に変更
// ============================
const SAFETY_INSTRUCTIONS_COUNT = 10;

// ============================
// 【修正】STEP3: 基本確認事項の定義（10項目に拡張、項目名を変更）
// ============================
const STEP3_CONFIRMATION_LABELS: { key: keyof Step3ConfirmationItems; label: string }[] = [
  { key: 'item1', label: '健康状態の把握' },
  { key: 'item2', label: '服装・保護具の着用' },
  { key: 'item3', label: '資格者の配置（資格証の確認）' },
  { key: 'item4', label: '作業手順および合図・指揮系統の周知' },
  { key: 'item5', label: '危険作業および危険個所の周知' },
  { key: 'item6', label: '安全指示事項の周知確認（作業開始前）' },
  { key: 'item7', label: '相互の声掛けおよび合図確認の実施' },
  { key: 'item8', label: '異常・危険発見時の報告体制の周知' },
  { key: 'item9', label: 'KY活動および作業指揮者の明確化' },
  { key: 'item10', label: '新規入場者教育の実施' },
];

// ============================
// 【修正】STEP3: 当現場確認事項の定義（10項目に拡張、項目名を変更）
// ============================
const STEP3_SITE_CONFIRMATION_LABELS: { key: keyof Step3SiteConfirmationItems; label: string }[] = [
  { key: 'item1', label: '埋設物・架空線確認（作業開始前）' },
  { key: 'item2', label: '作業帯分離措置' },
  { key: 'item3', label: '建設機械使用前点検' },
  { key: 'item4', label: '仮囲い・保安設備確認' },
  { key: 'item5', label: '過積載確認' },
  { key: 'item6', label: '作業員と建設機械の接触防止措置' },
  { key: 'item7', label: '現場内の整理整頓' },
  { key: 'item8', label: '重機旋回範囲内立入禁止措置' },
  { key: 'item9', label: '誘導員配置および合図体制' },
  { key: 'item10', label: '作業通路および避難経路の確保' },
];

// ============================
// 【修正B】画像サイズエラー判定ヘルパー
// ============================
function isImageSizeError(error: unknown): boolean {
  const errorMessage =
    error instanceof Error
      ? error.message || error.toString()
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as any).message)
        : String(error || '');
  return (
    errorMessage.includes('exceeds the maximum allowed size') ||
    errorMessage.includes('INVALID_ARGUMENT') ||
    errorMessage.includes('Request payload size exceeds') ||
    errorMessage.includes('413') ||
    errorMessage.includes('too large') ||
    errorMessage.includes('size')
  );
}

// ============================
// メインコンポーネント
// ============================
const DailySafetyWizard: React.FC<Props> = ({ initialData, initialDraftId, onBackToMenu }) => {
  const [step, setStep] = useState(1);

  const [report, setReport] = useState<DailySafetyReportData>(() => {
    if (initialData) {
      const restored = { ...initialData };
      const si = restored.safetyInstructions || [];
      // 【修正】10個に合わせてリストア
      restored.safetyInstructions = Array.from(
        { length: SAFETY_INSTRUCTIONS_COUNT },
        (_, i) => si[i] || ''
      );
      if (!restored.actualWorkers) restored.actualWorkers = [];
      if (!restored.step3AdditionalWorkEntries) restored.step3AdditionalWorkEntries = [];
      if (!restored.step3MachineryEntries || !Array.isArray(restored.step3MachineryEntries)) restored.step3MachineryEntries = [];
      if (!restored.step3MachineryEntries || !Array.isArray(restored.step3MachineryEntries)) restored.step3MachineryEntries = [];
      /* 【修正】基本確認事項: 10項目対応のフォールバック（item8〜item10を補完） */
      if (!restored.step3ConfirmationItems) {
        restored.step3ConfirmationItems = { item1: '', item2: '', item3: '', item4: '', item5: '', item6: '', item7: '', item8: '', item9: '', item10: '' };
      } else {
        if (!('item8' in restored.step3ConfirmationItems)) (restored.step3ConfirmationItems as any).item8 = '';
        if (!('item9' in restored.step3ConfirmationItems)) (restored.step3ConfirmationItems as any).item9 = '';
        if (!('item10' in restored.step3ConfirmationItems)) (restored.step3ConfirmationItems as any).item10 = '';
      }
      /* 【修正】当現場確認事項: 10項目対応のフォールバック（item8〜item10を補完） */
      if (!restored.step3SiteConfirmationItems) {
        restored.step3SiteConfirmationItems = { item1: '', item2: '', item3: '', item4: '', item5: '', item6: '', item7: '', item8: '', item9: '', item10: '' };
      } else {
        if (!('item8' in restored.step3SiteConfirmationItems)) (restored.step3SiteConfirmationItems as any).item8 = '';
        if (!('item9' in restored.step3SiteConfirmationItems)) (restored.step3SiteConfirmationItems as any).item9 = '';
        if (!('item10' in restored.step3SiteConfirmationItems)) (restored.step3SiteConfirmationItems as any).item10 = '';
      }
      if (!restored.stageConfirmation) restored.stageConfirmation = '';
      if (!restored.witnessConfirmation) restored.witnessConfirmation = '';
      if (!restored.machineryEntries || !Array.isArray(restored.machineryEntries)) restored.machineryEntries = [''];
      if (!restored.dumpTrucks) restored.dumpTrucks = { incoming: 0, outgoing: 0 };
      if (!restored.patrolRecord) {
        restored.patrolRecord = {
          coordinationNotes: '',
          inspector: '',
          inspectionTime: '14:00',
          findings: '',
        };
      }
      /* STEP5: step5InspectionChecklistのフォールバック */
      if (!restored.step5InspectionChecklist) {
        restored.step5InspectionChecklist = INITIAL_DAILY_SAFETY_REPORT.step5InspectionChecklist;
      }
      /* 【修正1】既存データの workEntries に machine2 がない場合のフォールバック */
      if (restored.workEntries) {
        restored.workEntries = restored.workEntries.map((entry: any) => ({
          ...entry,
          machine2: entry.machine2 ?? '',
        }));
      }
      return restored;
    }
    const init = { ...INITIAL_DAILY_SAFETY_REPORT };
    if (init.workEntries.length === 0) {
      init.workEntries = [createEmptyWorkEntry()];
    }
    if (init.materialEntries.length === 0) {
      init.materialEntries = [''];
    }
    if (!init.machineryEntries || init.machineryEntries.length === 0) {
      init.machineryEntries = [''];
    }
    // 【修正2】preparationEntries の初期化を削除
    // 【修正】10個に合わせて初期化
    init.safetyInstructions = Array(SAFETY_INSTRUCTIONS_COUNT).fill('');
    return init;
  });

  const [draftId, setDraftId] = useState<string | null>(initialDraftId || null);

  const [originalWorkDate, setOriginalWorkDate] = useState<string | null>(() => {
    if (initialData) {
      return initialData.workDate || null;
    }
    return null;
  });

  const [showDateChangeConfirm, setShowDateChangeConfirm] = useState(false);

  const [masterData, setMasterData] = useState<MasterData>(INITIAL_MASTER_DATA);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [errors, setErrors] = useState<Record<string, boolean>>({});

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
    isOpen: false,
    message: '',
    onLeftButtonClick: () => {},
    onRightButtonClick: () => {},
    leftButtonLabel: '',
    rightButtonLabel: '',
    leftButtonClass: '',
    rightButtonClass: '',
  });

  const [showDiagramPicker, setShowDiagramPicker] = useState(false);
  const [diagramImages, setDiagramImages] = useState<DiagramImage[]>([]);
  const [diagramPickerLoading, setDiagramPickerLoading] = useState(false);

  // 【追加】プレビュー表示用state
  const [showPreview, setShowPreview] = useState(false);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const [penColor, setPenColor] = useState('#ff0000');
  const [penWidth, setPenWidth] = useState(4);
  const [diagramLoaded, setDiagramLoaded] = useState(false);

  const [canvasHistory, setCanvasHistory] = useState<string[]>([]);

  const isDrawingRef = useRef(false);

  const backgroundImageRef = useRef<HTMLImageElement | null>(null);

  const [currentDiagramSrc, setCurrentDiagramSrc] = useState<string>(() => {
    if (initialData) {
      return initialData.annotatedDiagramUrl || initialData.baseDiagramUrl || '';
    }
    return '';
  });

  const diagramFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      const src = initialData.annotatedDiagramUrl || initialData.baseDiagramUrl;
      if (src) {
        setDiagramLoaded(true);
      }
    }
  }, [initialData]);

  useEffect(() => {
    const loadMaster = async () => {
      try {
        const data = await getMasterData();
        setMasterData({
          ...data,
          machines: data.machines || INITIAL_MASTER_DATA.machines,
          equipment: data.equipment || INITIAL_MASTER_DATA.equipment,
          cautions: data.cautions || INITIAL_MASTER_DATA.cautions,
          safetyInstructionItems: data.safetyInstructionItems || INITIAL_MASTER_DATA.safetyInstructionItems,
        });
      } catch (e) {
        console.error('マスタ取得エラー', e);
      }
    };
    loadMaster();
  }, []);

  const updateReport = useCallback(
    (field: keyof DailySafetyReportData, value: any) => {
      setReport((prev) => ({ ...prev, [field]: value }));
      setSaveStatus('idle');
      setHasUnsavedChanges(true);
      if (value) {
        setErrors((prev) => ({ ...prev, [field]: false }));
      }
    },
    []
  );

  const updatePatrolRecord = useCallback(
    (field: keyof PatrolRecord, value: string) => {
      setReport((prev) => ({
        ...prev,
        patrolRecord: {
          ...prev.patrolRecord,
          [field]: value,
        },
      }));
      setSaveStatus('idle');
      setHasUnsavedChanges(true);
    },
    []
  );

  // ============================
  // STEP5: 点検チェックリストの評価値を更新するハンドラ
  // ============================
  const updateStep5ItemValue = useCallback(
    (categoryKey: keyof Step5InspectionChecklist, itemIndex: number, newValue: Step5InspectionItem['value']) => {
      setReport((prev) => {
        const updatedCategory = [...prev.step5InspectionChecklist[categoryKey]];
        updatedCategory[itemIndex] = { ...updatedCategory[itemIndex], value: newValue };
        return {
          ...prev,
          step5InspectionChecklist: {
            ...prev.step5InspectionChecklist,
            [categoryKey]: updatedCategory,
          },
        };
      });
      setSaveStatus('idle');
      setHasUnsavedChanges(true);
    },
    []
  );

  // ============================
  // STEP5: 自由記入欄の項目名を更新するハンドラ
  // ============================
  const updateStep5ItemLabel = useCallback(
    (categoryKey: keyof Step5InspectionChecklist, itemIndex: number, newLabel: string) => {
      setReport((prev) => {
        const updatedCategory = [...prev.step5InspectionChecklist[categoryKey]];
        updatedCategory[itemIndex] = { ...updatedCategory[itemIndex], label: newLabel };
        return {
          ...prev,
          step5InspectionChecklist: {
            ...prev.step5InspectionChecklist,
            [categoryKey]: updatedCategory,
          },
        };
      });
      setSaveStatus('idle');
      setHasUnsavedChanges(true);
    },
    []
  );

  const handleMeetingDateChange = (dateStr: string) => {
    const meetingDate = new Date(dateStr + 'T00:00:00');
    const nextBizDate = getNextBusinessDay(meetingDate);
    const yyyy = nextBizDate.getFullYear();
    const mm = String(nextBizDate.getMonth() + 1).padStart(2, '0');
    const dd = String(nextBizDate.getDate()).padStart(2, '0');
    const nextBizDateStr = `${yyyy}-${mm}-${dd}`;

    setReport((prev) => ({
      ...prev,
      meetingDate: dateStr,
      meetingDayOfWeek: getJapaneseDayOfWeek(meetingDate),
      workDate: nextBizDateStr,
      workDayOfWeek: getJapaneseDayOfWeek(nextBizDate),
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  const handleWorkDateChange = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    setReport((prev) => ({
      ...prev,
      workDate: dateStr,
      workDayOfWeek: getJapaneseDayOfWeek(d),
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  const updateWorkEntry = (id: string, field: keyof WorkEntry, value: any) => {
    setReport((prev) => ({
      ...prev,
      workEntries: prev.workEntries.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry
      ),
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  const addWorkEntry = () => {
    setReport((prev) => ({
      ...prev,
      workEntries: [...prev.workEntries, createEmptyWorkEntry()],
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  const removeWorkEntry = (id: string) => {
    setConfirmModal({
      isOpen: true,
      message: 'この作業を削除しますか？',
      leftButtonLabel: '削除する',
      leftButtonClass: 'px-4 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700',
      onLeftButtonClick: () => {
        setReport((prev) => ({
          ...prev,
          workEntries: prev.workEntries.filter((e) => e.id !== id),
        }));
        setHasUnsavedChanges(true);
        setSaveStatus('idle');
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
      rightButtonLabel: 'キャンセル',
      rightButtonClass: 'px-4 py-2 bg-gray-200 text-gray-700 rounded font-bold hover:bg-gray-300',
      onRightButtonClick: () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // 【修正2】updateListEntry から 'preparationEntries' を除外
  const updateListEntry = (
    field: 'materialEntries' | 'machineryEntries' | 'safetyInstructions',
    index: number,
    value: string
  ) => {
    setReport((prev) => {
      const arr = [...prev[field]];
      arr[index] = value;
      return { ...prev, [field]: arr };
    });
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  // 【修正2】addListEntry から 'preparationEntries' を除外
  const addListEntry = (field: 'materialEntries' | 'machineryEntries') => {
    if (field === 'machineryEntries' && report.machineryEntries.length >= 10) return; // 最大10個
    setReport((prev) => ({
      ...prev,
      [field]: [...prev[field], ''],
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  // 【修正2】removeListEntry から 'preparationEntries' を除外
  const removeListEntry = (
    field: 'materialEntries' | 'machineryEntries',
    index: number
  ) => {
    setReport((prev) => {
      const arr = [...prev[field]];
      arr.splice(index, 1);
      return { ...prev, [field]: arr };
    });
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  const updateActualWorkers = (entryIndex: number, count: number) => {
    setReport((prev) => {
      const newActualWorkers = [...prev.actualWorkers];
      const existingIdx = newActualWorkers.findIndex((aw) => aw.entryIndex === entryIndex);
      if (existingIdx >= 0) {
        newActualWorkers[existingIdx] = { entryIndex, count };
      } else {
        newActualWorkers.push({ entryIndex, count });
      }
      return { ...prev, actualWorkers: newActualWorkers };
    });
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  const getActualWorkersCount = (entryIndex: number): number => {
    const found = report.actualWorkers.find((aw) => aw.entryIndex === entryIndex);
    return found ? found.count : 0;
  };

  const addStep3AdditionalWork = () => {
    setReport((prev) => ({
      ...prev,
      step3AdditionalWorkEntries: [...prev.step3AdditionalWorkEntries, createEmptyAdditionalWorkEntry()],
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  const updateStep3AdditionalWork = (id: string, field: keyof AdditionalWorkEntry, value: any) => {
    setReport((prev) => ({
      ...prev,
      step3AdditionalWorkEntries: prev.step3AdditionalWorkEntries.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry
      ),
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  const removeStep3AdditionalWork = (id: string) => {
    setConfirmModal({
      isOpen: true,
      message: 'この追加作業を削除しますか？',
      leftButtonLabel: '削除する',
      leftButtonClass: 'px-4 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700',
      onLeftButtonClick: () => {
        setReport((prev) => ({
          ...prev,
          step3AdditionalWorkEntries: prev.step3AdditionalWorkEntries.filter((e) => e.id !== id),
        }));
        setHasUnsavedChanges(true);
        setSaveStatus('idle');
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
      rightButtonLabel: 'キャンセル',
      rightButtonClass: 'px-4 py-2 bg-gray-200 text-gray-700 rounded font-bold hover:bg-gray-300',
      onRightButtonClick: () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };
  // STEP3: 独立した主要機械の追加・更新・削除（STEP1と合計10個まで）
  const addStep3Machinery = () => {
    const total = (report.machineryEntries || []).filter(m => m).length + (report.step3MachineryEntries || []).length;
    if (total >= 10) return;
    setReport((prev) => ({
      ...prev,
      step3MachineryEntries: [...(prev.step3MachineryEntries || []), ''],
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  const updateStep3Machinery = (index: number, value: string) => {
    setReport((prev) => {
      const arr = [...(prev.step3MachineryEntries || [])];
      arr[index] = value;
      return { ...prev, step3MachineryEntries: arr };
    });
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  const removeStep3Machinery = (index: number) => {
    setReport((prev) => {
      const arr = [...(prev.step3MachineryEntries || [])];
      arr.splice(index, 1);
      return { ...prev, step3MachineryEntries: arr };
    });
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };


  const addMachineToAdditionalWork = (id: string) => {
    setReport((prev) => ({
      ...prev,
      step3AdditionalWorkEntries: prev.step3AdditionalWorkEntries.map((entry) =>
        entry.id === id ? { ...entry, machines: [...entry.machines, ''] } : entry
      ),
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  const updateMachineInAdditionalWork = (entryId: string, machineIndex: number, value: string) => {
    setReport((prev) => ({
      ...prev,
      step3AdditionalWorkEntries: prev.step3AdditionalWorkEntries.map((entry) => {
        if (entry.id !== entryId) return entry;
        const newMachines = [...entry.machines];
        newMachines[machineIndex] = value;
        return { ...entry, machines: newMachines };
      }),
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  const removeMachineFromAdditionalWork = (entryId: string, machineIndex: number) => {
    setReport((prev) => ({
      ...prev,
      step3AdditionalWorkEntries: prev.step3AdditionalWorkEntries.map((entry) => {
        if (entry.id !== entryId) return entry;
        const newMachines = [...entry.machines];
        newMachines.splice(machineIndex, 1);
        return { ...entry, machines: newMachines };
      }),
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  // 【修正】基本確認事項の更新
  const updateStep3Confirmation = (key: keyof Step3ConfirmationItems, value: '良' | '否' | '') => {
    setReport((prev) => ({
      ...prev,
      step3ConfirmationItems: {
        ...prev.step3ConfirmationItems,
        [key]: prev.step3ConfirmationItems[key] === value ? '' : value,
      },
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  // 【修正】当現場確認事項の更新
  const updateStep3SiteConfirmation = (key: keyof Step3SiteConfirmationItems, value: '良' | '否' | '') => {
    setReport((prev) => ({
      ...prev,
      step3SiteConfirmationItems: {
        ...prev.step3SiteConfirmationItems,
        [key]: prev.step3SiteConfirmationItems[key] === value ? '' : value,
      },
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  const totalStep3Workers = (() => {
    let total = 0;
    report.workEntries.forEach((_, index) => {
      total += getActualWorkersCount(index);
    });
    report.step3AdditionalWorkEntries.forEach((entry) => {
      total += entry.actualWorkers;
    });
    return total;
  })();

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    if (!report.project) {
      newErrors.project = true;
      hasError = true;
    }
    if (!report.meetingConductor) {
      newErrors.meetingConductor = true;
      hasError = true;
    }

    // 【修正】10個中1つ以上選択必須（バリデーションルールの数値変更のみ）
    const hasAtLeastOneSafetyInstruction = report.safetyInstructions.some((s) => s !== '');
    if (!hasAtLeastOneSafetyInstruction) {
      newErrors.safetyInstructions = true;
      hasError = true;
    }

    if (hasError) {
      setErrors(newErrors);
      if (newErrors.safetyInstructions && !newErrors.project && !newErrors.meetingConductor) {
        alert('安全衛生指示事項を1つ以上選択してください。');
      } else if (newErrors.safetyInstructions) {
        alert('未入力の必須項目があります。\n赤枠の項目を確認してください。\n\n安全衛生指示事項を1つ以上選択してください。');
      } else {
        alert('未入力の必須項目があります。\n赤枠の項目を確認してください。');
      }
      return false;
    }

    setErrors({});
    return true;
  };

  const handleDateChangeSeparation = useCallback(() => {
    const newId = generateId();
    setDraftId(newId);
    setReport((prev) => ({
      ...prev,
      annotatedDiagramUrl: '',
      baseDiagramUrl: '',
    }));
    setCurrentDiagramSrc('');
    setDiagramLoaded(false);
    setCanvasHistory([]);
    backgroundImageRef.current = null;
    setOriginalWorkDate(report.workDate);
    setStep(2);
    setShowDateChangeConfirm(false);
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  }, [report.workDate]);

  const handleNext = () => {
    if (step === 1) {
      if (!validateStep1()) return;
      if (
        originalWorkDate !== null &&
        originalWorkDate !== report.workDate
      ) {
        setShowDateChangeConfirm(true);
        return;
      }
    }
    setStep((prev) => Math.min(prev + 1, 5));
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSave = async () => {
    if (!report.project) {
      alert('保存するには「工事名」の選択が必須です。');
      return;
    }

    let updatedReport = { ...report };
    const canvasEl = canvasElRef.current;
    if (canvasEl && canvasEl.width > 0 && canvasEl.height > 0) {
      const dataUrl = canvasEl.toDataURL('image/jpeg', 0.6);
      console.log('[handleSave] toDataURL prefix:', dataUrl.substring(0, 30));
      updatedReport = { ...updatedReport, annotatedDiagramUrl: dataUrl };
      setReport(updatedReport);
    }

    setSaveStatus('saving');
    try {
      const newId = await saveDraft(draftId, 'DAILY_SAFETY', updatedReport);
      setDraftId(newId);
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      setShowCompleteModal(true);
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || '';
      if (
        errorMessage.includes('exceeds the maximum allowed size') ||
        errorMessage.includes('INVALID_ARGUMENT') ||
        errorMessage.includes('Request payload size exceeds') ||
        errorMessage.includes('413') ||
        errorMessage.includes('too large') ||
        errorMessage.includes('size')
      ) {
        alert('配置図の画像サイズが大きすぎます。より小さい画像を使用してください。');
      } else {
        alert('保存に失敗しました');
      }
      console.error('保存エラー:', error);
      setSaveStatus('idle');
    }
  };

  const handleHomeClick = () => {
    if (hasUnsavedChanges) {
      setConfirmModal({
        isOpen: true,
        message: 'データが保存されていません！\n保存ボタンを押してください！',
        leftButtonLabel: 'ホームに戻る',
        leftButtonClass: 'px-4 py-2 bg-gray-200 text-gray-700 rounded font-bold hover:bg-gray-300',
        onLeftButtonClick: () => {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          onBackToMenu();
        },
        rightButtonLabel: '編集を続ける',
        rightButtonClass: 'px-4 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700',
        onRightButtonClick: () => {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        },
      });
    } else {
      onBackToMenu();
    }
  };

  const getErrorClass = (field: string) =>
    errors[field] ? 'border-red-500 bg-red-50' : 'border-gray-300';

  // ============================
  // STEP2: HTML Canvas API によるキャンバス初期化
  // ============================
  useEffect(() => {
    if (step !== 2) return;
    if (!diagramLoaded) return;
    if (!currentDiagramSrc) return;

    const canvasEl = canvasElRef.current;
    if (!canvasEl) return;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;

      const containerWidth = canvasContainerRef.current?.clientWidth || 800;
      const canvasWidth = Math.min(containerWidth, 800);
      const canvasHeight = Math.round(canvasWidth * (naturalH / naturalW));

      canvasEl.width = canvasWidth;
      canvasEl.height = canvasHeight;

      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

      backgroundImageRef.current = img;

      const initialSnapshot = canvasEl.toDataURL('image/jpeg', 0.6);
      setCanvasHistory([initialSnapshot]);

      console.log('[キャンバス初期化] 完了 - サイズ:', canvasWidth, 'x', canvasHeight);
    };
    img.onerror = () => {
      console.error('[キャンバス初期化] 画像読み込みエラー:', currentDiagramSrc.substring(0, 50));
    };
    img.src = currentDiagramSrc;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, diagramLoaded, currentDiagramSrc]);

  // ============================
  // STEP2: キャンバスへのフリーハンド描画イベントハンドラ
  // ============================
  const getCanvasCoordinates = (
    canvasEl: HTMLCanvasElement,
    clientX: number,
    clientY: number
  ): { x: number; y: number } => {
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width / rect.width;
    const scaleY = canvasEl.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvasEl = canvasElRef.current;
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    isDrawingRef.current = true;
    const { x, y } = getCanvasCoordinates(canvasEl, e.clientX, e.clientY);

    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvasEl = canvasElRef.current;
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(canvasEl, e.clientX, e.clientY);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleMouseUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const canvasEl = canvasElRef.current;
    if (canvasEl) {
      const snapshot = canvasEl.toDataURL('image/jpeg', 0.6);
      setCanvasHistory((prev) => [...prev, snapshot]);
    }
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvasEl = canvasElRef.current;
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    if (e.touches.length === 0) return;

    isDrawingRef.current = true;
    const touch = e.touches[0];
    const { x, y } = getCanvasCoordinates(canvasEl, touch.clientX, touch.clientY);

    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const canvasEl = canvasElRef.current;
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    if (e.touches.length === 0) return;

    const touch = e.touches[0];
    const { x, y } = getCanvasCoordinates(canvasEl, touch.clientX, touch.clientY);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const canvasEl = canvasElRef.current;
    if (canvasEl) {
      const snapshot = canvasEl.toDataURL('image/jpeg', 0.6);
      setCanvasHistory((prev) => [...prev, snapshot]);
    }
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  // ============================
  // STEP2: 配置図アップロード処理
  // ============================
  const handleDiagramUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    try {
      const compressed = await compressImage(file);
      setReport((prev) => ({ ...prev, baseDiagramUrl: compressed, annotatedDiagramUrl: '' }));
      setCurrentDiagramSrc(compressed);
      setHasUnsavedChanges(true);
      setSaveStatus('idle');
      setDiagramLoaded(true);

      if (report.project) {
        try {
          const diagramCompressed = await compressDiagramImage(file);
          await saveDiagramImage(report.project, diagramCompressed, file.name);
          console.log('[配置図元画像保存] 完了 - 工事名:', report.project, 'ファイル名:', file.name);
        } catch (saveErr: any) {
          console.error('[配置図元画像保存] 失敗:', saveErr);
          const errorMessage = saveErr?.message || saveErr?.toString() || '';
          if (
            errorMessage.includes('exceeds the maximum allowed size') ||
            errorMessage.includes('INVALID_ARGUMENT') ||
            errorMessage.includes('Request payload size exceeds') ||
            errorMessage.includes('413') ||
            errorMessage.includes('too large') ||
            errorMessage.includes('size')
          ) {
            alert('配置図の画像サイズが大きすぎます。より小さい画像を使用してください。');
          }
        }
      }
    } catch (err) {
      console.error('画像圧縮エラー', err);
      alert('画像の読み込みに失敗しました。');
    }

    if (diagramFileInputRef.current) {
      diagramFileInputRef.current.value = '';
    }
  };

  const handleOpenDiagramPicker = async () => {
    if (!report.project) {
      alert('先にSTEP1で工事名を選択してください');
      return;
    }

    setShowDiagramPicker(true);
    setDiagramPickerLoading(true);

    try {
      const images = await fetchDiagramImages(report.project);
      setDiagramImages(images);
    } catch (err) {
      console.error('配置図元画像の取得に失敗:', err);
      setDiagramImages([]);
    } finally {
      setDiagramPickerLoading(false);
    }
  };

  const handleSelectDiagramImage = (image: DiagramImage) => {
    setCurrentDiagramSrc(image.imageDataUrl);
    setDiagramLoaded(true);
    setReport((prev) => ({
      ...prev,
      baseDiagramUrl: image.imageDataUrl,
      annotatedDiagramUrl: '',
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
    setShowDiagramPicker(false);
  };

  const handleDeleteDiagramImage = async (imageId: string): Promise<void> => {
    await removeDiagramImage(imageId);
    if (report.project) {
      const updatedImages = await fetchDiagramImages(report.project);
      setDiagramImages(updatedImages);
    }
  };

  const handleUndo = () => {
    const canvasEl = canvasElRef.current;
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    setCanvasHistory((prev) => {
      if (prev.length <= 1) return prev;

      const newHistory = prev.slice(0, -1);
      const previousSnapshot = newHistory[newHistory.length - 1];

      const restoreImg = new Image();
      restoreImg.onload = () => {
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        ctx.drawImage(restoreImg, 0, 0, canvasEl.width, canvasEl.height);
      };
      restoreImg.src = previousSnapshot;

      return newHistory;
    });
  };

  const handleClearAll = () => {
    const canvasEl = canvasElRef.current;
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const bgImg = backgroundImageRef.current;
    if (bgImg) {
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      ctx.drawImage(bgImg, 0, 0, canvasEl.width, canvasEl.height);

      const bgSnapshot = canvasEl.toDataURL('image/jpeg', 0.6);
      setCanvasHistory([bgSnapshot]);
    }
  };

  const handleSaveCanvas = async () => {
    if (!report.project) {
      alert('保存するには「工事名」の選択が必須です。');
      return;
    }

    const canvasEl = canvasElRef.current;
    if (!canvasEl || canvasEl.width === 0 || canvasEl.height === 0) {
      await handleSave();
      return;
    }

    const dataUrl = canvasEl.toDataURL('image/jpeg', 0.6);
    console.log('[handleSaveCanvas] toDataURL prefix:', dataUrl.substring(0, 30));

    const updatedReport = { ...report, annotatedDiagramUrl: dataUrl };
    setReport(updatedReport);

    setSaveStatus('saving');
    try {
      const newId = await saveDraft(draftId, 'DAILY_SAFETY', updatedReport);
      setDraftId(newId);
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      setShowCompleteModal(true);
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || '';
      if (
        errorMessage.includes('exceeds the maximum allowed size') ||
        errorMessage.includes('INVALID_ARGUMENT') ||
        errorMessage.includes('Request payload size exceeds') ||
        errorMessage.includes('413') ||
        errorMessage.includes('too large') ||
        errorMessage.includes('size')
      ) {
        alert('配置図の画像サイズが大きすぎます。より小さい画像を使用してください。');
      } else {
        alert('保存に失敗しました');
      }
      console.error('保存エラー:', error);
      setSaveStatus('idle');
    }
  };

  // ============================
  // 【修正】STEP5: プレビューボタンのハンドラ — モーダル表示に変更
  // ============================
  const handlePreview = () => {
    setShowPreview(true);
  };

  // ============================
  // 【追加】印刷ボタンのハンドラ
  // ============================
  const handlePrint = () => {
    window.print();
  };

  // ============================
  // STEP1 レンダリング
  // ============================
  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800 border-l-4 border-pink-500 pl-3">
        STEP 1: 作業内容
      </h2>

      {/* (1) 工事名 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">
          工事名 <span className="text-red-500 text-xs">*必須</span>
        </label>
        <select
          className={`w-full p-3 border rounded-lg bg-white text-black outline-none appearance-none ${getErrorClass('project')}`}
          value={report.project}
          onChange={(e) => updateReport('project', e.target.value)}
        >
          <option value="">選択してください</option>
          {masterData.projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* (2) 打合せ実施者 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">
          打合せ実施者 <span className="text-red-500 text-xs">*必須</span>
        </label>
        <select
          className={`w-full p-3 border rounded-lg bg-white text-black outline-none appearance-none ${getErrorClass('meetingConductor')}`}
          value={report.meetingConductor}
          onChange={(e) => updateReport('meetingConductor', e.target.value)}
        >
          <option value="">選択してください</option>
          {masterData.supervisors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* (3) 打合せ日 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">打合せ日</label>
        <div className="flex items-center gap-3">
          <input
            type="date"
            className="flex-1 p-3 border border-gray-300 rounded-lg bg-white text-black outline-none appearance-none"
            value={report.meetingDate}
            onChange={(e) => handleMeetingDateChange(e.target.value)}
          />
          <span className="text-sm font-bold text-gray-600 bg-gray-100 px-3 py-2 rounded-lg whitespace-nowrap">
            {report.meetingDayOfWeek}曜日
          </span>
        </div>
      </div>

      {/* (4) 作業日 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">作業日</label>
        <div className="flex items-center gap-3">
          <input
            type="date"
            className="flex-1 p-3 border border-gray-300 rounded-lg bg-white text-black outline-none appearance-none"
            value={report.workDate}
            onChange={(e) => handleWorkDateChange(e.target.value)}
          />
          <span className="text-sm font-bold text-gray-600 bg-gray-100 px-3 py-2 rounded-lg whitespace-nowrap">
            {report.workDayOfWeek}曜日
          </span>
        </div>
      </div>

      {/* (5) 作業内容セット */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">
          作業内容 <span className="text-red-500 text-xs">*1セット以上必須</span>
        </label>

        <div className="space-y-4">
          {report.workEntries.map((entry, index) => (
            <div key={entry.id} className="bg-gray-50 rounded-lg p-4 relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-pink-600">
                  作業{toCircledNumber(index + 1)}
                </span>
                {report.workEntries.length > 1 && (
                  <button
                    onClick={() => removeWorkEntry(entry.id)}
                    className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                    title="この作業を削除"
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-600 mb-1">作業内容</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded bg-white text-black outline-none text-sm"
                    placeholder="記入してください"
                    value={entry.workContent}
                    onChange={(e) => updateWorkEntry(entry.id, 'workContent', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">会社名</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded bg-white text-black outline-none appearance-none text-sm"
                    value={entry.company}
                    onChange={(e) => updateWorkEntry(entry.id, 'company', e.target.value)}
                  >
                    <option value="">選択してください</option>
                    {masterData.contractors.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">人数（予定）</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded bg-white text-black outline-none appearance-none text-sm"
                    value={entry.plannedWorkers}
                    onChange={(e) =>
                      updateWorkEntry(entry.id, 'plannedWorkers', parseInt(e.target.value))
                    }
                  >
                    {Array.from({ length: 50 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}名
                      </option>
                    ))}
                  </select>
                </div>

              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addWorkEntry}
          className="mt-3 w-full py-2 border-2 border-dashed border-pink-300 text-pink-600 rounded-lg font-bold hover:bg-pink-50 transition-colors text-sm"
        >
          <i className="fa-solid fa-plus mr-2"></i>作業を追加
        </button>
      </div>

      {/* (5.5) 主要機械（独立入力） */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">主要機械（任意）</label>
        {(report.machineryEntries || ['']).map((val, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-2">
            <select
              className="flex-1 p-2 border border-gray-300 rounded bg-white text-black outline-none appearance-none text-sm"
              value={val}
              onChange={(e) => updateListEntry('machineryEntries', idx, e.target.value)}
            >
              <option value="">選択してください</option>
              {masterData.machines.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button
              onClick={() => removeListEntry('machineryEntries', idx)}
              className="text-gray-400 hover:text-red-500 p-1 transition-colors shrink-0"
              title="削除"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        ))}
        {(report.machineryEntries || []).length < 10 && (
          <button
            onClick={() => addListEntry('machineryEntries')}
            className="text-sm text-pink-600 font-bold hover:underline"
          >
            <i className="fa-solid fa-plus mr-1"></i>追加
          </button>
        )}
      </div>

      {/* (6) 搬出入資機材 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">搬出入資機材（任意）</label>
        {report.materialEntries.map((val, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-2">
            <select
              className="flex-1 p-2 border border-gray-300 rounded bg-white text-black outline-none appearance-none text-sm"
              value={val}
              onChange={(e) => updateListEntry('materialEntries', idx, e.target.value)}
            >
              <option value="">選択してください</option>
              {masterData.equipment.map((eq) => (
                <option key={eq} value={eq}>
                  {eq}
                </option>
              ))}
            </select>
            <button
              onClick={() => removeListEntry('materialEntries', idx)}
              className="text-gray-400 hover:text-red-500 p-1 transition-colors shrink-0"
              title="削除"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        ))}
        <button
          onClick={() => addListEntry('materialEntries')}
          className="text-sm text-pink-600 font-bold hover:underline"
        >
          <i className="fa-solid fa-plus mr-1"></i>追加
        </button>
      </div>

      {/* 【修正2】段取り資材等の入力UIを完全削除 */}

      {/* (8) 安全衛生指示事項 — 【修正】10個固定表示 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">
          安全衛生指示事項 <span className="text-red-500 text-xs">*1つ以上選択必須</span>
        </label>
        {report.safetyInstructions.map((val, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-gray-500 w-6 text-right shrink-0">
              {idx + 1}.
            </span>
            <select
              className={`flex-1 p-2 border rounded bg-white text-black outline-none appearance-none text-sm ${
                errors.safetyInstructions ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
              value={val}
              onChange={(e) => updateListEntry('safetyInstructions', idx, e.target.value)}
            >
              <option value="">選択してください</option>
              {masterData.safetyInstructionItems.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );

  // ============================
  // STEP2 レンダリング
  // ============================
  const renderStep2 = () => {
    const hasDiagram = diagramLoaded && !!(currentDiagramSrc);

    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-800 border-l-4 border-pink-500 pl-3">
          STEP 2: 配置図・略図
        </h2>

        <div className="bg-pink-50 border border-pink-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-bold text-gray-700">
            <i className="fa-solid fa-image mr-2 text-pink-500"></i>
            配置図を選択してください
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex-1 cursor-pointer">
              <div className="py-3 px-4 bg-pink-600 text-white rounded-lg font-bold text-center hover:bg-pink-700 transition-colors text-sm">
                <i className="fa-solid fa-upload mr-2"></i>
                新しい配置図をアップロード
              </div>
              <input
                ref={diagramFileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleDiagramUpload}
              />
            </label>

            <button
              onClick={handleOpenDiagramPicker}
              className="flex-1 py-3 px-4 bg-gray-600 text-white rounded-lg font-bold text-center text-sm hover:bg-gray-700 transition-colors"
            >
              <i className="fa-solid fa-images mr-2"></i>
              保存済みの配置図から選択
            </button>
          </div>
        </div>

        {hasDiagram ? (
          <>
            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-gray-500 mr-1">色:</span>
                  {[
                    { color: '#ff0000', label: '赤' },
                    { color: '#0000ff', label: '青' },
                    { color: '#000000', label: '黒' },
                    { color: '#008000', label: '緑' },
                  ].map((item) => (
                    <button
                      key={item.color}
                      onClick={() => setPenColor(item.color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        penColor === item.color
                          ? 'border-gray-800 scale-110 shadow-md'
                          : 'border-gray-300 hover:border-gray-500'
                      }`}
                      style={{ backgroundColor: item.color }}
                      title={item.label}
                    />
                  ))}
                </div>

                <div className="w-px h-8 bg-gray-200 hidden sm:block"></div>

                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-gray-500 mr-1">太さ:</span>
                  {[
                    { width: 2, label: '細' },
                    { width: 4, label: '中' },
                    { width: 8, label: '太' },
                  ].map((item) => (
                    <button
                      key={item.width}
                      onClick={() => setPenWidth(item.width)}
                      className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                        penWidth === item.width
                          ? 'bg-pink-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="w-px h-8 bg-gray-200 hidden sm:block"></div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleUndo}
                    className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-bold hover:bg-yellow-200 transition-colors"
                  >
                    <i className="fa-solid fa-rotate-left mr-1"></i>戻す
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="px-3 py-1 bg-red-100 text-red-600 rounded text-xs font-bold hover:bg-red-200 transition-colors"
                  >
                    <i className="fa-solid fa-eraser mr-1"></i>全消去
                  </button>
                </div>
              </div>
            </div>

            <div
              ref={canvasContainerRef}
              style={{ maxWidth: '800px', width: '100%', margin: '0 auto' }}
            >
              <canvas
                ref={canvasElRef}
                className="border border-gray-300 rounded-lg shadow-sm"
                style={{ width: '100%', height: 'auto', touchAction: 'none' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
              />
            </div>
          </>
        ) : (
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
            <i className="fa-solid fa-map text-5xl text-gray-300 mb-4 block"></i>
            <p className="text-gray-400 font-bold text-sm">
              配置図をアップロードまたは選択してください
            </p>
          </div>
        )}
      </div>
    );
  };

  // ============================
  // STEP3 レンダリング — 当日作業確認
  // ============================
  const renderStep3 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800 border-l-4 border-pink-500 pl-3">
        STEP 3: 当日作業確認
      </h2>

      {/* ===== セクション1: 作業内容と実施人数 ===== */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-base font-bold text-gray-800 mb-3">
          <i className="fa-solid fa-clipboard-list mr-2 text-pink-500"></i>
          作業内容と実施人数
        </h3>

        <div className="space-y-4">
          {report.workEntries.map((entry, index) => (
            <div key={entry.id} className="bg-gray-50 rounded-lg p-4">
              <div className="mb-3">
                <span className="text-sm font-bold text-pink-600">
                  作業{toCircledNumber(index + 1)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-600 mb-1">作業内容</label>
                  <div className="w-full p-2 border border-gray-200 rounded bg-gray-100 text-gray-700 text-sm">
                    {entry.workContent || '（未入力）'}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">会社名</label>
                  <div className="w-full p-2 border border-gray-200 rounded bg-gray-100 text-gray-700 text-sm">
                    {entry.company || '（未選択）'}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">計画人数</label>
                  <div className="w-full p-2 border border-gray-200 rounded bg-gray-100 text-gray-700 text-sm">
                    {entry.plannedWorkers}名
                  </div>
                </div>

                {/* 主要機械は独立セクションに移動済み */}

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    実施人数 <span className="text-pink-500">（当日入力）</span>
                  </label>
                  <select
                    className="w-full p-2 border border-pink-300 rounded bg-white text-black outline-none appearance-none text-sm"
                    value={getActualWorkersCount(index)}
                    onChange={(e) => updateActualWorkers(index, parseInt(e.target.value))}
                  >
                    <option value={0}>選択してください</option>
                    {Array.from({ length: 50 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}名
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== セクション2: 追加作業 ===== */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-base font-bold text-gray-800 mb-3">
          <i className="fa-solid fa-plus-circle mr-2 text-pink-500"></i>
          追加作業
        </h3>

        <div className="space-y-4">
          {report.step3AdditionalWorkEntries.map((entry, index) => (
            <div key={entry.id} className="bg-gray-50 rounded-lg p-4 relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-pink-600">
                  追加作業{toCircledNumber(index + 1)}
                </span>
                <button
                  onClick={() => removeStep3AdditionalWork(entry.id)}
                  className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                  title="この追加作業を削除"
                >
                  <i className="fa-solid fa-trash"></i>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-600 mb-1">作業内容</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded bg-white text-black outline-none text-sm"
                    placeholder="作業内容を入力"
                    value={entry.description}
                    onChange={(e) => updateStep3AdditionalWork(entry.id, 'description', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">会社名</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded bg-white text-black outline-none appearance-none text-sm"
                    value={entry.company}
                    onChange={(e) => updateStep3AdditionalWork(entry.id, 'company', e.target.value)}
                  >
                    <option value="">選択してください</option>
                    {masterData.contractors.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">実施人数</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded bg-white text-black outline-none appearance-none text-sm"
                    value={entry.actualWorkers}
                    onChange={(e) => updateStep3AdditionalWork(entry.id, 'actualWorkers', parseInt(e.target.value))}
                  >
                    {Array.from({ length: 50 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}名
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-600 mb-1">主要機械</label>
                  {entry.machines.map((machine, machineIdx) => (
                    <div key={machineIdx} className="flex items-center gap-2 mb-2">
                      <select
                        className="flex-1 p-2 border border-gray-300 rounded bg-white text-black outline-none appearance-none text-sm"
                        value={machine}
                        onChange={(e) => updateMachineInAdditionalWork(entry.id, machineIdx, e.target.value)}
                      >
                        <option value="">選択してください</option>
                        {masterData.machines.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeMachineFromAdditionalWork(entry.id, machineIdx)}
                        className="text-gray-400 hover:text-red-500 p-1 transition-colors shrink-0"
                        title="削除"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addMachineToAdditionalWork(entry.id)}
                    className="text-sm text-pink-600 font-bold hover:underline"
                  >
                    <i className="fa-solid fa-plus mr-1"></i>追加
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addStep3AdditionalWork}
          className="mt-3 w-full py-2 border-2 border-dashed border-pink-300 text-pink-600 rounded-lg font-bold hover:bg-pink-50 transition-colors text-sm"
        >
          <i className="fa-solid fa-plus mr-2"></i>追加作業を追加
        </button>
      </div>

      {/* STEP3: 独立した主要機械入力欄（STEP1と合計10個まで） */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-base font-bold text-gray-800 mb-3">
          <i className="fa-solid fa-truck-monster mr-2 text-pink-500"></i>
          追加 主要機械（STEP1と合計10個まで）
        </h3>
        <p className="text-xs text-gray-500 mb-2">
          STEP1で{(report.machineryEntries || []).filter(m => m).length}個選択済み / 残り{Math.max(0, 10 - (report.machineryEntries || []).filter(m => m).length - (report.step3MachineryEntries || []).length)}個追加可能
        </p>
        {(report.step3MachineryEntries || []).map((val, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-2">
            <select
              className="flex-1 p-2 border border-gray-300 rounded bg-white text-black outline-none appearance-none text-sm"
              value={val}
              onChange={(e) => updateStep3Machinery(idx, e.target.value)}
            >
              <option value="">選択してください</option>
              {masterData.machines.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <button
              onClick={() => removeStep3Machinery(idx)}
              className="text-gray-400 hover:text-red-500 p-1 transition-colors shrink-0"
              title="削除"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        ))}
        {((report.machineryEntries || []).filter(m => m).length + (report.step3MachineryEntries || []).length) < 10 && (
          <button
            onClick={addStep3Machinery}
            className="text-sm text-pink-600 font-bold hover:underline"
          >
            <i className="fa-solid fa-plus mr-1"></i>追加
          </button>
        )}
      </div>

      {/* 本日の作業人数合計 */}
      <div className="p-3 bg-pink-50 border border-pink-200 rounded-lg flex items-center justify-between">
        <span className="text-sm font-bold text-gray-700">
          <i className="fa-solid fa-users mr-2 text-pink-500"></i>
          本日の作業人数合計
        </span>
        <span className="text-lg font-bold text-pink-600">
          {totalStep3Workers}人
        </span>
      </div>

      {/* ===== セクション3: 基本確認事項 ===== */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-base font-bold text-gray-800 mb-3">
          <i className="fa-solid fa-check-double mr-2 text-pink-500"></i>
          基本確認事項
        </h3>

        <div className="space-y-3">
          {STEP3_CONFIRMATION_LABELS.map((item, index) => (
            <div
              key={item.key}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-start gap-2 flex-1 mr-3">
                <span className="text-xs font-bold text-gray-500 shrink-0 mt-0.5">
                  {index + 1}.
                </span>
                <span className="text-sm text-gray-700">{item.label}</span>
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => updateStep3Confirmation(item.key, '良')}
                  className={`px-4 py-1.5 rounded font-bold text-sm border transition-colors ${
                    report.step3ConfirmationItems[item.key] === '良'
                      ? 'bg-pink-500 text-white border-pink-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-pink-300'
                  }`}
                >
                  良
                </button>
                <button
                  onClick={() => updateStep3Confirmation(item.key, '否')}
                  className={`px-4 py-1.5 rounded font-bold text-sm border transition-colors ${
                    report.step3ConfirmationItems[item.key] === '否'
                      ? 'bg-red-500 text-white border-red-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-red-300'
                  }`}
                >
                  否
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== セクション4: 当現場確認事項 ===== */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-base font-bold text-gray-800 mb-3">
          <i className="fa-solid fa-hard-hat mr-2 text-pink-500"></i>
          当現場確認事項
        </h3>

        <div className="space-y-3">
          {STEP3_SITE_CONFIRMATION_LABELS.map((item, index) => (
            <div
              key={item.key}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-start gap-2 flex-1 mr-3">
                <span className="text-xs font-bold text-gray-500 shrink-0 mt-0.5">
                  {index + 1}.
                </span>
                <span className="text-sm text-gray-700">{item.label}</span>
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => updateStep3SiteConfirmation(item.key, '良')}
                  className={`px-4 py-1.5 rounded font-bold text-sm border transition-colors ${
                    report.step3SiteConfirmationItems[item.key] === '良'
                      ? 'bg-pink-500 text-white border-pink-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-pink-300'
                  }`}
                >
                  良
                </button>
                <button
                  onClick={() => updateStep3SiteConfirmation(item.key, '否')}
                  className={`px-4 py-1.5 rounded font-bold text-sm border transition-colors ${
                    report.step3SiteConfirmationItems[item.key] === '否'
                      ? 'bg-red-500 text-white border-red-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-red-300'
                  }`}
                >
                  否
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== セクション5: 段階確認・立会確認 ===== */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-base font-bold text-gray-800 mb-3">
          <i className="fa-solid fa-clipboard-check mr-2 text-pink-500"></i>
          段階確認・立会確認
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">段階確認</label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  updateReport(
                    'stageConfirmation',
                    report.stageConfirmation === '有' ? '' : '有'
                  );
                }}
                className={`flex-1 px-4 py-2 rounded font-bold text-sm border transition-colors ${
                  report.stageConfirmation === '有'
                    ? 'bg-pink-500 text-white border-pink-500'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-pink-300'
                }`}
              >
                有
              </button>
              <button
                onClick={() => {
                  updateReport(
                    'stageConfirmation',
                    report.stageConfirmation === '無' ? '' : '無'
                  );
                }}
                className={`flex-1 px-4 py-2 rounded font-bold text-sm border transition-colors ${
                  report.stageConfirmation === '無'
                    ? 'bg-pink-500 text-white border-pink-500'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-pink-300'
                }`}
              >
                無
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">立会確認</label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  updateReport(
                    'witnessConfirmation',
                    report.witnessConfirmation === '有' ? '' : '有'
                  );
                }}
                className={`flex-1 px-4 py-2 rounded font-bold text-sm border transition-colors ${
                  report.witnessConfirmation === '有'
                    ? 'bg-pink-500 text-white border-pink-500'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-pink-300'
                }`}
              >
                有
              </button>
              <button
                onClick={() => {
                  updateReport(
                    'witnessConfirmation',
                    report.witnessConfirmation === '無' ? '' : '無'
                  );
                }}
                className={`flex-1 px-4 py-2 rounded font-bold text-sm border transition-colors ${
                  report.witnessConfirmation === '無'
                    ? 'bg-pink-500 text-white border-pink-500'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-pink-300'
                }`}
              >
                無
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== セクション6: ダンプ台数 ===== */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-base font-bold text-gray-800 mb-3">
          <i className="fa-solid fa-truck mr-2 text-pink-500"></i>
          ダンプ台数
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">搬入</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                className="flex-1 p-2 border border-gray-300 rounded bg-white text-black outline-none text-sm"
                placeholder="0"
                value={report.dumpTrucks.incoming === 0 ? '' : report.dumpTrucks.incoming}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  updateReport('dumpTrucks', {
                    ...report.dumpTrucks,
                    incoming: Math.max(0, val),
                  });
                }}
              />
              <span className="text-sm font-bold text-gray-600 shrink-0">台</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">搬出</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                className="flex-1 p-2 border border-gray-300 rounded bg-white text-black outline-none text-sm"
                placeholder="0"
                value={report.dumpTrucks.outgoing === 0 ? '' : report.dumpTrucks.outgoing}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  updateReport('dumpTrucks', {
                    ...report.dumpTrucks,
                    outgoing: Math.max(0, val),
                  });
                }}
              />
              <span className="text-sm font-bold text-gray-600 shrink-0">台</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ============================
  // STEP4 レンダリング — 巡視記録
  // ============================
  const renderStep4 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800 border-l-4 border-pink-500 pl-3">
        STEP 4: 巡視記録
      </h2>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-base font-bold text-gray-800 mb-3">
          <i className="fa-solid fa-clipboard mr-2 text-pink-500"></i>
          作業調整事項
        </h3>
        <textarea
          className="w-full p-2 border border-gray-300 rounded-md bg-white text-black outline-none text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
          rows={4}
          placeholder="作業調整事項を入力"
          value={report.patrolRecord.coordinationNotes}
          onChange={(e) => updatePatrolRecord('coordinationNotes', e.target.value)}
        />
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-base font-bold text-gray-800 mb-3">
          <i className="fa-solid fa-user-check mr-2 text-pink-500"></i>
          巡視点検者
        </h3>
        <select
          className="w-full p-2 border border-gray-300 rounded-md bg-white text-black outline-none appearance-none text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
          value={report.patrolRecord.inspector}
          onChange={(e) => updatePatrolRecord('inspector', e.target.value)}
        >
          <option value="">選択してください</option>
          {masterData.supervisors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-base font-bold text-gray-800 mb-3">
          <i className="fa-solid fa-clock mr-2 text-pink-500"></i>
          巡視時間
        </h3>
        <select
          className="w-full p-2 border border-gray-300 rounded-md bg-white text-black outline-none appearance-none text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
          value={report.patrolRecord.inspectionTime}
          onChange={(e) => updatePatrolRecord('inspectionTime', e.target.value)}
        >
          {PATROL_TIME_OPTIONS.map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-base font-bold text-gray-800 mb-3">
          <i className="fa-solid fa-pen-to-square mr-2 text-pink-500"></i>
          所見
        </h3>
        <textarea
          className="w-full p-2 border border-gray-300 rounded-md bg-white text-black outline-none text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
          rows={6}
          placeholder="所見を入力"
          value={report.patrolRecord.findings}
          onChange={(e) => updatePatrolRecord('findings', e.target.value)}
        />
      </div>
    </div>
  );

  // ============================
  // STEP5 レンダリング — 点検チェックリスト
  // ============================
  const renderStep5 = () => {
    // 固定項目の通し番号を計算するためのカウンター
    let fixedItemCounter = 0;

    return (
      <div className="space-y-6">
        {/* ヘッダー */}
        <h2 className="text-xl font-bold text-gray-800 border-l-4 border-pink-500 pl-3">
          STEP 5: 点検チェックリスト
        </h2>

        {/* 凡例表示 */}
        <div className="bg-gray-100 rounded p-2 text-sm text-center mb-4">
          <span className="font-bold">○</span> 適正　
          <span className="font-bold">△</span> 一部適正　
          <span className="font-bold">×</span> 不適切　
          <span className="font-bold">◎</span> 是正済　
          <span className="font-bold">無印</span> 該当無
        </div>

        {/* 各大分類セクション */}
        {STEP5_CATEGORIES.map((category) => {
          // この大分類の固定項目番号をリセット
          fixedItemCounter = 0;

          return (
            <div key={category.key} className="bg-white rounded-lg shadow mb-4">
              {/* セクションタイトル */}
              <div className="bg-pink-100 font-bold p-2 rounded-t-lg text-gray-800">
                {category.title}
              </div>

              {/* 各項目 */}
              <div className="p-2">
                {report.step5InspectionChecklist[category.key].map((item, itemIndex) => {
                  // 固定項目のカウント（自由記入欄でない場合）
                  if (!item.isCustom) {
                    fixedItemCounter++;
                  }
                  const displayNumber = !item.isCustom ? fixedItemCounter : 0;

                  return (
                    <div
                      key={`${category.key}-${itemIndex}`}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 border-b border-gray-200 last:border-b-0 gap-1 sm:gap-2"
                    >
                      {/* 左側: 番号（または＋マーク） + 項目名 */}
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        {/* 番号表示 */}
                        <span className="text-xs font-bold text-gray-500 shrink-0 mt-0.5 w-6 text-right">
                          {item.isCustom ? '＋' : `${displayNumber}.`}
                        </span>

                        {/* 項目名: 固定項目は読み取り専用テキスト、自由記入欄はテキスト入力 */}
                        {item.isCustom ? (
                          <input
                            type="text"
                            className="flex-1 p-1 border border-dashed border-gray-300 rounded bg-white text-black outline-none text-sm min-w-0"
                            placeholder="項目を入力"
                            value={item.label}
                            onChange={(e) =>
                              updateStep5ItemLabel(category.key, itemIndex, e.target.value)
                            }
                          />
                        ) : (
                          <span className="text-sm text-gray-700 break-words">
                            {item.label}
                          </span>
                        )}
                      </div>

                      {/* 右側: ドロップダウン（4択 + 無印） */}
                      <div className="shrink-0 pl-8 sm:pl-0">
                        <select
                          className="w-20 p-1 border border-gray-300 rounded text-center text-sm bg-white text-black outline-none appearance-none"
                          value={item.value}
                          onChange={(e) =>
                            updateStep5ItemValue(
                              category.key,
                              itemIndex,
                              e.target.value as Step5InspectionItem['value']
                            )
                          }
                        >
                          {INSPECTION_VALUES.map((v) => (
                            <option key={v} value={v}>
                              {v === '' ? '　' : v}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ============================
  // メインレンダリング
  // ============================
  return (
    <>
      {/* 【追加】印刷用CSS — 操作バー非表示・帳票のみ表示 */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          @page {
            size: A4 landscape;
            margin: 0;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div className="no-print min-h-screen pb-24 bg-gray-50">
        <header className="bg-slate-800 text-white p-4 shadow-md sticky top-0 z-10 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={handleHomeClick} className="text-white hover:text-gray-300">
              <i className="fa-solid fa-house"></i>
            </button>
            <h1 className="text-lg font-bold">
              <i className="fa-solid fa-book-medical mr-2"></i>安全衛生日誌
            </h1>
          </div>
        </header>

        <div className="bg-white p-4 shadow-sm mb-4">
          <div className="flex justify-between text-xs font-bold text-gray-400 mb-2">
            <span className={step >= 1 ? 'text-pink-600' : ''}>STEP 1</span>
            <span className={step >= 2 ? 'text-pink-600' : ''}>STEP 2</span>
            <span className={step >= 3 ? 'text-pink-600' : ''}>STEP 3</span>
            <span className={step >= 4 ? 'text-pink-600' : ''}>STEP 4</span>
            <span className={step >= 5 ? 'text-pink-600' : ''}>STEP 5</span>
          </div>
          <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-pink-600 h-full transition-all duration-300"
              style={{ width: `${step * 20}%` }}
            ></div>
          </div>
        </div>

        <main className="mx-auto p-4 bg-white shadow-lg rounded-lg min-h-[60vh] max-w-3xl">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
        </main>

        {/* フッター: STEP5では「次へ」の代わりに「プレビュー」ボタンを表示 */}
        <footer className="fixed bottom-0 left-0 w-full bg-white border-t p-4 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
          <div className="flex items-center gap-2">
            <button
              onClick={handleBack}
              disabled={step === 1}
              className={`px-4 py-3 rounded-lg font-bold ${
                step === 1 ? 'text-gray-300' : 'text-gray-600 bg-gray-100'
              }`}
            >
              戻る
            </button>
            {step === 2 && diagramLoaded ? (
              <button
                onClick={handleSaveCanvas}
                className="px-4 py-3 rounded-lg font-bold border border-pink-200 text-pink-600 bg-pink-50 hover:bg-pink-100 flex items-center"
              >
                <i className={`fa-solid ${saveStatus === 'saved' ? 'fa-check' : 'fa-save'} mr-2`}></i>
                {saveStatus === 'saved' ? '保存完了' : '一時保存'}
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="px-4 py-3 rounded-lg font-bold border border-pink-200 text-pink-600 bg-pink-50 hover:bg-pink-100 flex items-center"
              >
                <i className={`fa-solid ${saveStatus === 'saved' ? 'fa-check' : 'fa-save'} mr-2`}></i>
                {saveStatus === 'saved' ? '保存完了' : '保存'}
              </button>
            )}
          </div>

          {/* STEP5の場合は「プレビュー」ボタン、それ以外は「次へ」ボタン */}
          {step === 5 ? (
            <button
              onClick={handlePreview}
              className="px-8 py-3 rounded-lg font-bold shadow flex items-center bg-pink-600 text-white hover:bg-pink-700"
            >
              <i className="fa-solid fa-eye mr-2"></i>プレビュー
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-8 py-3 rounded-lg font-bold shadow flex items-center bg-pink-600 text-white hover:bg-pink-700"
            >
              次へ <i className="fa-solid fa-chevron-right ml-2"></i>
            </button>
          )}
        </footer>
      </div>

      {/* ============================
          【追加】プレビューモーダル（フルスクリーン）
          印刷時は操作バーを非表示にし、帳票部分のみ出力する
          ============================ */}
      {showPreview && (
        <div className="fixed inset-0 z-[80] bg-white flex flex-col">
          {/* 操作バー（印刷時は非表示） */}
          <div className="no-print flex items-center justify-between px-4 py-3 bg-slate-800 text-white shadow-md shrink-0">
            <button
              onClick={() => setShowPreview(false)}
              className="flex items-center gap-2 text-white hover:text-gray-300 font-bold text-sm"
            >
              <i className="fa-solid fa-arrow-left"></i>
              閉じる
            </button>
            <button
              onClick={handlePrint}
              className="px-6 py-2 bg-pink-600 text-white rounded-lg font-bold text-sm hover:bg-pink-700 transition-colors shadow"
            >
              <i className="fa-solid fa-print mr-2"></i>印刷
            </button>
          </div>

          {/* 帳票プレビュー（スクロール可能・中央寄せ） */}
          <div className="flex-1 overflow-auto bg-gray-200 p-4">
            <div className="flex justify-center">
              <div className="shadow-2xl">
                <DailySafetyPrintLayout data={report} />
              </div>
            </div>
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

      {/* 【修正】作業日変更確認ダイアログ */}
      <ConfirmationModal
        isOpen={showDateChangeConfirm}
        message={'作業日が変更されました。新しい日誌として作成します。\nSTEP2以降は初期状態に戻ります。よろしいですか？'}
        onLeftButtonClick={handleDateChangeSeparation}
        onRightButtonClick={() => setShowDateChangeConfirm(false)}
        leftButtonLabel="はい"
        rightButtonLabel="いいえ"
        leftButtonClass="px-4 py-2 bg-pink-600 text-white rounded font-bold hover:bg-pink-700"
        rightButtonClass="px-4 py-2 bg-gray-200 text-gray-700 rounded font-bold hover:bg-gray-300"
      />

      {/* 【修正1】保存済み配置図選択モーダル — インライン削除確認UI搭載 */}
      <DiagramPickerModal
        isOpen={showDiagramPicker}
        images={diagramImages}
        isLoading={diagramPickerLoading}
        onSelect={handleSelectDiagramImage}
        onDelete={handleDeleteDiagramImage}
        onClose={() => setShowDiagramPicker(false)}
      />
    </>
  );
};

// ============================
// 丸数字変換ヘルパー
// ============================
function toCircledNumber(n: number): string {
  const circled = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
    '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];
  if (n >= 1 && n <= 20) return circled[n - 1];
  return `(${n})`;
}

export default DailySafetyWizard;
