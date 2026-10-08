import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase';
import type { EmployeeAutofillData } from '../../functions/src/autofillData';
export type { EmployeeAutofillData };
export interface PublicEmployeeCandidate { employeePublicId: string; displayName: string }
const functions = getFunctions(app, 'asia-northeast1');
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') connectFunctionsEmulator(functions, '127.0.0.1', 15001);
const list = httpsCallable<{ token: string }, PublicEmployeeCandidate[]>(functions, 'listPublicEmployeeCandidates', { timeout: 30000 });
const verify = httpsCallable<{ token: string; employeePublicId: string; birthDate: string }, EmployeeAutofillData>(functions, 'verifyEmployeeAutofill', { timeout: 30000 });
export const listPublicEmployeeCandidates = async (token: string) => (await list({ token })).data;
export const verifyEmployeeAutofill = async (token: string, employeePublicId: string, birthDate: string) => (await verify({ token, employeePublicId, birthDate })).data;
