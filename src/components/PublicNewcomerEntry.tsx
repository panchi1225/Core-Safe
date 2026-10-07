import React, { useEffect, useState } from 'react';
import { getPublicNewcomerForm } from '../services/publicNewcomerService';
import { PublicNewcomerForm } from '../utils/newcomerAccess';
import NewcomerSurveyWizard from './NewcomerSurveyWizard';

export default function PublicNewcomerEntry({ token }: { token: string | null }) {
  const [form, setForm] = useState<PublicNewcomerForm | null>(null);
  const [invalid, setInvalid] = useState(!token);
  useEffect(() => {
    let current = true;
    if (token) getPublicNewcomerForm(token).then(value => { if (current) setForm(value); }).catch(() => { if (current) setInvalid(true); });
    return () => { current = false; };
  }, [token]);
  if (invalid) return <main className="min-h-screen bg-gray-100 p-6 flex items-center justify-center"><div className="bg-white rounded-xl shadow p-8 max-w-md"><h1 className="font-bold text-xl mb-4">このQRコードは利用できません</h1><p>有効期限切れ、無効化、または旧方式のQRコードです。現場担当者に新しいQRコードの発行を依頼してください。通信状況もご確認ください。</p></div></main>;
  if (!form) return <p className="p-8 text-center">公開フォームを確認しています…</p>;
  return <NewcomerSurveyWizard isPublicEntry publicForm={form} initialData={{ project: form.project, director: form.director }} onBackToMenu={() => {}} />;
}
