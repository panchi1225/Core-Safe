// src/components/DailySafetyPrintLayout.tsx
// 安全衛生日誌（作業打合せ及び安全衛生日誌）帳票レイアウトコンポーネント
// A4横向き（297mm × 210mm）1ページに全入力項目を収める
// HTMLの<table>タグをネストして元PDFのレイアウトを極限まで再現する
// STEP3当日入力分・STEP4巡視記録は赤字（color: red）で表示

import React from 'react';
import {
  DailySafetyReportData,
  Step5InspectionChecklist,
  Step5InspectionItem,
  Step3ConfirmationItems,
  Step3SiteConfirmationItems,
} from '../types';

// ============================
// 曜日の日本語ラベル
// ============================
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** 日付文字列(YYYY-MM-DD)から「（水）」形式の曜日文字列を返す */
function getDayOfWeekLabel(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return `（${WEEKDAYS[d.getDay()]}）`;
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
// 点検チェックリスト大分類定義（7分類）
// ============================
const CHECKLIST_CATEGORIES: { key: keyof Step5InspectionChecklist; title: string }[] = [
  { key: 'management', title: '管理' },
  { key: 'machinery', title: '重機・機械' },
  { key: 'electrical', title: '電気' },
  { key: 'falling', title: '墜落転落' },
  { key: 'debris', title: '飛来・落下崩壊・転倒' },
  { key: 'environment', title: '作業環境' },
  { key: 'others', title: 'その他' },
];

// 点検チェックリスト2列配置: 左列・右列の振り分け
const LEFT_CHECKLIST_KEYS: (keyof Step5InspectionChecklist)[] = ['management', 'machinery', 'electrical'];
const RIGHT_CHECKLIST_KEYS: (keyof Step5InspectionChecklist)[] = ['falling', 'debris', 'environment', 'others'];

// ============================
// 共通スタイル定数（フォントサイズ・余白基準に準拠）
// ============================
const B = '1px solid black'; // 罫線

/** 通常データセル: 7.5px、padding 3px 4px */
const CELL: React.CSSProperties = {
  border: B,
  padding: '3px 4px',
  verticalAlign: 'middle',
  lineHeight: 1.3,
  fontSize: '7.5px',
  whiteSpace: 'nowrap' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

/** 折り返し可能データセル */
const CELL_WRAP: React.CSSProperties = {
  ...CELL,
  whiteSpace: 'normal' as const,
  wordBreak: 'break-all' as const,
};

/** テーブルヘッダーセル: 8px太字、padding 2px 4px */
const TH: React.CSSProperties = {
  ...CELL,
  fontSize: '8px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  backgroundColor: 'transparent',
  padding: '2px 4px',
};

/** 折り返し可能ヘッダーセル */
const TH_WRAP: React.CSSProperties = {
  ...TH,
  whiteSpace: 'normal' as const,
  wordBreak: 'break-all' as const,
};

/** 赤字スタイル */
const RED: React.CSSProperties = { color: 'red' };

/** 全テーブル共通: border-collapse */
const TABLE_BASE: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  tableLayout: 'fixed' as const,
};

// ============================
// 固定行数定数
// ============================
const WORK_ROWS = 10;               // 統合テーブルの固定行数
const SAFETY_INSTRUCTION_ROWS = 10; // 安全衛生指示事項の固定行数
const CONFIRMATION_ROWS = 10;       // 基本確認事項の固定行数

// ============================
// Props
// ============================
interface Props {
  data: DailySafetyReportData;
}

// ============================
// 【修正】丸囲みレンダリングヘルパー
// 「良・否」または「有・無」を表示し、選択された方を赤い丸枠線で表示
// テキストは常に黒字、丸の枠線（border）のみ赤
// ============================
function renderCircledChoice(
  value: string | undefined,
  option1: string,
  option2: string
): React.ReactNode {
  /* 【修正】選択された文字: 赤い枠線のみ、テキストは黒字 */
  const circleStyle: React.CSSProperties = {
    border: '2px solid red',
    borderRadius: '50%',
    display: 'inline-block',
    width: '14px',
    height: '14px',
    textAlign: 'center' as const,
    lineHeight: '14px',
    color: 'black',       // ★黒字に変更（以前は 'red'）
    fontWeight: 'bold',
    fontSize: '7px',
  };
  /* 【修正】未選択の文字: 枠線なし、テキストは黒字 */
  const normalStyle: React.CSSProperties = {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    textAlign: 'center' as const,
    lineHeight: '14px',
    color: 'black',       // ★黒字のまま
    fontSize: '7px',
  };

  const isOption1 = value === option1;
  const isOption2 = value === option2;

  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <span style={isOption1 ? circleStyle : normalStyle}>{option1}</span>
      <span style={{ fontSize: '7px' }}>・</span>
      <span style={isOption2 ? circleStyle : normalStyle}>{option2}</span>
    </span>
  );
}

// ============================
// メインコンポーネント
// ============================
const DailySafetyPrintLayout: React.FC<Props> = ({ data }) => {
  // --- 作業人数合計（赤字表示用） ---
  const totalWorkers = (() => {
    let total = 0;
    (data.workEntries || []).forEach((_, index) => {
      const found = (data.actualWorkers || []).find((aw) => aw.entryIndex === index);
      total += found ? found.count : 0;
    });
    (data.step3AdditionalWorkEntries || []).forEach((entry) => {
      total += entry.actualWorkers || 0;
    });
    return total;
  })();

  // --- ダンプ台数 ---
  const dumpIncoming = data.dumpTrucks ? data.dumpTrucks.incoming : 0;
  const dumpOutgoing = data.dumpTrucks ? data.dumpTrucks.outgoing : 0;

  // --- 統合テーブル用の行データ生成（STEP1 + STEP3追加 → 10行固定に埋める） ---
  type IntegratedRowData = {
    workContent: string;
    company: string;
    plannedWorkers: string;
    actualWorkers: string;
    machine: string;
    material: string;
    preparation: string;
    safetyInstruction: string;
    confirmationLabel: string;
    confirmationResult: string;
    isAdditional: boolean;
    rowIndex: number;
  };

  const integratedRows: IntegratedRowData[] = [];

  // STEP1の作業エントリ
  const workEntries = data.workEntries || [];
  const step3Additional = data.step3AdditionalWorkEntries || [];
  const materialEntries = data.materialEntries || [];
  const preparationEntries = data.preparationEntries || [];
  const safetyInstructions = data.safetyInstructions || [];

  // STEP1の作業行を追加
  workEntries.forEach((entry, index) => {
    const found = (data.actualWorkers || []).find((aw) => aw.entryIndex === index);
    const actualCount = found ? found.count : 0;
    integratedRows.push({
      workContent: entry.workContent || '',
      company: entry.company || '',
      plannedWorkers: String(entry.plannedWorkers || ''),
      actualWorkers: actualCount > 0 ? String(actualCount) : '',
      machine: entry.machine || '',
      material: materialEntries[index] || '',
      preparation: preparationEntries[index] || '',
      safetyInstruction: '',
      confirmationLabel: '',
      confirmationResult: '',
      isAdditional: false,
      rowIndex: integratedRows.length,
    });
  });

  // STEP3の追加作業行（全セル赤字）
  step3Additional.forEach((entry) => {
    integratedRows.push({
      workContent: entry.description || '',
      company: entry.company || '',
      plannedWorkers: '',
      actualWorkers: entry.actualWorkers > 0 ? String(entry.actualWorkers) : '',
      machine: entry.machines ? entry.machines.filter((m) => m).join(', ') : '',
      material: '',
      preparation: '',
      safetyInstruction: '',
      confirmationLabel: '',
      confirmationResult: '',
      isAdditional: true,
      rowIndex: integratedRows.length,
    });
  });

  // 10行まで空行で埋める
  while (integratedRows.length < WORK_ROWS) {
    integratedRows.push({
      workContent: '',
      company: '',
      plannedWorkers: '',
      actualWorkers: '',
      machine: '',
      material: '',
      preparation: '',
      safetyInstruction: '',
      confirmationLabel: '',
      confirmationResult: '',
      isAdditional: false,
      rowIndex: integratedRows.length,
    });
  }

  // 各行に安全衛生指示事項・基本確認事項・結果を設定
  for (let i = 0; i < WORK_ROWS; i++) {
    const instrText = safetyInstructions[i] || '';
    integratedRows[i].safetyInstruction = `${i + 1}. ${instrText}`;
    integratedRows[i].confirmationLabel = `${i + 1}. ${CONFIRMATION_LABELS[i].label}`;
    const confirmKey = CONFIRMATION_LABELS[i].key;
    integratedRows[i].confirmationResult = data.step3ConfirmationItems
      ? (data.step3ConfirmationItems[confirmKey] || '')
      : '';
  }

  // --- 点検チェックリストの表示用フィルタリング ---
  const getVisibleItems = (items: Step5InspectionItem[]): Step5InspectionItem[] => {
    return items.filter((item) => {
      if (item.isCustom) return item.label.trim() !== '';
      return true;
    });
  };

  // --- 点検チェックリスト1列分のレンダリング ---
  const renderChecklistColumn = (keys: (keyof Step5InspectionChecklist)[]) => {
    const rows: React.ReactNode[] = [];
    keys.forEach((key) => {
      const cat = CHECKLIST_CATEGORIES.find((c) => c.key === key);
      if (!cat) return;
      const items = data.step5InspectionChecklist
        ? getVisibleItems(data.step5InspectionChecklist[key] || [])
        : [];

      // 大分類ヘッダー行: 7.5px太字、height 13px
      rows.push(
        <tr key={`hdr-${key}`}>
          <td
            colSpan={2}
            style={{
              border: B,
              padding: '2px 3px',
              fontWeight: 'bold',
              fontSize: '7.5px',
              textAlign: 'left' as const,
              height: '13px',
              lineHeight: 1.2,
            }}
          >
            【{cat.title}】
          </td>
        </tr>
      );

      // 小項目行: 項目名7px、評価値7.5px、height 13px
      items.forEach((item, idx) => {
        rows.push(
          <tr key={`${key}-${idx}`}>
            <td
              style={{
                border: B,
                padding: '2px 3px',
                fontSize: '7px',
                textAlign: 'left' as const,
                height: '13px',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap' as const,
              }}
            >
              {item.label}
            </td>
            <td
              style={{
                border: B,
                padding: '2px 3px',
                fontSize: '7.5px',
                textAlign: 'center' as const,
                width: '20px',
                height: '13px',
                lineHeight: 1.2,
              }}
            >
              {item.value || ''}
            </td>
          </tr>
        );
      });
    });
    return rows;
  };

  return (
    <>
      {/* ============================
          印刷用CSS（変更なし）
          ============================ */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
          }
          .daily-safety-print-layout {
            margin: 0 !important;
            padding: 4mm !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* ============================
          帳票本体（A4横 297mm × 210mm）
          ============================ */}
      <div
        className="daily-safety-print-layout"
        style={{
          width: '297mm',
          height: '210mm',
          padding: '4mm',
          background: 'white',
          fontFamily: 'sans-serif',
          fontSize: '7.5px',
          color: 'black',
          boxSizing: 'border-box',
          overflow: 'hidden',
          position: 'relative',
          WebkitPrintColorAdjust: 'exact',
        }}
      >
        {/* ==================================================================
            第1段: ヘッダー（タイトル + 所長確認欄）→ 変更なし
            ================================================================== */}
        <table style={{ ...TABLE_BASE, tableLayout: 'auto', marginBottom: '1px' }}>
          <tbody>
            <tr>
              {/* 左側空白 */}
              <td style={{ width: '28mm', padding: 0 }}>&nbsp;</td>
              {/* 中央: タイトル 16px太字 */}
              <td
                style={{
                  textAlign: 'center' as const,
                  fontSize: '16px',
                  fontWeight: 'bold',
                  padding: '2px 0',
                  verticalAlign: 'middle',
                }}
              >
                作業打合せ及び安全衛生日誌
              </td>
              {/* 右側: 所長確認欄 */}
              <td style={{ width: '28mm', verticalAlign: 'top', padding: 0 }}>
                <table
                  style={{
                    width: '28mm',
                    borderCollapse: 'collapse' as const,
                  }}
                >
                  <tbody>
                    <tr>
                      <td
                        style={{
                          border: B,
                          fontSize: '8px',
                          fontWeight: 'bold',
                          textAlign: 'center' as const,
                          padding: '1px',
                          height: '6mm',
                          verticalAlign: 'middle',
                        }}
                      >
                        所長確認
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          border: B,
                          height: '18mm',
                          verticalAlign: 'middle',
                          textAlign: 'center' as const,
                        }}
                      >
                        {/* 空白（押印欄） */}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ==================================================================
            第2段: 基本情報行 → 変更なし
            ================================================================== */}
        <table style={{ ...TABLE_BASE, marginBottom: '1px', fontSize: '10px' }}>
          <tbody>
            <tr>
              <td style={{ ...TH, fontSize: '10px', width: '7%', height: '18px' }}>工事名</td>
              <td style={{ ...CELL, fontSize: '10px', width: '35%', height: '18px' }}>{data.project || ''}</td>
              <td style={{ ...TH, fontSize: '10px', width: '7%', height: '18px' }}>打合せ日</td>
              <td style={{ ...CELL, fontSize: '10px', width: '15%', height: '18px' }}>
                {data.meetingDate || ''}{data.meetingDate ? getDayOfWeekLabel(data.meetingDate) : ''}
              </td>
              <td style={{ ...TH, fontSize: '10px', width: '6%', height: '18px' }}>作業日</td>
              <td style={{ ...CELL, fontSize: '10px', width: '15%', height: '18px' }}>
                {data.workDate || ''}{data.workDate ? getDayOfWeekLabel(data.workDate) : ''}
              </td>
              <td style={{ ...TH, fontSize: '10px', width: '7%', height: '18px' }}>打合せ者</td>
              <td style={{ ...CELL, fontSize: '10px', width: '8%', height: '18px' }}>{data.meetingConductor || ''}</td>
            </tr>
          </tbody>
        </table>

        {/* ==================================================================
            第3段: 統合テーブル（10行）→ 変更なし
            ================================================================== */}
        <table style={{ ...TABLE_BASE, marginBottom: '0px' }}>
          <colgroup>
            <col style={{ width: '14%' }} /> {/* 作業箇所・作業内容 */}
            <col style={{ width: '8%' }} />  {/* 会社名 */}
            <col style={{ width: '5%' }} />  {/* 人数(予定) */}
            <col style={{ width: '5%' }} />  {/* 人数(実施) */}
            <col style={{ width: '10%' }} /> {/* 主要機械 */}
            <col style={{ width: '8%' }} />  {/* 搬出入資機材 */}
            <col style={{ width: '8%' }} />  {/* 段取り資材等 */}
            <col style={{ width: '22%' }} /> {/* 安全衛生指示事項 */}
            <col style={{ width: '16%' }} /> {/* 基本確認事項 */}
            <col style={{ width: '4%' }} />  {/* 結果 */}
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...TH, fontSize: '8px', height: '17px', whiteSpace: 'normal' as const, lineHeight: 1.1 }}>
                作業箇所・<br />作業内容
              </th>
              <th style={{ ...TH, fontSize: '8px', height: '17px' }}>会社名</th>
              <th style={{ ...TH, fontSize: '8px', height: '17px', whiteSpace: 'normal' as const, lineHeight: 1.1 }}>
                人数<br />(予定)
              </th>
              <th style={{ ...TH, fontSize: '8px', height: '17px', whiteSpace: 'normal' as const, lineHeight: 1.1 }}>
                人数<br />(実施)
              </th>
              <th style={{ ...TH, fontSize: '8px', height: '17px' }}>主要機械</th>
              <th style={{ ...TH, fontSize: '8px', height: '17px', whiteSpace: 'normal' as const, lineHeight: 1.1 }}>
                搬出入<br />資機材
              </th>
              <th style={{ ...TH, fontSize: '8px', height: '17px', whiteSpace: 'normal' as const, lineHeight: 1.1 }}>
                段取り<br />資材等
              </th>
              <th style={{ ...TH, fontSize: '8px', height: '17px' }}>安全衛生指示事項</th>
              <th style={{ ...TH, fontSize: '8px', height: '17px' }}>基本確認事項</th>
              <th style={{ ...TH, fontSize: '8px', height: '17px' }}>結果</th>
            </tr>
          </thead>
          <tbody>
            {integratedRows.slice(0, WORK_ROWS).map((row, idx) => {
              const isAdd = row.isAdditional;
              const baseCellStyle: React.CSSProperties = {
                border: B,
                padding: '3px 4px',
                fontSize: '7.5px',
                height: '17px',
                lineHeight: 1.3,
                verticalAlign: 'middle',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap' as const,
                ...(isAdd ? RED : {}),
              };
              const actualCellStyle: React.CSSProperties = {
                ...baseCellStyle,
                textAlign: 'center' as const,
                ...RED,
              };
              const safetyCellStyle: React.CSSProperties = {
                border: B,
                padding: '3px 4px',
                fontSize: '7px',
                height: '17px',
                lineHeight: 1.2,
                verticalAlign: 'middle',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap' as const,
              };
              const confirmCellStyle: React.CSSProperties = {
                border: B,
                padding: '3px 4px',
                fontSize: '7px',
                height: '17px',
                lineHeight: 1.2,
                verticalAlign: 'middle',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap' as const,
              };
              const resultCellStyle: React.CSSProperties = {
                border: B,
                padding: '2px 2px',
                fontSize: '7px',
                height: '17px',
                lineHeight: 1.2,
                verticalAlign: 'middle',
                textAlign: 'center' as const,
              };

              return (
                <tr key={idx}>
                  <td style={baseCellStyle}>{row.workContent || '\u00A0'}</td>
                  <td style={baseCellStyle}>{row.company || '\u00A0'}</td>
                  <td style={{ ...baseCellStyle, textAlign: 'center' as const }}>
                    {isAdd ? '\u00A0' : (row.plannedWorkers || '\u00A0')}
                  </td>
                  <td style={actualCellStyle}>{row.actualWorkers || '\u00A0'}</td>
                  <td style={baseCellStyle}>{row.machine || '\u00A0'}</td>
                  <td style={baseCellStyle}>{row.material || '\u00A0'}</td>
                  <td style={baseCellStyle}>{row.preparation || '\u00A0'}</td>
                  <td style={safetyCellStyle}>{row.safetyInstruction || '\u00A0'}</td>
                  <td style={confirmCellStyle}>{row.confirmationLabel || '\u00A0'}</td>
                  {/* 【修正】結果: 良・否の両方表示＋赤い丸枠線方式（テキストは黒字） */}
                  <td style={resultCellStyle}>
                    {renderCircledChoice(row.confirmationResult, '良', '否')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ==================================================================
            【修正】第4段: 左右2カラム（ダンプ・人員・段階・立会（2行構成） ＋ 当現場確認項目）
            ダンプ台数の行を1行から2行構成に変更し、rowspanで整理
            ================================================================== */}
        <table style={{ ...TABLE_BASE, marginBottom: '0px' }}>
          <tbody>
            <tr>
              {/* === 左セル（50%）: 【修正】ダンプ台数2行構成（rowSpan使用） === */}
              <td style={{ width: '50%', verticalAlign: 'top', padding: 0 }}>
                <table style={{ ...TABLE_BASE }}>
                  <colgroup>
                    {/* 【修正】列幅: ダンプ台数ラベル12%、搬入搬出38%、本日の作業人員数30%、段階/立会確認20% */}
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '38%' }} />
                    <col style={{ width: '30%' }} />
                    <col style={{ width: '20%' }} />
                  </colgroup>
                  <tbody>
                    {/* 【修正】行1: ダンプ台数ラベル(rowSpan=2) | 搬入 | 本日の作業人員数(rowSpan=2) | 段階確認 */}
                    <tr>
                      <td
                        rowSpan={2}
                        style={{
                          border: B,
                          padding: '3px 4px',
                          fontSize: '8px',
                          height: '17px',
                          verticalAlign: 'middle',
                          textAlign: 'center' as const,
                          fontWeight: 'bold',
                        }}
                      >
                        ダンプ台数
                      </td>
                      <td
                        style={{
                          border: B,
                          padding: '3px 4px',
                          fontSize: '8px',
                          height: '17px',
                          verticalAlign: 'middle',
                          whiteSpace: 'nowrap' as const,
                        }}
                      >
                        搬入：<span style={RED}>{dumpIncoming}</span>台
                      </td>
                      <td
                        rowSpan={2}
                        style={{
                          border: B,
                          padding: '3px 4px',
                          fontSize: '8px',
                          height: '17px',
                          verticalAlign: 'middle',
                          textAlign: 'center' as const,
                          whiteSpace: 'nowrap' as const,
                        }}
                      >
                        <span style={{ fontWeight: 'bold' }}>本日の作業人員数</span>
                        {'　'}
                        <span style={{ ...RED, fontWeight: 'bold' }}>{totalWorkers}</span>名
                      </td>
                      {/* 【修正】段階確認: 有・無＋赤い丸枠線方式（テキストは黒字） */}
                      <td
                        style={{
                          border: B,
                          padding: '3px 4px',
                          fontSize: '8px',
                          height: '17px',
                          verticalAlign: 'middle',
                          textAlign: 'center' as const,
                          whiteSpace: 'nowrap' as const,
                        }}
                      >
                        <span style={{ fontWeight: 'bold' }}>段階確認</span>
                        {'　'}
                        {renderCircledChoice(data.stageConfirmation || '', '有', '無')}
                      </td>
                    </tr>
                    {/* 【修正】行2: (ダンプ台数はrowSpanで結合済) | 搬出 | (人員数はrowSpanで結合済) | 立会確認 */}
                    <tr>
                      <td
                        style={{
                          border: B,
                          padding: '3px 4px',
                          fontSize: '8px',
                          height: '17px',
                          verticalAlign: 'middle',
                          whiteSpace: 'nowrap' as const,
                        }}
                      >
                        搬出：<span style={RED}>{dumpOutgoing}</span>台
                      </td>
                      {/* 【修正】立会確認: 有・無＋赤い丸枠線方式（テキストは黒字） */}
                      <td
                        style={{
                          border: B,
                          padding: '3px 4px',
                          fontSize: '8px',
                          height: '17px',
                          verticalAlign: 'middle',
                          textAlign: 'center' as const,
                          whiteSpace: 'nowrap' as const,
                        }}
                      >
                        <span style={{ fontWeight: 'bold' }}>立会確認</span>
                        {'　'}
                        {renderCircledChoice(data.witnessConfirmation || '', '有', '無')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>

              {/* === 右セル（50%）: 当現場確認項目（ヘッダー行＋5データ行）→ 変更なし === */}
              <td style={{ width: '50%', verticalAlign: 'top', padding: 0 }}>
                <table style={{ ...TABLE_BASE }}>
                  <colgroup>
                    {/* 列幅調整: No.列3%、確認項目列30%、結果列8% × 左右 */}
                    <col style={{ width: '6%' }} />  {/* No.(左) */}
                    <col style={{ width: '60%' }} /> {/* 確認項目(左) → 左右分で30%相当 */}
                    <col style={{ width: '16%' }} /> {/* 結果(左) → 左右分で8%相当 */}
                    <col style={{ width: '6%' }} />  {/* No.(右) */}
                    <col style={{ width: '60%' }} /> {/* 確認項目(右) */}
                    <col style={{ width: '16%' }} /> {/* 結果(右) */}
                  </colgroup>
                  <thead>
                    {/* 全幅結合ヘッダー: 当現場確認項目 */}
                    <tr>
                      <th
                        colSpan={6}
                        style={{
                          border: B,
                          padding: '2px 4px',
                          fontWeight: 'bold',
                          fontSize: '9px',
                          textAlign: 'center' as const,
                          height: '17px',
                        }}
                      >
                        当現場確認項目
                      </th>
                    </tr>
                    {/* サブヘッダー */}
                    <tr>
                      <th style={{ ...TH, fontSize: '8px', height: '17px' }}>No.</th>
                      <th style={{ ...TH, fontSize: '8px', height: '17px' }}>確認項目</th>
                      <th style={{ ...TH, fontSize: '8px', height: '17px' }}>結果</th>
                      <th style={{ ...TH, fontSize: '8px', height: '17px' }}>No.</th>
                      <th style={{ ...TH, fontSize: '8px', height: '17px' }}>確認項目</th>
                      <th style={{ ...TH, fontSize: '8px', height: '17px' }}>結果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 1, 2, 3, 4].map((i) => {
                      const left = SITE_CONFIRMATION_LABELS[i];
                      const right = SITE_CONFIRMATION_LABELS[i + 5];
                      const leftResult = data.step3SiteConfirmationItems
                        ? data.step3SiteConfirmationItems[left.key]
                        : '';
                      const rightResult = data.step3SiteConfirmationItems
                        ? data.step3SiteConfirmationItems[right.key]
                        : '';
                      return (
                        <tr key={i}>
                          <td style={{ ...CELL, textAlign: 'center' as const, height: '17px', fontSize: '8px' }}>
                            {i + 1}
                          </td>
                          <td style={{ ...CELL_WRAP, height: '17px', fontSize: '8px', padding: '2px 4px' }}>
                            {left.label}
                          </td>
                          {/* 結果: 良・否＋赤い丸枠線方式（テキストは黒字） */}
                          <td
                            style={{
                              border: B,
                              padding: '2px 3px',
                              textAlign: 'center' as const,
                              fontSize: '8px',
                              height: '17px',
                              verticalAlign: 'middle',
                            }}
                          >
                            {renderCircledChoice(leftResult || '', '良', '否')}
                          </td>
                          <td style={{ ...CELL, textAlign: 'center' as const, height: '17px', fontSize: '8px' }}>
                            {i + 6}
                          </td>
                          <td style={{ ...CELL_WRAP, height: '17px', fontSize: '8px', padding: '2px 4px' }}>
                            {right.label}
                          </td>
                          {/* 結果: 良・否＋赤い丸枠線方式（テキストは黒字） */}
                          <td
                            style={{
                              border: B,
                              padding: '2px 3px',
                              textAlign: 'center' as const,
                              fontSize: '8px',
                              height: '17px',
                              verticalAlign: 'middle',
                            }}
                          >
                            {renderCircledChoice(rightResult || '', '良', '否')}
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
            【修正】第5段: 左右2カラム（作業連絡・巡視・配置図 ＋ 点検チェックリスト）
            空白スペースを削除し、第4段の直下に隙間なく配置。
            配置図の枠の縦幅を拡大してページ下部まで使う。
            ================================================================== */}
        <table style={{ ...TABLE_BASE }}>
          <tbody>
            <tr>
              {/* ====================================
                  左セル（50%）: 作業連絡調整事項 + 巡視記録 + 配置図
                  ==================================== */}
              <td style={{ width: '50%', verticalAlign: 'top', padding: 0 }}>
                {/* 作業連絡調整事項 + 巡視記録 + 巡視所見 + 配置図 を1つのテーブルにまとめる */}
                <table style={{ ...TABLE_BASE }}>
                  <tbody>
                    {/* 作業連絡調整事項 ヘッダー行: 8.5px太字 */}
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          ...TH_WRAP,
                          textAlign: 'left' as const,
                          fontSize: '8.5px',
                        }}
                      >
                        ＊作業連絡調整事項・打合せ・朝礼等周知事項・その他
                      </td>
                    </tr>
                    {/* 作業連絡調整事項 データ行: height 28px、fontSize 8px、上寄せ */}
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          ...CELL_WRAP,
                          height: '28px',
                          fontSize: '8px',
                          verticalAlign: 'top',
                          ...RED,
                        }}
                      >
                        {data.patrolRecord?.coordinationNotes || ''}
                      </td>
                    </tr>
                    {/* 巡視点検者・巡視時間: height 18px、fontSize 8.5px */}
                    <tr>
                      <td style={{ ...TH, width: '15%', height: '18px', fontSize: '8.5px' }}>巡視点検者</td>
                      <td style={{ ...CELL, width: '35%', height: '18px', fontSize: '8.5px', ...RED }}>
                        {data.patrolRecord?.inspector || ''}
                      </td>
                      <td style={{ ...TH, width: '15%', height: '18px', fontSize: '8.5px' }}>巡視時間</td>
                      <td style={{ ...CELL, width: '35%', height: '18px', fontSize: '8.5px', ...RED }}>
                        {data.patrolRecord?.inspectionTime || ''}
                      </td>
                    </tr>
                    {/* 巡視所見ヘッダー: 8.5px太字 */}
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          ...TH,
                          textAlign: 'left' as const,
                          fontSize: '8.5px',
                        }}
                      >
                        巡視所見
                      </td>
                    </tr>
                    {/* 巡視所見データ: height 28px、fontSize 8px、上寄せ */}
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          ...CELL_WRAP,
                          height: '28px',
                          fontSize: '8px',
                          verticalAlign: 'top',
                          ...RED,
                        }}
                      >
                        {data.patrolRecord?.findings || ''}
                      </td>
                    </tr>
                    {/* 配置図・略図 ヘッダー: 8.5px太字 */}
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          ...TH,
                          textAlign: 'left' as const,
                          fontSize: '8.5px',
                        }}
                      >
                        （配置図・略図）
                      </td>
                    </tr>
                    {/* 【修正】配置図 画像セル: 縦幅を大幅に拡大（130px → 230px）してページ下部まで活用 */}
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          ...CELL,
                          textAlign: 'center' as const,
                          verticalAlign: 'middle',
                          padding: '2px',
                          height: '230px',
                          whiteSpace: 'normal' as const,
                        }}
                      >
                        {data.annotatedDiagramUrl ? (
                          <img
                            src={data.annotatedDiagramUrl}
                            alt="配置図"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '220px',
                              objectFit: 'contain' as const,
                              display: 'block',
                              margin: '0 auto',
                            }}
                          />
                        ) : data.baseDiagramUrl ? (
                          <img
                            src={data.baseDiagramUrl}
                            alt="配置図"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '220px',
                              objectFit: 'contain' as const,
                              display: 'block',
                              margin: '0 auto',
                            }}
                          />
                        ) : (
                          <span>&nbsp;</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>

              {/* ====================================
                  右セル（50%）: 点検チェックリスト（変更なし）
                  ==================================== */}
              <td style={{ width: '50%', verticalAlign: 'top', padding: 0 }}>
                {/* 点検チェックリスト ヘッダー: 7.5px太字 */}
                <table style={{ ...TABLE_BASE }}>
                  <tbody>
                    <tr>
                      <td
                        style={{
                          border: B,
                          padding: '2px 3px',
                          fontWeight: 'bold',
                          fontSize: '7.5px',
                          textAlign: 'left' as const,
                          lineHeight: 1.3,
                        }}
                      >
                        ② 点検チェックリスト　記号　○適正　△一部適正　×不適切　◎是正済　無印は該当無
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* 点検チェックリスト本体: 左右2列 */}
                <table style={{ ...TABLE_BASE }}>
                  <tbody>
                    <tr>
                      {/* 左列: 管理、重機・機械、電気 */}
                      <td
                        style={{
                          width: '50%',
                          verticalAlign: 'top',
                          padding: 0,
                          border: B,
                        }}
                      >
                        <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                          <tbody>{renderChecklistColumn(LEFT_CHECKLIST_KEYS)}</tbody>
                        </table>
                      </td>

                      {/* 右列: 墜落転落、飛来・落下崩壊・転倒、作業環境、その他 */}
                      <td
                        style={{
                          width: '50%',
                          verticalAlign: 'top',
                          padding: 0,
                          border: B,
                        }}
                      >
                        <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
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
    </>
  );
};

// ============================
// 丸数字変換ヘルパー（未使用だが後方互換のため残す）
// ============================
function toCircledNumber(n: number): string {
  const circled = [
    '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
    '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳',
  ];
  if (n >= 1 && n <= 20) return circled[n - 1];
  return `(${n})`;
}

export default DailySafetyPrintLayout;
