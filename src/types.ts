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
  projects: ["公共運動公園周辺地区整備工事"],
  workplaces: ["現場事務所"],
  contractors: ["松浦建設株式会社"],
  subcontractors: ["（株）田中土木"],
  supervisors: ["大須賀 久敬"],
  locations: ["本社会議室"],
  goals: ["重機災害の防止"],
  processes: ["準備工"],
  topics: ["新規入場者教育の実施について"],
  cautions: ["現場内整理整頓"],
  roles: ["職長"],
  jobTypes: ["土工", "鳶", "大工", "オペ"],
  predictions: ["重機との接触"],
  countermeasures: ["作業範囲の立入禁止"],
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
  project: INITIAL_MASTER_DATA.projects[0],
  month: new Date().getMonth() + 1,
  contractor: INITIAL_MASTER_DATA.contractors[0],
  date: new Date().toISOString().split('T')[0],
  location: INITIAL_MASTER_DATA.locations[0],
  startTime: "08:00",
  endTime: "08:30",
  instructor: INITIAL_MASTER_DATA.supervisors[0],
  topic: INITIAL_MASTER_DATA.topics[0],
  goal: INITIAL_MASTER_DATA.goals[0],
  process: INITIAL_MASTER_DATA.processes[0],
  caution: INITIAL_MASTER_DATA.cautions[0],
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
  project: INITIAL_MASTER_DATA.projects[0],
  date: new Date().toISOString().split('T')[0],
  contractor: INITIAL_MASTER_DATA.contractors[0],
  startTime: "13:00",
  endTime: "14:00",
  location: INITIAL_MASTER_DATA.locations[0],
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
  project: INITIAL_MASTER_DATA.projects[0],
  location: INITIAL_MASTER_DATA.locations[0],
  author: INITIAL_MASTER_DATA.supervisors[0],
  trainingDate: "",
  trainingLeader: INITIAL_MASTER_DATA.supervisors[0],
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
  // Meta (表示用)
  name?: string; 

  project: string;
  director: string;
  
  // 氏名分割
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
  
  // ★修正: null許容に変更
  experienceYears: number | null;
  experienceMonths: number | null;
  
  jobType: string;
  jobTypeOther: string;
  
  address: string;
  phone: string;
  
  // 緊急連絡先分割
  emergencyContactSei: string;
  emergencyContactMei: string;
  
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  
  bloodType: string;
  bloodTypeRh: 'Plus' | 'Minus' | 'Unknown';
  
  // ★修正: null許容に変更
  healthCheckYear: number | null;
  healthCheckMonth: number | null;
  healthCheckDay: number | null;
  
  kentaikyo: 'Joined' | 'NotJoined';
  
  qualifications: Qualifications;
  
  // ★修正: null許容に変更
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
  
  // ★修正: ここが田中土木の原因でした。空文字にします。
  company: "", 
  
  subcontractorRank: "", 
  
  // ★修正: 初期値をnull(空欄)にする
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
  
  // ★修正: 初期値をnull(空欄)にする
  healthCheckYear: null,
  healthCheckMonth: null,
  healthCheckDay: null,
  
  kentaikyo: 'Joined',
  
  qualifications: {
    vehicle_leveling: false, vehicle_demolition: false, mobile_crane: false, slinging: false, gas_welding: false, earth_retaining: false, excavation: false, scaffolding: false, formwork: false, oxygen_deficiency: false, rough_terrain: false, arc_welding: false, grinding_wheel: false, low_voltage: false, roller: false, asbestos: false, foreman: false, 
    license_regular: false, license_large: false, license_large_special: false, license_towing: false,
    otherText1: "", otherText2: "", otherText3: ""
  },
  
  // ★修正: 誓約日も初期はnull (Wizard側で当日をセットするロジックがあればそちらが優先される)
  pledgeDateYear: null,
  pledgeDateMonth: null,
  pledgeDateDay: null,
  
  signatureDataUrl: null
};
