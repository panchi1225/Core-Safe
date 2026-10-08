import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { AutofillError, createAutofillService } from './autofillService.js';
import { secretKey } from './opaqueEmployeeId.js';

if (process.env.FUNCTIONS_EMULATOR === 'true' && process.env.GCLOUD_PROJECT !== 'demo-core-safe') throw new Error('Use demo-core-safe for local Functions.');
initializeApp();
const key = defineSecret('EMPLOYEE_AUTOFILL_KEY');
const options = {
  region: 'asia-northeast1', secrets: [key], timeoutSeconds: 30, maxInstances: 5,
  cors: process.env.FUNCTIONS_EMULATOR === 'true' ? [/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/] : ['https://panchi1225.github.io'],
};
const FAILURE = '本人確認ができませんでした。氏名と生年月日を確認してください。';
function publicError(error: unknown): HttpsError {
  if (error instanceof AutofillError && error.kind === 'rate-limited') return new HttpsError('resource-exhausted', '短時間の試行回数が上限に達しました。1分ほど待つか、手入力をご利用ください。');
  if (error instanceof AutofillError && error.kind === 'verification-failed') return new HttpsError('permission-denied', FAILURE);
  // Never log request bodies, token, DOB, employee IDs or private records.
  return new HttpsError('unavailable', '社員情報を読み込めませんでした。手入力でも提出できます。');
}
export const listPublicEmployeeCandidates = onCall(options, async request => {
  try { return await createAutofillService(getFirestore(), secretKey(key.value())).list(request.data?.token, request.rawRequest.ip || 'unknown-client'); }
  catch (error) { throw publicError(error); }
});
export const verifyEmployeeAutofill = onCall(options, async request => {
  try {
    const input = request.data && typeof request.data === 'object' && !Array.isArray(request.data) ? request.data : {};
    return await createAutofillService(getFirestore(), secretKey(key.value())).verify(input, request.rawRequest.ip || 'unknown-client');
  } catch (error) { throw publicError(error); }
});
