// src/types.ts

// ============================
// 帳票種別の型定義
// ============================
export type ReportTypeString = 'SAFETY_TRAINING' | 'DISASTER_COUNCIL' | 'SAFETY_PLAN' | 'NEWCOMER_SURVEY' | 'DAILY_SAFETY';

// ============================
// 一時保存データの型定義
// ============================
export interface SavedDraft {
  id: string;
  type: ReportTypeString;
  data: any;
  createdAt: number;
  updatedAt: number;
  lastModified: number;
}

// --- 元請社員データの型定義 ---
export interface EmployeeData {
  id: string; 
  nameSei: string;
  nameMei: string;
  furiganaSei: string;
  furiganaMei: string;
  birthEra: 'Showa' | 'Heisei';
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  gender: 'Male' | 'Female';
  bloodType: string;
  bloodTypeRh: 'Plus' | 'Minus' | 'Unknown';
  address: string;
  phone: string;
  emergencyContactSei: string;
  emergencyContactMei: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  jobType: string;
  experienceYears: number;
  experienceMonths: number;
  lastUpdatedExperience: number;
  healthCheckYear: number; 
  healthCheckMonth: number;
  healthCheckDay: number;
  qualifications: Qualifications;
}

export const EMPLOYEE_MASTER_DATA: Record<string, EmployeeData> = {};

// ============================
// マスタデータの型定義
// ============================
export interface MasterData {
  projects: string[];
  workplaces: string[];
  contractors: string[];
  supervisors: string[];
  locations: string[];
  roles: string[];
  topics: string[];
  jobTypes: string[];
  goals: string[];
  predictions: string[];
  countermeasures: string[];
  subcontractors: string[]; 
  processes: string[];      
  cautions: string[];
  // --- 安全衛生日誌用マスタ ---
  machines: string[];       // 機械
  equipment: string[];      // 資機材（搬出入資機材・段取り資材等で共通使用）
  safetyInstructionItems: string[];  // 安全衛生指示事項
}

export const INITIAL_MASTER_DATA: MasterData = {
  projects: [
    "テスト",
    "公共運動公園周辺地区整備工事（Ｒ７芝崎地区粗造成その２）"
  ],
  contractors: [
    "テスト",
    "松浦建設株式会社"
  ],
  supervisors: [
    "テスト",
    "大須賀 久敬"
  ],
  locations: [
    "テスト",
    "本社会議室",
    "現場事務所"
  ],
  workplaces: [
    "テスト",
    "芝崎作業所"
  ],
  roles: [
    "テスト",
    "主任技術者",
    "現場担当者"
  ],
  topics: [
    "本工事内容の周知徹底（工事概要・工程・図面・施工方法等）",
    "現場内注意事項説明",
    "災害事例による安全教育（建設機械による災害事例）",
    "ヒヤリハット事例による安全教育 ・熱中症対策に関する安全教育",
    "盗難防止対策に関する教育",
    "重機災害防止教育（車両系建設機械運転教本による教育）",
    "土木工事安全施工技術指針の周知",
    "建設工事公衆災害防止対策要領による教育",
    "指差呼称によるヒューマンエラー防止教育",
    "第三者災害防止に関する安全教育",
    "ダンプトラック出入口管理に関する安全教育",
    "重機接触・挟まれ防止に関する安全教育",
    "法面作業時の転倒防止に関する安全教育",
    "土砂崩落防止に関する安全教育",
    "敷鉄板設置箇所の安全確保に関する教育",
    "飛来・落下物防止に関する安全教育",
    "玉掛け作業に関する安全教育",
    "開口部墜落防止に関する安全教育",
    "交通誘導員との連携強化に関する教育",
    "緊急時対応（事故・増水時）に関する教育",
    "保護具着用徹底に関する安全教育",
    "作業前KY活動の徹底に関する教育",
    "不整地歩行時の転倒防止に関する教育"
  ],
  jobTypes: [
    "テスト",
    "盛土工",
    "掘削工",
    "植生工",
    "矢板工",
    "土砂改良工",
    "構造物撤去工",
    "工事用道路工",
    "交通管理工"
  ],
  goals: [
    "テスト",
    "重機接触災害防止",
    "重機転倒災害防止",
    "第三者災害防止",
    "ダンプトラック接触災害防止",
    "吊荷落下災害防止",
    "玉掛け作業災害防止",
    "熱中症災害防止",
    "重機巻き込まれ災害防止",
    "作業半径内立入災害防止",
    "ダンプ後退時災害防止",
    "法面滑落災害防止",
    "墜落・転落災害防止",
    "掘削面崩壊災害防止",
    "土砂崩落災害防止",
    "仮設構造物倒壊災害防止",
    "河川増水・急激水位上昇災害防止",
    "溺水災害防止",
    "感電災害防止",
    "飛来・落下物災害防止",
    "敷鉄板転倒・ずれ災害防止"
  ],
  predictions: [
    "重機接触災害",
    "第三者災害",
    "ダンプトラックとの接触事故",
    "重機同士の接触事故",
    "第三者との接触事故",
    "重機と人の激突事故",
    "重機との接触事故",
    "重機による挟まれ事故",
    "旋回時挟まれ事故",
    "手足の挟まれ事故",
    "法面からの転倒事故",
    "現場内転倒事故",
    "熱中症による人身事故",
    "足場崩壊による転落事故",
    "足場崩壊による転倒事故",
    "土砂崩落事故",
    "開口部の墜落事故",
    "敷鉄板による人身事故",
    "重量物取扱いによる腰痛事故",
    "飛来・落下物事故"
  ],
  countermeasures: [
    "作業区域の立入禁止徹底",
    "作業エリア明示の徹底",
    "誘導員配置の徹底",
    "合図の確認徹底",
    "ダンプ後退時の合図確認",
    "玉掛け合図の統一徹底",
    "人と車両の動線分離",
    "重機同士の作業間隔確保",
    "安全位置確保と退避徹底",
    "熱中症予防管理の徹底",
    "敷鉄板の固定・段差解消",
    "現場内の整理整頓",
    "重量物の複数人作業",
    "KY活動による危険共有",
    "作業半径内立入禁止",
    "旋回範囲への進入防止",
    "挟まれ防止の合図徹底",
    "こまめな水分補給・休息",
    "法面作業時の滑落防止",
    "掘削面の点検実施",
    "足場組立基準の遵守",
    "手すり・作業床の設置",
    "開口部養生の徹底",
    "飛来落下防止措置"
  ],
  subcontractors: [], 
  processes: [],
  cautions: [],
  // --- 安全衛生日誌用マスタ初期値 ---
  machines: [],       // 機械
  equipment: [],      // 資機材
  safetyInstructionItems: [],  // 安全衛生指示事項
};

// --- Safety Training Report ---
export interface WorkerSignature {
  id: string;
  company: string;
  name: string;
  signatureDataUrl: string;
}

export interface ReportData {
  project: string;
  month: number;
  contractor: string;
  date: string;
  location: string;
  startTime: string;
  endTime: string;
  instructor: string;
  goal: string;
  process: string;
  topic: string;
  caution: string;
  photoUrl: string | null;
  signatures: WorkerSignature[];
  year: number;
  scenePhoto: string;
  situationPhoto: string;
  remarks: string;
}

export const INITIAL_REPORT: ReportData = {
  project: '',
  month: new Date().getMonth() + 1,
  contractor: '松浦建設株式会社',
  date: new Date().toISOString().split('T')[0],
  location: '',
  startTime: "08:00",
  endTime: "08:30",
  instructor: '',
  topic: '',
  goal: '',
  process: '',
  caution: '',
  photoUrl: null,
  signatures: [],
  year: new Date().getFullYear(),
  scenePhoto: "",
  situationPhoto: "",
  remarks: ""
};

// --- Disaster Council Report ---
export interface GCAttendee {
  role: string;
  name: string;
}

export interface SubcontractorAttendee {
  id: string;
  company: string;
  role: string;
  name: string;
  signatureDataUrl: string;
}

export interface DisasterCouncilReportData extends ReportData {
  count: number;
  startTime: string;
  endTime: string;
  gcAttendees: GCAttendee[];
  subcontractorAttendees: SubcontractorAttendee[];
}

export const INITIAL_DISASTER_COUNCIL_REPORT: DisasterCouncilReportData = {
  ...INITIAL_REPORT,
  count: 1,
  startTime: "13:00",
  endTime: "14:00",
  gcAttendees: Array(8).fill({ role: "", name: "" }),
  subcontractorAttendees: []
};

// --- Safety Plan Report ---
export interface PlanProcessBar {
  startDay: number;
  endDay: number;
}

export interface PlanProcessRow {
  id: string;
  category: string;
  name: string;
  bars: PlanProcessBar[];
}

export interface SafetyPlanReportData extends ReportData {
  year: number;
  month: number;
  createdDate: string;
  project: string;
  location: string;
  author: string;
  trainingDate: string;
  trainingLeader: string;
  councilDate: string;
  councilLeader: string;
  patrolDate: string;
  processRows: PlanProcessRow[];
  predictions: string[][];
  countermeasures: string[][];
  inspectionItems: string[][];
  safetyDuty: Record<number, string>;
  // ★追加: 安全衛生目標 (3つ固定)
  safetyGoals: string[];
}

export const INITIAL_SAFETY_PLAN_REPORT: SafetyPlanReportData = {
  ...INITIAL_REPORT,
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  createdDate: new Date().toISOString().split('T')[0],
  project: '',
  location: '',
  author: '',
  trainingDate: "",
  trainingLeader: '',
  councilDate: "",
  councilLeader: "",
  patrolDate: "",
  processRows: [],
  predictions: Array(5).fill(null).map(() => ["", ""]),
  countermeasures: Array(5).fill(null).map(() => ["", "", "", "", ""]),
  inspectionItems: Array(5).fill(null).map(() => ["", "", ""]),
  safetyDuty: {},
  safetyGoals: ["", "", ""] // ★追加: 初期値は空文字3つ
};

// --- Newcomer Survey Report ---
export interface Qualifications {
  vehicle_leveling: boolean;
  vehicle_demolition: boolean;
  mobile_crane: boolean;
  slinging: boolean;
  gas_welding: boolean;
  earth_retaining: boolean;
  excavation: boolean;
  scaffolding: boolean;
  formwork: boolean;
  oxygen_deficiency: boolean;
  rough_terrain: boolean;
  arc_welding: boolean;
  grinding_wheel: boolean;
  low_voltage: boolean;
  roller: boolean;
  asbestos: boolean;
  foreman: boolean;
  license_regular?: boolean;
  license_large?: boolean;
  license_large_special?: boolean;
  license_towing?: boolean;
  otherText1: string;
  otherText2: string;
  otherText3: string;
}

export interface NewcomerSurveyReportData extends ReportData {
  name?: string; 
  project: string;
  director: string;
  furiganaSei: string;
  furiganaMei: string;
  nameSei: string;
  nameMei: string;
  birthEra: 'Showa' | 'Heisei';
  birthYear: number | '';
  birthMonth: number | '';
  birthDay: number | '';
  gender: 'Male' | 'Female';
  age: number;
  company: string;
  subcontractorRank: string;
  experienceYears: number | null;
  experienceMonths: number | null;
  jobType: string;
  jobTypeOther: string;
  address: string;
  phone: string;
  emergencyContactSei: string;
  emergencyContactMei: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  bloodType: string;
  bloodTypeRh: 'Plus' | 'Minus' | 'Unknown';
  healthCheckYear: number | null;
  healthCheckMonth: number | null;
  healthCheckDay: number | null;
  kentaikyo: 'Joined' | 'NotJoined';
  qualifications: Qualifications;
  pledgeDateYear: number | null;
  pledgeDateMonth: number | null;
  pledgeDateDay: number | null;
  signatureDataUrl: string | null;
}

export const INITIAL_NEWCOMER_SURVEY_REPORT: NewcomerSurveyReportData = {
  ...INITIAL_REPORT,
  project: "",
  director: "",
  furiganaSei: "",
  furiganaMei: "",
  nameSei: "",
  nameMei: "",
  birthEra: 'Heisei',
  birthYear: '',
  birthMonth: '',
  birthDay: '',
  gender: 'Male',
  age: 0,
  company: "", 
  subcontractorRank: "", 
  experienceYears: null,
  experienceMonths: null,
  jobType: "土工",
  jobTypeOther: "",
  address: "",
  phone: "",
  emergencyContactSei: "",
  emergencyContactMei: "",
  emergencyContactRelation: "",
  emergencyContactPhone: "",
  bloodType: "A",
  bloodTypeRh: "Unknown", 
  healthCheckYear: null,
  healthCheckMonth: null,
  healthCheckDay: null,
  kentaikyo: 'Joined',
  qualifications: {
    vehicle_leveling: false, vehicle_demolition: false, mobile_crane: false, slinging: false, gas_welding: false, earth_retaining: false, excavation: false, scaffolding: false, formwork: false, oxygen_deficiency: false, rough_terrain: false, arc_welding: false, grinding_wheel: false, low_voltage: false, roller: false, asbestos: false, foreman: false, 
    license_regular: false, license_large: false, license_large_special: false, license_towing: false,
    otherText1: "", otherText2: "", otherText3: ""
  },
  pledgeDateYear: null,
  pledgeDateMonth: null,
  pledgeDateDay: null,
  signatureDataUrl: null
};


// ============================
// 安全衛生日誌（作業打合せ及び安全衛生日誌）
// ============================

// --- サブインターフェース ---

/** 作業内容エントリ */
export interface WorkEntry {
  id: string;
  workContent: string;       // 作業内容（自由入力）
  company: string;           // 会社名（contractorsマスタ選択）
  plannedWorkers: number;    // 人数（予定）
  actualWorkers: number;     // 人数（実施）（STEP3で入力）
  machine: string;           // 機械（machinesマスタ選択）
  isAdditional: boolean;     // 追加作業フラグ（当日追加は true）
}

/** 確認事項チェック */
export interface ConfirmationCheck {
  id: string;
  label: string;             // 確認項目名
  result: 'good' | 'bad' | ''; // 良/否/未選択
}

/** 当現場の確認項目チェック */
export interface SiteCheck {
  id: string;
  label: string;             // 確認項目名
  result: 'good' | 'bad' | ''; // 良/否/未選択
}

/** 点検チェックリスト大項目 */
export interface InspectionCategory {
  categoryName: string;      // 大項目名（管理、重機・機械、電機、墜落転落 等）
  items: InspectionItem[];
}

/** 点検チェックリスト個別項目 */
export interface InspectionItem {
  id: string;
  label: string;             // 点検項目名
  result: '○' | '△' | '×' | '◎' | '';  // 結果（未入力は空文字）
  isEditable: boolean;       // 編集可能か（「その他」欄のみtrue）
  editedLabel: string;       // 編集後のラベル（isEditableがtrueの場合に使用）
}

/** 安全衛生日誌メインデータ */
export interface DailySafetyReportData {
  // --- 基本情報 ---
  project: string;              // 工事名（マスタ選択）
  meetingConductor: string;     // 打合せ実施者（supervisorsマスタ選択）
  meetingDate: string;          // 打合せ日（自動：今日の日付）
  meetingDayOfWeek: string;     // 打合せ日の曜日（自動算出）
  workDate: string;             // 作業日（自動：翌営業日、カレンダーで変更可）
  workDayOfWeek: string;        // 作業日の曜日（自動算出）

  // --- STEP1: 作業内容（前日入力） ---
  workEntries: WorkEntry[];     // 作業内容セット（複数追加可）
  materialEntries: string[];    // 搬出入資機材（資機材マスタから選択、複数追加可）
  preparationEntries: string[]; // 段取り資材等（資機材マスタから選択、複数追加可）
  safetyInstructions: string[]; // 安全衛生指示事項（safetyInstructionItemsマスタ選択、複数追加可）

  // --- STEP2: 配置図（前日入力） ---
  baseDiagramUrl: string;       // ベース配置図画像URL
  annotatedDiagramUrl: string;  // 書き込み済み配置図画像URL

  // --- STEP3: 作業当日確認 ---
  additionalWorkEntries: WorkEntry[];  // 追加作業（当日赤字追加）
  actualWorkerCounts: Record<string, number>; // 各作業の実施人数（キー: workEntryのid）
  totalWorkers: number;                // 本日の作業人員数（自動合計）
  confirmationChecks: ConfirmationCheck[];    // 確認事項（良/否）
  siteChecks: SiteCheck[];                    // 当現場の確認項目（良/否）
  dumpTruckRounds: number;             // ダンプ回数
  dumpTruckCount: number;              // ダンプ台数
  dumpTruckTotal: number;              // ダンプ合計台数（自動計算）
  hasStageConfirmation: boolean;       // 段階確認の有無
  hasWitnessConfirmation: boolean;     // 立会確認の有無

  // --- STEP4: 巡視記録 ---
  coordinationNotes: string;           // 作業連絡調整事項（自由入力）
  patrolInspector: string;             // 巡視点検者（supervisorsマスタ選択）
  patrolTime: string;                  // 巡視時間（プルダウン選択）
  patrolAmPm: 'AM' | 'PM';            // AM/PM選択
  patrolFindings: string;              // 巡視所見（自由入力）

  // --- STEP5: 点検チェックリスト ---
  inspectionChecklist: InspectionCategory[]; // 点検チェックリスト

  // --- 所長確認 ---
  directorStampUrl: string;     // 所長電子印画像URL
  directorStamped: boolean;     // 押印済みフラグ
}


// ============================
// 日本の祝日判定ヘルパー関数
// ============================

/**
 * 春分の日を計算する（簡易計算式）
 */
function getVernalEquinoxDay(year: number): number {
  if (year <= 1947) return 21;
  if (year <= 1979) return Math.floor(20.8357 + 0.242194 * (year - 1980) - Math.floor((year - 1983) / 4));
  if (year <= 2099) return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  return Math.floor(21.851 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

/**
 * 秋分の日を計算する（簡易計算式）
 */
function getAutumnalEquinoxDay(year: number): number {
  if (year <= 1947) return 23;
  if (year <= 1979) return Math.floor(23.2588 + 0.242194 * (year - 1980) - Math.floor((year - 1983) / 4));
  if (year <= 2099) return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  return Math.floor(24.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

/**
 * 指定された年月の第n月曜日の日を返す
 */
function getNthMonday(year: number, month: number, n: number): number {
  const firstDay = new Date(year, month - 1, 1);
  const firstDow = firstDay.getDay(); // 0=日, 1=月, ...
  const firstMonday = firstDow <= 1 ? (1 - firstDow + 1) : (8 - firstDow + 1);
  return firstMonday + (n - 1) * 7;
}

/**
 * 日本の祝日かどうかを判定する関数
 * SafetyPlanPrintLayout.tsx 内の isJapaneseHoliday と同じロジック
 */
export function isJapaneseHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dow = date.getDay(); // 0=日

  // 固定祝日
  const fixedHolidays: [number, number][] = [
    [1, 1],   // 元日
    [2, 11],  // 建国記念の日
    [2, 23],  // 天皇誕生日
    [4, 29],  // 昭和の日
    [5, 3],   // 憲法記念日
    [5, 4],   // みどりの日
    [5, 5],   // こどもの日
    [8, 11],  // 山の日
    [11, 3],  // 文化の日
    [11, 23], // 勤労感謝の日
  ];

  for (const [m, d] of fixedHolidays) {
    if (month === m && day === d) return true;
  }

  // 春分の日
  if (month === 3 && day === getVernalEquinoxDay(year)) return true;

  // 秋分の日
  if (month === 9 && day === getAutumnalEquinoxDay(year)) return true;

  // ハッピーマンデー制度
  // 成人の日：1月第2月曜
  if (month === 1 && day === getNthMonday(year, 1, 2)) return true;
  // 海の日：7月第3月曜
  if (month === 7 && day === getNthMonday(year, 7, 3)) return true;
  // 敬老の日：9月第3月曜
  if (month === 9 && day === getNthMonday(year, 9, 3)) return true;
  // スポーツの日：10月第2月曜
  if (month === 10 && day === getNthMonday(year, 10, 2)) return true;

  // 振替休日：祝日が日曜日の場合、翌月曜日が振替休日
  if (dow === 1) {
    // 昨日が祝日だったか（日曜日のチェック）
    const yesterday = new Date(year, month - 1, day - 1);
    if (yesterday.getDay() === 0) {
      // 再帰を避けるため、昨日が祝日かどうかを直接チェック
      const yYear = yesterday.getFullYear();
      const yMonth = yesterday.getMonth() + 1;
      const yDay = yesterday.getDate();
      
      // 固定祝日チェック
      for (const [m, d] of fixedHolidays) {
        if (yMonth === m && yDay === d) return true;
      }
      if (yMonth === 3 && yDay === getVernalEquinoxDay(yYear)) return true;
      if (yMonth === 9 && yDay === getAutumnalEquinoxDay(yYear)) return true;
      if (yMonth === 1 && yDay === getNthMonday(yYear, 1, 2)) return true;
      if (yMonth === 7 && yDay === getNthMonday(yYear, 7, 3)) return true;
      if (yMonth === 9 && yDay === getNthMonday(yYear, 9, 3)) return true;
      if (yMonth === 10 && yDay === getNthMonday(yYear, 10, 2)) return true;
    }
  }

  // 国民の休日：祝日と祝日に挟まれた日
  // 典型例: 9月の敬老の日と秋分の日の間
  if (month === 9) {
    const keirouDay = getNthMonday(year, 9, 3);
    const shubunDay = getAutumnalEquinoxDay(year);
    if (shubunDay - keirouDay === 2 && day === keirouDay + 1) return true;
  }

  return false;
}

/**
 * 日本語の曜日を取得する
 */
export function getJapaneseDayOfWeek(date: Date): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[date.getDay()];
}

/**
 * 翌営業日を取得する（土日祝を飛ばす）
 */
export function getNextBusinessDay(baseDate: Date): Date {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + 1);
  
  // 土日祝を飛ばす
  while (next.getDay() === 0 || next.getDay() === 6 || isJapaneseHoliday(next)) {
    next.setDate(next.getDate() + 1);
  }
  
  return next;
}


// ============================
// 安全衛生日誌の初期値
// ============================

/** ユニークID生成用ヘルパー */
function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

/** 点検チェックリストの初期値を生成する */
function createInitialInspectionChecklist(): InspectionCategory[] {
  // ヘルパー: 点検項目を生成（最後の項目のみ isEditable: true）
  const createItems = (labels: string[]): InspectionItem[] => {
    return labels.map((label, index) => ({
      id: generateId(),
      label,
      result: '' as '' ,
      isEditable: index === labels.length - 1,  // 最後の項目のみ編集可能
      editedLabel: '',
    }));
  };

  return [
    {
      categoryName: '管理',
      items: createItems([
        '朝（夕）礼・ＫＹミーティングの実施状況',
        '各作業間の連絡・調整',
        '作業主任者・有資格者の配置状況',
        '保護具（保安帽・安全帯・マスク・メガネ等）の使用',
        '救命胴衣の着用・浮き輪の常備',
        '標識類（立入禁止・足場積載荷重・作業主任者）',
        '建設廃棄物（許可証・契約書・マニュフェスト）',
        '各種点検状況の確認・記録状況',
        '建設業許可・労災成立・確認申請・占用許可等掲示',
        'その他掲示物管理（有効期限・汚れ等）',
      ]),
    },
    {
      categoryName: '重機・機械',
      items: createItems([
        '始業点検記録・自主検査済証の確認',
        '合図者・合図の方法・玉掛用具・玉掛方法・ワイヤー',
        'クレーン・重機の設置状況　立入禁止措置状況',
        '安全装置（外れ止め・過巻防止装置等）',
        '敷板・アウトリガー・用途外使用',
      ]),
    },
    {
      categoryName: '電機',
      items: createItems([
        '分電盤（取扱者表示・アース・行先表示）',
        '配線（充電部養生・活線損傷・水浸し等）',
        '電工ドラム・アース・ホルダー',
        '架空電線防護措置',
        '電動工具類の使用状況（カバー・刃の取付）',
      ]),
    },
    {
      categoryName: '墜落転落',
      items: createItems([
        '手すり（足場・桟橋・開口部・床端等）',
        '脚立・梯子・ローリングタワー使用状況',
        '安全ネット・防網・親綱',
        '昇降設備・安全通路',
        '足場・作業床の整理状況',
      ]),
    },
    {
      categoryName: '飛来・落下・崩壊・転倒',
      items: createItems([
        '支保工（土止め・型枠・ずい道等）',
        '切土・盛土・掘削・勾配',
        '湧き水・浮石・落石・亀裂',
        '足場（ヤラズ・壁つなぎ等）・作業構台',
        '幅木の有無・足場上の資材・養生シート等',
      ]),
    },
    {
      categoryName: '作業環境',
      items: createItems([
        '整理・整頓（事務所内・休憩所・通路・資材置場）',
        '照明・採光・粉塵換気・有機溶剤換気',
        '有機溶剤・アセ・酸素ボンベ・燃料等管理状況',
        '火気使用状況（消火器・作業場所・休憩所）・タバコ',
        '仮設トイレの衛生状況',
      ]),
    },
    {
      categoryName: 'その他',
      items: createItems([
        '騒音・振動・水質汚濁・粉じん飛散等防止措置条項',
        '過積載防止・運行速度管理',
        '機械と作業員の分離措置及び誘導員、合図員の配置',
        'ウイルス対策',
        '熱中症対策',
      ]),
    },
  ];
}

// 今日の日付
const today = new Date();
const todayISO = today.toISOString().split('T')[0];

// 翌営業日を算出
const nextBizDay = getNextBusinessDay(today);
const nextBizDayISO = nextBizDay.toISOString().split('T')[0];

/** 安全衛生日誌の初期値 */
export const INITIAL_DAILY_SAFETY_REPORT: DailySafetyReportData = {
  // --- 基本情報 ---
  project: '',
  meetingConductor: '',
  meetingDate: todayISO,
  meetingDayOfWeek: getJapaneseDayOfWeek(today),
  workDate: nextBizDayISO,
  workDayOfWeek: getJapaneseDayOfWeek(nextBizDay),

  // --- STEP1: 作業内容（前日入力） ---
  workEntries: [],
  materialEntries: [],      // 搬出入資機材（資機材マスタから選択）
  preparationEntries: [],   // 段取り資材等（資機材マスタから選択）
  safetyInstructions: [],

  // --- STEP2: 配置図（前日入力） ---
  baseDiagramUrl: '',
  annotatedDiagramUrl: '',

  // --- STEP3: 作業当日確認 ---
  additionalWorkEntries: [],
  actualWorkerCounts: {},
  totalWorkers: 0,
  confirmationChecks: [
    { id: generateId(), label: '健康状態', result: '' },
    { id: generateId(), label: '保護具・服装', result: '' },
    { id: generateId(), label: '資格証の確認', result: '' },
    { id: generateId(), label: '危険作業・危険箇所の説明', result: '' },
    { id: generateId(), label: '伝達事項', result: '' },
    { id: generateId(), label: '前日の作業中の指揮監督', result: '' },
    { id: generateId(), label: '前日の作業終了時片付け', result: '' },
  ],
  siteChecks: [
    { id: generateId(), label: '作業前に埋設物、架空線の確認を行っているか。', result: '' },
    { id: generateId(), label: '作業帯の分離措置を行っているか。', result: '' },
    { id: generateId(), label: '重機・機械等の使用前点検は実施したか。', result: '' },
    { id: generateId(), label: '仮囲い、保安施設に損傷やれっ化はないか。', result: '' },
    { id: generateId(), label: '建設機械の点検記録がチェックしてあるか。', result: '' },
    { id: generateId(), label: '過積載をしていないか。', result: '' },
    { id: generateId(), label: '現場数量調書（社内報告）を記録してあるか。', result: '' },
  ],
  dumpTruckRounds: 0,
  dumpTruckCount: 0,
  dumpTruckTotal: 0,
  hasStageConfirmation: false,
  hasWitnessConfirmation: false,

  // --- STEP4: 巡視記録 ---
  coordinationNotes: '',
  patrolInspector: '',
  patrolTime: '',
  patrolAmPm: 'AM',
  patrolFindings: '',

  // --- STEP5: 点検チェックリスト ---
  inspectionChecklist: createInitialInspectionChecklist(),

  // --- 所長確認 ---
  directorStampUrl: '',
  directorStamped: false,
};
