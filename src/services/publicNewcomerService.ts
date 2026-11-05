import { collection, doc, documentId, getDocFromServer, getDocs, getDocsFromServer, limit, orderBy, query, runTransaction, serverTimestamp, setDoc, startAfter, Timestamp, updateDoc, where, type QueryDocumentSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { NewcomerSurveyReportData } from '../types';
import { PublicNewcomerForm, surveyPayload, TOKEN_PATTERN } from '../utils/newcomerAccess';
import { publicContractorOptions } from '../utils/publicContractors';

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

export async function issuePublicNewcomerForm(project: string, director: string, expiresAt: number): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid || !project || !director || expiresAt <= Date.now()) throw new Error('invalid-form');
  const token = crypto.randomUUID();
  await runTransaction(db, async transaction => {
    // The manager may have been open while another employee changed the master.
    const master = await transaction.get(doc(db, 'masterData', 'general'));
    const contractorOptions = publicContractorOptions(master.data()?.contractors || []);
    transaction.set(doc(db, PUBLIC_FORMS, token), { project, director, active: true, createdAt: serverTimestamp(), createdBy: 'staff', expiresAt: Timestamp.fromMillis(expiresAt), contractorOptions });
    // The public configuration contains no issuer UID. Keep that in a private audit record.
    transaction.set(doc(db, 'publicNewcomerFormAudit', token), { createdBy: uid, createdAt: serverTimestamp() });
  });
  return token;
}

// Staff-only synchronization. Existing token URLs, projects, directors and expiry
// remain unchanged. Re-running repairs old QR snapshots or an interrupted sync.
export async function syncPublicNewcomerContractors(): Promise<void> {
  let cursor: QueryDocumentSnapshot | undefined;
  do {
    const page = await getDocsFromServer(query(collection(db, PUBLIC_FORMS), where('active', '==', true), orderBy(documentId()), limit(100), ...(cursor ? [startAfter(cursor)] : [])));
    if (!page.empty) await runTransaction(db, async transaction => {
      const master = await transaction.get(doc(db, 'masterData', 'general'));
      const contractorOptions = publicContractorOptions(master.data()?.contractors || []);
      const forms = await Promise.all(page.docs.map(form => transaction.get(form.ref)));
      if (JSON.stringify(master.data()?.contractors || []) !== JSON.stringify(contractorOptions)) {
        transaction.set(doc(db, 'masterData', 'general'), { contractors: contractorOptions }, { merge: true });
      }
      for (const form of forms) {
        const current = form.data();
        if (current?.active && current.expiresAt.toMillis() > Date.now()
          && JSON.stringify(current.contractorOptions) !== JSON.stringify(contractorOptions)) {
          // Reading the master and form in the transaction prevents an older
          // synchronization from overwriting a concurrent master edit/revocation.
          transaction.update(form.ref, { contractorOptions });
        }
      }
    });
    cursor = page.size === 100 ? page.docs[page.docs.length - 1] : undefined;
  } while (cursor);
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
