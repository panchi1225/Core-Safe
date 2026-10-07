export class Timestamp {
  constructor(value) { this.value = value; }
  toMillis() { return this.value; }
  static now() { return new Timestamp(100); }
}
export const collection = (_db, name) => name;
export const doc = (_db, name, id) => ({ name, id });
export const where = (field, op, value) => ({ kind: 'where', field, op, value });
export const documentId = () => '__name__';
export const orderBy = (field) => ({ kind: 'order', field });
export const limit = (value) => ({ kind: 'limit', value });
export const startAfter = (cursor) => ({ kind: 'cursor', value: cursor.id });
export const query = (name, ...constraints) => ({ name, constraints });
const snapshot = raw => ({ id: raw.id, data: () => ({ ...raw, lastModified: new Timestamp(raw.lastModified) }), exists: () => true });
export const getDocs = async (q) => {
  const state = globalThis.__firestoreFixture;
  state.calls.push(q);
  if (state.deny) throw new Error('permission-denied');
  if (state.abort) state.abort();
  const project = q.constraints.find(c => c.kind === 'where')?.value;
  const cursor = q.constraints.find(c => c.kind === 'cursor')?.value;
  const size = q.constraints.find(c => c.kind === 'limit')?.value || Infinity;
  const records = q.name === 'publicNewcomerSubmissions' ? state.publicRecords || [] : state.records;
  const field = q.constraints.find(c => c.kind === 'where')?.field;
  const docs = records.filter(d => (field === 'project' ? d.project : d.data.project) === project && (!cursor || d.id > cursor)).sort((a,b) => a.id.localeCompare(b.id)).slice(0, size).map(snapshot);
  return { docs, size: docs.length };
};
export const getDoc = async ({ id, name }) => {
  const state = globalThis.__firestoreFixture;
  if (state.deny) throw new Error('permission-denied');
  (state.reads ||= []).push({ id, name });
  const raw = (name === 'publicNewcomerSubmissions' ? state.publicRecords || [] : state.records).find(record => record.id === id);
  return raw ? snapshot(raw) : { exists: () => false };
};
export const getDocsFromServer = async q => {
  if (globalThis.__firestoreFixture.offline) throw new Error('unavailable');
  return getDocs(q);
};
export const getDocFromServer = async ref => {
  if (globalThis.__firestoreFixture.offline) throw new Error('unavailable');
  return getDoc(ref);
};
export const deleteDoc = () => { throw new Error('unexpected write'); };
export const setDoc = deleteDoc;
export const addDoc = deleteDoc;
export const writeBatch = deleteDoc;
export const updateDoc = deleteDoc;
export const serverTimestamp = () => 'server-time';
