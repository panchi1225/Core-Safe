import { collection, doc, getDocFromServer, getDocs, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { NewcomerSurveyReportData } from '../types';
import { PublicNewcomerForm, surveyPayload, TOKEN_PATTERN } from '../utils/newcomerAccess';

export const PUBLIC_FORMS = 'publicNewcomerForms';
export const PUBLIC_SUBMISSIONS = 'publicNewcomerSubmissions';
const decodeForm = (token: string, raw: any): PublicNewcomerForm => ({ ...raw, token, createdAt: raw.createdAt.toMillis(), expiresAt: raw.expiresAt.toMillis() });

// Public entry only reads this single public-safe document. Never read internal masters here.
export async function getPublicNewcomerForm(token: string): Promise<PublicNewcomerForm> {
  if (!TOKEN_PATTERN.test(token)) throw new Error('invalid-form');
  const snapshot = await getDocFromServer(doc(db, PUBLIC_FORMS, token));
  if (!snapshot.exists()) throw new Error('invalid-form');
  const form = decodeForm(token, snapshot.data());
  if (!form.active || form.expiresAt <= Date.now()) throw new Error('invalid-form');
  return form;
}

export async function issuePublicNewcomerForm(project: string, director: string, expiresAt: number, contractors: string[]): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid || !project || !director || expiresAt <= Date.now()) throw new Error('invalid-form');
  const token = crypto.randomUUID();
  const contractorOptions = [...new Set(contractors.map(c => c.trim()).filter(Boolean))];
  if (contractorOptions.length > 300 || contractorOptions.some(c => c.length > 200)) throw new Error('invalid-contractor-options');
  const batch = writeBatch(db);
  batch.set(doc(db, PUBLIC_FORMS, token), { project, director, active: true, createdAt: serverTimestamp(), createdBy: 'staff', expiresAt: Timestamp.fromMillis(expiresAt), contractorOptions });
  // The public configuration contains no issuer UID. Keep that in a private audit record.
  batch.set(doc(db, 'publicNewcomerFormAudit', token), { createdBy: uid, createdAt: serverTimestamp() });
  await batch.commit();
  return token;
}

export async function listPublicNewcomerForms(): Promise<PublicNewcomerForm[]> {
  const result = await getDocs(query(collection(db, PUBLIC_FORMS), orderBy('createdAt', 'desc')));
  return result.docs.map(d => decodeForm(d.id, d.data()));
}

export const deactivatePublicNewcomerForm = (token: string) => updateDoc(doc(db, PUBLIC_FORMS, token), { active: false });

export function newSubmissionId(): string { return doc(collection(db, PUBLIC_SUBMISSIONS)).id; }

// A stable ID for this page's attempt prevents double clicks from creating another record.
// No post-submit read: anonymous clients have create permission only.
export async function submitPublicNewcomerSurvey(id: string, form: PublicNewcomerForm, report: NewcomerSurveyReportData): Promise<void> {
  const data = surveyPayload({ ...report, project: form.project, director: form.director });
  await setDoc(doc(db, PUBLIC_SUBMISSIONS, id), {
    type: 'NEWCOMER_SURVEY', token: form.token, project: form.project, director: form.director,
    company: report.company, data, createdAt: serverTimestamp(), lastModified: serverTimestamp()
  });
}
