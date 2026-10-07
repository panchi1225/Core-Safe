import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
export type StaffAccess = { state: 'checking' | 'signedOut' | 'denied' | 'allowed' | 'error'; email?: string };
export function observeStaffAccess(next: (access: StaffAccess) => void): () => void {
  let stopProfile: (() => void) | undefined;
  let generation = 0;
  const stopAuth = onAuthStateChanged(auth, user => {
    const current = ++generation;
    stopProfile?.(); stopProfile = undefined;
    if (!user) { next({ state: 'signedOut' }); return; }
    next({ state: 'checking' });
    stopProfile = onSnapshot(doc(db, 'staffUsers', user.uid), { includeMetadataChanges: true }, snapshot => {
      if (current !== generation) return;
      // Cached approval never mounts the private app.
      if (snapshot.metadata.fromCache) { next({ state: 'checking' }); return; }
      next({ state: snapshot.exists() && snapshot.data().active === true ? 'allowed' : 'denied', email: user.email || '' });
    }, () => { if (current === generation) next({ state: 'error' }); });
  }, () => { generation++; stopProfile?.(); stopProfile = undefined; next({ state: 'error' }); });
  return () => { generation++; stopProfile?.(); stopAuth(); };
}
export const staffSignIn = (email: string, password: string) => signInWithEmailAndPassword(auth, email.trim(), password);
export const staffSignOut = () => signOut(auth);
