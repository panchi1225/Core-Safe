// src/components/DailySafetyWizard.tsx
// 安全衛生日誌（作業打合せ及び安全衛生日誌）ウィザード
// STEP1: 作業内容入力、STEP2: 配置図・略図、STEP3〜5: 未実装プレースホルダー

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MasterData,
  DailySafetyReportData,
  WorkEntry,
  DiagramImage,
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
  // 【修正1】削除対象のIDをモーダル内stateで管理
  const [deletingDiagramId, setDeletingDiagramId] = useState<string | null>(null);
  // 削除処理中フラグ
  const [isDeleting, setIsDeleting] = useState(false);

  // モーダルが閉じた時にリセット
  useEffect(() => {
    if (!isOpen) {
      setDeletingDiagramId(null);
      setIsDeleting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 日時フォーマットヘルパー
  const formatDate = (ms: number): string => {
    const d = new Date(ms);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
  };

  // 【修正1】インライン削除確認の「はい」ボタン処理
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
        {/* ヘッダー */}
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

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            /* ローディング表示 */
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-500 text-sm font-bold">読み込み中...</p>
            </div>
          ) : images.length === 0 ? (
            /* 0件の場合 */
            <div className="text-center py-12">
              <i className="fa-solid fa-folder-open text-4xl text-gray-300 mb-4 block"></i>
              <p className="text-gray-400 font-bold text-sm">
                この現場の保存済み配置図はありません
              </p>
            </div>
          ) : (
            /* サムネイルグリッド: 2列表示（スマホは1列） */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="border border-gray-200 rounded-lg p-3 hover:border-pink-300 hover:shadow-md transition-all bg-gray-50"
                >
                  {/* 【修正1】削除確認中はインライン確認UIを表示 */}
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
                      {/* サムネイル画像 */}
                      <div className="flex justify-center mb-2">
                        <img
                          src={img.imageDataUrl}
                          alt={img.fileName}
                          className="w-24 h-24 object-cover rounded border border-gray-200 bg-white"
                        />
                      </div>
                      {/* ファイル名 */}
                      <p className="text-xs text-gray-700 font-bold truncate text-center mb-1" title={img.fileName}>
                        {img.fileName}
                      </p>
                      {/* アップロード日時 */}
                      <p className="text-[10px] text-gray-400 text-center mb-2">
                        {formatDate(img.createdAt)}
                      </p>
                      {/* 操作ボタン */}
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

        {/* フッター */}
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
// 空の作業内容エントリ生成
// ============================
function createEmptyWorkEntry(): WorkEntry {
  return {
    id: generateId(),
    workContent: '',
    company: '',
    plannedWorkers: 1,
    actualWorkers: 0,
    machine: '',
    isAdditional: false,
  };
}

// ============================
// 安全衛生指示事項の固定数
// ============================
const SAFETY_INSTRUCTIONS_COUNT = 7;

// ============================
// 【修正B】画像サイズエラー判定ヘルパー
// Firestoreドキュメントサイズ制限やペイロードサイズ超過を検出する
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
  // --- ステップ管理 ---
  const [step, setStep] = useState(1);

  // --- レポートデータ ---
  const [report, setReport] = useState<DailySafetyReportData>(() => {
    if (initialData) {
      // 一時保存データから復元時、safetyInstructions を7個に正規化
      const restored = { ...initialData };
      const si = restored.safetyInstructions || [];
      // 7個未満なら空文字で埋め、7個を超えていれば切り詰め
      restored.safetyInstructions = Array.from(
        { length: SAFETY_INSTRUCTIONS_COUNT },
        (_, i) => si[i] || ''
      );
      return restored;
    }
    // 初期値: 作業エントリが空なら1つ追加
    const init = { ...INITIAL_DAILY_SAFETY_REPORT };
    if (init.workEntries.length === 0) {
      init.workEntries = [createEmptyWorkEntry()];
    }
    if (init.materialEntries.length === 0) {
      init.materialEntries = [''];
    }
    if (init.preparationEntries.length === 0) {
      init.preparationEntries = [''];
    }
    // 安全衛生指示事項は7個の空文字配列で初期化
    init.safetyInstructions = Array(SAFETY_INSTRUCTIONS_COUNT).fill('');
    return init;
  });

  // --- ドラフトID ---
  const [draftId, setDraftId] = useState<string | null>(initialDraftId || null);

  // 【修正】作業日変更検知用: 初期化時の作業日を保持する
  // 一時保存データから復元した場合はその作業日、新規作成時はnull
  const [originalWorkDate, setOriginalWorkDate] = useState<string | null>(() => {
    if (initialData) {
      return initialData.workDate || null;
    }
    return null;
  });

  // 【修正】作業日変更確認ダイアログ表示用state
  const [showDateChangeConfirm, setShowDateChangeConfirm] = useState(false);

  // --- マスタデータ ---
  const [masterData, setMasterData] = useState<MasterData>(INITIAL_MASTER_DATA);

  // --- 保存状態 ---
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // --- バリデーションエラー ---
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // --- モーダル ---
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

  // --- STEP2: 保存済み配置図選択モーダル ---
  const [showDiagramPicker, setShowDiagramPicker] = useState(false);
  const [diagramImages, setDiagramImages] = useState<DiagramImage[]>([]);
  const [diagramPickerLoading, setDiagramPickerLoading] = useState(false);

  // --- STEP2: HTML Canvas API 関連 ---
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const [penColor, setPenColor] = useState('#ff0000'); // デフォルト: 赤
  const [penWidth, setPenWidth] = useState(4); // デフォルト: 中(4px)
  const [diagramLoaded, setDiagramLoaded] = useState(false);

  // 描画履歴（各スナップショットの data URL を保持）
  const [canvasHistory, setCanvasHistory] = useState<string[]>([]);

  // 描画中フラグ（useRef で管理し、再レンダリングを防止）
  const isDrawingRef = useRef(false);

  // 背景画像のImageオブジェクトを保持（全消去・元に戻す時に再利用）
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);

  // キャンバスに表示する画像URLを別stateで管理
  // useEffectの依存配列からreportのURLを排除することで、保存時のキャンバス再初期化を防止
  const [currentDiagramSrc, setCurrentDiagramSrc] = useState<string>(() => {
    // 初期値: 一時保存データから復元時に設定
    if (initialData) {
      return initialData.annotatedDiagramUrl || initialData.baseDiagramUrl || '';
    }
    return '';
  });

  // --- STEP2: アップロード用の隠しinput ref ---
  const diagramFileInputRef = useRef<HTMLInputElement>(null);

  // ============================
  // 一時保存データから復元した際にdiagramLoadedを設定
  // ============================
  useEffect(() => {
    if (initialData) {
      const src = initialData.annotatedDiagramUrl || initialData.baseDiagramUrl;
      if (src) {
        setDiagramLoaded(true);
      }
    }
  }, [initialData]);

  // ============================
  // マスタデータ読み込み
  // ============================
  useEffect(() => {
    const loadMaster = async () => {
      try {
        const data = await getMasterData();
        // getMasterData が各フィールドを返さない場合に備えてフォールバック
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

  // ============================
  // レポート更新ヘルパー
  // ============================
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

  // ============================
  // 打合せ日変更時に作業日を翌営業日に連動 + 曜日自動更新
  // ============================
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

  // ============================
  // 作業日変更時の曜日自動更新
  // ============================
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

  // ============================
  // 作業エントリ操作
  // ============================
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

  // ============================
  // 搬出入資機材・段取り資材等・安全衛生指示事項の汎用操作
  // ============================
  const updateListEntry = (
    field: 'materialEntries' | 'preparationEntries' | 'safetyInstructions',
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

  const addListEntry = (field: 'materialEntries' | 'preparationEntries') => {
    setReport((prev) => ({
      ...prev,
      [field]: [...prev[field], ''],
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  const removeListEntry = (
    field: 'materialEntries' | 'preparationEntries',
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

  // ============================
  // バリデーション
  // ============================
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

    // 安全衛生指示事項: 7個のうち最低1つ以上選択必須
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

  // ============================
  // 【修正】作業日変更時の新規ドラフト分離処理
  // 「はい」が選択された場合に呼ばれるコールバック
  // ============================
  const handleDateChangeSeparation = useCallback(() => {
    // a) 新しいドラフトIDを生成
    const newId = generateId();

    // b) draftIdを新しいIDに更新
    setDraftId(newId);

    // c) STEP2以降のデータを初期状態にリセット
    //    ※STEP1のデータはすべて維持する
    setReport((prev) => ({
      ...prev,
      annotatedDiagramUrl: '',
      baseDiagramUrl: '',
    }));
    // キャンバス関連のstateをクリア
    setCurrentDiagramSrc('');
    setDiagramLoaded(false);
    setCanvasHistory([]);
    backgroundImageRef.current = null;

    // d) originalWorkDateを現在のreport.workDateに更新
    setOriginalWorkDate(report.workDate);

    // e) stepを2に進める
    setStep(2);

    // 確認ダイアログを閉じる
    setShowDateChangeConfirm(false);

    // 変更フラグ更新
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  }, [report.workDate]);

  // ============================
  // ステップ遷移
  // ============================
  const handleNext = () => {
    if (step === 1) {
      if (!validateStep1()) return;

      // 【修正】作業日変更判定:
      // originalWorkDateがnullでない（一時保存データから復元）かつ
      // 作業日が変更されている場合、確認ダイアログを表示
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

  // ============================
  // 一時保存処理 — 【修正A】JPEG圧縮 + 【修正B】サイズエラーメッセージ改善
  // ============================
  const handleSave = async () => {
    if (!report.project) {
      alert('保存するには「工事名」の選択が必須です。');
      return;
    }

    // STEP2でキャンバスが存在する場合は、キャンバス内容を画像化して保存
    let updatedReport = { ...report };
    const canvasEl = canvasElRef.current;
    if (canvasEl && canvasEl.width > 0 && canvasEl.height > 0) {
      // 【修正A】PNGからJPEG（品質60%）に変更し、dataURLのサイズを大幅に削減
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
      // 【修正B】画像サイズエラーの判定
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
  // ホームへ戻る
  // ============================
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

  // ============================
  // エラー表示用ヘルパー
  // ============================
  const getErrorClass = (field: string) =>
    errors[field] ? 'border-red-500 bg-red-50' : 'border-gray-300';

  // ============================
  // STEP2: HTML Canvas API によるキャンバス初期化
  // - currentDiagramSrc の画像を読み込み、アスペクト比に基づいてキャンバスサイズを決定
  // - 画像をキャンバス全体にフィットして描画
  // - 描画履歴の初期状態として背景画像のスナップショットを保存
  // ============================
  useEffect(() => {
    // STEP2のときのみキャンバスを初期化
    if (step !== 2) return;
    // 配置図が読み込まれていない場合はキャンバスを生成しない
    if (!diagramLoaded) return;
    // currentDiagramSrc がなければ初期化しない
    if (!currentDiagramSrc) return;

    const canvasEl = canvasElRef.current;
    if (!canvasEl) return;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    // 画像を読み込み
    const img = new Image();
    img.onload = () => {
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;

      // コンテナ幅を取得（最大800px）
      const containerWidth = canvasContainerRef.current?.clientWidth || 800;
      const canvasWidth = Math.min(containerWidth, 800);
      // キャンバスの高さ = 幅 × (画像の naturalHeight / naturalWidth)
      const canvasHeight = Math.round(canvasWidth * (naturalH / naturalW));

      // canvas要素の内部ピクセルサイズを設定
      canvasEl.width = canvasWidth;
      canvasEl.height = canvasHeight;

      // 画像をキャンバス全体にフィットして描画
      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

      // 背景画像を保持（全消去・元に戻す時に再利用）
      backgroundImageRef.current = img;

      // 【修正A】描画履歴の初期スナップショットもJPEG圧縮で保存
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
  // マウスイベントとタッチイベントの両方に対応
  // ============================

  // キャンバスの座標を取得する共通ヘルパー（CSS表示サイズと内部ピクセルサイズの差を補正）
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

  // 描画開始（mousedown）
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvasEl = canvasElRef.current;
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    isDrawingRef.current = true;

    // 座標を補正して取得
    const { x, y } = getCanvasCoordinates(canvasEl, e.clientX, e.clientY);

    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  // 描画中（mousemove）
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

  // 描画終了（mouseup / mouseleave）
  const handleMouseUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    // 【修正A】スナップショットをJPEG圧縮で保存
    const canvasEl = canvasElRef.current;
    if (canvasEl) {
      const snapshot = canvasEl.toDataURL('image/jpeg', 0.6);
      setCanvasHistory((prev) => [...prev, snapshot]);
    }
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  // 描画開始（touchstart）
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // スクロール防止
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

  // 描画中（touchmove）
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // スクロール防止
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

  // 描画終了（touchend / touchcancel）
  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    // 【修正A】スナップショットをJPEG圧縮で保存
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
  // 【修正B】saveDiagramImage のエラーメッセージ改善
  // ============================
  const handleDiagramUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    try {
      // キャンバス表示用に既存の compressImage で圧縮
      const compressed = await compressImage(file);
      setReport((prev) => ({ ...prev, baseDiagramUrl: compressed, annotatedDiagramUrl: '' }));
      // currentDiagramSrc を新しい画像のdata URLに更新 → useEffectでキャンバス再初期化
      setCurrentDiagramSrc(compressed);
      setHasUnsavedChanges(true);
      setSaveStatus('idle');
      setDiagramLoaded(true);

      // 工事名が選択されている場合、配置図専用圧縮で元画像をFirestoreに保存
      if (report.project) {
        try {
          const diagramCompressed = await compressDiagramImage(file);
          await saveDiagramImage(report.project, diagramCompressed, file.name);
          console.log('[配置図元画像保存] 完了 - 工事名:', report.project, 'ファイル名:', file.name);
        } catch (saveErr: any) {
          console.error('[配置図元画像保存] 失敗:', saveErr);
          // 【修正B】画像サイズエラーの判定
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
          // それ以外のエラーはキャンバス表示を続行する（ログのみ）
        }
      }
    } catch (err) {
      console.error('画像圧縮エラー', err);
      alert('画像の読み込みに失敗しました。');
    }

    // input の値をリセット（同じファイルを再アップロード可能にする）
    if (diagramFileInputRef.current) {
      diagramFileInputRef.current.value = '';
    }
  };

  // ============================
  // STEP2: 保存済みの配置図から選択モーダルを開く
  // ============================
  const handleOpenDiagramPicker = async () => {
    // 工事名が未選択の場合はアラートを表示
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

  // ============================
  // STEP2: 保存済み配置図モーダルから画像を選択
  // ============================
  const handleSelectDiagramImage = (image: DiagramImage) => {
    // 選択した元画像をキャンバスに表示
    setCurrentDiagramSrc(image.imageDataUrl);
    setDiagramLoaded(true);
    setReport((prev) => ({
      ...prev,
      baseDiagramUrl: image.imageDataUrl,
      annotatedDiagramUrl: '',
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
    // モーダルを閉じる
    setShowDiagramPicker(false);
  };

  // ============================
  // 【修正1】STEP2: 保存済み配置図モーダルから画像を削除
  // ConfirmationModalを使わず、モーダル内のインライン確認UIで処理する
  // DiagramPickerModal の onDelete に渡すコールバック
  // ============================
  const handleDeleteDiagramImage = async (imageId: string): Promise<void> => {
    await removeDiagramImage(imageId);
    // リストを再読み込み
    if (report.project) {
      const updatedImages = await fetchDiagramImages(report.project);
      setDiagramImages(updatedImages);
    }
  };

  // ============================
  // STEP2: 元に戻す
  // 履歴の最後のスナップショットを削除し、1つ前の状態を復元
  // ============================
  const handleUndo = () => {
    const canvasEl = canvasElRef.current;
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    setCanvasHistory((prev) => {
      // 履歴が1つ以下（背景画像のみ）の場合は何もしない
      if (prev.length <= 1) return prev;

      // 最後のスナップショットを削除
      const newHistory = prev.slice(0, -1);
      // 1つ前の状態を復元
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

  // ============================
  // STEP2: 全消去（書き込みのみクリア、背景画像は保持）
  // ============================
  const handleClearAll = () => {
    const canvasEl = canvasElRef.current;
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const bgImg = backgroundImageRef.current;
    if (bgImg) {
      // 背景画像のみを再描画
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      ctx.drawImage(bgImg, 0, 0, canvasEl.width, canvasEl.height);

      // 【修正A】履歴クリア後のスナップショットもJPEG圧縮で保存
      const bgSnapshot = canvasEl.toDataURL('image/jpeg', 0.6);
      setCanvasHistory([bgSnapshot]);
    }
  };

  // ============================
  // STEP2: キャンバスを画像として書き出し＆保存
  // 【修正A】JPEG圧縮 + 【修正B】サイズエラーメッセージ改善
  // ============================
  const handleSaveCanvas = async () => {
    if (!report.project) {
      alert('保存するには「工事名」の選択が必須です。');
      return;
    }

    const canvasEl = canvasElRef.current;
    if (!canvasEl || canvasEl.width === 0 || canvasEl.height === 0) {
      // キャンバスなしの場合は通常保存
      await handleSave();
      return;
    }

    // 【修正A】PNGからJPEG（品質60%）に変更し、dataURLのサイズを大幅に削減
    const dataUrl = canvasEl.toDataURL('image/jpeg', 0.6);
    console.log('[handleSaveCanvas] toDataURL prefix:', dataUrl.substring(0, 30));

    // annotatedDiagramUrl に保存。currentDiagramSrc は更新しない（再初期化防止）
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
      // 【修正B】画像サイズエラーの判定
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
              {/* セット番号とゴミ箱 */}
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

              {/* 入力フィールド（レスポンシブ対応） */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 作業内容 */}
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

                {/* 会社名 */}
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

                {/* 人数（予定） */}
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

                {/* 機械 — masterData.machines を参照 */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">機械</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded bg-white text-black outline-none appearance-none text-sm"
                    value={entry.machine}
                    onChange={(e) => updateWorkEntry(entry.id, 'machine', e.target.value)}
                  >
                    <option value="">選択してください</option>
                    {masterData.machines.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 作業追加ボタン */}
        <button
          onClick={addWorkEntry}
          className="mt-3 w-full py-2 border-2 border-dashed border-pink-300 text-pink-600 rounded-lg font-bold hover:bg-pink-50 transition-colors text-sm"
        >
          <i className="fa-solid fa-plus mr-2"></i>作業を追加
        </button>
      </div>

      {/* (6) 搬出入資機材 — masterData.equipment を参照 */}
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

      {/* (7) 段取り資材等 — masterData.equipment を参照 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">段取り資材等（任意）</label>
        {report.preparationEntries.map((val, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-2">
            <select
              className="flex-1 p-2 border border-gray-300 rounded bg-white text-black outline-none appearance-none text-sm"
              value={val}
              onChange={(e) => updateListEntry('preparationEntries', idx, e.target.value)}
            >
              <option value="">選択してください</option>
              {masterData.equipment.map((eq) => (
                <option key={eq} value={eq}>
                  {eq}
                </option>
              ))}
            </select>
            <button
              onClick={() => removeListEntry('preparationEntries', idx)}
              className="text-gray-400 hover:text-red-500 p-1 transition-colors shrink-0"
              title="削除"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        ))}
        <button
          onClick={() => addListEntry('preparationEntries')}
          className="text-sm text-pink-600 font-bold hover:underline"
        >
          <i className="fa-solid fa-plus mr-1"></i>追加
        </button>
      </div>

      {/* (8) 安全衛生指示事項 — 7個固定表示、masterData.safetyInstructionItems を参照 */}
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
    // 配置図の有無を判定（diagramLoaded で管理）
    const hasDiagram = diagramLoaded && !!(currentDiagramSrc);

    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-800 border-l-4 border-pink-500 pl-3">
          STEP 2: 配置図・略図
        </h2>

        {/* 配置図アップロードエリア */}
        <div className="bg-pink-50 border border-pink-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-bold text-gray-700">
            <i className="fa-solid fa-image mr-2 text-pink-500"></i>
            配置図を選択してください
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* 新しい配置図をアップロード */}
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

            {/* 保存済みの配置図から選択 */}
            <button
              onClick={handleOpenDiagramPicker}
              className="flex-1 py-3 px-4 bg-gray-600 text-white rounded-lg font-bold text-center text-sm hover:bg-gray-700 transition-colors"
            >
              <i className="fa-solid fa-images mr-2"></i>
              保存済みの配置図から選択
            </button>
          </div>
        </div>

        {/* 書き込みキャンバス */}
        {hasDiagram ? (
          <>
            {/* ツールバー */}
            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                {/* ペンの色選択 */}
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

                {/* 区切り線 */}
                <div className="w-px h-8 bg-gray-200 hidden sm:block"></div>

                {/* ペンの太さ */}
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

                {/* 区切り線 */}
                <div className="w-px h-8 bg-gray-200 hidden sm:block"></div>

                {/* 元に戻す・全消去 */}
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

            {/* キャンバス — HTML Canvas API を使用 */}
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
          /* 配置図未選択時のプレースホルダー */
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
  // STEP3〜5 プレースホルダー
  // ============================
  const renderPlaceholder = (currentStep: number) => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800 border-l-4 border-pink-500 pl-3">
        STEP {currentStep}
      </h2>
      <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
        <i className="fa-solid fa-code text-5xl text-gray-300 mb-4 block"></i>
        <p className="text-gray-500 font-bold text-lg mb-2">このSTEPは現在開発中です</p>
        <p className="text-gray-400 text-sm">次回のアップデートで実装されます。</p>
      </div>
    </div>
  );

  // ============================
  // メインレンダリング
  // ============================
  return (
    <>
      <div className="no-print min-h-screen pb-24 bg-gray-50">
        {/* ヘッダー */}
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

        {/* ステップインジケーター（5ステップ対応） */}
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

        {/* メインコンテンツ */}
        <main className="mx-auto p-4 bg-white shadow-lg rounded-lg min-h-[60vh] max-w-3xl">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderPlaceholder(3)}
          {step === 4 && renderPlaceholder(4)}
          {step === 5 && renderPlaceholder(5)}
        </main>

        {/* フッター（固定） */}
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
            {/* STEP2では「一時保存」ボタンをキャンバス書き出し保存に */}
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
          <button
            onClick={handleNext}
            disabled={step === 5}
            className={`px-8 py-3 rounded-lg font-bold shadow flex items-center ${
              step === 5
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-pink-600 text-white hover:bg-pink-700'
            }`}
          >
            次へ <i className="fa-solid fa-chevron-right ml-2"></i>
          </button>
        </footer>
      </div>

      {/* 保存完了モーダル */}
      <CompleteModal
        isOpen={showCompleteModal}
        onOk={() => {
          setShowCompleteModal(false);
          onBackToMenu();
        }}
      />

      {/* 確認モーダル（作業削除・ホームに戻る等で使用。配置図削除には使用しない） */}
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
