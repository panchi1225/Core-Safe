export interface MasterData {
  // --- 基本・共通 ---
  projects: string[];       // 工事名
  workplaces: string[];     // 作業所名 (新規追加)
  contractors: string[];    // 会社名 (元請/施工者)
  supervisors: string[];    // 現場責任者
  locations: string[];      // 場所
  subcontractors: string[]; // 協力会社名 (アンケート等で使用)

  // --- 各種項目 ---
  roles: string[];          // 役職 (新規追加)
  topics: string[];         // 安全訓練内容 (旧:周知徹底事項)
  jobTypes: string[];       // 工種 (新規追加)
  goals: string[];          // 安全衛生目標
  predictions: string[];    // 予想災害 (新規追加)
  countermeasures: string[];// 防止対策 (新規追加)
  
  // その他 (内部保持用)
  processes: string[];      // 作業工程
  cautions: string[];       // 注意事項
}

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
  startTime: string;
  endTime: string;
  location: string;
  instructor: string;
  goal: string;
  process: string;
  topic: string;
  caution: string;
  photoUrl: string | null;
  signatures: WorkerSignature[];
}

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
  otherText1: string;
  otherText2: string;
  otherText3: string;
}

export interface NewcomerSurveyReportData {
  project: string;
  director: string;
  furigana: string;
  name: string;
  birthEra: 'Showa' | 'Heisei';
  birthYear: number | '';
  birthMonth: number | '';
  birthDay: number | '';
  gender: 'Male' | 'Female';
  age: number;
  company: string;
  subcontractorRank: string;
  experienceYears: number;
  experienceMonths: number;
  jobType: string;
  jobTypeOther: string;
  address: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  bloodType: string;
  bloodTypeRh: 'Plus' | 'Minus' | '';
  healthCheckYear: number;
  healthCheckMonth: number;
  healthCheckDay: number;
  kentaikyo: 'Joined' | 'NotJoined';
  qualifications: Qualifications;
  pledgeDateYear: number;
  pledgeDateMonth: number;
  pledgeDateDay: number;
  signatureDataUrl: string | null;
}

export type ReportDataType = ReportData | DisasterCouncilReportData | SafetyPlanReportData | NewcomerSurveyReportData;
export type ReportTypeString = 'SAFETY_TRAINING' | 'DISASTER_COUNCIL' | 'SAFETY_PLAN' | 'NEWCOMER_SURVEY';

export interface SavedDraft {
  id: string;
  type: ReportTypeString;
  lastModified: number;
  data: any;
}

export const INITIAL_MASTER_DATA: MasterData = {
  projects: ["公共運動公園周辺地区整備工事"],
  workplaces: ["現場事務所"], // 新規
  contractors: ["松浦建設株式会社"],
  subcontractors: ["（株）田中土木"],
  supervisors: ["大須賀 久敬"],
  locations: ["本社会議室"],
  goals: ["重機災害の防止"],
  processes: ["準備工"],
  topics: ["新規入場者教育の実施について"],
  cautions: ["現場内整理整頓"],
  roles: ["職長"], // 新規
  jobTypes: ["土工", "鳶", "大工", "オペ"], // 新規
  predictions: ["重機との接触"], // 新規
  countermeasures: ["作業範囲の立入禁止"] // 新規
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
  gcAttendees: Array(8).fill({ role: "", name: "" }),
  subcontractorAttendees: []
};

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

export const INITIAL_NEWCOMER_SURVEY_REPORT: NewcomerSurveyReportData = {
  project: INITIAL_MASTER_DATA.projects[0],
  director: INITIAL_MASTER_DATA.supervisors[0],
  furigana: "",
  name: "",
  birthEra: 'Showa',
  birthYear: '',
  birthMonth: '',
  birthDay: '',
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
  healthCheckYear: new Date().getFullYear() - 2018,
  healthCheckMonth: new Date().getMonth() + 1,
  healthCheckDay: new Date().getDate(),
  kentaikyo: 'Joined',
  qualifications: {
    vehicle_leveling: false, vehicle_demolition: false, mobile_crane: false, slinging: false, gas_welding: false, earth_retaining: false, excavation: false, scaffolding: false, formwork: false, oxygen_deficiency: false, rough_terrain: false, arc_welding: false, grinding_wheel: false, low_voltage: false, roller: false, asbestos: false, foreman: false, otherText1: "", otherText2: "", otherText3: ""
  },
  pledgeDateYear: new Date().getFullYear() - 2018,
  pledgeDateMonth: new Date().getMonth() + 1,
  pledgeDateDay: new Date().getDate(),
  signatureDataUrl: null
};