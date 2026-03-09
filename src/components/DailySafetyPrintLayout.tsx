// src/components/DailySafetyPrintLayout.tsx
// 安全衛生日誌（作業打合せ及び安全衛生日誌）帳票レイアウトコンポーネント
// A4横向き（297mm × 210mm）1ページに全入力項目を収める
// HTMLの<table>タグをネストして元PDFのレイアウトを極限まで再現する
// STEP3当日入力分・STEP4巡視記録は赤字（color: red）で表示
// ※ 全セル高さ・フォントサイズ・paddingを縮小してA4横1ページに確実に収める

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
// 丸囲み表示関数（縮小版: 12px丸枠、1.5px赤ボーダー）
// ============================
function circledChoice(
  value: string,
  option1: string,
  option2: string
): JSX.Element {
  // 丸枠サイズ: 12px、ボーダー: 1.5px solid red
  const circleStyle: React.CSSProperties = {
    border: '1.5px solid red',
    borderRadius: '50%',
    display: 'inline-block',
    width: '12px',
    height: '12px',
    textAlign: 'center' as const,
    lineHeight: '10px',
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
// 【管理】は11固定項目（「新規入場者教育・作業内容の周知」を含む）
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
    '新規入場者教育・作業内容の周知', // 11番目の固定項目
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

// 各カテゴリの自由記入欄の行数
const CHECKLIST_CUSTOM_ROWS: Record<string, number> = {
  management: 1,  // 固定11 + 自由1 = 12行
  machinery: 1,   // 固定5 + 自由1 = 6行
  electrical: 1,  // 固定5 + 自由1 = 6行
  falling: 1,     // 固定5 + 自由1 = 6行
  debris: 1,      // 固定5 + 自由1 = 6行
  environment: 1, // 固定5 + 自由1 = 6行
  others: 2,      // 固定3 + 自由2 = 5行
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
// 共通スタイル定数（縮小版）
// ============================
const B = '1px solid black';

// 第3段統合テーブルのデータ行高さ（14px → 11px に縮小）
const INTEGRATED_ROW_H = '11px';

/** 全テーブル共通スタイル */
const TABLE_BASE: React.CSSProperties = {
  borderCollapse: 'collapse' as const,
  width: '100%',
  tableLayout: 'fixed' as const,
  margin: 0,
  padding: 0,
};

/** 全セル共通スタイル（padding・fontSize縮小版） */
const CELL: React.CSSProperties = {
  border: B,
  padding: '1px 2px',
  fontSize: '6px',
  lineHeight: 1.2,
  verticalAlign: 'middle',
  overflow: 'hidden',
  whiteSpace: 'nowrap' as const,
  textOverflow: 'ellipsis',
};

/** THセル（ヘッダー）共通スタイル（fontSize縮小版） */
const TH: React.CSSProperties = {
  ...CELL,
  fontWeight: 'bold',
  textAlign: 'center' as const,
  backgroundColor: 'white',
  fontSize: '6.5px',
};

/** 赤字スタイル */
const RED: React.CSSProperties = {
  color: 'red',
  WebkitPrintColorAdjust: 'exact' as any,
};

// ============================
// 固定行数定数
// ============================
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
  const safetyInstructions = data?.safetyInstructions || [];
  const confirmationItems = data?.step3ConfirmationItems || ({} as any);
  const siteConfirmationItems = data?.step3SiteConfirmationItems || ({} as any);
  const inspectionChecklist = data?.step5InspectionChecklist || ({} as any);
  const dumpTrucks = data?.dumpTrucks || ({ incoming: '', outgoing: '' } as any);
  const patrolRecord = data?.patrolRecord || ({} as any);
  const stageConfirmation = data?.stageConfirmation || '';
  const witnessConfirmation = data?.witnessConfirmation || '';
  const workNotes = data?.workNotes || '';
  const diagramUrl = (data as any)?.diagramUrl || (data as any)?.diagramImage || (data as any)?.annotatedDiagramUrl || (data as any)?.baseDiagramUrl || '';
  const presenter = data?.presenter || (data as any)?.meetingConductor || '';
  const projectName = data?.projectName || (data as any)?.project || '';
  const meetingDate = data?.meetingDate || '';
  const workDate = data?.workDate || '';

  // --- 追加作業エントリ ---
  const additionalEntries = (data as any)?.step3AdditionalWorkEntries || [];

  // --- 作業人数合計 ---
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

  // ============================
  // チェックリスト: カテゴリごとに固定行数分の行データを生成
  // ============================
  const buildChecklistRows = (categoryKey: string): { label: string; rating: string }[] => {
    const fixedLabels = CHECKLIST_FIXED_ITEMS[categoryKey] || [];
    const customRowCount = CHECKLIST_CUSTOM_ROWS[categoryKey] || 1;
    const dataItems: Step5InspectionItem[] = inspectionChecklist[categoryKey] || [];

    const rows: { label: string; rating: string }[] = [];

    // 固定項目行
    fixedLabels.forEach((fixedLabel, idx) => {
      const foundByLabel = dataItems.find((item: any) => item.label === fixedLabel);
      const foundByIndex = !foundByLabel ? dataItems[idx] : undefined;
      const found = foundByLabel || foundByIndex;
      rows.push({
        label: fixedLabel,
        rating: found?.value || '',
      });
    });

    // 自由記入欄行: データがなくても空行を表示
    for (let c = 0; c < customRowCount; c++) {
      const customIdx = fixedLabels.length + c;
      const found = dataItems[customIdx];
      rows.push({
        label: (found?.label || '').trim() ? found.label : '',
        rating: found?.value || '',
      });
    }

    return rows;
  };

  // ============================
  // チェックリスト1列分のレンダリング（固定行数）
  // 項目行: height 8px, fontSize 5px, padding 0px 1px
  // カテゴリヘッダー: height 9px, fontSize 5px
  // ============================
  const renderChecklistColumn = (keys: string[]) => {
    const rows: React.ReactNode[] = [];
    keys.forEach((key) => {
      const title = CATEGORY_TITLES[key] || key;
      const items = buildChecklistRows(key);

      // カテゴリヘッダー行（9px高さ）
      rows.push(
        <tr key={`hdr-${key}`}>
          <td
            colSpan={2}
            style={{
              border: B,
              padding: '0px 1px',
              fontWeight: 'bold',
              fontSize: '5px',
              textAlign: 'left' as const,
              height: '9px',
              lineHeight: 1.2,
            }}
          >
            【{title}】
          </td>
        </tr>
      );

      // 項目行（8px高さ）
      items.forEach((item, idx) => {
        rows.push(
          <tr key={`${key}-${idx}`}>
            <td
              style={{
                border: B,
                padding: '0px 1px',
                fontSize: '5px',
                textAlign: 'left' as const,
                height: '8px',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap' as const,
              }}
            >
              {item.label || '\u00A0'}
            </td>
            <td
              style={{
                border: B,
                padding: '0px 1px',
                fontSize: '5px',
                textAlign: 'center' as const,
                width: '16px',
                height: '8px',
                lineHeight: 1.2,
                ...RED,
              }}
            >
              {item.rating || '\u00A0'}
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

      {/* 帳票本体（A4横 297mm × 210mm、余白3mm → 有効高さ204mm） */}
      <div
        id="print-area"
        style={{
          width: '297mm',
          height: '210mm',
          padding: '3mm',
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
            タイトル fontSize: 12px、所長確認枠 height: 16px、marginBottom: 0
            ================================================================== */}
        <table style={{ ...TABLE_BASE, marginBottom: 0 }}>
          <tbody>
            <tr>
              {/* 左セル（25%）: 空白 */}
              <td style={{ width: '25%', border: 'none', padding: 0 }}>{'\u00A0'}</td>
              {/* 中央セル（50%）: タイトル（12px） */}
              <td
                style={{
                  width: '50%',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  textAlign: 'center' as const,
                  padding: '1px 0',
                }}
              >
                作業打合せ及び安全衛生日誌
              </td>
              {/* 右セル（25%）: 所長確認欄（枠 16px） */}
              <td
                style={{
                  width: '25%',
                  border: 'none',
                  textAlign: 'right' as const,
                  verticalAlign: 'bottom',
                  padding: '0 0 1px 0',
                }}
              >
                <div style={{ fontSize: '6px', textAlign: 'right' }}>所長確認欄</div>
                <div
                  style={{
                    border: '1px solid black',
                    height: '16px',
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
            TH fontSize: 6.5px、TD fontSize: 6px、行高さ: 13px
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
              <th style={{ ...TH, fontSize: '6.5px', height: '13px' }}>工事名</th>
              <td style={{ ...CELL, fontSize: '6px', paddingLeft: '4px', height: '13px' }}>{projectName}</td>
              <th style={{ ...TH, fontSize: '6.5px', height: '13px' }}>打合せ日</th>
              <td style={{ ...CELL, fontSize: '6px', paddingLeft: '4px', height: '13px' }}>
                {toWareki(meetingDate)}{getWeekdayLabel(meetingDate)}
              </td>
              <th style={{ ...TH, fontSize: '6.5px', height: '13px' }}>作業日</th>
              <td style={{ ...CELL, fontSize: '6px', paddingLeft: '4px', height: '13px' }}>
                {toWareki(workDate)}{getWeekdayLabel(workDate)}
              </td>
              <th style={{ ...TH, fontSize: '6.5px', height: '13px' }}>打合せ実施者</th>
              <td style={{ ...CELL, fontSize: '6px', paddingLeft: '4px', height: '13px', ...RED }}>
                {presenter}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ==================================================================
            第3段: 統合作業テーブル（9列×ヘッダー1行＋データ10行固定）
            ヘッダー行: height 11px, fontSize 5.5px
            データ行: height 11px, fontSize 6px
            セル padding: 1px 2px
            主要機械セル lineHeight: 1.0
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
              <th style={{ ...TH, fontSize: '5.5px', height: '11px', padding: '1px 2px' }}>作業内容</th>
              <th style={{ ...TH, fontSize: '5.5px', height: '11px', padding: '1px 2px' }}>会社名</th>
              <th style={{ ...TH, fontSize: '5.5px', height: '11px', padding: '1px 2px', whiteSpace: 'normal' as const, lineHeight: 1.1 }}>
                人数<br />（予定）
              </th>
              <th style={{ ...TH, fontSize: '5.5px', height: '11px', padding: '1px 2px', whiteSpace: 'normal' as const, lineHeight: 1.1 }}>
                人数<br />（実施）
              </th>
              <th style={{ ...TH, fontSize: '5.5px', height: '11px', padding: '1px 2px' }}>主要機械</th>
              <th style={{ ...TH, fontSize: '5.5px', height: '11px', padding: '1px 2px' }}>搬出入資機材</th>
              <th style={{ ...TH, fontSize: '5.5px', height: '11px', padding: '1px 2px' }}>安全衛生指示事項</th>
              <th style={{ ...TH, fontSize: '5.5px', height: '11px', padding: '1px 2px' }}>基本確認事項</th>
              <th style={{ ...TH, fontSize: '5.5px', height: '11px', padding: '1px 2px' }}>結果</th>
            </tr>
          </thead>
          <tbody>
            {integratedRows.slice(0, WORK_ROWS).map((row, idx) => {
              // データセル共通スタイル（赤字、11px高さ）
              const dataCell: React.CSSProperties = {
                ...CELL,
                fontSize: '6px',
                padding: '1px 2px',
                height: INTEGRATED_ROW_H,
                ...RED,
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
                  {/* 主要機械: machine + machine2 を改行で表示、lineHeight: 1.0 */}
                  <td style={{ ...dataCell, whiteSpace: 'normal' as const, lineHeight: 1.0 }}>
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
                  <td style={{ ...CELL, height: INTEGRATED_ROW_H, fontSize: '6px', padding: '1px 2px', textAlign: 'center' as const }}>
                    {circledChoice(row.confirmationResult, '良', '否')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ==================================================================
            第4段〜第5段: 左右独立レイアウト
            外枠テーブル1行2列（左50%・右50%）
            ================================================================== */}
        <table style={{ ...TABLE_BASE }}>
          <tbody>
            <tr>
              {/* ====================================
                  左側セル（50%）
                  ダンプ台数 → 作業連絡 → 巡視 → 配置図
                  1つの内部テーブルで隙間なし
                  ==================================== */}
              <td style={{ width: '50%', verticalAlign: 'top', padding: 0, border: 'none' }}>
                <table style={{ ...TABLE_BASE }}>
                  <colgroup>
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '23%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '50%' }} />
                  </colgroup>
                  <tbody>
                    {/* ===== 行1: ダンプ台数（搬入）+ 作業人員数 + 段階確認 ===== */}
                    {/* 各行 height: 12px、fontSize: 6px、padding: 1px 2px */}
                    <tr>
                      <td
                        rowSpan={2}
                        style={{
                          ...TH,
                          fontSize: '6px',
                          height: '12px',
                          padding: '1px 2px',
                        }}
                      >
                        ダンプ台数
                      </td>
                      <td style={{ ...CELL, fontSize: '6px', height: '12px', padding: '1px 2px' }}>
                        搬入：<span style={RED}>{dumpIncoming}</span>台
                      </td>
                      <td
                        rowSpan={2}
                        style={{
                          ...CELL,
                          textAlign: 'center' as const,
                          verticalAlign: 'middle',
                          fontSize: '5px',
                          height: '24px',
                          padding: '1px 2px',
                        }}
                      >
                        <span>本日の作業人員数（実施）</span>
                        <br />
                        <span style={{ ...RED, fontWeight: 'bold', fontSize: '8px' }}>{totalWorkers}</span>
                        <span style={{ fontSize: '6px' }}>名</span>
                      </td>
                      <td style={{ ...CELL, fontSize: '6px', textAlign: 'center' as const, height: '12px', padding: '1px 2px' }}>
                        <span style={{ fontWeight: 'bold' }}>段階確認</span>
                        {'　'}
                        {circledChoice(stageConfirmation, '有', '無')}
                      </td>
                    </tr>
                    {/* ===== 行2: ダンプ台数（搬出）+ 立会確認 ===== */}
                    <tr>
                      <td style={{ ...CELL, fontSize: '6px', height: '12px', padding: '1px 2px' }}>
                        搬出：<span style={RED}>{dumpOutgoing}</span>台
                      </td>
                      <td style={{ ...CELL, fontSize: '6px', textAlign: 'center' as const, height: '12px', padding: '1px 2px' }}>
                        <span style={{ fontWeight: 'bold' }}>立会確認</span>
                        {'　'}
                        {circledChoice(witnessConfirmation, '有', '無')}
                      </td>
                    </tr>

                    {/* ===== 行3: 作業連絡調整事項ヘッダー ===== */}
                    {/* height: 10px, fontSize: 5.5px */}
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          ...TH,
                          fontSize: '5.5px',
                          fontWeight: 'bold',
                          textAlign: 'left' as const,
                          height: '10px',
                          padding: '1px 2px',
                        }}
                      >
                        ＊作業連絡調整事項・打合せ・朝礼等周知事項・その他
                      </td>
                    </tr>

                    {/* ===== 行4: 作業連絡調整事項データ（18px高さ） ===== */}
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          ...CELL,
                          whiteSpace: 'normal' as const,
                          height: '18px',
                          verticalAlign: 'top',
                          fontSize: '5.5px',
                          padding: '1px 2px',
                          ...RED,
                        }}
                      >
                        {workNotes || '\u00A0'}
                      </td>
                    </tr>

                    {/* ===== 行5: 巡視点検者 + 巡視所見（横並び） ===== */}
                    {/* height: 11px、TH fontSize: 6px、TD fontSize: 5.5px */}
                    <tr>
                      <th style={{ ...TH, fontSize: '6px', height: '11px', padding: '1px 2px' }}>巡視点検者</th>
                      <td style={{ ...CELL, fontSize: '5.5px', height: '11px', padding: '1px 2px', ...RED }}>
                        {patrolRecord.inspector || '\u00A0'}
                      </td>
                      <th style={{ ...TH, fontSize: '6px', height: '11px', padding: '1px 2px' }}>巡視所見</th>
                      <td style={{ ...CELL, fontSize: '5.5px', height: '11px', padding: '1px 2px', whiteSpace: 'normal' as const, ...RED }}>
                        {patrolRecord.findings || '\u00A0'}
                      </td>
                    </tr>

                    {/* ===== 行6: 巡視時間 ===== */}
                    {/* height: 11px */}
                    <tr>
                      <th style={{ ...TH, fontSize: '6px', height: '11px', padding: '1px 2px' }}>巡視時間</th>
                      <td style={{ ...CELL, fontSize: '5.5px', height: '11px', padding: '1px 2px', ...RED }}>
                        {patrolRecord.inspectionTime || '\u00A0'}
                      </td>
                      <td style={{ ...CELL, height: '11px', padding: '1px 2px' }}>{'\u00A0'}</td>
                      <td style={{ ...CELL, height: '11px', padding: '1px 2px' }}>{'\u00A0'}</td>
                    </tr>

                    {/* ===== 行7: 配置図ヘッダー ===== */}
                    {/* height: 10px, fontSize: 6px */}
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          ...TH,
                          fontSize: '6px',
                          textAlign: 'center' as const,
                          height: '10px',
                          padding: '1px 2px',
                        }}
                      >
                        配置図・略図
                      </td>
                    </tr>

                    {/* ===== 行8: 配置図画像 ===== */}
                    {/* height を指定せず、右側チェックリストの高さに合わせて自動的に伸びる */}
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          ...CELL,
                          textAlign: 'center' as const,
                          verticalAlign: 'top',
                          padding: '1px',
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
                  右側セル（50%）
                  当現場確認項目 → 巡視点検チェックリスト
                  ==================================== */}
              <td style={{ width: '50%', verticalAlign: 'top', padding: 0, border: 'none' }}>
                {/* ---- Part A: 当現場確認項目 ---- */}
                {/* ヘッダー行: height 11px, fontSize 6px */}
                {/* データ行: height 10px, fontSize 5.5px */}
                <table style={{ ...TABLE_BASE }}>
                  <colgroup>
                    <col style={{ width: '35%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '35%' }} />
                    <col style={{ width: '15%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th
                        colSpan={4}
                        style={{
                          ...TH,
                          fontSize: '6px',
                          height: '11px',
                          padding: '1px 2px',
                        }}
                      >
                        当現場確認項目
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 当現場確認項目データ行（5行 × 左右）各行10px高さ */}
                    {[0, 1, 2, 3, 4].map((i) => {
                      const left = SITE_CONFIRMATION_LABELS[i];
                      const right = SITE_CONFIRMATION_LABELS[i + 5];
                      const leftResult = left ? (siteConfirmationItems[left.key] || '') : '';
                      const rightResult = right ? (siteConfirmationItems[right.key] || '') : '';
                      return (
                        <tr key={i}>
                          <td style={{ ...CELL, fontSize: '5.5px', height: '10px', padding: '1px 2px', whiteSpace: 'normal' as const, ...RED }}>
                            {left?.label || '\u00A0'}
                          </td>
                          <td style={{ ...CELL, fontSize: '5.5px', height: '10px', padding: '1px 2px', textAlign: 'center' as const }}>
                            {circledChoice(leftResult, '良', '否')}
                          </td>
                          <td style={{ ...CELL, fontSize: '5.5px', height: '10px', padding: '1px 2px', whiteSpace: 'normal' as const, ...RED }}>
                            {right?.label || '\u00A0'}
                          </td>
                          <td style={{ ...CELL, fontSize: '5.5px', height: '10px', padding: '1px 2px', textAlign: 'center' as const }}>
                            {circledChoice(rightResult, '良', '否')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* ---- Part B: 巡視点検チェックリスト ---- */}
                {/* タイトル行: height 9px, fontSize 5px */}
                <table style={{ ...TABLE_BASE }}>
                  <tbody>
                    {/* タイトル行 */}
                    <tr>
                      <td
                        colSpan={2}
                        style={{
                          ...CELL,
                          fontSize: '5px',
                          fontWeight: 'bold',
                          textAlign: 'center' as const,
                          height: '9px',
                          padding: '0px 1px',
                        }}
                      >
                        巡視点検チェックリスト　（ ○適正　△一部適正　×不適切　◎是正済　無印は該当無 ）
                      </td>
                    </tr>
                    {/* チェックリスト本体: 左右2列 */}
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
                        <table style={{ width: '100%', borderCollapse: 'collapse' as const, tableLayout: 'fixed' as const, margin: 0 }}>
                          <colgroup>
                            <col style={{ width: '80%' }} />
                            <col style={{ width: '20%' }} />
                          </colgroup>
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
                        <table style={{ width: '100%', borderCollapse: 'collapse' as const, tableLayout: 'fixed' as const, margin: 0 }}>
                          <colgroup>
                            <col style={{ width: '80%' }} />
                            <col style={{ width: '20%' }} />
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
    </>
  );
};

export default DailySafetyPrintLayout;
