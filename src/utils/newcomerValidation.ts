import type { NewcomerSurveyReportData } from '../types';

// Keep the existing STEP 1 requirements. In particular, zero years is valid,
// and health-check day, experience months and subcontractor rank are optional.
export const NEWCOMER_REQUIRED_LABELS = {
  project: '現場名', director: '作業所長名',
  nameSei: '氏名（氏）', nameMei: '氏名（名）',
  furiganaSei: 'フリガナ（セイ）', furiganaMei: 'フリガナ（メイ）',
  birthYear: '生年月日（年）', birthMonth: '生年月日（月）', birthDay: '生年月日（日）',
  company: '所属会社名', experienceYears: '経験年数（年）',
  jobType: '職種', jobTypeOther: '職種（その他の詳細）',
  address: '現住所', phone: '電話番号',
  emergencyContactSei: '緊急連絡先の氏名（氏）', emergencyContactMei: '緊急連絡先の氏名（名）',
  emergencyContactRelation: '緊急連絡先の続柄', emergencyContactPhone: '緊急連絡先の電話番号',
  healthCheckYear: '健康診断受診日（年）', healthCheckMonth: '健康診断受診日（月）',
} as const;

export type NewcomerRequiredField = keyof typeof NEWCOMER_REQUIRED_LABELS;

export function newcomerStep1Errors(report: NewcomerSurveyReportData): Partial<Record<NewcomerRequiredField, boolean>> {
  const errors: Partial<Record<NewcomerRequiredField, boolean>> = {};
  for (const key of Object.keys(NEWCOMER_REQUIRED_LABELS) as NewcomerRequiredField[]) {
    if (key === 'experienceYears') {
      if (report[key] === undefined || report[key] === null) errors[key] = true;
    } else if (key === 'jobTypeOther') {
      if (report.jobType === 'その他' && !report[key]) errors[key] = true;
    } else if (!report[key]) errors[key] = true;
  }
  return errors;
}
