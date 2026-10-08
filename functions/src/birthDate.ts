const ERAS = {
  Showa: { offset: 1925, first: '19261225', last: '19890107' },
  Heisei: { offset: 1988, first: '19890108', last: '20190430' },
  Reiwa: { offset: 2018, first: '20190501', last: '99991231' },
} as const;
export type SurveyEra = keyof typeof ERAS;
const numeric = (v: unknown): number => typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,4}$/.test(v) ? Number(v) : NaN;

export function validBirthDate(value: unknown, today: string): value is string {
  if (typeof value !== 'string' || !/^\d{8}$/.test(value) || value > today) return false;
  const y = Number(value.slice(0, 4)), m = Number(value.slice(4, 6)), d = Number(value.slice(6, 8));
  if (y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
export function employeeBirthDate(employee: Record<string, unknown>, today: string): string | null {
  const aliases: Record<string, string> = { '昭和': 'Showa', '平成': 'Heisei', '令和': 'Reiwa', '西暦': 'AD', Gregorian: 'AD', Western: 'AD' };
  const rawEra = typeof employee.birthEra === 'string' ? employee.birthEra : '';
  const era = aliases[rawEra] || rawEra;
  const year = numeric(employee.birthYear), month = numeric(employee.birthMonth), day = numeric(employee.birthDay);
  if (![year, month, day].every(Number.isInteger) || year < 1) return null;
  const details = ERAS[era as SurveyEra];
  if (!details && era !== 'AD') return null;
  const ad = details ? details.offset + year : year;
  const result = `${ad.toString().padStart(4, '0')}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}`;
  if (!validBirthDate(result, today) || (details && (result < details.first || result > details.last))) return null;
  return result;
}
export function birthDateFormValues(value: string) {
  const era: SurveyEra | undefined = value >= ERAS.Reiwa.first ? 'Reiwa' : value >= ERAS.Heisei.first ? 'Heisei' : value >= ERAS.Showa.first ? 'Showa' : undefined;
  if (!era) return null; // Existing form has no pre-Showa era; use manual entry for unsupported records.
  return { birthEra: era, birthYear: Number(value.slice(0, 4)) - ERAS[era].offset, birthMonth: Number(value.slice(4, 6)), birthDay: Number(value.slice(6, 8)) };
}
