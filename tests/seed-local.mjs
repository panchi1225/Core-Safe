// Disposable, synthetic fixtures only. This script cannot select a production project.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { INITIAL_MASTER_DATA, INITIAL_NEWCOMER_SURVEY_REPORT, INITIAL_DAILY_SAFETY_REPORT, INITIAL_REPORT, INITIAL_DISASTER_COUNCIL_REPORT } from '../src/types.ts';
import { surveyPayload } from '../src/utils/newcomerAccess.ts';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080') throw new Error('Local demo emulator only: FIRESTORE_EMULATOR_HOST=127.0.0.1:18080');
const env = await initializeTestEnvironment({ projectId: 'demo-core-safe' });
const password = 'Local-test-12345!';
async function account(email) {
  const base = 'http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:';
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) };
  let response = await fetch(base + 'signUp?key=demo-key', options);
  if (!response.ok) response = await fetch(base + 'signInWithPassword?key=demo-key', options);
  const data = await response.json(); if (!response.ok) throw new Error('Local Auth emulator account setup failed');
  return data.localId;
}
const staffUid = await account('staff@core-safe.local'); await account('outsider@core-safe.local');
const token = '11111111-1111-4111-8111-111111111111';
const signatureDataUrl = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80"><path d="M10 60 L40 15 L65 60 L100 20 L135 60 L180 15 L220 60" stroke="red" stroke-width="4" fill="none"/><text x="10" y="77" font-size="12">SYNTHETIC TEST SIGNATURE</text></svg>').toString('base64');
const report = { ...INITIAL_NEWCOMER_SURVEY_REPORT, project: '検証現場', director: '検証所長', company: '検証会社', companyInputType: 'master', nameSei: '検証', nameMei: '太郎', name: '検証太郎', furiganaSei: 'ケンショウ', furiganaMei: 'タロウ', birthYear: 10, birthMonth: 1, birthDay: 1, age: 28, experienceYears: 1, experienceMonths: 0, address: '架空の住所', phone: '000-0000-0000', emergencyContactSei: '検証', emergencyContactMei: '家族', emergencyContactRelation: '家族', emergencyContactPhone: '000-0000-0000', healthCheckYear: 8, healthCheckMonth: 1, healthCheckDay: 1, pledgeDateYear: 8, pledgeDateMonth: 10, pledgeDateDay: 7, signatureDataUrl };
await env.withSecurityRulesDisabled(async c => {
  const db = c.firestore();
  await setDoc(doc(db, 'staffUsers', staffUid), { active: true });
  await setDoc(doc(db, 'masterData/general'), { ...INITIAL_MASTER_DATA, projects: ['検証現場'], supervisors: ['検証所長'], contractors: ['検証会社'] });
  await setDoc(doc(db, 'employees/synthetic'), { ...report, nameMei: '社員', birthYear: 7, experienceYears: 1, experienceMonths: 0, sealImage: 'PRIVATE-ELECTRONIC-SEAL' });
  await setDoc(doc(db, 'publicNewcomerForms', token), { project: report.project, director: report.director, active: true, createdAt: Timestamp.now(), createdBy: 'staff', expiresAt: Timestamp.fromMillis(Date.now() + 86400000), contractorOptions: ['検証会社'] });
  await setDoc(doc(db, 'drafts/legacy-survey'), { type: 'NEWCOMER_SURVEY', data: { ...report, nameSei: '旧', name: '旧太郎' }, lastModified: Timestamp.now() });
  await setDoc(doc(db, 'publicNewcomerSubmissions/public-survey'), { type: 'NEWCOMER_SURVEY', token, project: report.project, director: report.director, company: report.company, data: surveyPayload({ ...report, nameSei: '公開' }), createdAt: Timestamp.now(), lastModified: Timestamp.now() });
  for (const [id,type,data] of [
    ['daily','DAILY_SAFETY',{...INITIAL_DAILY_SAFETY_REPORT,project:report.project,workDate:'2026-10-07',meetingDate:'2026-10-07'}],
    ['training','SAFETY_TRAINING',{...INITIAL_REPORT,project:report.project,date:'2026-10-07'}],
    ['council','DISASTER_COUNCIL',{...INITIAL_DISASTER_COUNCIL_REPORT,project:report.project,date:'2026-10-07'}],
  ]) await setDoc(doc(db,'drafts',id),{type,data,lastModified:Timestamp.now()});
});
await env.cleanup();
console.log('demo-core-safe synthetic fixtures ready. Local-only login: staff@core-safe.local / Local-test-12345!');
