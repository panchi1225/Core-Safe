import React from 'react';

interface Props {
  title: string;
  onBack: () => void;
}

const ConstructionPage: React.FC<Props> = ({ title, onBack }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        <div className="text-6xl text-gray-300 mb-6">
          <i className="fa-solid fa-person-digging"></i>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-500 mb-8">この機能は現在開発中です。<br/>次回アップデートをお待ちください。</p>
        
        <button 
          onClick={onBack}
          className="px-6 py-3 bg-gray-800 text-white rounded-lg font-bold hover:bg-gray-700 transition-colors w-full"
        >
          ホームへ戻る
        </button>
      </div>
    </div>
  );
};

export default ConstructionPage;