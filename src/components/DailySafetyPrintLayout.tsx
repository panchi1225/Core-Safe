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
  // 令和は2019年5月1日から
  if (year >= 2019) {
    const reiwa = year - 2018;
    return `令和${reiwa}年${month}月${day}日`;
  }
  // 平成
  if (year >= 1989) {
    const heisei = year - 1988;
    return `平成${heisei}年${month}月${day}日`;
  }
  return `${year}年${month}月${day}日`;
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
  { key: 'falling', title: '墜落・転落' },
  { key: 'debris', title: '飛来・落下崩壊・転倒' },
  { key: 'environment', title: '作業環境' },
  { key: 'others', title: 'その他' },
];

// 点検チェックリスト2列配置: 左列・右列の振り分け
const LEFT_CHECKLIST_KEYS: (keyof Step5InspectionChecklist)[] = ['management', 'machinery', 'electrical'];
const RIGHT_CHECKLIST_KEYS: (keyof Step5InspectionChecklist)[] = ['falling', 'debris', 'environment', 'others'];

// ============================
// 共通スタイル定数
// ============================
const B = '1px solid black'; // 罫線

/** 全テーブル共通スタイル */
const TABLE_BASE: React.CSSProperties = {
  borderCollapse: 'collapse' as const,
  width: '100%',
  tableLayout: 'fixed' as const,
  margin: 0,
  padding: 0,
};

/** 全セル共通スタイル */
const CELL: React.CSSProperties = {
  border: B,
  padding: '2px 3px',
  fontSize: '7px',
  lineHeight: 1.2,
  verticalAlign: 'middle',
  overflow: 'hidden',
  whiteSpace: 'nowrap' as const,
  textOverflow: 'ellipsis',
};

/** THセル（ヘッダー）共通スタイル */
const TH: React.CSSProperties = {
  ...CELL,
  fontWeight: 'bold',
  textAlign: 'center' as const,
  backgroundColor: 'white',
};

/** 赤字スタイル */
const RED: React.CSSProperties = {
  color: 'red',
  WebkitPrintColorAdjust: 'exact' as any,
};

// ============================
// 固定行数定数
// ============================
const WORK_ROWS = 10; // 統合テーブルの固定行数

// ============================
// Props
// ============================
interface Props {
  data: DailySafetyReportData;
}

// ============================
// 丸囲み表示関数
// value が option1 に一致 → option1 を赤い丸枠で囲み、区切り「・」、option2 を通常表示
// value が option2 に一致 → option1 を通常表示、区切り「・」、option2 を赤い丸枠で囲む
// どちらでもない → 両方を通常表示
// 丸枠スタイル: border のみ赤、テキストは常に黒
// ============================
function circledChoice(
  value: string,
  option1: string,
  option2: string
): JSX.Element {
  const circleStyle: React.CSSProperties = {
    border: '2px solid red',
    borderRadius: '50%',
    display: 'inline-block',
    width: '16px',
    height: '16px',
    textAlign: 'center' as const,
    lineHeight: '14px',
    color: 'black',
  };
  const normalStyle: React.CSSProperties = {
    display: 'inline-block',
    color: 'black',
  };

  const isOption1 = value === option1;
  const isOption2 = value === option2;

  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <span style={isOption1 ? circleStyle : normalStyle}>{option1}</span>
      <span style={{ color: 'black' }}>・</span>
      <span style={isOption2 ? circleStyle : normalStyle}>{option2}</span>
    </span>
  );
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
  const safetyInstructions = data?.safetyInstructions || [];
  const confirmationItems = data?.step3ConfirmationItems || ({} as any);
  const siteConfirmationItems = data?.step3SiteConfirmationItems || ({} as any);
  const inspectionChecklist = data?.step5InspectionChecklist || ({ categories: [] } as any);
  const dumpTrucks = data?.dumpTrucks || ({ incoming: '', outgoing: '' } as any);
  const patrolRecord = data?.patrolRecord || ({} as any);
  const stageConfirmation = data?.stageConfirmation || '';
  const witnessConfirmation = data?.witnessConfirmation || '';
  const workNotes = data?.workNotes || (patrolRecord?.coordinationNotes || '');
  const diagramUrl = (data as any)?.diagramUrl || (data as any)?.diagramImage || (data as any)?.annotatedDiagramUrl || (data as any)?.baseDiagramUrl || '';
  const presenter = data?.presenter || (data as any)?.meetingConductor || '';
  const projectName = data?.projectName || (data as any)?.project || '';
  const meetingDate = data?.meetingDate || '';
  const workDate = data?.workDate || '';

  // --- 追加作業エントリ ---
  const additionalEntries = (data as any)?.step3AdditionalWorkEntries || [];

  // --- 作業人数合計（赤字表示用） ---
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

  // --- ダンプ台数 ---
  const dumpIncoming = dumpTrucks.incoming || '';
  const dumpOutgoing = dumpTrucks.outgoing || '';

  // --- 統合テーブル用の行データ生成 ---
  type IntegratedRowData = {
    workContent: string;
    company: string;
    plannedWorkers: string;
    actualWorkersVal: string;
    machine: string;
    machine2: string;
    material: string;
    safetyInstruction: string;
    confirmationLabel: string;
    confirmationResult: string;
    isAdditional: boolean;
  };

  const integratedRows: IntegratedRowData[] = [];

  // STEP1の作業行
  workEntries.forEach((entry: any, index: number) => {
    const found = actualWorkers.find ? actualWorkers.find((aw: any) => aw.entryIndex === index) : undefined;
    const actualCount = found ? found.count : 0;
    integratedRows.push({
      workContent: entry.workContent || '',
      company: entry.company || '',
      plannedWorkers: String(entry.plannedWorkers || ''),
      actualWorkersVal: actualCount > 0 ? String(actualCount) : '',
      machine: entry.machine || '',
      machine2: entry.machine2 || '',
      material: materialEntries[index] || '',
      safetyInstruction: '',
      confirmationLabel: '',
      confirmationResult: '',
      isAdditional: false,
    });
  });

  // STEP3の追加作業行
  additionalEntries.forEach((entry: any) => {
    integratedRows.push({
      workContent: entry.description || '',
      company: entry.company || '',
      plannedWorkers: '',
      actualWorkersVal: entry.actualWorkers > 0 ? String(entry.actualWorkers) : '',
      machine: entry.machines ? entry.machines.filter((m: any) => m).join(', ') : '',
      machine2: '',
      material: '',
      safetyInstruction: '',
      confirmationLabel: '',
      confirmationResult: '',
      isAdditional: true,
    });
  });

  // 10行まで空行で埋める
  while (integratedRows.length < WORK_ROWS) {
    integratedRows.push({
      workContent: '',
      company: '',
      plannedWorkers: '',
      actualWorkersVal: '',
      machine: '',
      machine2: '',
      material: '',
      safetyInstruction: '',
      confirmationLabel: '',
      confirmationResult: '',
      isAdditional: false,
    });
  }

  // 各行に安全衛生指示事項・基本確認事項・結果を設定
  for (let i = 0; i < WORK_ROWS; i++) {
    integratedRows[i].safetyInstruction = safetyInstructions[i] || '';
    integratedRows[i].confirmationLabel = CONFIRMATION_LABELS[i]?.label || '';
    const confirmKey = CONFIRMATION_LABELS[i]?.key;
    integratedRows[i].confirmationResult = confirmKey ? (confirmationItems[confirmKey] || '') : '';
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
      const items = getVisibleItems(inspectionChecklist[key] || []);

      // カテゴリヘッダー行
      rows.push(
        <tr key={`hdr-${key}`}>
          <td
            colSpan={2}
            style={{
              border: B,
              padding: '1px 2px',
              fontWeight: 'bold',
              fontSize: '6px',
              textAlign: 'left' as const,
              height: '10px',
              lineHeight: 1.2,
            }}
          >
            【{cat.title}】
          </td>
        </tr>
      );

      // 小項目行
      items.forEach((item, idx) => {
        rows.push(
          <tr key={`${key}-${idx}`}>
            <td
              style={{
                border: B,
                padding: '1px 2px',
                fontSize: '5.5px',
                textAlign: 'left' as const,
                height: '10px',
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
                padding: '1px 2px',
                fontSize: '5.5px',
                textAlign: 'center' as const,
                width: '16px',
                height: '10px',
                lineHeight: 1.2,
                ...RED,
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
      {/* 印刷用CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; }
        }
        @page { size: landscape; margin: 0; }
      `}</style>

      {/* 帳票本体（A4横 297mm × 210mm） */}
      <div
        id="print-area"
        style={{
          width: '297mm',
          height: '210mm',
          padding: '4mm',
          overflow: 'hidden',
          background: 'white',
          boxSizing: 'border-box',
          fontFamily: "'MS Gothic', 'Hiragino Kaku Gothic Pro', monospace",
          position: 'relative',
          color: 'black',
          WebkitPrintColorAdjust: 'exact' as any,
        }}
      >
        {/* ==================================================================
            第1段: ヘッダー（タイトル + 所長確認欄）
            テーブル1行3列、セルにborderなし
            ================================================================== */}
        <table style={{ ...TABLE_BASE }}>
          <tbody>
            <tr>
              {/* 左セル（25%）: 空白 */}
              <td style={{ width: '25%', border: 'none', padding: 0 }}>&nbsp;</td>
              {/* 中央セル（50%）: タイトル */}
              <td
                style={{
                  width: '50%',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  textAlign: 'center' as const,
                  padding: '2px 0',
                }}
              >
                作業打合せ及び安全衛生日誌
              </td>
              {/* 右セル（25%）: 所長確認欄 */}
              <td
                style={{
                  width: '25%',
                  border: 'none',
                  textAlign: 'right' as const,
                  verticalAlign: 'bottom',
                  padding: '0 0 2px 0',
                }}
              >
                <div style={{ fontSize: '7px', textAlign: 'right' }}>所長確認欄</div>
                <div
                  style={{
                    border: '1px solid black',
                    height: '20px',
                    width: '80px',
                    display: 'inline-block',
                  }}
                />
              </td>
            </tr>
          </tbody>
        </table>

        {/* ==================================================================
            第2段: 基本情報行（1行8列）
            ================================================================== */}
        <table style={{ ...TABLE_BASE }}>
          <colgroup>
            <col style={{ width: '6%' }} />
            <col style={{ width: '32%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '14%' }} />
          </colgroup>
          <tbody>
            <tr>
              <th style={{ ...TH, fontSize: '7.5px' }}>工事名</th>
              <td style={{ ...CELL, fontSize: '7px', paddingLeft: '4px' }}>{projectName}</td>
              <th style={{ ...TH, fontSize: '7.5px' }}>打合せ日</th>
              <td style={{ ...CELL, fontSize: '7px', paddingLeft: '4px' }}>
                {toWareki(meetingDate)}{getWeekdayLabel(meetingDate)}
              </td>
              <th style={{ ...TH, fontSize: '7.5px' }}>作業日</th>
              <td style={{ ...CELL, fontSize: '7px', paddingLeft: '4px' }}>
                {toWareki(workDate)}{getWeekdayLabel(workDate)}
              </td>
              <th style={{ ...TH, fontSize: '7.5px' }}>打合せ実施者</th>
              <td style={{ ...CELL, fontSize: '7px', paddingLeft: '4px', ...RED }}>
                {presenter}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ==================================================================
            第3段: 統合作業テーブル（9列×ヘッダー1行＋データ10行固定）
            ================================================================== */}
        <table style={{ ...TABLE_BASE }}>
          <colgroup>
            <col style={{ width: '13%' }} /> {/* 作業内容 */}
            <col style={{ width: '8%' }} />  {/* 会社名 */}
            <col style={{ width: '4%' }} />  {/* 人数（予定） */}
            <col style={{ width: '4%' }} />  {/* 人数（実施） */}
            <col style={{ width: '10%' }} /> {/* 主要機械 */}
            <col style={{ width: '8%' }} />  {/* 搬出入資機材 */}
            <col style={{ width: '25%' }} /> {/* 安全衛生指示事項 */}
            <col style={{ width: '23%' }} /> {/* 基本確認事項 */}
            <col style={{ width: '5%' }} />  {/* 結果 */}
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...TH, fontSize: '6.5px', height: '14px' }}>作業内容</th>
              <th style={{ ...TH, fontSize: '6.5px', height: '14px' }}>会社名</th>
              <th style={{ ...TH, fontSize: '6.5px', height: '14px', whiteSpace: 'normal' as const, lineHeight: 1.1 }}>
                人数<br />（予定）
              </th>
              <th style={{ ...TH, fontSize: '6.5px', height: '14px', whiteSpace: 'normal' as const, lineHeight: 1.1 }}>
                人数<br />（実施）
              </th>
              <th style={{ ...TH, fontSize: '6.5px', height: '14px' }}>主要機械</th>
              <th style={{ ...TH, fontSize: '6.5px', height: '14px' }}>搬出入資機材</th>
              <th style={{ ...TH, fontSize: '6.5px', height: '14px' }}>安全衛生指示事項</th>
              <th style={{ ...TH, fontSize: '6.5px', height: '14px' }}>基本確認事項</th>
              <th style={{ ...TH, fontSize: '6.5px', height: '14px' }}>結果</th>
            </tr>
          </thead>
          <tbody>
            {integratedRows.slice(0, WORK_ROWS).map((row, idx) => {
              const isAdd = row.isAdditional;
              // データセル共通スタイル（赤字）
              const dataCell: React.CSSProperties = {
                ...CELL,
                height: '14px',
                ...RED,
                ...(isAdd ? {} : {}),
              };

              // 主要機械の表示内容を生成
              const renderMachineContent = () => {
                const m1 = row.machine || '';
                const m2 = row.machine2 || '';
                if (m1 && m2) {
                  return <>{m1}<br />{m2}</>;
                } else if (m1) {
                  return <>{m1}</>;
                } else if (m2) {
                  return <>{m2}</>;
                }
                return <>{'\u00A0'}</>;
              };

              return (
                <tr key={idx}>
                  {/* 作業内容 */}
                  <td style={dataCell}>
                    {row.workContent || '\u00A0'}
                  </td>
                  {/* 会社名 */}
                  <td style={dataCell}>
                    {row.company || '\u00A0'}
                  </td>
                  {/* 人数（予定） */}
                  <td style={{ ...dataCell, textAlign: 'center' as const }}>
                    {row.plannedWorkers || '\u00A0'}
                  </td>
                  {/* 人数（実施） */}
                  <td style={{ ...dataCell, textAlign: 'center' as const }}>
                    {row.actualWorkersVal || '\u00A0'}
                  </td>
                  {/* 主要機械: machine + machine2 を改行で表示 */}
                  <td style={{ ...dataCell, whiteSpace: 'normal' as const, lineHeight: 1.1 }}>
                    {renderMachineContent()}
                  </td>
                  {/* 搬出入資機材 */}
                  <td style={dataCell}>
                    {row.material || '\u00A0'}
                  </td>
                  {/* 安全衛生指示事項 */}
                  <td style={{ ...dataCell, whiteSpace: 'normal' as const }}>
                    {row.safetyInstruction || '\u00A0'}
                  </td>
                  {/* 基本確認事項 */}
                  <td style={{ ...dataCell, whiteSpace: 'normal' as const }}>
                    {row.confirmationLabel || '\u00A0'}
                  </td>
                  {/* 結果: 良・否の丸囲み */}
                  <td style={{ ...CELL, height: '14px', fontSize: '6px', textAlign: 'center' as const }}>
                    {circledChoice(row.confirmationResult, '良', '否')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ==================================================================
            第4段: 左右2分割（ダンプ台数 + 当現場確認項目）
            外枠テーブル1行2列、第3段との間にスペースなし
            ================================================================== */}
        <table style={{ ...TABLE_BASE }}>
          <tbody>
            <tr>
              {/* ====================================
                  左側セル（50%）: ダンプ台数
                  ==================================== */}
              <td style={{ width: '50%', verticalAlign: 'top', padding: 0 }}>
                <table style={{ ...TABLE_BASE }}>
                  <colgroup>
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '23%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '50%' }} />
                  </colgroup>
                  <tbody>
                    {/* ダンプ台数 行1: 搬入 + 作業人員数 + 段階確認 */}
                    <tr>
                      {/* ダンプ台数ラベル: rowSpan=2 */}
                      <td
                        rowSpan={2}
                        style={{
                          ...TH,
                          fontSize: '7px',
                        }}
                      >
                        ダンプ台数
                      </td>
                      {/* 搬入データ */}
                      <td style={{ ...CELL, fontSize: '7px' }}>
                        搬入：<span style={RED}>{dumpIncoming}</span>台
                      </td>
                      {/* 本日の作業人員数: rowSpan=2 */}
                      <td
                        rowSpan={2}
                        style={{
                          ...CELL,
                          textAlign: 'center' as const,
                          fontSize: '6px',
                        }}
                      >
                        <span>本日の作業人員数（実施）</span>
                        <br />
                        <span style={{ ...RED, fontWeight: 'bold', fontSize: '9px' }}>{totalWorkers}</span>
                        <span style={{ fontSize: '7px' }}>名</span>
                      </td>
                      {/* 段階確認 */}
                      <td style={{ ...CELL, fontSize: '7px', textAlign: 'center' as const }}>
                        <span style={{ fontWeight: 'bold' }}>段階確認</span>
                        {'　'}
                        {circledChoice(stageConfirmation, '有', '無')}
                      </td>
                    </tr>
                    {/* ダンプ台数 行2: 搬出 + 立会確認 */}
                    <tr>
                      {/* 搬出データ */}
                      <td style={{ ...CELL, fontSize: '7px' }}>
                        搬出：<span style={RED}>{dumpOutgoing}</span>台
                      </td>
                      {/* 立会確認 */}
                      <td style={{ ...CELL, fontSize: '7px', textAlign: 'center' as const }}>
                        <span style={{ fontWeight: 'bold' }}>立会確認</span>
                        {'　'}
                        {circledChoice(witnessConfirmation, '有', '無')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>

              {/* ====================================
                  右側セル（50%）: 当現場確認項目
                  ==================================== */}
              <td style={{ width: '50%', verticalAlign: 'top', padding: 0 }} rowSpan={1}>
                <table style={{ ...TABLE_BASE }}>
                  <colgroup>
                    <col style={{ width: '38%' }} /> {/* 確認項目（左） */}
                    <col style={{ width: '8%' }} />  {/* 結果（左） */}
                    <col style={{ width: '38%' }} /> {/* 確認項目（右） */}
                    <col style={{ width: '8%' }} />  {/* 結果（右） */}
                  </colgroup>
                  <thead>
                    {/* ヘッダー: 当現場確認項目 */}
                    <tr>
                      <th
                        colSpan={4}
                        style={{
                          ...TH,
                          fontSize: '7px',
                        }}
                      >
                        当現場確認項目
                      </th>
                    </tr>
                    {/* サブヘッダー */}
                    <tr>
                      <th style={{ ...TH, fontSize: '6px', height: '12px' }}>確認項目</th>
                      <th style={{ ...TH, fontSize: '6px', height: '12px' }}>結果</th>
                      <th style={{ ...TH, fontSize: '6px', height: '12px' }}>確認項目</th>
                      <th style={{ ...TH, fontSize: '6px', height: '12px' }}>結果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 当現場確認項目データ行（5行 × 左右） */}
                    {[0, 1, 2, 3, 4].map((i) => {
                      const left = SITE_CONFIRMATION_LABELS[i];
                      const right = SITE_CONFIRMATION_LABELS[i + 5];
                      const leftResult = left ? (siteConfirmationItems[left.key] || '') : '';
                      const rightResult = right ? (siteConfirmationItems[right.key] || '') : '';
                      return (
                        <tr key={i}>
                          <td style={{ ...CELL, fontSize: '6px', height: '12px', whiteSpace: 'normal' as const }}>
                            {left?.label || '\u00A0'}
                          </td>
                          <td style={{ ...CELL, fontSize: '6px', height: '12px', textAlign: 'center' as const }}>
                            {circledChoice(leftResult, '良', '否')}
                          </td>
                          <td style={{ ...CELL, fontSize: '6px', height: '12px', whiteSpace: 'normal' as const }}>
                            {right?.label || '\u00A0'}
                          </td>
                          <td style={{ ...CELL, fontSize: '6px', height: '12px', textAlign: 'center' as const }}>
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
            第5段: 左右2分割（作業連絡＋巡視＋配置図 / 点検チェックリスト）
            外枠テーブル1行2列、第4段との間にスペースなし
            ================================================================== */}
        <table style={{ ...TABLE_BASE }}>
          <tbody>
            <tr>
              {/* ====================================
                  左側セル（50%）: 作業連絡 + 巡視記録 + 配置図
                  ==================================== */}
              <td style={{ width: '50%', verticalAlign: 'top', padding: 0 }}>
                <table style={{ ...TABLE_BASE }}>
                  <colgroup>
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '53%' }} />
                  </colgroup>
                  <tbody>
                    {/* (a) 作業連絡調整事項ヘッダー行 */}
                    <tr>
                      <th
                        colSpan={4}
                        style={{
                          ...TH,
                          fontSize: '6.5px',
                          fontWeight: 'bold',
                          textAlign: 'left' as const,
                          height: '12px',
                        }}
                      >
                        ＊作業連絡調整事項・打合せ・朝礼等周知事項・その他
                      </th>
                    </tr>
                    {/* (b) 作業連絡調整事項データ行 */}
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          ...CELL,
                          whiteSpace: 'normal' as const,
                          height: '24px',
                          verticalAlign: 'top',
                          fontSize: '6px',
                          ...RED,
                        }}
                      >
                        {workNotes || (patrolRecord.coordinationNotes || '\u00A0')}
                      </td>
                    </tr>
                    {/* (c) 巡視点検者 + 巡視所見（1行に横並び） */}
                    <tr>
                      <th style={{ ...TH, fontSize: '7px', height: '14px' }}>巡視点検者</th>
                      <td style={{ ...CELL, fontSize: '7px', height: '14px', ...RED }}>
                        {patrolRecord.inspector || '\u00A0'}
                      </td>
                      <th style={{ ...TH, fontSize: '7px', height: '14px' }}>巡視所見</th>
                      <td style={{ ...CELL, fontSize: '6px', height: '14px', whiteSpace: 'normal' as const, ...RED }}>
                        {patrolRecord.findings || '\u00A0'}
                      </td>
                    </tr>
                    {/* (d) 巡視時間 */}
                    <tr>
                      <th style={{ ...TH, fontSize: '7px', height: '14px' }}>巡視時間</th>
                      <td style={{ ...CELL, fontSize: '7px', height: '14px', ...RED }}>
                        {patrolRecord.inspectionTime || '\u00A0'}
                      </td>
                      <td colSpan={2} style={{ ...CELL, height: '14px' }}>{'\u00A0'}</td>
                    </tr>
                    {/* (e) 配置図ヘッダー行 */}
                    <tr>
                      <th
                        colSpan={4}
                        style={{
                          ...TH,
                          fontSize: '7px',
                          textAlign: 'center' as const,
                          height: '12px',
                        }}
                      >
                        配置図・略図
                      </th>
                    </tr>
                    {/* (f) 配置図画像行: ページ下部まで拡大 */}
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          ...CELL,
                          textAlign: 'center' as const,
                          verticalAlign: 'top',
                          padding: '2px',
                          minHeight: '150px',
                          height: '150px',
                          whiteSpace: 'normal' as const,
                        }}
                      >
                        {diagramUrl ? (
                          <img
                            src={diagramUrl}
                            alt="配置図"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '100%',
                              objectFit: 'contain' as const,
                              display: 'block',
                              margin: '0 auto',
                            }}
                          />
                        ) : (
                          '\u00A0'
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>

              {/* ====================================
                  右側セル（50%）: 巡視点検チェックリスト
                  ==================================== */}
              <td style={{ width: '50%', verticalAlign: 'top', padding: 0 }}>
                <table style={{ ...TABLE_BASE }}>
                  <tbody>
                    {/* (a) タイトル行 */}
                    <tr>
                      <td
                        colSpan={2}
                        style={{
                          ...CELL,
                          fontSize: '6px',
                          fontWeight: 'bold',
                          textAlign: 'center' as const,
                          height: '11px',
                        }}
                      >
                        巡視点検チェックリスト　（ ○適正　△一部適正　×不適切　◎是正済　無印は該当無 ）
                      </td>
                    </tr>
                    {/* (b) チェックリスト本体: 左右2列 */}
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
                        <table style={{ width: '100%', borderCollapse: 'collapse' as const, margin: 0 }}>
                          <tbody>{renderChecklistColumn(LEFT_CHECKLIST_KEYS)}</tbody>
                        </table>
                      </td>
                      {/* 右列: 墜落・転落、飛来・落下崩壊・転倒、作業環境、その他 */}
                      <td
                        style={{
                          width: '50%',
                          verticalAlign: 'top',
                          padding: 0,
                          border: B,
                        }}
                      >
                        <table style={{ width: '100%', borderCollapse: 'collapse' as const, margin: 0 }}>
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

export default DailySafetyPrintLayout;
