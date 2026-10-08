import test from 'node:test';
import assert from 'node:assert/strict';
import { employeeBirthDate, validBirthDate, birthDateFormValues } from '../../lib/birthDate.js';
import { AUTOFILL_FIELDS, employeeAutofillData } from '../../lib/autofillData.js';
import { publicEmployeeId, employeeIdFromPublic, secretKey, rateId } from '../../lib/opaqueEmployeeId.js';
const today = '20261007';
for (const [era, year, month, day, expected] of [
  ['Heisei',7,1,1,'19950101'], ['平成','7','1','1','19950101'], ['Showa',62,12,5,'19871205'], ['昭和',1,12,25,'19261225'],
  ['Reiwa',1,5,1,'20190501'], ['令和',8,4,23,'20260423'], ['AD',1995,1,1,'19950101'], ['西暦',2001,4,23,'20010423'],
]) test(`existing ${era} ${year}/${month}/${day} converts to ${expected}`, () => assert.equal(employeeBirthDate({birthEra:era,birthYear:year,birthMonth:month,birthDay:day},today),expected));
for (const value of ['1995-01-01','1995/01/01','1995011',' 19950101','19950101 ','19950231','19000229','20270201'])
  test(`invalid or future YYYYMMDD rejected: ${value}`, () => assert.equal(validBirthDate(value,today),false));
test('leap day and actual era boundaries are checked', () => {
  assert.ok(validBirthDate('20000229',today));
  for (const [birthEra,birthYear,birthMonth,birthDay] of [['Showa',1,1,1],['Showa',64,1,8],['Heisei',1,1,7],['Heisei',31,5,1],['Reiwa',1,4,30],['AD',0,1,1],['unknown',7,1,1]])
    assert.equal(employeeBirthDate({birthEra,birthYear,birthMonth,birthDay},today),null);
  assert.deepEqual(birthDateFormValues('19950101'),{birthEra:'Heisei',birthYear:7,birthMonth:1,birthDay:1});
  assert.deepEqual(birthDateFormValues('19890107'),{birthEra:'Showa',birthYear:64,birthMonth:1,birthDay:7});
});
test('response is an explicit allowlist including qualification allowlist, never a record spread', () => {
  const raw={id:'EMPLOYEE-NUMBER',sealImage:'PRIVATE-SEAL',password:'PRIVATE',address:'必要な住所',phone:'000',nameSei:'山田',nameMei:'太郎',qualifications:{slinging:true,sealImage:'PRIVATE-SEAL',otherText1:'資格'}, experienceYears:10,experienceMonths:5};
  const result=employeeAutofillData(raw,birthDateFormValues('19950101'));
  assert.deepEqual(Object.keys(result).sort(),[...AUTOFILL_FIELDS].sort());
  assert.equal(result.address,'必要な住所'); assert.equal(result.company,'松浦建設株式会社'); assert.equal(result.qualifications.slinging,true);
  assert.ok(!JSON.stringify(result).includes('PRIVATE')); assert.ok(!JSON.stringify(result).includes('EMPLOYEE-NUMBER'));
});
const key=secretKey('a'.repeat(64)),token='11111111-1111-4111-8111-111111111111';
test('opaque IDs hide meaningful document IDs, vary per issuance, and bind token/expiry', () => {
  const id=publicEmployeeId(key,token,'社員番号0001',10000),again=publicEmployeeId(key,token,'社員番号0001',10000);
  assert.notEqual(id,again); assert.ok(!Buffer.from(id,'base64url').toString('utf8').includes('社員番号0001'));
  assert.equal(employeeIdFromPublic(key,token,id,1),'社員番号0001');
  assert.equal(employeeIdFromPublic(key,'other-token',id,1),null); assert.equal(employeeIdFromPublic(key,token,id,10000),null);
  const bytes=Buffer.from(id,'base64url'); bytes[30]^=1; assert.equal(employeeIdFromPublic(key,token,bytes.toString('base64url'),1),null);
  assert.equal(employeeIdFromPublic(secretKey('b'.repeat(64)),token,id,1),null);
  assert.equal(employeeIdFromPublic(key,token,'employee-number',1),null);
});
test('counter keys are opaque and separated by scope; invalid server keys fail closed', () => {
  const first=rateId(key,'employee',[token,'employee-number']); assert.match(first,/^[a-f0-9]{64}$/);
  assert.notEqual(first,rateId(key,'client',[token,'employee-number']));
  assert.throws(()=>secretKey('not-configured'));
});
