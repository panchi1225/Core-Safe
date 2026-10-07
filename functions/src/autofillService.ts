import { timingSafeEqual } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { birthDateFormValues, employeeBirthDate, validBirthDate } from './birthDate.js';
import { employeeAutofillData } from './autofillData.js';
import { employeeIdFromPublic, publicEmployeeId, rateId } from './opaqueEmployeeId.js';

export const RATE_COLLECTION = 'employeeAutofillRateLimits';
export const WINDOW_MS = 60_000;
export class AutofillError extends Error {
  constructor(public kind: 'verification-failed' | 'rate-limited' | 'unavailable') { super(kind); }
}
const fail = () => new AutofillError('verification-failed');
const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const validToken = (token: unknown): token is string => typeof token === 'string' && TOKEN.test(token);
const validForm = (data: Record<string, unknown> | undefined, now: number) => data?.active === true && data.expiresAt instanceof Timestamp && data.expiresAt.toMillis() > now;
const todayJst = (now: number) => new Date(now + 9 * 3600_000).toISOString().slice(0, 10).replaceAll('-', '');
type Bucket = { id: string; limit: number };
export function createAutofillService(db: Firestore, key: Buffer, clock: () => number = Date.now) {
  // Atomic counters apply across processes/instances. Client identifiers alone never control the employee limit.
  async function authorize(token: string, buckets: Bucket[]) {
    const ordered = [...buckets].sort((a, b) => a.id.localeCompare(b.id));
    await db.runTransaction(async tx => {
      const now = clock(), form = await tx.get(db.doc(`publicNewcomerForms/${token}`));
      if (!validForm(form.data(), now)) throw fail();
      const counters = await tx.getAll(...ordered.map(b => db.doc(`${RATE_COLLECTION}/${b.id}`)));
      const next = counters.map(c => {
        const data = c.data();
        return data && typeof data.windowStart === 'number' && now >= data.windowStart && now - data.windowStart < WINDOW_MS ? { windowStart: data.windowStart, attempts: Number(data.attempts) || 0 } : { windowStart: now, attempts: 0 };
      });
      if (next.some((n, i) => n.attempts >= ordered[i].limit)) throw new AutofillError('rate-limited');
      next.forEach((n, i) => tx.set(counters[i].ref, { windowStart: n.windowStart, attempts: n.attempts + 1, expiresAt: Timestamp.fromMillis(now + 24 * 3600_000) }));
    });
  }
  const clientBucket = (token: string, client: string, action: string, limit: number): Bucket => ({ id: rateId(key, action, [token, client]), limit });
  async function recheck(token: string) {
    if (!validForm((await db.doc(`publicNewcomerForms/${token}`).get()).data(), clock())) throw fail();
  }
  return {
    async list(token: unknown, client: string) {
      if (!validToken(token) || !client) throw fail();
      await authorize(token, [clientBucket(token, client, 'list-client', 30), { id: rateId(key, 'list-token', [token]), limit: 500 }]);
      // Read only name/availability fields; no birth date or other private fields in this query.
      const employees = await db.collection('employees').select('nameSei', 'nameMei', 'active').limit(1001).get();
      if (employees.size > 1000) throw new AutofillError('unavailable');
      const expires = clock() + 15 * 60_000;
      const result = employees.docs.flatMap(doc => {
        const d = doc.data();
        if (d.active === false || typeof d.nameSei !== 'string' || typeof d.nameMei !== 'string' || !d.nameSei || !d.nameMei) return [];
        return [{ employeePublicId: publicEmployeeId(key, token, doc.id, expires), displayName: `${d.nameSei.slice(0, 100)} ${d.nameMei.slice(0, 100)}` }];
      }).sort((a, b) => a.displayName.localeCompare(b.displayName, 'ja'));
      await recheck(token);
      return result;
    },
    async verify(input: Record<string, unknown>, client: string) {
      const { token, employeePublicId: opaque, birthDate } = input;
      if (!validToken(token) || !client) throw fail();
      const id = employeeIdFromPublic(key, token, opaque, clock());
      const buckets = [clientBucket(token, client, 'verify-client', 20), { id: rateId(key, 'verify-token', [token]), limit: 500 }];
      if (id) buckets.push({ id: rateId(key, 'verify-employee-token', [token, id]), limit: 5 }, { id: rateId(key, 'verify-employee', [id]), limit: 10 });
      await authorize(token, buckets); // Includes failures and successes; no reset-on-success loophole.
      const today = todayJst(clock());
      if (!id || !validBirthDate(birthDate, today)) throw fail();
      const snapshot = await db.doc(`employees/${id}`).get(), employee = snapshot.data();
      if (!employee || employee.active === false) throw fail();
      const expected = employeeBirthDate(employee, today);
      if (!expected || !timingSafeEqual(Buffer.from(expected), Buffer.from(birthDate))) throw fail();
      const birth = birthDateFormValues(birthDate);
      if (!birth) throw fail();
      const result = employeeAutofillData(employee, birth);
      await recheck(token);
      return result;
    },
  };
}
