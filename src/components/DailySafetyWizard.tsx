// src/components/DailySafetyWizard.tsx
// 安全衛生日誌（作業打合せ及び安全衛生日誌）ウィザード
// STEP1: 作業内容入力、STEP2: 配置図・略図、STEP3〜5: 未実装プレースホルダー

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MasterData,
  DailySafetyReportData,
  WorkEntry,
  INITIAL_DAILY_SAFETY_REPORT,
  INITIAL_MASTER_DATA,
  getJapaneseDayOfWeek,
  getNextBusinessDay,
} from '../types';
import { getMasterData, compressImage, saveDraft } from '../services/firebaseService';
import { Canvas as FabricCanvas, PencilBrush, FabricImage } from 'fabric';

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
// メインコンポーネント
// ============================
const DailySafetyWizard: React.FC<Props> = ({ initialData, initialDraftId, onBackToMenu }) => {
  // --- ステップ管理 ---
  const [step, setStep] = useState(1);

  // --- レポートデータ ---
  const [report, setReport] = useState<DailySafetyReportData>(() => {
    if (initialData) {
      // 【修正4】一時保存データから復元時、safetyInstructions を7個に正規化
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
    // 【修正4】安全衛生指示事項は7個の空文字配列で初期化
    init.safetyInstructions = Array(SAFETY_INSTRUCTIONS_COUNT).fill('');
    return init;
  });

  // --- ドラフトID ---
  const [draftId, setDraftId] = useState<string | null>(initialDraftId || null);

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

  // --- STEP2: Fabric.js 関連 ---
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const [penColor, setPenColor] = useState('#ff0000'); // デフォルト: 赤
  const [penWidth, setPenWidth] = useState(4); // デフォルト: 中(4px)
  const [diagramLoaded, setDiagramLoaded] = useState(false);
  const [canvasHistory, setCanvasHistory] = useState<string[]>([]);
  const isInitializingRef = useRef(false);

  // ============================
  // 【修正3】一時保存データから復元した際にdiagramLoadedを設定
  // ============================
  useEffect(() => {
    if (initialData) {
      // annotatedDiagramUrl または baseDiagramUrl があれば配置図を復元可能
      if (initialData.annotatedDiagramUrl || initialData.baseDiagramUrl) {
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
        // getMasterData が machines/materials/preparations を返さない場合に備える
        setMasterData({
          ...data,
          machines: data.machines || INITIAL_MASTER_DATA.machines,
          materials: data.materials || INITIAL_MASTER_DATA.materials,
          preparations: data.preparations || INITIAL_MASTER_DATA.preparations,
          cautions: data.cautions || INITIAL_MASTER_DATA.cautions,
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
  // 【修正1】打合せ日変更時に作業日を翌営業日に連動 + 曜日自動更新
  // ============================
  const handleMeetingDateChange = (dateStr: string) => {
    const meetingDate = new Date(dateStr + 'T00:00:00');
    // getNextBusinessDay で翌営業日（土日祝を飛ばす）を取得
    const nextBizDate = getNextBusinessDay(meetingDate);
    const nextBizDateStr = nextBizDate.toISOString().split('T')[0];

    setReport((prev) => ({
      ...prev,
      meetingDate: dateStr,
      meetingDayOfWeek: getJapaneseDayOfWeek(meetingDate),
      // 作業日を翌営業日に自動設定
      workDate: nextBizDateStr,
      workDayOfWeek: getJapaneseDayOfWeek(nextBizDate),
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  // ============================
  // 作業日変更時の曜日自動更新（手動変更も可能なまま）
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

    // 【修正4】安全衛生指示事項: 7個のうち最低1つ以上選択必須
    const hasAtLeastOneSafetyInstruction = report.safetyInstructions.some((s) => s !== '');
    if (!hasAtLeastOneSafetyInstruction) {
      newErrors.safetyInstructions = true;
      hasError = true;
    }

    if (hasError) {
      setErrors(newErrors);
      if (newErrors.safetyInstructions && !newErrors.project && !newErrors.meetingConductor) {
        // 安全衛生指示事項のみエラーの場合
        alert('安全衛生指示事項を1つ以上選択してください。');
      } else if (newErrors.safetyInstructions) {
        // 他のエラーと合わせて表示
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
  // ステップ遷移
  // ============================
  const handleNext = () => {
    if (step === 1) {
      if (!validateStep1()) return;
    }
    setStep((prev) => Math.min(prev + 1, 5));
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  // ============================
  // 【修正3】一時保存処理 — キャンバス内容を annotatedDiagramUrl に確実に保存
  // ============================
  const handleSave = async () => {
    if (!report.project) {
      alert('保存するには「工事名」の選択が必須です。');
      return;
    }

    // STEP2でキャンバスが存在する場合は、キャンバス内容を画像化して保存
    let updatedReport = { ...report };
    const fc = fabricCanvasRef.current;
    if (fc) {
      const dataUrl = fc.toDataURL({
        format: 'jpeg',
        quality: 0.8,
        multiplier: 1,
      });
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
    } catch (e) {
      console.error(e);
      alert('保存に失敗しました');
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
  // 【修正2・修正3】STEP2: Fabric.js キャンバス初期化
  // 配置図画像をキャンバスにフィットさせ、中央配置＋アスペクト比維持
  // 一時保存データからの復元にも対応
  // ============================
  useEffect(() => {
    // STEP2のときのみキャンバスを初期化
    if (step !== 2) return;
    // 配置図が読み込まれていない場合はキャンバスを生成しない
    if (!diagramLoaded) return;
    // 既に初期化中なら中断
    if (isInitializingRef.current) return;

    isInitializingRef.current = true;

    // 既存キャンバスがあれば破棄
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose();
      fabricCanvasRef.current = null;
    }

    const canvasEl = canvasElRef.current;
    if (!canvasEl) {
      isInitializingRef.current = false;
      return;
    }

    // 【修正3】復元ロジック: annotatedDiagramUrl > baseDiagramUrl の優先順
    // annotatedDiagramUrl がある場合はそちらを背景として使用（書き込み済み画像）
    // なければ baseDiagramUrl を使用
    const bgSrc = report.annotatedDiagramUrl || report.baseDiagramUrl;
    if (!bgSrc) {
      isInitializingRef.current = false;
      return;
    }

    // コンテナ幅を取得
    const containerWidth = canvasContainerRef.current?.clientWidth || 800;
    // 【修正2】PC: 最大800px、スマホ: 画面幅 - padding
    const maxWidth = Math.min(containerWidth, 800);

    const img = new Image();
    img.onload = () => {
      // 【修正2】画像のアスペクト比に基づいてキャンバスサイズを決定
      const aspectRatio = img.height / img.width;
      const canvasWidth = maxWidth;
      const canvasHeight = Math.round(canvasWidth * aspectRatio);

      // canvas要素のサイズ設定
      canvasEl.width = canvasWidth;
      canvasEl.height = canvasHeight;

      const fc = new FabricCanvas(canvasEl, {
        isDrawingMode: true,
        width: canvasWidth,
        height: canvasHeight,
      });

      // ペンブラシ設定
      const brush = new PencilBrush(fc);
      brush.color = penColor;
      brush.width = penWidth;
      fc.freeDrawingBrush = brush;

      // 【修正2】背景画像をキャンバスにフィットさせて中央配置
      FabricImage.fromURL(bgSrc).then((fabricImg) => {
        const imgW = fabricImg.width || 1;
        const imgH = fabricImg.height || 1;

        // アスペクト比を維持してキャンバスにフィットするスケールを計算
        const scaleX = canvasWidth / imgW;
        const scaleY = canvasHeight / imgH;
        const scale = Math.min(scaleX, scaleY);

        fabricImg.scaleX = scale;
        fabricImg.scaleY = scale;

        // 中央配置のためのオフセット計算
        const scaledW = imgW * scale;
        const scaledH = imgH * scale;
        fabricImg.left = (canvasWidth - scaledW) / 2;
        fabricImg.top = (canvasHeight - scaledH) / 2;

        fc.backgroundImage = fabricImg;
        fc.renderAll();

        // 描画履歴を初期化
        setCanvasHistory([]);
      });

      // パス追加時に履歴保存
      fc.on('path:created', () => {
        const json = JSON.stringify(fc.toJSON());
        setCanvasHistory((prev) => [...prev, json]);
      });

      fabricCanvasRef.current = fc;
      isInitializingRef.current = false;
    };
    img.onerror = () => {
      isInitializingRef.current = false;
    };
    img.src = bgSrc;

    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
      isInitializingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, diagramLoaded, report.baseDiagramUrl, report.annotatedDiagramUrl]);

  // ============================
  // STEP2: ペンの色・太さ変更時にブラシを更新
  // ============================
  useEffect(() => {
    const fc = fabricCanvasRef.current;
    if (!fc || !fc.freeDrawingBrush) return;
    fc.freeDrawingBrush.color = penColor;
    fc.freeDrawingBrush.width = penWidth;
  }, [penColor, penWidth]);

  // ============================
  // STEP2: 配置図アップロード処理
  // ============================
  const handleDiagramUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    try {
      const compressed = await compressImage(e.target.files[0]);
      setReport((prev) => ({ ...prev, baseDiagramUrl: compressed, annotatedDiagramUrl: '' }));
      setHasUnsavedChanges(true);
      setSaveStatus('idle');
      setDiagramLoaded(true);
    } catch (err) {
      console.error('画像圧縮エラー', err);
      alert('画像の読み込みに失敗しました。');
    }
  };

  // ============================
  // STEP2: 前回の配置図を使用
  // ============================
  const handleUsePreviousDiagram = () => {
    if (report.baseDiagramUrl || report.annotatedDiagramUrl) {
      setDiagramLoaded(true);
    } else {
      alert('保存済みの配置図がありません。新しい配置図をアップロードしてください。');
    }
  };

  // ============================
  // STEP2: 元に戻す（消しゴム）
  // ============================
  const handleUndo = () => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;

    const objects = fc.getObjects();
    if (objects.length > 0) {
      const lastObj = objects[objects.length - 1];
      fc.remove(lastObj);
      fc.renderAll();
      setCanvasHistory((prev) => prev.slice(0, -1));
    }
  };

  // ============================
  // STEP2: 全消去（書き込みのみクリア）
  // ============================
  const handleClearAll = () => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;

    // 背景画像を保持したまま描画オブジェクトのみ削除
    const objects = fc.getObjects();
    objects.forEach((obj) => fc.remove(obj));
    fc.renderAll();
    setCanvasHistory([]);
  };

  // ============================
  // 【修正3】STEP2: キャンバスを画像として書き出し＆保存
  // ============================
  const handleSaveCanvas = async () => {
    if (!report.project) {
      alert('保存するには「工事名」の選択が必須です。');
      return;
    }

    const fc = fabricCanvasRef.current;
    if (!fc) {
      // キャンバスなしの場合は通常保存
      await handleSave();
      return;
    }

    // キャンバスの内容（背景画像＋書き込み）を1枚の画像としてdata URL化
    const dataUrl = fc.toDataURL({
      format: 'jpeg',
      quality: 0.8,
      multiplier: 1,
    });

    // annotatedDiagramUrl に保存し、baseDiagramUrl も保持
    const updatedReport = { ...report, annotatedDiagramUrl: dataUrl };
    setReport(updatedReport);

    setSaveStatus('saving');
    try {
      const newId = await saveDraft(draftId, 'DAILY_SAFETY', updatedReport);
      setDraftId(newId);
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      setShowCompleteModal(true);
    } catch (e) {
      console.error(e);
      alert('保存に失敗しました');
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

                {/* 主要機械 */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">主要機械</label>
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
              {masterData.materials.map((m) => (
                <option key={m} value={m}>
                  {m}
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

      {/* (7) 段取り資材等 */}
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
              {masterData.preparations.map((p) => (
                <option key={p} value={p}>
                  {p}
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

      {/* (8) 安全衛生指示事項 — 【修正4】7個固定表示、追加/削除ボタンなし */}
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
              {masterData.cautions.map((c) => (
                <option key={c} value={c}>
                  {c}
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
    // 【修正3】配置図の有無を判定（annotatedDiagramUrl または baseDiagramUrl）
    const hasDiagram = !!(report.annotatedDiagramUrl || report.baseDiagramUrl);

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
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleDiagramUpload}
              />
            </label>

            {/* 前回の配置図を使用 */}
            <button
              onClick={handleUsePreviousDiagram}
              className={`flex-1 py-3 px-4 rounded-lg font-bold text-center text-sm transition-colors ${
                hasDiagram
                  ? 'bg-gray-600 text-white hover:bg-gray-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              disabled={!hasDiagram}
            >
              <i className="fa-solid fa-rotate-left mr-2"></i>
              前回の配置図を使用
            </button>
          </div>
        </div>

        {/* 書き込みキャンバス */}
        {diagramLoaded && hasDiagram ? (
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

            {/* キャンバス */}
            <div
              ref={canvasContainerRef}
              className="w-full flex justify-center"
              style={{ maxWidth: '800px', margin: '0 auto' }}
            >
              <canvas
                ref={canvasElRef}
                className="border border-gray-300 rounded-lg shadow-sm touch-none"
                style={{ width: '100%', height: 'auto' }}
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

      {/* 確認モーダル */}
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
