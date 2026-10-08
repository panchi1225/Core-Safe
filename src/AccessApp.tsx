import React, { lazy, Suspense } from 'react';
import StaffGate from './components/StaffGate';
import { publicEntryRoute } from './utils/newcomerAccess';
const StaffApp = lazy(() => import('./App'));
const PublicEntry = lazy(() => import('./components/PublicNewcomerEntry'));
export default function AccessApp() {
  const route = publicEntryRoute(window.location.search);
  return <Suspense fallback={<p className="p-8 text-center">読み込み中…</p>}>
    {route.public ? <PublicEntry token={route.token} /> : <StaffGate><StaffApp /></StaffGate>}
  </Suspense>;
}
