import React, { useEffect, useState } from 'react';
import { observeStaffAccess, staffSignIn, staffSignOut, type StaffAccess } from '../services/authService';
const defaultSource = { observeStaffAccess, staffSignIn, staffSignOut };
export default function StaffGate({ children, source = defaultSource }: { children: React.ReactNode; source?: typeof defaultSource }) {
  const [access, setAccess] = useState<StaffAccess>({ state: 'checking' });
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => source.observeStaffAccess(setAccess), [source]);
  const login = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await source.staffSignIn(email, password); setPassword(''); }
    catch { setError('ログインできませんでした。入力内容と通信状態を確認してください。'); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    setBusy(true); setError('');
    try { await source.staffSignOut(); }
    catch { setError('ログアウトできませんでした。再試行してください。'); }
    finally { setBusy(false); }
  };
  if (access.state === 'allowed') return <>
    <div className="no-print bg-slate-900 text-white px-4 py-2 flex justify-end gap-4 text-sm">
      <span>{access.email}</span><button disabled={busy} onClick={() => void logout()}>ログアウト</button>
      {error && <span role="alert">{error}</span>}
    </div>{children}
  </>;
  return <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
    <main className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md space-y-5">
      <h1 className="font-bold text-2xl text-slate-800">Core Safe 社員ログイン</h1>
      {access.state === 'checking' ? <p role="status">利用権限を確認しています…</p>
        : access.state === 'signedOut' ? <form onSubmit={login} className="space-y-4">
          <p className="text-sm text-gray-600">管理者から発行された社員アカウントを使用してください。</p>
          <label className="block">メールアドレス<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 p-3 border rounded-lg w-full" /></label>
          <label className="block">パスワード<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 p-3 border rounded-lg w-full" /></label>
          <button disabled={busy} className="w-full p-3 bg-blue-600 text-white rounded-lg font-bold">{busy ? 'ログイン中…' : 'ログイン'}</button>
        </form> : <>
          <p role="alert">{access.state === 'denied' ? 'このアカウントはCore Safeの利用を許可されていません。管理者に確認してください。' : '利用権限を確認できませんでした。通信状態を確認してください。'}</p>
          <button disabled={busy} onClick={() => void logout()} className="p-3 border rounded-lg">ログアウトしてやり直す</button>
        </>}
      {error && <p role="alert" className="text-red-600">{error}</p>}
    </main>
  </div>;
}
