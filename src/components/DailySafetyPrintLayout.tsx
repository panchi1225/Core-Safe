// src/components/DailySafetyPrintLayout.tsx
// 安全衛生日誌（作業打合せ及び安全衛生日誌）帳票レイアウトコンポーネント
// A4横向き（297mm × 210mm）1ページに全入力項目を収める
// HTMLの<table>タグをネストして元PDFのレイアウトを極限まで再現する
// STEP3当日入力分・STEP4巡視記録は赤字（color: red）で表示
//
// ■ 修正14点
// 修正1: 全行14px統一（ヘッダー20px以外例外なし）
// 修正2: ダンプ台数を5列構成に変更
// 修正3: 巡視所見をrowSpan=2に変更
// 修正4: 配置図画像のURL参照を修正（annotatedDiagramUrl優先）
// 修正5: 左右分割47%:53%
// 修正6: 右側53%を完全半分（50%:50%）
// 修正7: チェックリスト行数修正（自由記入=余白行として統合）
// 修正8: 左右最下部を揃える
// 修正9: 印刷時の配置を横中央・縦下寄せ
// 修正10: 左右余白を6mmに変更
// 修正11: フォントサイズをタイトル13.5px、それ以外全て8pxに統一
// 修正12: 作業連絡調整事項データ行を2行に拡大
// 修正13: 配置図画像セルは常に右側最下部と揃う
// 修正14: 第2段基本情報行の列幅変更・中央表示・外枠太線

import React from 'react';
import {
  DailySafetyReportData,
  Step5InspectionChecklist,
  Step5InspectionItem,
  Step3ConfirmationItems,
  Step3SiteConfirmationItems,
} from '../types';

// ============================
// 曜日算出関数
// ============================
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** 日付文字列(YYYY-MM-DD)から「(月)」形式の曜日文字列を返す */
function getWeekdayLabel(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return `(${WEEKDAYS[d.getDay()]})`;
}

// ============================
// 和暦変換関数
// ============================
/** 日付文字列(YYYY-MM-DD)から「令和○年○月○日」形式を返す */
function toWareki(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  if (year >= 2019) {
    const reiwa = year - 2018;
    return `令和${reiwa}年${month}月${day}日`;
  }
  if (year >= 1989) {
    const heisei = year - 1988;
    return `平成${heisei}年${month}月${day}日`;
  }
  return `${year}年${month}月${day}日`;
}

// ============================
// 丸囲み表示関数（11px丸枠、1.5px赤ボーダー、テキスト黒）
// ============================
function circledChoice(
  value: string,
  option1: string,
  option2: string
): JSX.Element {
  const circleStyle: React.CSSProperties = {
    border: '1.5px solid red',
    borderRadius: '50%',
    display: 'inline-block',
    width: '11px',
    height: '11px',
    textAlign: 'center' as const,
    lineHeight: '9px',
    color: 'black',
    fontSize: '8px',
  };
  const normalStyle: React.CSSProperties = {
    display: 'inline-block',
    color: 'black',
    fontSize: '8px',
  };

  const isOption1 = value === option1;
  const isOption2 = value === option2;

  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <span style={isOption1 ? circleStyle : normalStyle}>{option1}</span>
      <span style={{ color: 'black', fontSize: '8px' }}>・</span>
      <span style={isOption2 ? circleStyle : normalStyle}>{option2}</span>
    </span>
  );
}

// ============================
// 基本確認事項のラベル定義（10項目）
// ============================
const CONFIRMATION_LABELS: { key: keyof Step3ConfirmationItems; label: string }[] = [
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
// 当現場確認事項のラベル定義（10項目）
// ============================
const SITE_CONFIRMATION_LABELS: { key: keyof Step3SiteConfirmationItems; label: string }[] = [
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
// 点検チェックリスト: 各カテゴリの固定項目ラベル定義
// ============================
const CHECKLIST_FIXED_ITEMS: Record<string, string[]> = {
  management: [
    '朝礼・KYの実施',
    '各作業間の連絡調整',
    '作業主任者・有資格者の配置',
    '保護具（保安帽・安全帯・マスク・メガネ等）の着用',
    '救命胴衣・浮き輪の備え',
    '標識類の設置（立入禁止・足場積載荷重・作業主任者）',
    '廃棄物書類の整備（許可証・契約書・マニュフェスト）',
    '各種点検・記録の確認',
    '建設業許可・労災成立・確認申請・占用許可等掲示',
    '掲示物の期限・汚損確認',
    '新規入場者教育・作業内容の周知',
  ],
  machinery: [
    '始業点検・検査済証の確認',
    '合図者・合図の方法・玉掛用具・ワイヤーの確認',
    '重機・クレーンの設置状況、立ち入り禁止措置',
    '安全装置の作動確認（外れ止め・過巻防止装置等）',
    '敷板・アウトリガー・用途外使用',
  ],
  electrical: [
    '分電盤の表示・アース確認',
    '配線の損傷・漏電・水濡れ確認',
    '電工ドラム・ホルダーの使用状況',
    '架空電線の防護措置',
    '電動工具のカバー・刃の確認',
  ],
  falling: [
    '手すりの設置状況（足場・桟橋・開口部・床端等）',
    '脚立・はしご・ローリングタワーの使用状況',
    '安全ネット・親綱の設置',
    '昇降設備・通路の確保',
    '足場・作業床の整理状況',
  ],
  debris: [
    '支保工の設置状況',
    '切土・盛土・掘削面の状況',
    '湧水・浮石・亀裂の有無',
    '足場・作業構台の安全状況',
    '幅木・資材・シートの管理',
  ],
  environment: [
    '整理整頓の状況（事務所内・休憩所・通路・資材置場）',
    '照明・換気の状況',
    'ボンベ・燃料類の管理',
    '火気使用・消火器の管理、喫煙状況',
    '仮設トイレの衛生状況',
  ],
  others: [
    '騒音・振動・粉じん・濁水対策',
    '過積載防止・速度管理',
    '重機と作業員の分離・誘導（合図者）配置',
  ],
};

// 修正7: 自由記入欄と余白行を統合。全カテゴリ0に
const CHECKLIST_CUSTOM_ROWS: Record<string, number> = {
  management: 0,
  machinery: 0,
  electrical: 0,
  falling: 0,
  debris: 0,
  environment: 0,
  others: 0,
};

// 各カテゴリの余白行数（自由記入欄を兼ねる）
const CHECKLIST_BLANK_ROWS: Record<string, number> = {
  management: 1,
  machinery: 1,
  electrical: 1,
  falling: 1,
  debris: 1,
  environment: 1,
  others: 2,
};

// 左列・右列のカテゴリキー
const LEFT_CHECKLIST_KEYS = ['management', 'machinery', 'electrical'];
const RIGHT_CHECKLIST_KEYS = ['falling', 'debris', 'environment', 'others'];

// カテゴリ表示名
const CATEGORY_TITLES: Record<string, string> = {
  management: '管理',
  machinery: '重機・機械',
  electrical: '電気',
  falling: '墜落・転落',
  debris: '飛来・落下崩壊・転倒',
  environment: '作業環境',
  others: 'その他',
};

// ============================
// 共通スタイル定数
// ============================
const B = '1px solid black';
const B2 = '1px solid black'; // 修正17: 全罫線を細線(1px)に統一

// 隣接テーブル間のボーダー重複を防止するスタイル
// 上辺ボーダーなし（上のテーブルの下辺と重複を避ける）
const NO_TOP_BORDER = '0px solid black';

// 標準行高さ: 14px（ヘッダー行以外すべて。例外なし）
const ROW_H = '14px';
const ROW_H2 = '28px'; // rowSpan=2用

// 修正11: フォントサイズ統一 8px
const FONT = '8px';
// ヘッダー用フォントサイズ（1サイズ大きい）
const FONT_H = '9px';
const DIAGRAM_IMG_H = '378px';  // 配置図画像エリア固定高さ = 27行 × 14px
// ヘッダーセル背景色（なし）
const BG_HEADER = 'transparent';

/** 全テーブル共通スタイル */
const TABLE_BASE: React.CSSProperties = {
  borderCollapse: 'collapse' as const,
  width: '100%',
  tableLayout: 'fixed' as const,
  margin: 0,
  padding: 0,
};

// 修正21: インデント用の定数
const INDENT1 = '1em';
const INDENT2 = '2em';

/** 全セル共通スタイル（14px強制、8px統一） */
const CELL: React.CSSProperties = {
  border: B,
  padding: '1px 2px',
  fontSize: FONT,
  lineHeight: '12px',
  verticalAlign: 'middle',
  overflow: 'hidden',
  whiteSpace: 'nowrap' as const,
  textOverflow: 'ellipsis',
  height: ROW_H,
  maxHeight: ROW_H,
  boxSizing: 'border-box' as const,
};

/** THセル共通スタイル */
const TH: React.CSSProperties = {
  ...CELL,
  fontWeight: 'bold',
  textAlign: 'center' as const,
  backgroundColor: BG_HEADER,
};

/** データ入力スタイル（全文字黒統一。後で赤字指定箇所を変更予定） */
const RED: React.CSSProperties = {
  color: 'black',
};

/**
 * AutoFitText: セル内にテキストが収まるようフォントサイズを自動縮小するコンポーネント
 * - 改行（\n）に対応
 * - align: 'left'で左寄せ+インデント、'center'で中央表示
 * - maxFontSizeから0.5pxずつ縮小してオーバーフローしないサイズを探す
 */
const AutoFitText: React.FC<{
  text: string;
  maxFontSize?: number;
  minFontSize?: number;
  align?: 'left' | 'center';
  indent?: string;
  style?: React.CSSProperties;
}> = ({ text, maxFontSize = 8, minFontSize = 4, align = 'center', indent, style }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = React.useState(maxFontSize);

  React.useEffect(() => {
    if (!containerRef.current || !textRef.current || !text) return;
    let fs = maxFontSize;
    textRef.current.style.fontSize = `${fs}px`;
    while (fs > minFontSize) {
      textRef.current.style.fontSize = `${fs}px`;
      if (
        textRef.current.scrollWidth <= containerRef.current.clientWidth &&
        textRef.current.scrollHeight <= containerRef.current.clientHeight
      ) {
        break;
      }
      fs -= 0.5;
    }
    setFontSize(fs);
  }, [text, maxFontSize, minFontSize]);

  if (!text) return <>{'\u00A0'}</>;

  const lines = text.split('\n');
  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'left' ? 'flex-start' : 'center',
        overflow: 'hidden',
        paddingLeft: align === 'left' && indent ? indent : undefined,
        boxSizing: 'border-box' as const,
        ...style,
      }}
    >
      <div
        ref={textRef}
        style={{
          fontSize: `${fontSize}px`,
          lineHeight: 1.3,
          textAlign: align,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {lines.map((line, i) => (
          <React.Fragment key={i}>
            {line}
            {i < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// 固定行数定数
const WORK_ROWS = 10;

// ============================
// Props
// ============================
interface Props {
  data: DailySafetyReportData;
}

// ============================
// メインコンポーネント
// ============================
const DailySafetyPrintLayout: React.FC<Props> = ({ data }) => {
  // ============================
  // データフォールバック一覧
  // ============================
  const workEntries = data?.workEntries || [];
  const actualWorkers = data?.actualWorkers || [];
  const materialEntries = data?.materialEntries || [];
  const machineryEntries = ((data as any)?.machineryEntries || []).filter((m: string) => m);
  const safetyInstructions = data?.safetyInstructions || [];
  const confirmationItems = data?.step3ConfirmationItems || ({} as any);
  const siteConfirmationItems = data?.step3SiteConfirmationItems || ({} as any);
  const inspectionChecklist = data?.step5InspectionChecklist || ({ categories: [] } as any);
  const dumpTrucks = data?.dumpTrucks || ({ incoming: '', outgoing: '' } as any);
  const patrolRecord = data?.patrolRecord || ({} as any);
  const stageConfirmation = data?.stageConfirmation || '';
  const witnessConfirmation = data?.witnessConfirmation || '';
  // 修正22: workNotesフィールド名修正（patrolRecord.coordinationNotesが正しいフィールド名）
  const workNotes = (data as any)?.workNotes || patrolRecord?.coordinationNotes || '';
  // 修正4: annotatedDiagramUrl優先、baseDiagramUrlフォールバック
  const diagramUrl = (data as any)?.annotatedDiagramUrl || (data as any)?.baseDiagramUrl || '';
  const presenter = (data as any)?.presenter || data?.meetingConductor || '';
  const projectName = (data as any)?.projectName || data?.project || '';
  const meetingDate = data?.meetingDate || '';
  const workDate = data?.workDate || '';

  // 追加作業エントリ
  const additionalEntries = (data as any)?.step3AdditionalWorkEntries || [];

  // 作業人数合計
  const totalWorkers = (() => {
    let total = 0;
    workEntries.forEach((_: any, index: number) => {
      const found = actualWorkers.find ? actualWorkers.find((aw: any) => aw.entryIndex === index) : undefined;
      if (found) total += found.count || 0;
    });
    additionalEntries.forEach((entry: any) => {
      total += entry.actualWorkers || 0;
    });
    return total;
  })();

  // ダンプ台数
  const dumpIncoming = dumpTrucks.incoming ?? 0;
  const dumpOutgoing = dumpTrucks.outgoing ?? 0;

  // 統合テーブル用の行データ生成
  type IntegratedRowData = {
    workContent: string;
    company: string;
    plannedWorkers: string;
    actualWorkersVal: string;
    machinery: string;
    material: string;
    safetyInstruction: string;
    confirmationLabel: string;
    confirmationResult: string;
    isAdditional: boolean;
  };

  const integratedRows: IntegratedRowData[] = [];

  workEntries.forEach((entry: any, index: number) => {
    const found = actualWorkers.find ? actualWorkers.find((aw: any) => aw.entryIndex === index) : undefined;
    const actualCount = found ? found.count : 0;
    integratedRows.push({
      workContent: entry.workContent || '',
      company: entry.company || '',
      plannedWorkers: String(entry.plannedWorkers || ''),
      actualWorkersVal: actualCount > 0 ? String(actualCount) : '',
      machinery: '',
      material: materialEntries[index] || '',
      safetyInstruction: '',
      confirmationLabel: '',
      confirmationResult: '',
      isAdditional: false,
    });
  });

  additionalEntries.forEach((entry: any) => {
    integratedRows.push({
      workContent: entry.description || '',
      company: entry.company || '',
      plannedWorkers: '',
      actualWorkersVal: entry.actualWorkers > 0 ? String(entry.actualWorkers) : '',
      machinery: '',
      material: '',
      safetyInstruction: '',
      confirmationLabel: '',
      confirmationResult: '',
      isAdditional: true,
    });
  });

  while (integratedRows.length < WORK_ROWS) {
    integratedRows.push({
      workContent: '', company: '', plannedWorkers: '', actualWorkersVal: '',
      machinery: '', material: '', safetyInstruction: '',
      confirmationLabel: '', confirmationResult: '', isAdditional: false,
    });
  }

  // 主要機械を上から順に1セル1項目で割り当て
  for (let i = 0; i < WORK_ROWS && i < machineryEntries.length; i++) {
    integratedRows[i].machinery = machineryEntries[i] || '';
  }

  for (let i = 0; i < WORK_ROWS; i++) {
    integratedRows[i].safetyInstruction = safetyInstructions[i] || '';
    integratedRows[i].confirmationLabel = CONFIRMATION_LABELS[i]?.label || '';
    const confirmKey = CONFIRMATION_LABELS[i]?.key;
    integratedRows[i].confirmationResult = confirmKey ? (confirmationItems[confirmKey] || '') : '';
  }

  // ============================
  // チェックリスト: カテゴリごとに固定項目行データ生成
  // ============================
  const buildChecklistRows = (categoryKey: string): { label: string; rating: string }[] => {
    const fixedLabels = CHECKLIST_FIXED_ITEMS[categoryKey] || [];
    const dataItems: Step5InspectionItem[] = inspectionChecklist[categoryKey] || [];
    const rows: { label: string; rating: string }[] = [];
    fixedLabels.forEach((fixedLabel, idx) => {
      const foundByLabel = dataItems.find((item: any) => item.label === fixedLabel);
      const foundByIndex = !foundByLabel ? dataItems[idx] : undefined;
      const found = foundByLabel || foundByIndex;
      rows.push({ label: fixedLabel, rating: found?.value || '' });
    });
    return rows;
  };

  // 修正7: 余白行にカスタムデータがあれば表示
  const getBlankRowData = (categoryKey: string, blankIndex: number): { label: string; rating: string } => {
    const fixedLabels = CHECKLIST_FIXED_ITEMS[categoryKey] || [];
    const dataItems: Step5InspectionItem[] = inspectionChecklist[categoryKey] || [];
    const customIdx = fixedLabels.length + blankIndex;
    const found = dataItems[customIdx];
    if (found && (found.label || '').trim()) {
      return { label: found.label, rating: found.value || '' };
    }
    return { label: '', rating: '' };
  };

  // チェックリスト1列分のレンダリング
  const renderChecklistColumn = (keys: string[]) => {
    const rows: React.ReactNode[] = [];
    keys.forEach((key) => {
      const title = CATEGORY_TITLES[key] || key;
      const items = buildChecklistRows(key);
      const blankCount = CHECKLIST_BLANK_ROWS[key] || 1;

      // カテゴリヘッダー行（14px）
      rows.push(
        <tr key={`hdr-${key}`} style={{ height: ROW_H }}>
          <td colSpan={2} style={{
            border: B, padding: '0px 1px', fontWeight: 'bold', fontSize: FONT,
            textAlign: 'left' as const, height: ROW_H, maxHeight: ROW_H,
            lineHeight: '12px', overflow: 'hidden', boxSizing: 'border-box' as const,
            backgroundColor: BG_HEADER,
          }}>
            【{title}】
          </td>
        </tr>
      );

      // 項目行（各14px）
      items.forEach((item, idx) => {
        rows.push(
          <tr key={`${key}-${idx}`} style={{ height: ROW_H }}>
            <td style={{
              border: B, padding: '0px 1px', fontSize: FONT,
              textAlign: 'left' as const, height: ROW_H, maxHeight: ROW_H,
              lineHeight: '12px', overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap' as const, boxSizing: 'border-box' as const,
              textIndent: INDENT2,
            }}>
              {item.label || '\u00A0'}
            </td>
            <td style={{
              border: B, padding: '0px 1px', fontSize: FONT,
              textAlign: 'center' as const, height: ROW_H, maxHeight: ROW_H,
              lineHeight: '12px', overflow: 'hidden', boxSizing: 'border-box' as const,
              ...RED,
            }}>
              {item.rating || '\u00A0'}
            </td>
          </tr>
        );
      });

      // 余白行（自由記入欄兼用、各14px）
      for (let b = 0; b < blankCount; b++) {
        const blankData = getBlankRowData(key, b);
        rows.push(
          <tr key={`blank-${key}-${b}`} style={{ height: ROW_H }}>
            <td style={{
              border: B, padding: '0px 1px', fontSize: FONT, height: ROW_H,
              maxHeight: ROW_H, lineHeight: '12px', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
              boxSizing: 'border-box' as const, textIndent: INDENT2,
            }}>
              {blankData.label || '\u00A0'}
            </td>
            <td style={{
              border: B, padding: '0px 1px', fontSize: FONT,
              textAlign: 'center' as const, height: ROW_H, maxHeight: ROW_H,
              lineHeight: '12px', overflow: 'hidden', boxSizing: 'border-box' as const,
              ...RED,
            }}>
              {blankData.rating || '\u00A0'}
            </td>
          </tr>
        );
      }
    });
    return rows;
  };

  return (
    <>
      {/* 印刷用CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area-wrapper, #print-area-wrapper * { visibility: visible; }
          #print-area-wrapper { position: fixed; left: 0; top: 0; width: 100%; height: 100%; }
        }
        @page { size: A4 landscape; margin: 0; }
      `}</style>

      {/* 修正9: ラッパーdivで横中央・縦下寄せ */}
      <div
        id="print-area-wrapper"
        style={{
          width: '297mm',
          height: '210mm',
          display: 'flex',
          flexDirection: 'column' as const,
          justifyContent: 'flex-end',
          alignItems: 'center',
          background: 'white',
          overflow: 'hidden',
          boxSizing: 'border-box' as const,
        }}
      >
        {/* 帳票本体 修正10: 左右余白6mm、上下余白4mm */}
        <div
          id="print-area"
          style={{
            width: '100%',
            padding: '4mm 6mm',
            overflow: 'hidden',
            background: 'white',
            boxSizing: 'border-box' as const,
            fontFamily: "'MS Gothic', 'Hiragino Kaku Gothic Pro', monospace",
            color: 'black',
            WebkitPrintColorAdjust: 'exact' as any,
          }}
        >
          {/* ==================================================================
              第1段: ヘッダー（タイトル行 20px）
              修正11: タイトル13.5px、所長確認欄ラベル8px
              ================================================================== */}
          <table style={{ ...TABLE_BASE, marginBottom: 0 }}>
            <tbody>
              <tr style={{ height: '20px' }}>
                <td style={{ width: '25%', border: 'none', padding: 0, height: '20px' }}>{'\u00A0'}</td>
                <td style={{
                  width: '50%', border: 'none', fontSize: '13.5px', fontWeight: 'bold',
                  textAlign: 'center' as const, padding: 0, height: '20px',
                }}>
                  作業打合せ及び安全衛生日誌
                </td>
                <td style={{
                  width: '25%', border: 'none', textAlign: 'right' as const,
                  verticalAlign: 'bottom', padding: 0, height: '20px',
                }}>
                  <div style={{ display: 'inline-block', textAlign: 'center' }}>
                    <div style={{ fontSize: FONT, marginBottom: '1px' }}>所長確認欄</div>
                    <div style={{
                      border: '1px solid black', height: '30px', width: '30px',
                      display: 'inline-block',
                    }} />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ==================================================================
              第2段: 基本情報行（罫線なし、ラベル：データの形式で1行表示）
              ================================================================== */}
          <div style={{
            height: ROW_H2, display: 'flex', alignItems: 'center',
            fontSize: FONT, lineHeight: ROW_H2,
            padding: '0 2px', overflow: 'hidden',
            whiteSpace: 'nowrap' as const,
          }}>
            <span style={{ fontWeight: 'bold', fontSize: FONT_H }}>工事名</span>
            <span>：</span>
            <span style={RED}>{projectName}</span>
            <span style={{ margin: '0 8px' }}>{'\u00A0'}</span>
            <span style={{ fontWeight: 'bold', fontSize: FONT_H }}>打合せ日</span>
            <span>：</span>
            <span style={RED}>{toWareki(meetingDate)}{getWeekdayLabel(meetingDate)}</span>
            <span style={{ margin: '0 8px' }}>{'\u00A0'}</span>
            <span style={{ fontWeight: 'bold', fontSize: FONT_H }}>作業日</span>
            <span>：</span>
            <span style={RED}>{toWareki(workDate)}{getWeekdayLabel(workDate)}</span>
            <span style={{ margin: '0 8px' }}>{'\u00A0'}</span>
            <span style={{ fontWeight: 'bold', fontSize: FONT_H }}>打合せ実施者</span>
            <span>：</span>
            <span style={RED}>{presenter}</span>
          </div>

          {/* ==================================================================
              第3段: 統合作業テーブル（9列×ヘッダー1行(14px)＋データ10行(14px)）
              列幅: 13+8+4+4+12+6=47% | 25+21+7=53%
              修正11: 全フォント8px
              修正19: 上辺ボーダー削除（第2段の下辺と重複防止）
              ================================================================== */}
          <table style={{ ...TABLE_BASE, marginTop: '-1px' }}>
            <colgroup>
              <col style={{ width: '15%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '4%' }} />
              <col style={{ width: '4%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '23%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '5%' }} />
            </colgroup>
            <thead>
              <tr style={{ height: ROW_H2 }}>
                <th style={{ ...TH, height: ROW_H2, fontSize: FONT_H }}>作業内容</th>
                <th style={{ ...TH, height: ROW_H2, fontSize: FONT_H }}>会社名</th>
                <th style={{ ...TH, height: ROW_H2, fontSize: FONT_H, whiteSpace: 'normal' as const, lineHeight: '12px' }}>人数<br /><span style={{ fontSize: FONT }}>（予定）</span></th>
                <th style={{ ...TH, height: ROW_H2, fontSize: FONT_H, whiteSpace: 'normal' as const, lineHeight: '12px' }}>人数<br /><span style={{ fontSize: FONT }}>（実施）</span></th>
                <th style={{ ...TH, height: ROW_H2, fontSize: FONT_H }}>主要機械</th>
                <th style={{ ...TH, height: ROW_H2, fontSize: FONT_H, whiteSpace: 'normal' as const, lineHeight: '12px' }}>搬出入資機材</th>
                <th style={{ ...TH, height: ROW_H2, fontSize: FONT_H }}>安全衛生指示事項</th>
                <th style={{ ...TH, height: ROW_H2, fontSize: FONT_H }}>基本確認事項</th>
                <th style={{ ...TH, height: ROW_H2, fontSize: FONT_H }}>結果</th>
              </tr>
            </thead>
            <tbody>
              {integratedRows.slice(0, WORK_ROWS).map((row, idx) => {
                const dataCell: React.CSSProperties = { ...CELL, ...RED };

                return (
                  <tr key={idx} style={{ height: ROW_H }}>
                    <td style={{ ...dataCell, textIndent: INDENT1 }}>{row.workContent || '\u00A0'}</td>
                    <td style={{ ...dataCell, textAlign: 'center' as const }}>{row.company || '\u00A0'}</td>
                    <td style={{ ...dataCell, textAlign: 'center' as const }}>{row.plannedWorkers || '\u00A0'}</td>
                    <td style={{ ...dataCell, textAlign: 'center' as const }}>{row.actualWorkersVal || '\u00A0'}</td>
                    <td style={{ ...dataCell, textAlign: 'center' as const }}>{row.machinery || '\u00A0'}</td>
                    <td style={{ ...dataCell, textAlign: 'center' as const }}>{row.material || '\u00A0'}</td>
                    <td style={{ ...dataCell, whiteSpace: 'normal' as const, textIndent: INDENT2 }}>{row.safetyInstruction || '\u00A0'}</td>
                    <td style={{ ...dataCell, whiteSpace: 'normal' as const, textIndent: INDENT2 }}>{row.confirmationLabel || '\u00A0'}</td>
                    <td style={{ ...CELL, textAlign: 'center' as const }}>
                      {circledChoice(row.confirmationResult, '良', '否')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ==================================================================
              第4段〜第5段: 左右独立レイアウト
              修正5: 左47%・右53%
              修正19: 上辺重複防止
              ================================================================== */}
          <table style={{ ...TABLE_BASE, marginTop: '-1px' }}>
            <tbody>
              <tr>
                {/* ====================================
                    左側セル（47%）
                    修正2: 5列構成
                    列幅: 13% + 15% + 25% + 9% + 38% = 100%
                    ==================================== */}
                <td style={{ width: '55%', verticalAlign: 'top', padding: 0, border: 'none', height: '100%' }}>
                  {/* === 行1〜3: 4列構成 (25%+4%+9%+9%=47%) === */}
                  <table style={{ ...TABLE_BASE }}>
                    <colgroup>
                      <col style={{ width: '49.09%' }} />{/* 27/55*100 */}
                      <col style={{ width: '7.27%' }} />{/* 4/55*100 */}
                      <col style={{ width: '21.82%' }} />{/* 12/55*100 */}
                      <col style={{ width: '21.82%' }} />{/* 12/55*100 */}
                    </colgroup>
                    <tbody>
                      {/* 行1: ヘッダー（28px） */}
                      <tr style={{ height: ROW_H2 }}>
                        <td style={{
                          border: B, fontSize: FONT_H, fontWeight: 'bold',
                          textAlign: 'center' as const, height: ROW_H2, maxHeight: ROW_H2,
                          padding: '1px 2px', overflow: 'hidden', lineHeight: '12px',
                          boxSizing: 'border-box' as const, whiteSpace: 'nowrap' as const,
                          verticalAlign: 'middle', backgroundColor: BG_HEADER,
                        }}>
                          作業連絡調整事項・朝礼周知事項等
                        </td>
                        <td style={{
                          border: B, fontSize: FONT_H, fontWeight: 'bold',
                          textAlign: 'center' as const, height: ROW_H2, maxHeight: ROW_H2,
                          padding: '1px 2px', overflow: 'hidden', lineHeight: '12px',
                          boxSizing: 'border-box' as const, whiteSpace: 'normal' as const,
                          verticalAlign: 'middle', backgroundColor: BG_HEADER,
                        }}>
                          人数<br /><span style={{ fontSize: FONT }}>（合計）</span>
                        </td>
                        <td style={{
                          border: B, fontSize: FONT_H, fontWeight: 'bold',
                          textAlign: 'center' as const, height: ROW_H2, maxHeight: ROW_H2,
                          padding: '1px 2px', overflow: 'hidden', lineHeight: '12px',
                          boxSizing: 'border-box' as const,
                          verticalAlign: 'middle', backgroundColor: BG_HEADER,
                        }}>
                          ダンプ台数
                        </td>
                        <td style={{
                          border: B, fontSize: FONT_H, fontWeight: 'bold',
                          textAlign: 'center' as const, height: ROW_H2, maxHeight: ROW_H2,
                          padding: '1px 2px', overflow: 'hidden', lineHeight: '12px',
                          boxSizing: 'border-box' as const,
                          verticalAlign: 'middle', backgroundColor: BG_HEADER,
                        }}>
                          発注者確認
                        </td>
                      </tr>

                      {/* 行2: データ上段（14px） */}
                      <tr style={{ height: ROW_H }}>
                        {/* 作業連絡調整事項 入力欄 rowSpan=2 */}
                        <td rowSpan={2} style={{
                          border: B, whiteSpace: 'normal' as const,
                          height: ROW_H2, maxHeight: ROW_H2,
                          verticalAlign: 'middle', padding: '1px 2px',
                          overflow: 'hidden',
                          boxSizing: 'border-box' as const, ...RED,
                        }}>
                          <AutoFitText text={workNotes} align="left" indent={INDENT1} />
                        </td>
                        {/* 人数（合計）表示欄 rowSpan=2 */}
                        <td rowSpan={2} style={{
                          border: B, textAlign: 'center' as const, verticalAlign: 'middle',
                          fontSize: FONT, fontWeight: 'bold', padding: '1px 2px',
                          overflow: 'hidden', height: ROW_H2, maxHeight: ROW_H2,
                          boxSizing: 'border-box' as const, lineHeight: '12px', ...RED,
                        }}>
                          {totalWorkers}名
                        </td>
                        {/* ダンプ台数：搬入 */}
                        <td style={{
                          border: B, fontSize: FONT, height: ROW_H, maxHeight: ROW_H,
                          padding: '1px 2px', overflow: 'hidden', lineHeight: '12px',
                          boxSizing: 'border-box' as const, textAlign: 'center' as const,
                        }}>
                          搬入：<span style={RED}>{dumpIncoming}</span>台
                        </td>
                        {/* 段階確認 */}
                        <td style={{
                          border: B, fontSize: FONT, textAlign: 'center' as const,
                          height: ROW_H, maxHeight: ROW_H, padding: '1px 2px',
                          overflow: 'hidden', lineHeight: '12px', boxSizing: 'border-box' as const,
                        }}>
                          <span style={{ fontWeight: 'bold' }}>段階確認</span>
                          {'　'}
                          {circledChoice(stageConfirmation, '有', '無')}
                        </td>
                      </tr>

                      {/* 行3: データ下段（14px） */}
                      <tr style={{ height: ROW_H }}>
                        {/* ダンプ台数：搬出 */}
                        <td style={{
                          border: B, fontSize: FONT, height: ROW_H, maxHeight: ROW_H,
                          padding: '1px 2px', overflow: 'hidden', lineHeight: '12px',
                          boxSizing: 'border-box' as const, textAlign: 'center' as const,
                        }}>
                          搬出：<span style={RED}>{dumpOutgoing}</span>台
                        </td>
                        {/* 立合確認 */}
                        <td style={{
                          border: B, fontSize: FONT, textAlign: 'center' as const,
                          height: ROW_H, maxHeight: ROW_H, padding: '1px 2px',
                          overflow: 'hidden', lineHeight: '12px', boxSizing: 'border-box' as const,
                        }}>
                          <span style={{ fontWeight: 'bold' }}>立合確認</span>
                          {'　'}
                          {circledChoice(witnessConfirmation, '有', '無')}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* === 行4〜6: 巡視記録（行4=ヘッダー、行5-6=データ結合）marginTop:-1px === */}
                  <table style={{ ...TABLE_BASE, marginTop: '-1px' }}>
                    <colgroup>
                      <col style={{ width: '27.27%' }} />{/* 15/55*100 = 巡視点検者 */}
                      <col style={{ width: '21.82%' }} />{/* 12/55*100 = 巡視時間 */}
                      <col style={{ width: '50.91%' }} />{/* 28/55*100 = 巡視所見 */}
                    </colgroup>
                    <tbody>
                      {/* 行4: ヘッダー行（14px） */}
                      <tr style={{ height: ROW_H }}>
                        <th style={{
                          border: B, fontSize: FONT, fontWeight: 'bold',
                          textAlign: 'center' as const, height: ROW_H, maxHeight: ROW_H,
                          padding: '1px 2px', overflow: 'hidden', lineHeight: '12px',
                          boxSizing: 'border-box' as const, backgroundColor: BG_HEADER,
                        }}>
                          巡視点検者
                        </th>
                        <th style={{
                          border: B, fontSize: FONT, fontWeight: 'bold',
                          textAlign: 'center' as const, height: ROW_H, maxHeight: ROW_H,
                          padding: '1px 2px', overflow: 'hidden', lineHeight: '12px',
                          boxSizing: 'border-box' as const, backgroundColor: BG_HEADER,
                        }}>
                          巡視時間
                        </th>
                        <th style={{
                          border: B, fontSize: FONT, fontWeight: 'bold',
                          textAlign: 'center' as const, height: ROW_H, maxHeight: ROW_H,
                          padding: '1px 2px', overflow: 'hidden', lineHeight: '12px',
                          boxSizing: 'border-box' as const, backgroundColor: BG_HEADER,
                        }}>
                          巡視所見
                        </th>
                      </tr>

                      {/* 行5-6: データ行（2行結合=28px）borderTopなしで二重罫線防止 */}
                      <tr style={{ height: ROW_H2 }}>
                        <td style={{
                          border: B, borderTop: 'none', borderBottom: 'none', fontSize: FONT, height: ROW_H2, maxHeight: ROW_H2,
                          padding: '1px 2px', overflow: 'hidden', lineHeight: '12px',
                          boxSizing: 'border-box' as const, textAlign: 'center' as const,
                          verticalAlign: 'middle', ...RED,
                        }}>
                          {patrolRecord.inspector || '\u00A0'}
                        </td>
                        <td style={{
                          border: B, borderTop: 'none', borderBottom: 'none', fontSize: FONT, height: ROW_H2, maxHeight: ROW_H2,
                          padding: '1px 2px', overflow: 'hidden', lineHeight: '12px',
                          boxSizing: 'border-box' as const, textAlign: 'center' as const,
                          verticalAlign: 'middle', ...RED,
                        }}>
                          {patrolRecord.inspectionTime || '\u00A0'}
                        </td>
                        <td style={{
                          border: B, borderTop: 'none', borderBottom: 'none', borderRight: 'none', height: ROW_H2, maxHeight: ROW_H2,
                          padding: '1px 2px', overflow: 'hidden',
                          verticalAlign: 'middle',
                          boxSizing: 'border-box' as const, ...RED,
                        }}>
                          <AutoFitText text={patrolRecord.findings || ''} align="left" indent={INDENT1} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>

                {/* ====================================
                    右側セル（45%）当現場確認項目のみ
                    ==================================== */}
                <td style={{ width: '45%', verticalAlign: 'top', padding: 0, border: 'none', height: '100%' }}>
                  {/* Part A: 当現場確認項目（ヘッダー1行 + データ5行 = 6行） */}
                  <table style={{ ...TABLE_BASE }}>
                    <colgroup>
                      <col style={{ width: '38.89%' }} />
                      <col style={{ width: '11.11%' }} />
                      <col style={{ width: '38.89%' }} />
                      <col style={{ width: '11.11%' }} />
                    </colgroup>
                    <thead>
                      <tr style={{ height: ROW_H2 }}>
                        <th colSpan={4} style={{
                          border: B, fontSize: FONT_H, fontWeight: 'bold',
                          textAlign: 'center' as const, height: ROW_H2, maxHeight: ROW_H2,
                          padding: '1px 2px', overflow: 'hidden', lineHeight: '12px',
                          boxSizing: 'border-box' as const, backgroundColor: BG_HEADER,
                        }}>
                          当現場確認項目
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 1, 2, 3, 4].map((i) => {
                        const left = SITE_CONFIRMATION_LABELS[i];
                        const right = SITE_CONFIRMATION_LABELS[i + 5];
                        const leftResult = left ? (siteConfirmationItems[left.key] || '') : '';
                        const rightResult = right ? (siteConfirmationItems[right.key] || '') : '';
                        return (
                          <tr key={i} style={{ height: ROW_H }}>
                            <td style={{
                              border: B, fontSize: FONT, height: ROW_H, maxHeight: ROW_H,
                              padding: '1px 2px', whiteSpace: 'normal' as const,
                              overflow: 'hidden', lineHeight: '12px',
                              boxSizing: 'border-box' as const, textIndent: INDENT2, ...RED,
                            }}>
                              {left?.label || '\u00A0'}
                            </td>
                            <td style={{
                              border: B, fontSize: FONT, height: ROW_H, maxHeight: ROW_H,
                              padding: '1px 2px', textAlign: 'center' as const,
                              overflow: 'hidden', lineHeight: '12px',
                              boxSizing: 'border-box' as const,
                            }}>
                              {circledChoice(leftResult, '良', '否')}
                            </td>
                            <td style={{
                              border: B, fontSize: FONT, height: ROW_H, maxHeight: ROW_H,
                              padding: '1px 2px', whiteSpace: 'normal' as const,
                              overflow: 'hidden', lineHeight: '12px',
                              boxSizing: 'border-box' as const, textIndent: INDENT2, ...RED,
                            }}>
                              {right?.label || '\u00A0'}
                            </td>
                            <td style={{
                              border: B, fontSize: FONT, height: ROW_H, maxHeight: ROW_H,
                              padding: '1px 2px', textAlign: 'center' as const,
                              overflow: 'hidden', lineHeight: '12px',
                              boxSizing: 'border-box' as const,
                            }}>
                              {circledChoice(rightResult, '良', '否')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ==================================================================
              第5段: 配置図・略図（43%）＋ 巡視点検チェックリスト（57%）
              ================================================================== */}
          <table style={{ ...TABLE_BASE, marginTop: '-1px' }}>
            <tbody>
              <tr>
                {/* 左側: 配置図・略図（43%） */}
                <td style={{ width: '43%', verticalAlign: 'top', padding: 0, border: 'none' }}>
                  <table style={{ ...TABLE_BASE }}>
                    <tbody>
                      {/* 配置図ヘッダー: 2行結合(28px) */}
                      <tr style={{ height: ROW_H2 }}>
                        <td style={{
                          border: B, borderBottom: 'none', fontSize: FONT_H, fontWeight: 'bold',
                          textAlign: 'center' as const, height: ROW_H2, maxHeight: ROW_H2,
                          padding: '1px 2px', overflow: 'hidden', lineHeight: '12px',
                          verticalAlign: 'middle', boxSizing: 'border-box' as const,
                          backgroundColor: BG_HEADER,
                        }}>
                          配置図・略図
                        </td>
                      </tr>

                      {/* 配置図画像: 固定高さ */}
                      <tr style={{ height: DIAGRAM_IMG_H }}>
                        <td style={{
                          border: B, borderTop: 'none', textAlign: 'center' as const,
                          verticalAlign: 'top', padding: 0,
                          overflow: 'hidden',
                          height: DIAGRAM_IMG_H, maxHeight: DIAGRAM_IMG_H,
                          boxSizing: 'border-box' as const,
                          position: 'relative' as const,
                        }}>
                          {diagramUrl ? (
                            <div style={{
                              position: 'absolute' as const,
                              top: '1px', left: '1px', right: '1px', bottom: '1px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                            }}>
                              <img
                                src={diagramUrl}
                                alt="配置図"
                                style={{
                                  maxWidth: '100%', maxHeight: '100%',
                                  objectFit: 'contain' as const,
                                  display: 'block',
                                }}
                              />
                            </div>
                          ) : (
                            '\u00A0'
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>

                {/* 右側: 巡視点検チェックリスト（57%） */}
                <td style={{ width: '57%', verticalAlign: 'top', padding: 0, border: 'none' }}>
                  <table style={{ ...TABLE_BASE, marginLeft: '-1px', width: 'calc(100% + 1px)' }}>
                    <tbody>
                      {/* タイトル行（28px） */}
                      <tr style={{ height: ROW_H2 }}>
                        <td colSpan={4} style={{
                          border: B, borderBottom: 'none', fontSize: FONT_H, fontWeight: 'bold',
                          textAlign: 'center' as const, height: ROW_H2, maxHeight: ROW_H2,
                          padding: '0px 1px', overflow: 'hidden', lineHeight: '12px',
                          boxSizing: 'border-box' as const, backgroundColor: BG_HEADER,
                        }}>
                          巡視点検チェックリスト　（ ○適正　△一部適正　×不適切　◎是正済　無印は該当無 ）
                        </td>
                      </tr>
                      {/* チェックリスト本体: 左右2列（各50%） */}
                      <tr>
                        <td colSpan={2} style={{
                          width: '50%', verticalAlign: 'top', padding: 0,
                          border: 'none',
                        }}>
                          <table style={{
                            width: '100%', borderCollapse: 'collapse' as const,
                            tableLayout: 'fixed' as const, margin: 0,
                          }}>
                            <colgroup>
                              <col style={{ width: '77.78%' }} />
                              <col style={{ width: '22.22%' }} />
                            </colgroup>
                            <tbody>{renderChecklistColumn(LEFT_CHECKLIST_KEYS)}</tbody>
                          </table>
                        </td>
                        <td colSpan={2} style={{
                          width: '50%', verticalAlign: 'top', padding: 0,
                          border: 'none',
                        }}>
                          <table style={{
                            width: '100%', borderCollapse: 'collapse' as const,
                            tableLayout: 'fixed' as const, margin: 0,
                            marginLeft: '-1px',
                          }}>
                            <colgroup>
                              <col style={{ width: '77.78%' }} />
                              <col style={{ width: '22.22%' }} />
                            </colgroup>
                            <tbody>{renderChecklistColumn(RIGHT_CHECKLIST_KEYS)}</tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default DailySafetyPrintLayout;
