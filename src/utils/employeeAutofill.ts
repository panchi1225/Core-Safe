import { INITIAL_NEWCOMER_SURVEY_REPORT, type EmployeeData, type NewcomerSurveyReportData } from '../types.ts';
import { calculateCurrentExperience } from './experience.ts';

export const MATSUURA_COMPANY = '松浦建設株式会社';
// Shared by the existing staff selector and the DOB-verified public selector.
// Never spread employee data into a report: in particular, seals/signatures stay out.
export function employeeSurveyFields(emp: Partial<EmployeeData>): Partial<NewcomerSurveyReportData> {
  const experience = calculateCurrentExperience(emp.experienceYears || 0, emp.experienceMonths || 0);
  const preset = ['土工', '鳶', '大工', 'オペ', '鉄筋工', '交通整理人'].includes(emp.jobType || '');
  return {
    company: MATSUURA_COMPANY,
    nameSei: emp.nameSei, nameMei: emp.nameMei, furiganaSei: emp.furiganaSei, furiganaMei: emp.furiganaMei,
    birthEra: emp.birthEra, birthYear: emp.birthYear, birthMonth: emp.birthMonth, birthDay: emp.birthDay,
    bloodType: emp.bloodType, bloodTypeRh: emp.bloodTypeRh, gender: emp.gender,
    address: emp.address, phone: emp.phone,
    emergencyContactSei: emp.emergencyContactSei, emergencyContactMei: emp.emergencyContactMei,
    emergencyContactRelation: emp.emergencyContactRelation, emergencyContactPhone: emp.emergencyContactPhone,
    healthCheckYear: emp.healthCheckYear, healthCheckMonth: emp.healthCheckMonth, healthCheckDay: emp.healthCheckDay,
    experienceYears: experience.years, experienceMonths: experience.months,
    jobType: preset ? emp.jobType : (emp.jobType ? 'その他' : ''), jobTypeOther: preset ? '' : emp.jobType,
    qualifications: { ...INITIAL_NEWCOMER_SURVEY_REPORT.qualifications, ...emp.qualifications },
  };
}
