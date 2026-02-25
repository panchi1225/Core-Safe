// src/components/DailySafetyWizard.tsx
// ※後のプロンプトで本実装を行うプレースホルダー

import React from 'react';

interface Props {
  initialData: any;
  initialDraftId: string | null;
  onBackToMenu: () => void;
}

const DailySafetyWizard: React.FC<Props> = ({ onBackToMenu }) => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-pink-600 text-white p-4 shadow-md flex justify-between items-center">
        <h1 className="text-lg font-bold">
          <i className="fa-solid fa-book-medical mr-2"></i>安全衛生日誌（準備中）
        </h1>
        <button
          onClick={onBackToMenu}
          className="px-4 py-2 bg-pink-800 rounded hover:bg-pink-900 font-bold text-sm"
        >
          メニューに戻る
        </button>
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg p-10 text-center max-w-md">
          <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-book-medical text-4xl text-pink-500"></i>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-3">安全衛生日誌</h2>
          <p className="text-gray-500 text-sm">
            この機能は現在開発中です。<br />
            次回のアップデートでUI・レイアウトが実装されます。
          </p>
        </div>
      </main>
    </div>
  );
};

export default DailySafetyWizard;
