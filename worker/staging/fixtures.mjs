import {STRING_FIELDS,NUMBER_FIELDS,QUALIFICATIONS,QUALIFICATION_TEXT} from '../src/data.mjs';
export const token='33333333-3333-4333-8333-333333333333';
export function employee(number,updated=false){
 const label=String(number).padStart(3,'0');
 const raw={...Object.fromEntries(STRING_FIELDS.map(k=>[k,'架空'+label])),...Object.fromEntries(NUMBER_FIELDS.map(k=>[k,0])),
  nameSei:'架空',nameMei:'社員'+label,furiganaSei:'カクウ',furiganaMei:'シャイン',birthEra:'Heisei',birthYear:7,birthMonth:1,birthDay:(number-1)%28+1,
  gender:'Male',bloodType:'A',bloodTypeRh:'Plus',address:updated?'更新済み架空住所'+label:'架空住所'+label,phone:'000-0000-0000',emergencyContactPhone:'000-0000-0001',emergencyContactRelation:'家族',jobType:'架空職種',experienceYears:10,experienceMonths:3,healthCheckYear:8,healthCheckMonth:1,healthCheckDay:1,
  qualifications:{...Object.fromEntries(QUALIFICATIONS.map(k=>[k,true])),...Object.fromEntries(QUALIFICATION_TEXT.map(k=>[k,'架空資格']))},sealImage:'STAGING-NOT-TRANSFERRED',management:'STAGING-NOT-TRANSFERRED'};
 return raw;
}
const value=v=>v===null?{nullValue:null}:typeof v==='string'?{stringValue:v}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{integerValue:String(v)}:{mapValue:{fields:fields(v)}};
export const fields=v=>Object.fromEntries(Object.entries(v).map(([k,x])=>[k,value(x)]));
