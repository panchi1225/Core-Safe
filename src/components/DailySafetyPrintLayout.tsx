// src/components/DailySafetyPrintLayout.tsx
// 安全衛生日誌（作業打合せ及び安全衛生日誌）帳票レイアウトコンポーネント
// A4横向き（297mm × 210mm）1ページに全入力項目を収める
// STEP3当日入力分・STEP4巡視記録は赤字で表示

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

/** 日付文字列(YYYY-MM-DD)から曜日文字列を返す */
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

// 2列配置: 左列・右列の振り分け
const LEFT_CHECKLIST_KEYS: (keyof Step5InspectionChecklist)[] = ['management', 'electrical', 'debris', 'others'];
const RIGHT_CHECKLIST_KEYS: (keyof Step5InspectionChecklist)[] = ['machinery', 'falling', 'environment'];

// ============================
// 共通スタイル定数
// ============================
const BORDER = '1px solid black';
const CELL_STYLE: React.CSSProperties = {
  border: BORDER,
  padding: '1px 2px',
  verticalAlign: 'middle',
  lineHeight: 1.2,
};
const HEADER_CELL_STYLE: React.CSSProperties = {
  ...CELL_STYLE,
  fontWeight: 'bold',
  textAlign: 'center' as const,
};
const RED_STYLE: React.CSSProperties = { color: 'red' };

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

  // --- 安全衛生指示事項（選択されているもののみ） ---
  const filteredInstructions = (data.safetyInstructions || [])
    .map((s, i) => ({ text: s, index: i + 1 }))
    .filter((item) => item.text !== '');

  // --- 点検チェックリストの表示用フィルタリング ---
  const getVisibleItems = (items: Step5InspectionItem[]): Step5InspectionItem[] => {
    return items.filter((item) => {
      // 自由記入欄はlabelが空でなければ表示
      if (item.isCustom) return item.label.trim() !== '';
      return true;
    });
  };

  // --- 点検チェックリスト1列分のレンダリング ---
  const renderChecklistColumn = (keys: (keyof Step5InspectionChecklist)[]) => {
    return keys.map((key) => {
      const cat = CHECKLIST_CATEGORIES.find((c) => c.key === key);
      if (!cat) return null;
      const items = data.step5InspectionChecklist
        ? getVisibleItems(data.step5InspectionChecklist[key] || [])
        : [];
      return (
        <React.Fragment key={key}>
          {/* 大分類ヘッダー行 */}
          <tr>
            <td
              colSpan={2}
              style={{
                ...CELL_STYLE,
                fontWeight: 'bold',
                fontSize: '5.5px',
                textAlign: 'left',
                padding: '1px 2px',
              }}
            >
              【{cat.title}】
            </td>
          </tr>
          {/* 小項目 */}
          {items.map((item, idx) => (
            <tr key={`${key}-${idx}`}>
              <td style={{ ...CELL_STYLE, fontSize: '5px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.label}
              </td>
              <td style={{ ...CELL_STYLE, fontSize: '5.5px', textAlign: 'center', width: '14px' }}>
                {item.value || ''}
              </td>
            </tr>
          ))}
        </React.Fragment>
      );
    });
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
            padding: 5mm !important;
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
          padding: '5mm',
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
            ヘッダー部（1段目）
            ================================== */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2mm' }}>
          {/* 左側: タイトル */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', textAlign: 'center', paddingTop: '2mm' }}>
              作業打合せ及び安全衛生日誌
            </div>
          </div>

          {/* 右側: 所長確認欄 */}
          <div
            style={{
              width: '25mm',
              height: '20mm',
              border: BORDER,
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: '6px',
                fontWeight: 'bold',
                textAlign: 'center',
                borderBottom: BORDER,
                padding: '1px 0',
              }}
            >
              所長確認
            </div>
            {/* 空白欄（電子印は次回実装） */}
            <div style={{ flex: 1 }}></div>
          </div>
        </div>

        {/* ==================================
            基本情報部（2段目）
            ================================== */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '2mm',
            fontSize: '7px',
          }}
        >
          <tbody>
            <tr>
              <td style={{ ...HEADER_CELL_STYLE, width: '12%' }}>工事名</td>
              <td style={{ ...CELL_STYLE, width: '38%' }}>{data.project || '―'}</td>
              <td style={{ ...HEADER_CELL_STYLE, width: '12%' }}>打合せ実施者</td>
              <td style={{ ...CELL_STYLE, width: '38%' }}>{data.meetingConductor || '―'}</td>
            </tr>
            <tr>
              <td style={HEADER_CELL_STYLE}>打合せ日</td>
              <td style={CELL_STYLE}>
                {data.meetingDate || '―'}{data.meetingDate ? getDayOfWeekLabel(data.meetingDate) : ''}
              </td>
              <td style={HEADER_CELL_STYLE}>作業日</td>
              <td style={CELL_STYLE}>
                {data.workDate || '―'}{data.workDate ? getDayOfWeekLabel(data.workDate) : ''}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ==================================
            メイン部（3段目）— 左右2カラム
            ================================== */}
        <div style={{ display: 'flex', gap: '2mm', flex: 1 }}>
          {/* --- 左カラム（約60%） --- */}
          <div style={{ width: '60%', display: 'flex', flexDirection: 'column', gap: '1.5mm' }}>
            {/* 【作業内容テーブル】 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '6.5px' }}>
              <thead>
                <tr>
                  <th style={{ ...HEADER_CELL_STYLE, width: '6%' }}>No.</th>
                  <th style={{ ...HEADER_CELL_STYLE, width: '30%' }}>作業内容</th>
                  <th style={{ ...HEADER_CELL_STYLE, width: '18%' }}>会社名</th>
                  <th style={{ ...HEADER_CELL_STYLE, width: '10%' }}>計画人数</th>
                  <th style={{ ...HEADER_CELL_STYLE, width: '10%' }}>実施人数</th>
                  <th style={{ ...HEADER_CELL_STYLE, width: '26%' }}>主要機械</th>
                </tr>
              </thead>
              <tbody>
                {/* STEP1の作業セット */}
                {data.workEntries.length > 0 ? (
                  data.workEntries.map((entry, index) => {
                    const actualWorkerEntry = (data.actualWorkers || []).find(
                      (aw) => aw.entryIndex === index
                    );
                    const actualCount = actualWorkerEntry ? actualWorkerEntry.count : 0;
                    return (
                      <tr key={entry.id || index}>
                        <td style={{ ...CELL_STYLE, textAlign: 'center' }}>{index + 1}</td>
                        <td style={CELL_STYLE}>{entry.workContent || '―'}</td>
                        <td style={CELL_STYLE}>{entry.company || '―'}</td>
                        <td style={{ ...CELL_STYLE, textAlign: 'center' }}>{entry.plannedWorkers}</td>
                        <td style={{ ...CELL_STYLE, textAlign: 'center', ...RED_STYLE }}>
                          {actualCount > 0 ? actualCount : '―'}
                        </td>
                        <td style={CELL_STYLE}>{entry.machine || '―'}</td>
                      </tr>
                    );
                  })
                ) : (
                  /* 作業セット0件の場合は空行1行 */
                  <tr>
                    <td style={{ ...CELL_STYLE, textAlign: 'center' }}>1</td>
                    <td style={CELL_STYLE}>―</td>
                    <td style={CELL_STYLE}>―</td>
                    <td style={{ ...CELL_STYLE, textAlign: 'center' }}>―</td>
                    <td style={{ ...CELL_STYLE, textAlign: 'center' }}>―</td>
                    <td style={CELL_STYLE}>―</td>
                  </tr>
                )}

                {/* STEP3の追加作業（すべて赤字） */}
                {(data.step3AdditionalWorkEntries || []).map((entry, index) => (
                  <tr key={`add-${entry.id || index}`}>
                    <td style={{ ...CELL_STYLE, textAlign: 'center', ...RED_STYLE }}>
                      追{toCircledNumber(index + 1)}
                    </td>
                    <td style={{ ...CELL_STYLE, ...RED_STYLE }}>{entry.description || '―'}</td>
                    <td style={{ ...CELL_STYLE, ...RED_STYLE }}>{entry.company || '―'}</td>
                    <td style={{ ...CELL_STYLE, textAlign: 'center', ...RED_STYLE }}>―</td>
                    <td style={{ ...CELL_STYLE, textAlign: 'center', ...RED_STYLE }}>
                      {entry.actualWorkers > 0 ? entry.actualWorkers : '―'}
                    </td>
                    <td style={{ ...CELL_STYLE, ...RED_STYLE }}>
                      {entry.machines && entry.machines.length > 0
                        ? entry.machines.filter((m) => m).join(', ') || '―'
                        : '―'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 本日の作業人数合計 */}
            <div style={{ fontSize: '7px', fontWeight: 'bold', ...RED_STYLE, textAlign: 'right', padding: '1px 2px' }}>
              本日の作業人数合計: {totalWorkers}人
            </div>

            {/* 【搬出入資機材・段取り資材等】 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '6.5px' }}>
              <tbody>
                <tr>
                  <td style={{ ...HEADER_CELL_STYLE, width: '18%' }}>搬出入資機材</td>
                  <td style={CELL_STYLE}>
                    {(data.materialEntries || []).filter((m) => m).length > 0
                      ? data.materialEntries.filter((m) => m).join(', ')
                      : '―'}
                  </td>
                </tr>
                <tr>
                  <td style={HEADER_CELL_STYLE}>段取り資材等</td>
                  <td style={CELL_STYLE}>
                    {(data.preparationEntries || []).filter((p) => p).length > 0
                      ? data.preparationEntries.filter((p) => p).join(', ')
                      : '―'}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 【安全衛生指示事項】 */}
            <div>
              <div style={{ fontSize: '6.5px', fontWeight: 'bold', borderBottom: BORDER, padding: '1px 2px', marginBottom: '1px' }}>
                安全衛生指示事項
              </div>
              {filteredInstructions.length > 0 ? (
                filteredInstructions.map((item) => (
                  <div key={item.index} style={{ fontSize: '6px', padding: '0 2px', lineHeight: 1.3 }}>
                    {item.index}. {item.text}
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '6px', padding: '0 2px', color: '#999' }}>―</div>
              )}
            </div>

            {/* 【配置図・略図】 */}
            <div style={{ flex: 1, minHeight: '15mm', border: BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {data.annotatedDiagramUrl ? (
                <img
                  src={data.annotatedDiagramUrl}
                  alt="配置図"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              ) : data.baseDiagramUrl ? (
                <img
                  src={data.baseDiagramUrl}
                  alt="配置図"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              ) : (
                <span style={{ fontSize: '7px', color: '#999' }}>配置図なし</span>
              )}
            </div>
          </div>

          {/* --- 右カラム（約40%） --- */}
          <div style={{ width: '40%', display: 'flex', flexDirection: 'column', gap: '1.5mm' }}>
            {/* 【基本確認事項】 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '6px' }}>
              <thead>
                <tr>
                  <th style={{ ...HEADER_CELL_STYLE, width: '6%' }}>No.</th>
                  <th style={{ ...HEADER_CELL_STYLE }}>基本確認事項</th>
                  <th style={{ ...HEADER_CELL_STYLE, width: '12%' }}>結果</th>
                </tr>
              </thead>
              <tbody>
                {CONFIRMATION_LABELS.map((item, index) => {
                  const result = data.step3ConfirmationItems
                    ? data.step3ConfirmationItems[item.key]
                    : '';
                  return (
                    <tr key={item.key}>
                      <td style={{ ...CELL_STYLE, textAlign: 'center' }}>{index + 1}</td>
                      <td style={CELL_STYLE}>{item.label}</td>
                      <td style={{ ...CELL_STYLE, textAlign: 'center', ...RED_STYLE, fontWeight: 'bold' }}>
                        {result || ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* 【当現場確認事項】 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '6px' }}>
              <thead>
                <tr>
                  <th style={{ ...HEADER_CELL_STYLE, width: '6%' }}>No.</th>
                  <th style={HEADER_CELL_STYLE}>当現場確認事項</th>
                  <th style={{ ...HEADER_CELL_STYLE, width: '12%' }}>結果</th>
                </tr>
              </thead>
              <tbody>
                {SITE_CONFIRMATION_LABELS.map((item, index) => {
                  const result = data.step3SiteConfirmationItems
                    ? data.step3SiteConfirmationItems[item.key]
                    : '';
                  return (
                    <tr key={item.key}>
                      <td style={{ ...CELL_STYLE, textAlign: 'center' }}>{index + 1}</td>
                      <td style={CELL_STYLE}>{item.label}</td>
                      <td style={{ ...CELL_STYLE, textAlign: 'center', ...RED_STYLE, fontWeight: 'bold' }}>
                        {result || ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* 【段階確認・立会確認】 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '6.5px' }}>
              <tbody>
                <tr>
                  <td style={{ ...HEADER_CELL_STYLE, width: '25%' }}>段階確認</td>
                  <td style={{ ...CELL_STYLE, textAlign: 'center', ...RED_STYLE, fontWeight: 'bold', width: '25%' }}>
                    {data.stageConfirmation || '―'}
                  </td>
                  <td style={{ ...HEADER_CELL_STYLE, width: '25%' }}>立会確認</td>
                  <td style={{ ...CELL_STYLE, textAlign: 'center', ...RED_STYLE, fontWeight: 'bold', width: '25%' }}>
                    {data.witnessConfirmation || '―'}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 【ダンプ台数】 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '6.5px' }}>
              <tbody>
                <tr>
                  <td style={{ ...HEADER_CELL_STYLE, width: '25%' }}>搬入</td>
                  <td style={{ ...CELL_STYLE, textAlign: 'center', ...RED_STYLE, fontWeight: 'bold', width: '25%' }}>
                    {data.dumpTrucks ? data.dumpTrucks.incoming : 0} 台
                  </td>
                  <td style={{ ...HEADER_CELL_STYLE, width: '25%' }}>搬出</td>
                  <td style={{ ...CELL_STYLE, textAlign: 'center', ...RED_STYLE, fontWeight: 'bold', width: '25%' }}>
                    {data.dumpTrucks ? data.dumpTrucks.outgoing : 0} 台
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 【巡視記録】 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '6.5px' }}>
              <thead>
                <tr>
                  <th colSpan={2} style={{ ...HEADER_CELL_STYLE, fontSize: '7px' }}>巡視記録</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...HEADER_CELL_STYLE, width: '25%' }}>作業調整事項</td>
                  <td style={{ ...CELL_STYLE, ...RED_STYLE }}>
                    {data.patrolRecord?.coordinationNotes || '―'}
                  </td>
                </tr>
                <tr>
                  <td style={HEADER_CELL_STYLE}>巡視点検者</td>
                  <td style={{ ...CELL_STYLE, ...RED_STYLE }}>
                    {data.patrolRecord?.inspector || '―'}
                  </td>
                </tr>
                <tr>
                  <td style={HEADER_CELL_STYLE}>巡視時間</td>
                  <td style={{ ...CELL_STYLE, ...RED_STYLE }}>
                    {data.patrolRecord?.inspectionTime || '―'}
                  </td>
                </tr>
                <tr>
                  <td style={HEADER_CELL_STYLE}>所見</td>
                  <td style={{ ...CELL_STYLE, ...RED_STYLE }}>
                    {data.patrolRecord?.findings || '―'}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 【点検チェックリスト】— 7大分類を2列に配置 */}
            <div style={{ fontSize: '5px', fontWeight: 'bold', borderBottom: BORDER, padding: '1px 2px' }}>
              点検チェックリスト
            </div>
            <div style={{ display: 'flex', gap: '1mm', flex: 1, overflow: 'hidden' }}>
              {/* 左列: 管理、電気、飛来・落下崩壊・転倒、その他 */}
              <div style={{ width: '50%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '5px' }}>
                  <tbody>
                    {renderChecklistColumn(LEFT_CHECKLIST_KEYS)}
                  </tbody>
                </table>
              </div>
              {/* 右列: 重機・機械、墜落転落、作業環境 */}
              <div style={{ width: '50%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '5px' }}>
                  <tbody>
                    {renderChecklistColumn(RIGHT_CHECKLIST_KEYS)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ============================
// 丸数字変換ヘルパー
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
