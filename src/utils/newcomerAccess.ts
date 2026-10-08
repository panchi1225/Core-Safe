import type { NewcomerSurveyReportData, SavedDraft } from '../types';
export const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export interface PublicNewcomerForm {
  token: string; project: string; director: string; active: boolean;
  createdAt: number; createdBy: 'staff'; expiresAt: number; contractorOptions: string[];
}
export function publicEntryRoute(search: string): { public: boolean; token: string | null } {
  const params = new URLSearchParams(search), token = params.get('token');
  const publicEntry = params.get('form') === 'newcomer';
  return { public: publicEntry, token: publicEntry && token && TOKEN_PATTERN.test(token) ? token : null };
}
export const publicReportId = (id: string) => `public-newcomer/${id}`;
export function reportLocation(id: string): { collection: 'drafts' | 'publicNewcomerSubmissions'; id: string } {
  if (id.startsWith('public-newcomer/')) {
    const raw = id.slice('public-newcomer/'.length);
    if (!raw || raw.includes('/')) throw new Error('帳票IDが不正です。');
    return { collection: 'publicNewcomerSubmissions', id: raw };
  }
  if (!id || id.includes('/')) throw new Error('帳票IDが不正です。');
  return { collection: 'drafts', id };
}
// Explicit payload allowlist: inherited training/photo/admin fields stay out.
export const SURVEY_FIELDS = ['project', 'director', 'furiganaSei', 'furiganaMei', 'nameSei', 'nameMei',
  'birthEra', 'birthYear', 'birthMonth', 'birthDay', 'gender', 'age', 'company', 'subcontractorRank',
  'experienceYears', 'experienceMonths', 'jobType', 'jobTypeOther', 'address', 'phone',
  'emergencyContactSei', 'emergencyContactMei', 'emergencyContactRelation', 'emergencyContactPhone',
  'bloodType', 'bloodTypeRh', 'healthCheckYear', 'healthCheckMonth', 'healthCheckDay', 'kentaikyo',
  'qualifications', 'pledgeDateYear', 'pledgeDateMonth', 'pledgeDateDay', 'signatureDataUrl', 'companyInputType'] as const;
export function surveyPayload(report: NewcomerSurveyReportData): Record<string, unknown> {
  const qualifications = Object.fromEntries(QUALIFICATION_FIELDS.map(key => [key, report.qualifications?.[key] ?? (key.startsWith('otherText') ? '' : false)]));
  return Object.fromEntries(SURVEY_FIELDS.map(key => [key, key === 'qualifications' ? qualifications : key === 'companyInputType' ? report[key] || 'other' : report[key] ?? null]));
}
export const QUALIFICATION_FIELDS = ['vehicle_leveling','vehicle_demolition','mobile_crane','slinging','gas_welding','earth_retaining','excavation','scaffolding','formwork','oxygen_deficiency','rough_terrain','arc_welding','grinding_wheel','low_voltage','roller','asbestos','chainsaw','foreman','license_regular','license_large','license_large_special','license_towing','license_mobile_crane','electrician','otherText1','otherText2','otherText3'] as const;
export function asPublicDraft(id: string, raw: any): SavedDraft {
  return { id: publicReportId(id), type: 'NEWCOMER_SURVEY', data: { ...raw.data, name: (raw.data.nameSei || '') + (raw.data.nameMei || '') },
    lastModified: raw.lastModified?.toMillis?.() ?? raw.createdAt?.toMillis?.() ?? 0 };
}
