export interface SavedDraft {
  id: string;
  type: ReportTypeString;
  data: any;
  lastModified: number;
}

export type ReportTypeString = 'SAFETY_TRAINING' | 'DISASTER_COUNCIL' | 'SAFETY_PLAN' | 'NEWCOMER_SURVEY';

export interface MasterData {
  // --- 基本・共通 ---
  projects: string[];       // 工事名
  workplaces: string[];     // 作業所名
  contractors: string[];    // 会社名 (元請/施工者)
  supervisors: string[];    // 現場責任者
  locations: string[];      // 場所
  subcontractors: string[]; // 協力会社名

  // --- 各種項目 ---
  roles: string[];          // 役職
  topics: string[];         // 安全訓練内容
  jobTypes: string[];       // 工種
  goals: string[];          // 安全衛生目標
  predictions: string[];    // 予想災害
  countermeasures: string[];// 防止対策
  
  // その他 (内部保持用)
  processes: string[];      // 作業工程
  cautions: string[];       // 注意事項
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
  subcontractors: [], // 今回のリストには含まれていなかったので空配列
  roles: [
    "テスト",
    "主任技術者",
    "現場担当者"
  ],
  topics: [
    "テスト"
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
    "重機巻き込まれ災害防止",
    "作業半径内立入災害防止",
    "ダンプトラック接触災害防止",
    "ダンプ後退時災害防止",
    "吊荷落下災害防止",
    "玉掛け作業災害防止",
    "熱中症災害防止",
    "第三者災害防止",
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
    "重機災害",
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
    "重機作業区域の立入禁止徹底",
    "誘導員配置による接触防止",
    "ダンプ後退時の合図確認徹底",
    "人と車両の動線分離",
    "重機同士の作業間隔確保",
    "作業半径内立入禁止",
    "旋回範囲への進入防止",
    "挟まれ防止の合図徹底",
    "安全位置確保と退避徹底",
    "玉掛け合図の統一",
    "熱中症予防管理の徹底",
    "敷鉄板の固定・段差解消",
    "法面作業時の滑落防止",
    "掘削面の点検実施",
    "足場組立基準の遵守",
    "手すり・作業床の確実設置",
    "開口部養生の徹底",
    "飛来落下防止措置",
    "重量物の複数人作業",
    "KY活動による危険共有"
  ],
  processes: [],
  cautions: [],
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
}

export const INITIAL_REPORT: ReportData = {
  project: '',
  month: new Date().getMonth() + 1,
  contractor: '',
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
  signatures: []
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

export interface DisasterCouncilReportData {
  count: number;
  project: string;
  date: string;
  contractor: string;
  startTime: string;
  endTime: string;
  location: string;
  gcAttendees: GCAttendee[];
  subcontractorAttendees: SubcontractorAttendee[];
}

export const INITIAL_DISASTER_COUNCIL_REPORT: DisasterCouncilReportData = {
  count: 1,
  project: '',
  date: new Date().toISOString().split('T')[0],
  contractor: '',
  startTime: "13:00",
  endTime: "14:00",
  location: '',
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

export interface SafetyPlanReportData {
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
  predictions: string[];
  countermeasures: string[];
  inspectionItems: string[];
  safetyDuty: Record<string, string>;
  lastMonthReflection: string;
}

export const INITIAL_SAFETY_PLAN_REPORT: SafetyPlanReportData = {
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
  predictions: Array(5).fill(""),
  countermeasures: Array(5).fill(""),
  inspectionItems: Array(5).fill(""),
  safetyDuty: {},
  lastMonthReflection: ""
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
  // Licenses
  license_regular?: boolean;
  license_large?: boolean;
  license_large_special?: boolean;
  license_towing?: boolean;
  // Other text
  otherText1: string;
  otherText2: string;
  otherText3: string;
}

export interface NewcomerSurveyReportData {
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
