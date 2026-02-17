
export interface MasterData {
  projects: string[];
  contractors: string[];
  supervisors: string[];
  locations: string[];
  goals: string[]; // 災害防止目標
  processes: string[]; // 作業工程
  topics: string[]; // 周知徹底事項
  cautions: string[]; // 注意事項
  subcontractors: string[]; // 協力会社名
}

export interface WorkerSignature {
  id: string;
  company: string;
  name: string; // Used for display logic, but signature is the image
  signatureDataUrl: string; // Base64 PNG
}

export interface ReportData {
  // Step 1: Cover
  project: string;
  month: number;
  contractor: string;

  // Step 2: Details
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  instructor: string;
  
  goal: string; // (1)
  process: string; // (2)
  topic: string; // (3) Selectable
  caution: string; // (4) Selectable
  // (5) and (6) are fixed strings
  
  photoUrl: string | null;

  // Step 3: Roster (formerly Step 4)
  signatures: WorkerSignature[];
}

// --- Disaster Council Types ---

export interface GCAttendee {
  role: string;
  name: string;
}

export interface SubcontractorAttendee {
  id: string;
  company: string;
  role: string;
  name: string; // Display name
  signatureDataUrl: string; // Image
}

export interface DisasterCouncilReportData {
  // Step 1: Cover
  count: number; // 第N回
  project: string;
  date: string; // 開催日
  contractor: string;

  // Step 2: Details & Roster
  startTime: string;
  endTime: string;
  location: string;
  
  // GC Attendees (Fixed roles usually)
  gcAttendees: GCAttendee[];

  // Subcontractor Attendees
  subcontractorAttendees: SubcontractorAttendee[];
}

// --- Safety Plan Types ---

export interface PlanProcessBar {
  startDay: number;
  endDay: number;
}

export interface PlanProcessRow {
  id: string;
  category: string; // e.g., 河川土工
  name: string;     // e.g., 盛土工
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

  predictions: string[]; // 予想される災害 (5 items)
  countermeasures: string[]; // 防止対策 (5 items)
  inspectionItems: string[]; // 重点点検項目 (5 items)
  
  safetyDuty: Record<string, string>; // key: day number, value: name
  
  lastMonthReflection: string;
}

// --- Newcomer Survey Types ---

export interface Qualifications {
  // Skill Training
  vehicle_leveling: boolean; // 車輌系建設機械（整地、積込運搬等）
  vehicle_demolition: boolean; // 車輌系建設機械（解体用）
  mobile_crane: boolean; // 小型移動クレーン
  slinging: boolean; // 玉掛
  gas_welding: boolean; // ガス溶接
  earth_retaining: boolean; // 土留め支保工作業主任者
  excavation: boolean; // 地山掘削作業主任者
  scaffolding: boolean; // 足場組立て等作業主任者
  formwork: boolean; // 型枠支保工作業主任者
  oxygen_deficiency: boolean; // 酸素欠乏危険作業主任者
  rough_terrain: boolean; // 不整地運搬車

  // Special Education
  arc_welding: boolean; // アーク溶接
  grinding_wheel: boolean; // 研削といし取替え業務
  low_voltage: boolean; // 低圧電気取扱
  roller: boolean; // ローラー運転業務
  asbestos: boolean; // 石綿取り扱い業務

  // Others
  foreman: boolean; // 職長教育
  
  otherText1: string;
  otherText2: string;
  otherText3: string;
}

export interface NewcomerSurveyReportData {
  // Header
  project: string;
  director: string; // 作業所長名

  // Basic Info
  furigana: string;
  name: string;
  
  // Birthdate
  birthEra: 'Showa' | 'Heisei';
  birthYear: number | ''; // Allow empty
  birthMonth: number | ''; // Allow empty
  birthDay: number | ''; // Allow empty
  
  gender: 'Male' | 'Female';
  age: number;
  
  company: string;
  subcontractorRank: string; // (  次) 下請け
  
  experienceYears: number;
  experienceMonths: number;
  
  jobType: string; // 職種
  jobTypeOther: string;
  
  address: string;
  phone: string;
  
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  
  bloodType: string; // A, B, O, AB
  bloodTypeRh: 'Plus' | 'Minus' | ''; 
  
  healthCheckYear: number; // Reiwa
  healthCheckMonth: number;
  healthCheckDay: number;
  
  kentaikyo: 'Joined' | 'NotJoined';
  
  // Qualifications
  qualifications: Qualifications;
  
  // Pledge
  pledgeDateYear: number; // Reiwa
  pledgeDateMonth: number;
  pledgeDateDay: number;
  
  signatureDataUrl: string | null;
}

// Union type for Drafts
export type ReportDataType = ReportData | DisasterCouncilReportData | SafetyPlanReportData | NewcomerSurveyReportData;
export type ReportTypeString = 'SAFETY_TRAINING' | 'DISASTER_COUNCIL' | 'SAFETY_PLAN' | 'NEWCOMER_SURVEY';

export interface SavedDraft {
  id: string;
  type: ReportTypeString;
  lastModified: number;
  data: any; // Using any to accomodate different shapes, cast based on type
}

export const INITIAL_MASTER_DATA: MasterData = {
  projects: [
    "公共運動公園周辺地区整備工事（R7芝崎地区粗造成その2）",
    "市内道路改良工事（第3工区）",
    "河川護岸改修工事（A地区）"
  ],
  contractors: [
    "松浦建設株式会社",
    "山田建設株式会社"
  ],
  supervisors: [
    "大須賀 久敬",
    "佐藤 和則",
    "鈴木 一郎"
  ],
  locations: [
    "本社会議室",
    "現場事務所",
    "現場詰所"
  ],
  goals: [
    "重機災害の防止と合図の徹底",
    "墜落・転落災害の絶滅",
    "熱中症対策の徹底"
  ],
  processes: [
    "準備工・除草・看板設置",
    "掘削工・残土搬出",
    "路盤工・舗装工"
  ],
  topics: [
    "本工事内容の周知徹底および近隣対策について",
    "搬入経路と第三者災害防止について",
    "新規入場者教育の実施について"
  ],
  cautions: [
    "現場内整理整頓と区画明確化",
    "開口部養生の徹底",
    "架空線注意と旋回範囲立入禁止"
  ],
  subcontractors: [
    "（株）田中土木",
    "鈴木興業",
    "（有）高橋重機",
    "（株）エストラスト"
  ]
};

export const INITIAL_REPORT: ReportData = {
  project: INITIAL_MASTER_DATA.projects[0],
  month: new Date().getMonth() + 1,
  contractor: INITIAL_MASTER_DATA.contractors[0],
  date: new Date().toISOString().split('T')[0],
  startTime: "08:00",
  endTime: "08:30",
  location: INITIAL_MASTER_DATA.locations[0],
  instructor: INITIAL_MASTER_DATA.supervisors[0],
  goal: INITIAL_MASTER_DATA.goals[0],
  process: INITIAL_MASTER_DATA.processes[0],
  topic: INITIAL_MASTER_DATA.topics[0],
  caution: INITIAL_MASTER_DATA.cautions[0],
  photoUrl: null,
  signatures: []
};

export const INITIAL_DISASTER_COUNCIL_REPORT: DisasterCouncilReportData = {
  count: 1,
  project: INITIAL_MASTER_DATA.projects[0],
  date: new Date().toISOString().split('T')[0],
  contractor: INITIAL_MASTER_DATA.contractors[0],
  startTime: "13:00",
  endTime: "14:00",
  location: INITIAL_MASTER_DATA.locations[0],
  gcAttendees: [
    { role: "統括", name: INITIAL_MASTER_DATA.supervisors[0] },
    { role: "副統括", name: "" },
    { role: "書記", name: INITIAL_MASTER_DATA.supervisors[0] },
    { role: "安全委員", name: INITIAL_MASTER_DATA.supervisors[1] },
    { role: "", name: "" },
    { role: "", name: "" },
    { role: "", name: "" },
    { role: "", name: "" }
  ],
  subcontractorAttendees: []
};

export const INITIAL_SAFETY_PLAN_REPORT: SafetyPlanReportData = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  createdDate: new Date().toISOString().split('T')[0],
  project: INITIAL_MASTER_DATA.projects[0],
  location: INITIAL_MASTER_DATA.locations[1],
  author: INITIAL_MASTER_DATA.supervisors[0],
  
  trainingDate: "",
  trainingLeader: INITIAL_MASTER_DATA.supervisors[0],
  councilDate: "",
  councilLeader: "",
  patrolDate: "",
  
  processRows: [
    { id: "1", category: "河川土工", name: "盛土工", bars: [] },
    { id: "2", category: "河川土工", name: "法面整形工", bars: [] },
    { id: "3", category: "法覆護岸工", name: "植生工", bars: [] },
    { id: "4", category: "坂路工", name: "ｱｽﾌｧﾙﾄ舗装工", bars: [] },
    { id: "5", category: "坂路工", name: "縁石工", bars: [] },
    { id: "6", category: "坂路工", name: "排水工", bars: [] },
    { id: "7", category: "付帯道路工", name: "ﾌﾟﾚｷｬｽﾄ擁壁工", bars: [] },
    { id: "8", category: "高水敷道路整備工", name: "ｱｽﾌｧﾙﾄ舗装工", bars: [] },
    { id: "9", category: "光ケーブル配管工", name: "配管工", bars: [] },
    { id: "10", category: "河川土工(渡良瀬)", name: "掘削工", bars: [] },
    { id: "11", category: "河川土工(渡良瀬)", name: "盛土工", bars: [] },
  ],

  predictions: ["重機との接触事故", "重機との接触事故", "重機との接触事故", "重機との接触事故", "重機との接触事故"],
  countermeasures: ["作業範囲の明示", "作業範囲の明示", "作業範囲の明示", "作業範囲の明示", "作業範囲の明示"],
  inspectionItems: ["関係者以外立入り禁止", "関係者以外立入り禁止", "関係者以外立入り禁止", "関係者以外立入り禁止", "関係者以外立入り禁止"],
  
  safetyDuty: {}, // e.g. "1": "Sato", "2": "Suzuki"
  lastMonthReflection: ""
};

export const INITIAL_NEWCOMER_SURVEY_REPORT: NewcomerSurveyReportData = {
  project: INITIAL_MASTER_DATA.projects[0],
  director: INITIAL_MASTER_DATA.supervisors[0],
  
  furigana: "",
  name: "",
  
  birthEra: 'Showa',
  birthYear: '', // Empty initially
  birthMonth: '', // Empty initially
  birthDay: '', // Empty initially
  
  gender: 'Male',
  age: 0,
  
  company: INITIAL_MASTER_DATA.subcontractors[0],
  subcontractorRank: "", 
  
  experienceYears: 10,
  experienceMonths: 0,
  
  jobType: "土工",
  jobTypeOther: "",
  
  address: "",
  phone: "",
  
  emergencyContactName: "",
  emergencyContactRelation: "",
  emergencyContactPhone: "",
  
  bloodType: "A",
  bloodTypeRh: "Plus",
  
  healthCheckYear: new Date().getFullYear() - 2018, // Default to current Reiwa year
  healthCheckMonth: new Date().getMonth() + 1,
  healthCheckDay: new Date().getDate(),
  
  kentaikyo: 'Joined',
  
  qualifications: {
    vehicle_leveling: false,
    vehicle_demolition: false,
    mobile_crane: false,
    slinging: false,
    gas_welding: false,
    earth_retaining: false,
    excavation: false,
    scaffolding: false,
    formwork: false,
    oxygen_deficiency: false,
    rough_terrain: false,
    
    arc_welding: false,
    grinding_wheel: false,
    low_voltage: false,
    roller: false,
    asbestos: false,
    
    foreman: false,
    
    otherText1: "",
    otherText2: "",
    otherText3: ""
  },
  
  // Set default pledge date to Today (Reiwa)
  pledgeDateYear: new Date().getFullYear() - 2018,
  pledgeDateMonth: new Date().getMonth() + 1,
  pledgeDateDay: new Date().getDate(),
  
  signatureDataUrl: null
};