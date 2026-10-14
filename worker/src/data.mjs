export const STRING_FIELDS = ['nameSei','nameMei','furiganaSei','furiganaMei','birthEra','gender','bloodType','bloodTypeRh','address','phone','emergencyContactSei','emergencyContactMei','emergencyContactRelation','emergencyContactPhone','jobType'];
export const NUMBER_FIELDS = ['birthYear','birthMonth','birthDay','experienceYears','experienceMonths','healthCheckYear','healthCheckMonth','healthCheckDay'];
export const QUALIFICATIONS = ['electrician','vehicle_leveling','vehicle_demolition','mobile_crane','slinging','gas_welding','earth_retaining','excavation','scaffolding','formwork','oxygen_deficiency','rough_terrain','arc_welding','grinding_wheel','low_voltage','roller','asbestos','chainsaw','foreman','license_regular','license_large','license_large_special','license_towing','license_mobile_crane'];
export const QUALIFICATION_TEXT = ['otherText1','otherText2','otherText3'];
export const TRANSFER_FIELDS = [...STRING_FIELDS,...NUMBER_FIELDS,'qualifications'];
export const MAX_EMPLOYEES = 200;

export function decodeValue(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  if ('nullValue' in value) return null;
  return undefined;
}
export const decodeFields = fields => Object.fromEntries(Object.entries(fields).map(([k,v]) => [k,decodeValue(v)]));

// Strict calendar AND Japanese era checks. Never silently repair live employee DOBs.
export function birthDate(employee, now = Date.now()) {
  const {birthEra:era,birthYear:y,birthMonth:m,birthDay:d} = employee;
  if (![y,m,d].every(Number.isInteger) || y < 1 || m < 1 || m > 12 || d < 1 || d > 31) return {error:'invalidComponents'};
  const def = {Showa:[1925,'19261225','19890107'],Heisei:[1988,'19890108','20190430'],Reiwa:[2018,'20190501','99991231']}[era];
  if (!def) return {error:'unsupportedEra'};
  const year = def[0] + y, date = new Date(Date.UTC(year,m-1,d));
  if (date.getUTCFullYear() !== year || date.getUTCMonth()+1 !== m || date.getUTCDate() !== d) return {error:'invalidCalendarDate'};
  const digits = `${year}${String(m).padStart(2,'0')}${String(d).padStart(2,'0')}`;
  if (digits < def[1] || digits > def[2]) return {error:'outsideEraBoundary'};
  if (date.getTime() > now) return {error:'futureDate'};
  return {digits};
}

export function transferEmployee(raw) {
  const result = {};
  for (const field of STRING_FIELDS) {
    const max = field === 'address' ? 500 : field === 'jobType' ? 200 : field.includes('Phone') || field === 'phone' ? 50 : 100;
    if (typeof raw[field] !== 'string' || raw[field].length > max) throw Error('invalid-transfer-field');
    result[field] = raw[field];
  }
  for (const field of NUMBER_FIELDS) {
    const value = raw[field];
    if (value == null && ['experienceMonths','healthCheckDay'].includes(field)) result[field] = 0;
    else if (!Number.isInteger(value) || value < 0 || value > 2200) throw Error('invalid-transfer-field');
    else result[field] = value;
  }
  if (!result.nameSei || !result.nameMei || !['Male','Female'].includes(result.gender) || !['Plus','Minus','Unknown'].includes(result.bloodTypeRh)
    || result.experienceYears > 100 || result.experienceMonths > 11 || result.healthCheckMonth > 12 || result.healthCheckDay > 31) throw Error('invalid-transfer-field');
  result.qualifications = {};
  for (const field of QUALIFICATIONS) result.qualifications[field] = raw.qualifications?.[field] === true;
  for (const field of QUALIFICATION_TEXT) {
    const value = raw.qualifications?.[field] ?? '';
    if (typeof value !== 'string' || value.length > 200) throw Error('invalid-transfer-field');
    result.qualifications[field] = value;
  }
  if (JSON.stringify(result).length > 8000) throw Error('oversized-transfer');
  return result;
}
