// src/components/DailySafetyPrintLayout.tsx
// 安全衛生日誌（作業打合せ及び安全衛生日誌）帳票レイアウトコンポーネント
// A4横向き（297mm × 210mm）1ページに全入力項目を収める
// HTMLの<table>タグをネストして元PDFのレイアウトを極限まで再現する
// STEP3当日入力分・STEP4巡視記録は赤字（color: red）で表示
//
// ■ サイズ計算根拠
// A4横: 297mm × 210mm, padding: 4mm（上下左右）
// 有効高さ: 210mm - 8mm = 202mm ≒ 764px（96dpi）
// ヘッダー（タイトル行）: 20px
// 残り44行 × 14px = 616px
// border累積（約50行分 border-collapse で約25px）
// 合計: 20 + 616 + 25 = 661px（有効764px内に十分収まる）

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

// 各カテゴリの自由記入欄の行数
const CHECKLIST_CUSTOM_ROWS: Record<string, number> = {
  management: 1,  // 固定11 + 自由1 = 12項目行 → ヘッダー1 + 項目11 + 余白1 = 13行
  machinery: 0,   // 固定5 → ヘッダー1 + 項目5 + 余白1 = 7行
  electrical: 0,  // 固定5 → ヘッダー1 + 項目5 + 余白1 = 7行
  falling: 0,     // 固定5 → ヘッダー1 + 項目5 + 余白1 = 7行
  debris: 0,      // 固定5 → ヘッダー1 + 項目5 + 余白1 = 7行
  environment: 0, // 固定5 → ヘッダー1 + 項目5 + 余白1 = 7行
  others: 0,      // 固定3 → ヘッダー1 + 項目3 + 余白2 = 6行
};

// 各カテゴリの余白行数
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

// 標準行高さ: 14px（ヘッダー行以外すべて。例外なし）
const ROW_H = '14px';

// rowSpan=2のセル高さ: 28px（14px × 2）
const ROW_H2 = '28px';

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
  padding: '1px 2px',
  fontSize: '6px',
  lineHeight: 1.2,
  verticalAlign: 'middle',
  overflow: 'hidden',
  whiteSpace: 'nowrap' as const,
  textOverflow: 'ellipsis',
  height: ROW_H,
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
  const inspectionChecklist = data?.step5InspectionChecklist || ({ categories: [] } as any);
  const dumpTrucks = data?.dumpTrucks || ({ incoming: '', outgoing: '' } as any);
  const patrolRecord = data?.patrolRecord || ({} as any);
  const stageConfirmation = data?.stageConfirmation || '';
  const witnessConfirmation = data?.witnessConfirmation || '';
  const workNotes = data?.workNotes || '';
  const diagramUrl = (data as any)?.diagramUrl || (data as any)?.diagramImage || '';
  const presenter = data?.presenter || '';
  const projectName = data?.projectName || '';
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
    const customRowCount = CHECKLIST_CUSTOM_ROWS[categoryKey] || 0;
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

    // 自由記入欄行: データがなくても空行を表示（管理カテゴリのみ1行）
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
  // カテゴリヘッダー行: height 14px, fontSize 5px bold
  // 項目行: height 14px, fontSize 4.5px
  // 余白行: height 14px, 空セル border維持
  // ============================
  const renderChecklistColumn = (keys: string[]) => {
    const rows: React.ReactNode[] = [];
    keys.forEach((key) => {
      const title = CATEGORY_TITLES[key] || key;
      const items = buildChecklistRows(key);
      const blankCount = CHECKLIST_BLANK_ROWS[key] || 1;

      // カテゴリヘッダー行（14px高さ）
      rows.push(
        <tr key={`hdr-${key}`} style={{ height: ROW_H }}>
          <td
            colSpan={2}
            style={{
              border: B,
              padding: '0px 1px',
              fontWeight: 'bold',
              fontSize: '5px',
              textAlign: 'left' as const,
              height: ROW_H,
              lineHeight: ROW_H,
              overflow: 'hidden',
            }}
          >
            【{title}】
          </td>
        </tr>
      );

      // 項目行（各14px高さ）
      items.forEach((item, idx) => {
        rows.push(
          <tr key={`${key}-${idx}`} style={{ height: ROW_H }}>
            <td
              style={{
                border: B,
                padding: '0px 1px',
                fontSize: '4.5px',
                textAlign: 'left' as const,
                height: ROW_H,
                lineHeight: ROW_H,
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
                fontSize: '4.5px',
                textAlign: 'center' as const,
                height: ROW_H,
                lineHeight: ROW_H,
                ...RED,
              }}
            >
              {item.rating || '\u00A0'}
            </td>
          </tr>
        );
      });

      // 余白行（各14px高さ、空セル border維持）
      for (let b = 0; b < blankCount; b++) {
        rows.push(
          <tr key={`blank-${key}-${b}`} style={{ height: ROW_H }}>
            <td
              style={{
                border: B,
                padding: '0px 1px',
                fontSize: '4.5px',
                height: ROW_H,
                lineHeight: ROW_H,
              }}
            >
              {'\u00A0'}
            </td>
            <td
              style={{
                border: B,
                padding: '0px 1px',
                fontSize: '4.5px',
                textAlign: 'center' as const,
                height: ROW_H,
                lineHeight: ROW_H,
              }}
            >
              {'\u00A0'}
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
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; }
        }
        @page { size: A4 landscape; margin: 0; }
      `}</style>

      {/* 帳票本体（A4横 297mm × 210mm、余白4mm → 有効高さ202mm ≒ 764px） */}
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
            第1段: ヘッダー（タイトル行 20px）
            左セル25%: 空白, border: none
            中央セル50%: タイトル fontSize 13px bold
            右セル25%: 所長確認欄ラベル 6px + 空白枠 14px高 70px幅
            ================================================================== */}
        <table style={{ ...TABLE_BASE, marginBottom: 0 }}>
          <tbody>
            <tr style={{ height: '20px' }}>
              {/* 左セル（25%）: 空白 */}
              <td style={{ width: '25%', border: 'none', padding: 0, height: '20px' }}>{'\u00A0'}</td>
              {/* 中央セル（50%）: タイトル（13px bold） */}
              <td
                style={{
                  width: '50%',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  textAlign: 'center' as const,
                  padding: 0,
                  height: '20px',
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
                  padding: 0,
                  height: '20px',
                }}
              >
                <div style={{ fontSize: '6px', textAlign: 'right' }}>所長確認欄</div>
                <div
                  style={{
                    border: '1px solid black',
                    height: '14px',
                    width: '70px',
                    display: 'inline-block',
                  }}
                />
              </td>
            </tr>
          </tbody>
        </table>

        {/* ==================================================================
            第2段: 基本情報行（1行8列, height: 14px）
            TH fontSize: 6px bold, textAlign center
            TD fontSize: 6px, paddingLeft 4px
            打合せ実施者: 赤字
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
            <tr style={{ height: ROW_H }}>
              <th style={{ ...TH, fontSize: '6px' }}>工事名</th>
              <td style={{ ...CELL, fontSize: '6px', paddingLeft: '4px' }}>{projectName}</td>
              <th style={{ ...TH, fontSize: '6px' }}>打合せ日</th>
              <td style={{ ...CELL, fontSize: '6px', paddingLeft: '4px' }}>
                {toWareki(meetingDate)}{getWeekdayLabel(meetingDate)}
              </td>
              <th style={{ ...TH, fontSize: '6px' }}>作業日</th>
              <td style={{ ...CELL, fontSize: '6px', paddingLeft: '4px' }}>
                {toWareki(workDate)}{getWeekdayLabel(workDate)}
              </td>
              <th style={{ ...TH, fontSize: '6px' }}>打合せ実施者</th>
              <td style={{ ...CELL, fontSize: '6px', paddingLeft: '4px', ...RED }}>
                {presenter}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ==================================================================
            第3段: 統合作業テーブル（9列×ヘッダー1行(14px)＋データ10行(14px)固定）
            列幅: 作業内容13% + 会社名8% + 人数予定4% + 人数実施4% + 主要機械10%
                  + 搬出入資機材8% + 安全衛生指示事項25% + 基本確認事項23% + 結果5%
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
            {/* ヘッダー行: 14px高さ, fontSize 5.5px bold */}
            <tr style={{ height: ROW_H }}>
              <th style={{ ...TH, fontSize: '5.5px' }}>作業内容</th>
              <th style={{ ...TH, fontSize: '5.5px' }}>会社名</th>
              <th style={{ ...TH, fontSize: '5.5px', whiteSpace: 'normal' as const, lineHeight: 1.1 }}>
                人数<br />（予定）
              </th>
              <th style={{ ...TH, fontSize: '5.5px', whiteSpace: 'normal' as const, lineHeight: 1.1 }}>
                人数<br />（実施）
              </th>
              <th style={{ ...TH, fontSize: '5.5px' }}>主要機械</th>
              <th style={{ ...TH, fontSize: '5.5px' }}>搬出入資機材</th>
              <th style={{ ...TH, fontSize: '5.5px' }}>安全衛生指示事項</th>
              <th style={{ ...TH, fontSize: '5.5px' }}>基本確認事項</th>
              <th style={{ ...TH, fontSize: '5.5px' }}>結果</th>
            </tr>
          </thead>
          <tbody>
            {integratedRows.slice(0, WORK_ROWS).map((row, idx) => {
              // データセル共通スタイル（赤字、14px高さ）
              const dataCell: React.CSSProperties = {
                ...CELL,
                fontSize: '5.5px',
                ...RED,
              };

              // 主要機械の表示: machineとmachine2をカンマ区切りで1行表示（改行なし）
              const renderMachineContent = (): string => {
                const m1 = row.machine || '';
                const m2 = row.machine2 || '';
                if (m1 && m2) return `${m1}, ${m2}`;
                if (m1) return m1;
                if (m2) return m2;
                return '\u00A0';
              };

              return (
                <tr key={idx} style={{ height: ROW_H }}>
                  {/* 作業内容 */}
                  <td style={dataCell}>{row.workContent || '\u00A0'}</td>
                  {/* 会社名 */}
                  <td style={dataCell}>{row.company || '\u00A0'}</td>
                  {/* 人数（予定） */}
                  <td style={{ ...dataCell, textAlign: 'center' as const }}>{row.plannedWorkers || '\u00A0'}</td>
                  {/* 人数（実施） */}
                  <td style={{ ...dataCell, textAlign: 'center' as const }}>{row.actualWorkersVal || '\u00A0'}</td>
                  {/* 主要機械: カンマ区切り1行表示、whiteSpace nowrap */}
                  <td style={{ ...dataCell, whiteSpace: 'nowrap' as const }}>{renderMachineContent()}</td>
                  {/* 搬出入資機材 */}
                  <td style={dataCell}>{row.material || '\u00A0'}</td>
                  {/* 安全衛生指示事項: 折り返し許可、行高さ14px維持、はみ出しhidden */}
                  <td style={{ ...dataCell, whiteSpace: 'normal' as const }}>{row.safetyInstruction || '\u00A0'}</td>
                  {/* 基本確認事項: 折り返し許可、行高さ14px維持、はみ出しhidden */}
                  <td style={{ ...dataCell, whiteSpace: 'normal' as const }}>{row.confirmationLabel || '\u00A0'}</td>
                  {/* 結果: 良・否の丸囲み、fontSize 5px */}
                  <td style={{ ...CELL, fontSize: '5px', textAlign: 'center' as const }}>
                    {circledChoice(row.confirmationResult, '良', '否')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ==================================================================
            第4段〜第5段: 左右独立レイアウト
            外枠テーブル1行2列（左47%・右53%）
            第3段の列境界と縦ラインが揃う
            margin: 0, 第3段テーブルとの間にスペースなし
            ================================================================== */}
        <table style={{ ...TABLE_BASE }}>
          <tbody>
            <tr>
              {/* ====================================
                  左側セル（47%）
                  ダンプ台数 → 作業連絡 → 巡視 → 配置図
                  1つの内部テーブルで隙間なし
                  列幅: 28% + 25% + 9% + 38% = 100%
                  ==================================== */}
              <td style={{ width: '47%', verticalAlign: 'top', padding: 0, border: 'none' }}>
                <table style={{ ...TABLE_BASE }}>
                  <colgroup>
                    <col style={{ width: '28%' }} />
                    <col style={{ width: '25%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '38%' }} />
                  </colgroup>
                  <tbody>
                    {/* ===== 行1: ダンプ台数（搬入）+ 作業人員数 + 段階確認 ===== */}
                    <tr style={{ height: ROW_H }}>
                      {/* ダンプ台数セル: rowSpan=2, height=28px（14px×2） */}
                      <td
                        rowSpan={2}
                        style={{
                          border: B,
                          padding: 0,
                          fontSize: '5.5px',
                          verticalAlign: 'top',
                          overflow: 'hidden',
                          height: ROW_H2,
                        }}
                      >
                        {/* 上段: ダンプ台数ラベル + 搬入 */}
                        <div style={{ height: ROW_H, lineHeight: ROW_H, paddingLeft: '2px', overflow: 'hidden' }}>
                          <span style={{ fontWeight: 'bold' }}>ダンプ台数</span>
                          {'　'}
                          <span>搬入：</span>
                          <span style={RED}>{dumpIncoming}</span>
                          <span>台</span>
                        </div>
                        {/* 下段: 搬出 */}
                        <div style={{ height: ROW_H, lineHeight: ROW_H, paddingLeft: '2px', borderTop: B, overflow: 'hidden' }}>
                          <span>{'　　　　　　'}搬出：</span>
                          <span style={RED}>{dumpOutgoing}</span>
                          <span>台</span>
                        </div>
                      </td>
                      {/* 本日の作業人員数（実施）: rowSpan=2, height=28px */}
                      <td
                        rowSpan={2}
                        style={{
                          border: B,
                          textAlign: 'center' as const,
                          verticalAlign: 'middle',
                          fontSize: '5px',
                          padding: '1px 2px',
                          overflow: 'hidden',
                          height: ROW_H2,
                        }}
                      >
                        本日の作業人員数（実施）
                      </td>
                      {/* ○名: rowSpan=2, height=28px, 人数7px bold赤字 */}
                      <td
                        rowSpan={2}
                        style={{
                          border: B,
                          textAlign: 'center' as const,
                          verticalAlign: 'middle',
                          fontSize: '7px',
                          fontWeight: 'bold',
                          padding: '1px 2px',
                          overflow: 'hidden',
                          height: ROW_H2,
                          ...RED,
                        }}
                      >
                        {totalWorkers}<span style={{ fontSize: '5.5px' }}>名</span>
                      </td>
                      {/* 段階確認: height=14px */}
                      <td style={{ border: B, fontSize: '5.5px', textAlign: 'center' as const, height: ROW_H, padding: '1px 2px', overflow: 'hidden' }}>
                        <span style={{ fontWeight: 'bold' }}>段階確認</span>
                        {'　'}
                        {circledChoice(stageConfirmation, '有', '無')}
                      </td>
                    </tr>
                    {/* ===== 行2: 立会確認 height=14px ===== */}
                    <tr style={{ height: ROW_H }}>
                      <td style={{ border: B, fontSize: '5.5px', textAlign: 'center' as const, height: ROW_H, padding: '1px 2px', overflow: 'hidden' }}>
                        <span style={{ fontWeight: 'bold' }}>立会確認</span>
                        {'　'}
                        {circledChoice(witnessConfirmation, '有', '無')}
                      </td>
                    </tr>

                    {/* ===== 行3: 作業連絡調整事項ヘッダー（14px） ===== */}
                    <tr style={{ height: ROW_H }}>
                      <td
                        colSpan={4}
                        style={{
                          border: B,
                          fontSize: '5.5px',
                          fontWeight: 'bold',
                          textAlign: 'left' as const,
                          height: ROW_H,
                          padding: '1px 2px',
                          overflow: 'hidden',
                        }}
                      >
                        ＊作業連絡調整事項・打合せ・朝礼等周知事項・その他
                      </td>
                    </tr>

                    {/* ===== 行4: 作業連絡調整事項データ（14px） ===== */}
                    <tr style={{ height: ROW_H }}>
                      <td
                        colSpan={4}
                        style={{
                          border: B,
                          whiteSpace: 'normal' as const,
                          height: ROW_H,
                          verticalAlign: 'top',
                          fontSize: '5px',
                          padding: '1px 2px',
                          overflow: 'hidden',
                          ...RED,
                        }}
                      >
                        {workNotes || '\u00A0'}
                      </td>
                    </tr>

                    {/* ===== 行5: 巡視点検者 + 巡視所見（14px） ===== */}
                    <tr style={{ height: ROW_H }}>
                      <th style={{ border: B, fontSize: '5.5px', fontWeight: 'bold', textAlign: 'center' as const, height: ROW_H, padding: '1px 2px', overflow: 'hidden' }}>巡視点検者</th>
                      <td style={{ border: B, fontSize: '5.5px', height: ROW_H, padding: '1px 2px', overflow: 'hidden', ...RED }}>
                        {patrolRecord.inspector || '\u00A0'}
                      </td>
                      <th style={{ border: B, fontSize: '5.5px', fontWeight: 'bold', textAlign: 'center' as const, height: ROW_H, padding: '1px 2px', overflow: 'hidden' }}>巡視所見</th>
                      <td style={{ border: B, fontSize: '5px', height: ROW_H, padding: '1px 2px', whiteSpace: 'normal' as const, overflow: 'hidden', ...RED }}>
                        {patrolRecord.findings || '\u00A0'}
                      </td>
                    </tr>

                    {/* ===== 行6: 巡視時間（14px） ===== */}
                    <tr style={{ height: ROW_H }}>
                      <th style={{ border: B, fontSize: '5.5px', fontWeight: 'bold', textAlign: 'center' as const, height: ROW_H, padding: '1px 2px', overflow: 'hidden' }}>巡視時間</th>
                      <td style={{ border: B, fontSize: '5.5px', height: ROW_H, padding: '1px 2px', overflow: 'hidden', ...RED }}>
                        {patrolRecord.inspectionTime || '\u00A0'}
                      </td>
                      <td style={{ border: B, height: ROW_H, padding: '1px 2px' }}>{'\u00A0'}</td>
                      <td style={{ border: B, height: ROW_H, padding: '1px 2px' }}>{'\u00A0'}</td>
                    </tr>

                    {/* ===== 行7: 配置図ヘッダー（14px） ===== */}
                    <tr style={{ height: ROW_H }}>
                      <td
                        colSpan={4}
                        style={{
                          border: B,
                          fontSize: '5.5px',
                          fontWeight: 'bold',
                          textAlign: 'center' as const,
                          height: ROW_H,
                          padding: '1px 2px',
                          overflow: 'hidden',
                        }}
                      >
                        配置図・略図
                      </td>
                    </tr>

                    {/* ===== 行8: 配置図画像 ===== */}
                    {/* 高さは指定しない。右側テーブルと同じ高さまで自動的に伸びる */}
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          border: B,
                          textAlign: 'center' as const,
                          verticalAlign: 'top',
                          padding: '1px',
                          whiteSpace: 'normal' as const,
                          overflow: 'hidden',
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
                  右側セル（53%）
                  当現場確認項目 → 巡視点検チェックリスト
                  右側53%を完全に半分に分割: 左半分26.5%, 右半分26.5%
                  ==================================== */}
              <td style={{ width: '53%', verticalAlign: 'top', padding: 0, border: 'none' }}>
                {/* ---- Part A: 当現場確認項目（ヘッダー1行 + データ5行 = 6行, 全て14px） ---- */}
                {/* 4列構成: 左確認項目37% + 左結果13% + 右確認項目37% + 右結果13% */}
                <table style={{ ...TABLE_BASE }}>
                  <colgroup>
                    <col style={{ width: '37%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '37%' }} />
                    <col style={{ width: '13%' }} />
                  </colgroup>
                  <thead>
                    {/* 当現場確認項目ヘッダー行（14px） */}
                    <tr style={{ height: ROW_H }}>
                      <th
                        colSpan={4}
                        style={{
                          border: B,
                          fontSize: '5.5px',
                          fontWeight: 'bold',
                          textAlign: 'center' as const,
                          height: ROW_H,
                          padding: '1px 2px',
                          overflow: 'hidden',
                        }}
                      >
                        当現場確認項目
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 当現場確認項目データ行（5行 × 左右, 各14px） */}
                    {[0, 1, 2, 3, 4].map((i) => {
                      const left = SITE_CONFIRMATION_LABELS[i];
                      const right = SITE_CONFIRMATION_LABELS[i + 5];
                      const leftResult = left ? (siteConfirmationItems[left.key] || '') : '';
                      const rightResult = right ? (siteConfirmationItems[right.key] || '') : '';
                      return (
                        <tr key={i} style={{ height: ROW_H }}>
                          <td style={{ border: B, fontSize: '5px', height: ROW_H, padding: '1px 2px', whiteSpace: 'normal' as const, overflow: 'hidden', ...RED }}>
                            {left?.label || '\u00A0'}
                          </td>
                          <td style={{ border: B, fontSize: '5px', height: ROW_H, padding: '1px 2px', textAlign: 'center' as const, overflow: 'hidden' }}>
                            {circledChoice(leftResult, '良', '否')}
                          </td>
                          <td style={{ border: B, fontSize: '5px', height: ROW_H, padding: '1px 2px', whiteSpace: 'normal' as const, overflow: 'hidden', ...RED }}>
                            {right?.label || '\u00A0'}
                          </td>
                          <td style={{ border: B, fontSize: '5px', height: ROW_H, padding: '1px 2px', textAlign: 'center' as const, overflow: 'hidden' }}>
                            {circledChoice(rightResult, '良', '否')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* ---- Part B: 巡視点検チェックリスト（タイトル1行 + 27行 = 28行, 全て14px） ---- */}
                <table style={{ ...TABLE_BASE }}>
                  <tbody>
                    {/* タイトル行（14px） */}
                    <tr style={{ height: ROW_H }}>
                      <td
                        colSpan={4}
                        style={{
                          border: B,
                          fontSize: '4.5px',
                          fontWeight: 'bold',
                          textAlign: 'center' as const,
                          height: ROW_H,
                          padding: '0px 1px',
                          overflow: 'hidden',
                        }}
                      >
                        巡視点検チェックリスト　（ ○適正　△一部適正　×不適切　◎是正済　無印は該当無 ）
                      </td>
                    </tr>
                    {/* チェックリスト本体: 左右2列（各50%） */}
                    <tr>
                      {/* 左列: 管理、重機・機械、電気（27行） */}
                      <td
                        colSpan={2}
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
                      {/* 右列: 墜落・転落、飛来・落下崩壊・転倒、作業環境、その他（27行） */}
                      <td
                        colSpan={2}
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
