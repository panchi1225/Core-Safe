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
// 共通スタイル定数
// ============================
const B = '1px solid black'; // 罫線
const CELL: React.CSSProperties = {
  border: B,
  padding: '1px 2px',
  verticalAlign: 'middle',
  lineHeight: 1.2,
  fontSize: '7px',
  whiteSpace: 'nowrap' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
const CELL_WRAP: React.CSSProperties = {
  ...CELL,
  whiteSpace: 'normal' as const,
  wordBreak: 'break-all' as const,
};
const TH: React.CSSProperties = {
  ...CELL,
  fontWeight: 'bold',
  textAlign: 'center' as const,
  backgroundColor: 'transparent',
};
const TH_WRAP: React.CSSProperties = {
  ...TH,
  whiteSpace: 'normal' as const,
  wordBreak: 'break-all' as const,
};
const RED: React.CSSProperties = { color: 'red' };

// ============================
// 作業行の固定行数
// ============================
const WORK_ROWS = 10;

// ============================
// 安全衛生指示事項の固定行数
// ============================
const SAFETY_INSTRUCTION_ROWS = 10;

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
  // --- 作業人数合計（赤字表示用） ---
  const totalWorkers = (() => {
    let total = 0;
    data.workEntries.forEach((_, index) => {
      const found = (data.actualWorkers || []).find((aw) => aw.entryIndex === index);
      total += found ? found.count : 0;
    });
    (data.step3AdditionalWorkEntries || []).forEach((entry) => {
      total += entry.actualWorkers || 0;
    });
    return total;
  })();

  // --- ダンプ合計台数 ---
  const dumpIncoming = data.dumpTrucks ? data.dumpTrucks.incoming : 0;
  const dumpOutgoing = data.dumpTrucks ? data.dumpTrucks.outgoing : 0;
  const dumpTotal = dumpIncoming + dumpOutgoing;

  // --- 作業行データ生成（STEP1 + STEP3追加 → 10行固定に埋める） ---
  type WorkRowData = {
    workContent: string;
    company: string;
    plannedWorkers: string;
    actualWorkers: string;
    machine: string;
    isAdditional: boolean;
  };

  const workRows: WorkRowData[] = [];

  // STEP1の作業セット
  (data.workEntries || []).forEach((entry, index) => {
    const found = (data.actualWorkers || []).find((aw) => aw.entryIndex === index);
    const actualCount = found ? found.count : 0;
    workRows.push({
      workContent: entry.workContent || '',
      company: entry.company || '',
      plannedWorkers: String(entry.plannedWorkers || ''),
      actualWorkers: actualCount > 0 ? String(actualCount) : '',
      machine: entry.machine || '',
      isAdditional: false,
    });
  });

  // STEP3の追加作業（全項目赤字）
  (data.step3AdditionalWorkEntries || []).forEach((entry) => {
    workRows.push({
      workContent: entry.description || '',
      company: entry.company || '',
      plannedWorkers: '',
      actualWorkers: entry.actualWorkers > 0 ? String(entry.actualWorkers) : '',
      machine: entry.machines ? entry.machines.filter((m) => m).join(', ') : '',
      isAdditional: true,
    });
  });

  // 10行まで空行で埋める
  while (workRows.length < WORK_ROWS) {
    workRows.push({
      workContent: '',
      company: '',
      plannedWorkers: '',
      actualWorkers: '',
      machine: '',
      isAdditional: false,
    });
  }

  // --- 安全衛生指示事項（10行固定） ---
  const safetyInstructions = Array.from(
    { length: SAFETY_INSTRUCTION_ROWS },
    (_, i) => (data.safetyInstructions || [])[i] || ''
  );

  // --- 点検チェックリストの表示用フィルタリング ---
  const getVisibleItems = (items: Step5InspectionItem[]): Step5InspectionItem[] => {
    return items.filter((item) => {
      if (item.isCustom) return item.label.trim() !== '';
      return true; // 固定項目は常に表示
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
      // 大分類ヘッダー行
      rows.push(
        <tr key={`hdr-${key}`}>
          <td
            colSpan={2}
            style={{
              ...CELL,
              fontWeight: 'bold',
              fontSize: '5.5px',
              textAlign: 'left',
              padding: '0px 1px',
            }}
          >
            【{cat.title}】
          </td>
        </tr>
      );
      // 小項目
      items.forEach((item, idx) => {
        rows.push(
          <tr key={`${key}-${idx}`}>
            <td
              style={{
                ...CELL,
                fontSize: '4.5px',
                padding: '0px 1px',
                maxWidth: '90px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </td>
            <td
              style={{
                ...CELL,
                fontSize: '5px',
                textAlign: 'center',
                width: '12px',
                padding: '0px 1px',
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
          印刷用CSS
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
            padding: 3mm !important;
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
          padding: '3mm',
          background: 'white',
          fontFamily: 'sans-serif',
          fontSize: '7px',
          color: 'black',
          boxSizing: 'border-box',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* ==================================
            ヘッダー行: タイトル + 所長確認欄
            ================================== */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '1mm',
          }}
        >
          <tbody>
            <tr>
              {/* タイトル */}
              <td
                style={{
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  padding: '2px 0',
                  verticalAlign: 'middle',
                }}
              >
                作業打合せ及び安全衛生日誌
              </td>
              {/* 所長確認欄 */}
              <td
                style={{
                  width: '25mm',
                  verticalAlign: 'top',
                  padding: 0,
                }}
              >
                <table
                  style={{
                    width: '25mm',
                    height: '20mm',
                    borderCollapse: 'collapse',
                  }}
                >
                  <tbody>
                    <tr>
                      <td
                        style={{
                          border: B,
                          fontSize: '6px',
                          fontWeight: 'bold',
                          textAlign: 'center',
                          padding: '1px',
                          height: '5mm',
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
                          height: '15mm',
                          verticalAlign: 'middle',
                          textAlign: 'center',
                        }}
                      >
                        {/* 空白欄 */}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ==================================
            基本情報行
            ================================== */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '1mm',
            fontSize: '7px',
          }}
        >
          <tbody>
            <tr>
              <td style={{ ...TH, width: '8%' }}>工事名</td>
              <td style={{ ...CELL, width: '34%' }}>{data.project || ''}</td>
              <td style={{ ...TH, width: '7%' }}>打合せ日</td>
              <td style={{ ...CELL, width: '15%' }}>
                {data.meetingDate || ''}{data.meetingDate ? getDayOfWeekLabel(data.meetingDate) : ''}
              </td>
              <td style={{ ...TH, width: '6%' }}>作業日</td>
              <td style={{ ...CELL, width: '15%' }}>
                {data.workDate || ''}{data.workDate ? getDayOfWeekLabel(data.workDate) : ''}
              </td>
              <td style={{ ...TH, width: '7%' }}>打合せ者</td>
              <td style={{ ...CELL, width: '8%' }}>{data.meetingConductor || ''}</td>
            </tr>
          </tbody>
        </table>

        {/* ==================================
            メインエリア（上段）: 左右分割
            ================================== */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '0mm',
          }}
        >
          <tbody>
            <tr>
              {/* ============================================
                  左側（約55%幅）: 作業内容テーブル
                  ============================================ */}
              <td
                style={{
                  width: '55%',
                  verticalAlign: 'top',
                  padding: 0,
                }}
              >
                {/* 作業内容テーブル */}
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '6.5px',
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ ...TH, width: '30%', fontSize: '6.5px' }}>作業箇所・作業内容</th>
                      <th style={{ ...TH, width: '18%', fontSize: '6.5px' }}>会社名</th>
                      <th style={{ ...TH, width: '10%', fontSize: '6px' }}>人数<br/>(予定)</th>
                      <th style={{ ...TH, width: '10%', fontSize: '6px' }}>人数<br/>(実施)</th>
                      <th style={{ ...TH, width: '32%', fontSize: '6.5px' }}>主要機械</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workRows.map((row, idx) => {
                      const isAdd = row.isAdditional;
                      const cellStyle: React.CSSProperties = isAdd
                        ? { ...CELL, fontSize: '6px', ...RED }
                        : { ...CELL, fontSize: '6px' };
                      const actualStyle: React.CSSProperties = {
                        ...CELL,
                        fontSize: '6px',
                        textAlign: 'center',
                        ...RED,
                      };
                      return (
                        <tr key={idx}>
                          <td style={cellStyle}>{row.workContent}</td>
                          <td style={cellStyle}>{row.company}</td>
                          <td style={{ ...cellStyle, textAlign: 'center' }}>
                            {isAdd ? '' : row.plannedWorkers}
                          </td>
                          <td style={actualStyle}>{row.actualWorkers}</td>
                          <td style={cellStyle}>{row.machine}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* 本日の作業人員数 */}
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '7px',
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ ...TH, fontSize: '7px' }}>本日の作業人員数</td>
                      <td
                        style={{
                          ...CELL,
                          textAlign: 'center',
                          fontWeight: 'bold',
                          fontSize: '7px',
                          ...RED,
                        }}
                      >
                        {totalWorkers}名
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>

              {/* ============================================
                  右側（約45%幅）: 3セクション縦並び
                  ============================================ */}
              <td
                style={{
                  width: '45%',
                  verticalAlign: 'top',
                  padding: 0,
                }}
              >
                {/* --- セクション1: 搬出入資機材・段取り資材等（2行） --- */}
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '6.5px',
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ ...TH, width: '22%', fontSize: '6px' }}>搬出入資機材</td>
                      <td style={{ ...CELL_WRAP, fontSize: '6px' }}>
                        {(data.materialEntries || []).filter((m) => m).join(', ')}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ ...TH, width: '22%', fontSize: '6px' }}>段取り資材等</td>
                      <td style={{ ...CELL_WRAP, fontSize: '6px' }}>
                        {(data.preparationEntries || []).filter((p) => p).join(', ')}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* --- セクション2: 安全衛生指示事項（左）＋ 基本確認事項（右）左右並び --- */}
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '6px',
                  }}
                >
                  <tbody>
                    <tr>
                      {/* 安全衛生指示事項（左半分） */}
                      <td
                        style={{
                          width: '50%',
                          verticalAlign: 'top',
                          padding: 0,
                          border: B,
                        }}
                      >
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '6px',
                          }}
                        >
                          <thead>
                            <tr>
                              <th
                                style={{
                                  ...TH,
                                  fontSize: '6px',
                                  padding: '1px',
                                }}
                              >
                                安全衛生指示事項
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {safetyInstructions.map((text, idx) => (
                              <tr key={idx}>
                                <td
                                  style={{
                                    ...CELL_WRAP,
                                    fontSize: '5.5px',
                                    padding: '0px 2px',
                                    height: '11px',
                                  }}
                                >
                                  {idx + 1}. {text}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>

                      {/* 基本確認事項（右半分） */}
                      <td
                        style={{
                          width: '50%',
                          verticalAlign: 'top',
                          padding: 0,
                          border: B,
                        }}
                      >
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '6px',
                          }}
                        >
                          <thead>
                            <tr>
                              <th
                                style={{
                                  ...TH,
                                  fontSize: '6px',
                                  padding: '1px',
                                }}
                              >
                                基本確認事項
                              </th>
                              <th
                                style={{
                                  ...TH,
                                  fontSize: '6px',
                                  padding: '1px',
                                  width: '18px',
                                }}
                              >
                                結果
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {CONFIRMATION_LABELS.map((item, idx) => {
                              const result = data.step3ConfirmationItems
                                ? data.step3ConfirmationItems[item.key]
                                : '';
                              return (
                                <tr key={item.key}>
                                  <td
                                    style={{
                                      ...CELL_WRAP,
                                      fontSize: '5px',
                                      padding: '0px 1px',
                                      height: '11px',
                                    }}
                                  >
                                    {idx + 1}. {item.label}
                                  </td>
                                  <td
                                    style={{
                                      ...CELL,
                                      fontSize: '6px',
                                      textAlign: 'center',
                                      fontWeight: 'bold',
                                      width: '18px',
                                      padding: '0px 1px',
                                      height: '11px',
                                      ...RED,
                                    }}
                                  >
                                    {result || ''}
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
              </td>
            </tr>
          </tbody>
        </table>

        {/* ==================================
            ダンプ・段階確認行
            ================================== */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '7px',
            marginBottom: '0mm',
          }}
        >
          <tbody>
            <tr>
              <td style={{ ...TH, width: '10%', fontSize: '6.5px' }}>ダンプ台数</td>
              <td
                style={{
                  ...CELL,
                  width: '25%',
                  textAlign: 'center',
                  fontSize: '6.5px',
                  ...RED,
                }}
              >
                搬入 {dumpIncoming}台 ＋ 搬出 {dumpOutgoing}台 ＝ {dumpTotal}台
              </td>
              <td style={{ ...TH, width: '8%', fontSize: '6.5px' }}>段階確認</td>
              <td
                style={{
                  ...CELL,
                  width: '10%',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: '7px',
                  ...RED,
                }}
              >
                {data.stageConfirmation === '有' ? '有' : data.stageConfirmation === '無' ? '無' : ''}
              </td>
              <td style={{ ...TH, width: '8%', fontSize: '6.5px' }}>確認立会</td>
              <td
                style={{
                  ...CELL,
                  width: '10%',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: '7px',
                  ...RED,
                }}
              >
                {data.witnessConfirmation === '有' ? '有' : data.witnessConfirmation === '無' ? '無' : ''}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ==================================
            中段: 当現場確認項目（左右5項目ずつ配置）
            ================================== */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '6px',
            marginBottom: '0mm',
          }}
        >
          <thead>
            <tr>
              <th
                colSpan={6}
                style={{
                  ...TH,
                  fontSize: '7px',
                  padding: '1px 2px',
                }}
              >
                当現場確認項目
              </th>
            </tr>
            <tr>
              <th style={{ ...TH, width: '4%', fontSize: '5.5px' }}>No.</th>
              <th style={{ ...TH, width: '30%', fontSize: '5.5px' }}>確認項目</th>
              <th style={{ ...TH, width: '6%', fontSize: '5.5px' }}>結果</th>
              <th style={{ ...TH, width: '4%', fontSize: '5.5px' }}>No.</th>
              <th style={{ ...TH, width: '30%', fontSize: '5.5px' }}>確認項目</th>
              <th style={{ ...TH, width: '6%', fontSize: '5.5px' }}>結果</th>
            </tr>
          </thead>
          <tbody>
            {/* 左: 1〜5、右: 6〜10 */}
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
                  <td style={{ ...CELL, textAlign: 'center', fontSize: '5.5px' }}>{i + 1}</td>
                  <td style={{ ...CELL_WRAP, fontSize: '5.5px', padding: '0px 2px' }}>{left.label}</td>
                  <td
                    style={{
                      ...CELL,
                      textAlign: 'center',
                      fontWeight: 'bold',
                      fontSize: '6px',
                      ...RED,
                    }}
                  >
                    {leftResult || ''}
                  </td>
                  <td style={{ ...CELL, textAlign: 'center', fontSize: '5.5px' }}>{i + 6}</td>
                  <td style={{ ...CELL_WRAP, fontSize: '5.5px', padding: '0px 2px' }}>{right.label}</td>
                  <td
                    style={{
                      ...CELL,
                      textAlign: 'center',
                      fontWeight: 'bold',
                      fontSize: '6px',
                      ...RED,
                    }}
                  >
                    {rightResult || ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ==================================
            下段: 左右2カラム
            ================================== */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '6px',
          }}
        >
          <tbody>
            <tr>
              {/* ============================================
                  左側（約50%幅）: 作業連絡調整事項・巡視所見 + 配置図
                  ============================================ */}
              <td
                style={{
                  width: '50%',
                  verticalAlign: 'top',
                  padding: 0,
                }}
              >
                {/* 作業連絡調整事項・打合せ・朝礼等周知事項・その他 */}
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '6px',
                  }}
                >
                  <tbody>
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          ...TH_WRAP,
                          fontSize: '6px',
                          textAlign: 'left',
                          padding: '1px 2px',
                        }}
                      >
                        ＊作業連絡調整事項・打合せ・朝礼等周知事項・その他
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          ...CELL_WRAP,
                          fontSize: '6px',
                          height: '18px',
                          verticalAlign: 'top',
                          padding: '1px 2px',
                          ...RED,
                        }}
                      >
                        {data.patrolRecord?.coordinationNotes || ''}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ ...TH, width: '15%', fontSize: '6px' }}>巡視点検者</td>
                      <td
                        style={{
                          ...CELL,
                          width: '35%',
                          fontSize: '6px',
                          ...RED,
                        }}
                      >
                        {data.patrolRecord?.inspector || ''}
                      </td>
                      <td style={{ ...TH, width: '15%', fontSize: '6px' }}>巡視時間</td>
                      <td
                        style={{
                          ...CELL,
                          width: '35%',
                          fontSize: '6px',
                          ...RED,
                        }}
                      >
                        {data.patrolRecord?.inspectionTime || ''}
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          ...TH,
                          fontSize: '6px',
                          textAlign: 'left',
                          padding: '1px 2px',
                        }}
                      >
                        巡視所見
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          ...CELL_WRAP,
                          fontSize: '6px',
                          height: '18px',
                          verticalAlign: 'top',
                          padding: '1px 2px',
                          ...RED,
                        }}
                      >
                        {data.patrolRecord?.findings || ''}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* 配置図・略図 */}
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '6px',
                  }}
                >
                  <tbody>
                    <tr>
                      <td
                        style={{
                          ...TH,
                          fontSize: '6px',
                          textAlign: 'left',
                          padding: '1px 2px',
                        }}
                      >
                        配置図・略図
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          ...CELL,
                          height: '80px',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          padding: '1px',
                        }}
                      >
                        {data.annotatedDiagramUrl ? (
                          <img
                            src={data.annotatedDiagramUrl}
                            alt="配置図"
                            style={{
                              maxHeight: '76px',
                              maxWidth: '100%',
                              objectFit: 'contain',
                            }}
                          />
                        ) : data.baseDiagramUrl ? (
                          <img
                            src={data.baseDiagramUrl}
                            alt="配置図"
                            style={{
                              maxHeight: '76px',
                              maxWidth: '100%',
                              objectFit: 'contain',
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: '6px', color: '#999' }}></span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>

              {/* ============================================
                  右側（約50%幅）: 点検チェックリスト
                  ============================================ */}
              <td
                style={{
                  width: '50%',
                  verticalAlign: 'top',
                  padding: 0,
                }}
              >
                {/* 点検チェックリストヘッダー */}
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '5px',
                  }}
                >
                  <tbody>
                    <tr>
                      <td
                        style={{
                          ...TH_WRAP,
                          fontSize: '5.5px',
                          textAlign: 'left',
                          padding: '1px 2px',
                        }}
                      >
                        ② 点検チェックリスト　記号　○適正　△一部適正　×不適切　◎是正済　無印は該当無
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* 点検チェックリスト: 左右2列 */}
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                  }}
                >
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
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '5px',
                          }}
                        >
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
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '5px',
                          }}
                        >
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
