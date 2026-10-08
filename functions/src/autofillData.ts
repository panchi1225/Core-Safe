// Pure response contract. This file has no Admin SDK, keys, or employee IDs.
export const AUTOFILL_TEXT_FIELDS = [
  'nameSei', 'nameMei', 'furiganaSei', 'furiganaMei', 'bloodType', 'address', 'phone',
  'emergencyContactSei', 'emergencyContactMei', 'emergencyContactRelation', 'emergencyContactPhone', 'jobType',
] as const;
export const AUTOFILL_QUALIFICATIONS = [
  'electrician', 'vehicle_leveling', 'vehicle_demolition', 'mobile_crane', 'slinging', 'gas_welding',
  'earth_retaining', 'excavation', 'scaffolding', 'formwork', 'oxygen_deficiency', 'rough_terrain',
  'arc_welding', 'grinding_wheel', 'low_voltage', 'roller', 'asbestos', 'chainsaw', 'foreman',
  'license_regular', 'license_large', 'license_large_special', 'license_towing', 'license_mobile_crane',
] as const;
export type EmployeeAutofillData = Record<typeof AUTOFILL_TEXT_FIELDS[number], string> & {
  company: '松浦建設株式会社'; birthEra: 'Showa' | 'Heisei' | 'Reiwa'; birthYear: number; birthMonth: number; birthDay: number;
  gender: 'Male' | 'Female'; bloodTypeRh: 'Plus' | 'Minus' | 'Unknown';
  healthCheckYear: number; healthCheckMonth: number; healthCheckDay: number;
  experienceYears: number; experienceMonths: number;
  qualifications: Record<typeof AUTOFILL_QUALIFICATIONS[number], boolean> & { otherText1: string; otherText2: string; otherText3: string };
};
export const AUTOFILL_FIELDS = [...AUTOFILL_TEXT_FIELDS, 'company', 'birthEra', 'birthYear', 'birthMonth', 'birthDay',
  'gender', 'bloodTypeRh', 'healthCheckYear', 'healthCheckMonth', 'healthCheckDay', 'experienceYears', 'experienceMonths', 'qualifications'] as const;
const safeText = (v: unknown, max: number) => typeof v === 'string' ? v.slice(0, max) : '';
const safeNumber = (v: unknown, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : 0;
export function employeeAutofillData(raw: Record<string, unknown>, birth: Pick<EmployeeAutofillData, 'birthEra' | 'birthYear' | 'birthMonth' | 'birthDay'>): EmployeeAutofillData {
  const text = Object.fromEntries(AUTOFILL_TEXT_FIELDS.map(key => [key, safeText(raw[key], key === 'address' ? 500 : key.includes('Phone') || key === 'phone' ? 50 : 100)]));
  const q = raw.qualifications && typeof raw.qualifications === 'object' ? raw.qualifications as Record<string, unknown> : {};
  const qualifications = Object.fromEntries(AUTOFILL_QUALIFICATIONS.map(key => [key, q[key] === true]));
  return {
    ...text, company: '松浦建設株式会社', ...birth,
    gender: raw.gender === 'Female' ? 'Female' : 'Male',
    bloodTypeRh: raw.bloodTypeRh === 'Plus' || raw.bloodTypeRh === 'Minus' ? raw.bloodTypeRh : 'Unknown',
    healthCheckYear: safeNumber(raw.healthCheckYear, 2200), healthCheckMonth: safeNumber(raw.healthCheckMonth, 12), healthCheckDay: safeNumber(raw.healthCheckDay, 31),
    experienceYears: safeNumber(raw.experienceYears, 100), experienceMonths: safeNumber(raw.experienceMonths, 11),
    qualifications: { ...qualifications, otherText1: safeText(q.otherText1, 200), otherText2: safeText(q.otherText2, 200), otherText3: safeText(q.otherText3, 200) },
  } as EmployeeAutofillData;
}
