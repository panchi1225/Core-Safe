import React from 'react';
import { ReportData } from '../types';

interface Props {
  data: ReportData;
}

// Helper for dynamic font size
const getProjectNameClass = (text: string) => {
  if (!text) return "text-5xl";
  const len = text.length;
  // ★修正: より細かいサイズ調整
  if (len > 40) return "text-sm";
  if (len > 30) return "text-lg";
  if (len > 22) return "text-2xl";
  if (len > 15) return "text-3xl";
  if (len > 10) return "text-4xl";
  return "text-5xl";
};

const PrintLayout: React.FC<Props> = ({ data }) => {
  if (!data) return null;

  // Split signatures into pages (max 10 per page)
  const signaturePages = [];
  for (let i = 0; i < data.signatures.length; i += 10) {
    signaturePages.push(data.signatures.slice(i, i + 10));
  }
  // Ensure at least 2 pages of signatures (1-10, 11-20)
  while (signaturePages.length < 2) {
    signaturePages.push([]);
  }

  return (
    <div className="font-serif text-black leading-tight bg-white">
      {/* --- PAGE 1: COVER --- */}
      <div className="print-page p-[20mm] flex flex-col justify-between items-center text-center border-b-2 border-gray-200" style={{ height: '297mm', width: '210mm' }}>
        <div className="mt-20 w-full">
          <div className="text-2xl mb-2 font-bold tracking-widest">安全教育・訓練</div>
          <div className="text-6xl font-bold tracking-widest border-b-4 border-black inline-block pb-4 mb-4">報告書</div>
          <div className="text-xl mt-4">（実施報告書）</div>
        </div>

        <div className="w-full my-10 flex flex-col items-center justify-center flex-1">
          <div className="w-full border-t-2 border-b-2 border-black py-12 my-8">
            <div className="text-2xl mb-6 font-bold text-gray-600">工 事 名</div>
            {/* ★修正: 長い工事名でも1行に収めるためのクラス適用 */}
            <h1 className={`${getProjectNameClass(data.project)} font-bold px-4 leading-tight whitespace-nowrap overflow-hidden text-ellipsis`}>
              {data.project}
            </h1>
          </div>
        </div>

        <div className="w-full text-right mb-20 pr-10">
          <div className="text-xl font-bold mb-2">実施月： {data.month} 月度</div>
          <div className="text-2xl font-bold border-b-2 border-black inline-block min-w-[300px] text-center pb-2">
            {data.contractor}
          </div>
        </div>
      </div>

      <div style={{ pageBreakBefore: 'always' }}></div>

      {/* --- PAGE 2: DETAILS --- */}
      <div className="print-page p-[15mm] flex flex-col" style={{ height: '297mm', width: '210mm' }}>
        <h2 className="text-2xl font-bold text-center mb-6 border-2 border-black py-2">安全教育・訓練実施報告書</h2>
        
        <div className="flex-1 border-2 border-black">
          {/* Header Grid */}
          <div className="grid grid-cols-12 border-b border-black text-center">
            <div className="col-span-2 bg-gray-100 border-r border-black p-2 font-bold flex items-center justify-center">実施日</div>
            <div className="col-span-4 border-r border-black p-2 flex items-center justify-center font-bold">
              {new Date(data.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="col-span-2 bg-gray-100 border-r border-black p-2 font-bold flex items-center justify-center">時間</div>
            <div className="col-span-4 p-2 flex items-center justify-center font-bold">
              {data.startTime} ～ {data.endTime}
            </div>
          </div>

          <div className="grid grid-cols-12 border-b border-black text-center">
            <div className="col-span-2 bg-gray-100 border-r border-black p-2 font-bold flex items-center justify-center">場所</div>
            <div className="col-span-4 border-r border-black p-2 flex items-center justify-center">{data.location}</div>
            <div className="col-span-2 bg-gray-100 border-r border-black p-2 font-bold flex items-center justify-center">実施者</div>
            <div className="col-span-4 p-2 flex items-center justify-center">{data.instructor}</div>
          </div>

          {/* Content Section */}
          <div className="flex flex-col h-[700px]">
            {/* Top Half: Text Content */}
            <div className="h-1/2 flex border-b border-black">
              <div className="w-12 bg-gray-100 border-r border-black font-bold flex items-center justify-center text-center writing-vertical">
                教育・訓練内容
              </div>
              <div className="flex-1 p-4 space-y-4 text-sm">
                <div className="border-b border-dashed border-gray-300 pb-2">
                  <span className="font-bold mr-2">【今月の安全衛生目標】</span>
                  {data.goal}
                </div>
                <div className="border-b border-dashed border-gray-300 pb-2">
                  <span className="font-bold mr-2">【今月の作業工程】</span>
                  {data.process}
                </div>
                <div className="border-b border-dashed border-gray-300 pb-2">
                  <span className="font-bold mr-2">【安全訓練内容】</span>
                  {data.topic}
                </div>
                <div>
                  <span className="font-bold mr-2">【注意事項】</span>
                  {data.caution}
                </div>
              </div>
            </div>

            {/* Bottom Half: Photo */}
            <div className="h-1/2 flex">
              <div className="w-12 bg-gray-100 border-r border-black font-bold flex items-center justify-center text-center writing-vertical">
                実施状況写真
              </div>
              <div className="flex-1 p-4 flex items-center justify-center">
                {data.photoUrl ? (
                  <img src={data.photoUrl} alt="Evidence" className="max-h-full max-w-full object-contain border border-gray-200" />
                ) : (
                  <span className="text-gray-300">（写真なし）</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="text-right mt-2 text-sm">※本報告書は、毎月の安全書類として提出してください。</div>
      </div>

      <div style={{ pageBreakBefore: 'always' }}></div>

      {/* --- PAGE 3 & 4: SIGNATURES --- */}
      {signaturePages.map((signatures, pageIndex) => (
        <React.Fragment key={pageIndex}>
          <div className="print-page p-[15mm] flex flex-col" style={{ height: '297mm', width: '210mm' }}>
            <h2 className="text-xl font-bold text-center mb-4 border-2 border-black py-2">
              安全教育・訓練 参加者名簿 ({pageIndex + 1})
            </h2>
            
            <div className="w-full border-2 border-black mb-4">
               <div className="grid grid-cols-12 border-b border-black text-center text-sm bg-gray-100">
                 <div className="col-span-3 border-r border-black p-2 font-bold">工事名</div>
                 <div className="col-span-9 p-2 font-bold truncate text-left px-4">{data.project}</div>
               </div>
               <div className="grid grid-cols-12 text-center text-sm">
                 <div className="col-span-3 bg-gray-100 border-r border-black p-2 font-bold">実施日</div>
                 <div className="col-span-9 p-2 font-bold text-left px-4">
                   {new Date(data.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                 </div>
               </div>
            </div>

            <div className="flex-1 border-2 border-black">
              {/* Header */}
              <div className="flex border-b border-black bg-gray-100 text-center font-bold text-sm h-10">
                <div className="w-12 border-r border-black flex items-center justify-center">No</div>
                <div className="w-1/3 border-r border-black flex items-center justify-center">会社名</div>
                <div className="flex-1 border-r border-black flex items-center justify-center">氏名 (自署)</div>
                <div className="w-24 flex items-center justify-center">備考</div>
              </div>

              {/* Rows */}
              {Array.from({ length: 10 }).map((_, i) => {
                const sig = signatures[i];
                return (
                  <div key={i} className="flex border-b border-black h-20 text-sm last:border-b-0">
                    <div className="w-12 border-r border-black flex items-center justify-center bg-gray-50 font-bold">
                      {pageIndex * 10 + i + 1}
                    </div>
                    <div className="w-1/3 border-r border-black flex items-center justify-center px-2 text-center">
                      {sig ? sig.company : ''}
                    </div>
                    <div className="flex-1 border-r border-black flex items-center justify-center">
                      {sig ? (
                        <img src={sig.signatureDataUrl} alt="Sig" className="max-h-16 max-w-full object-contain" />
                      ) : (
                        ''
                      )}
                    </div>
                    <div className="w-24 flex items-center justify-center"></div>
                  </div>
                );
              })}
            </div>
            <div className="text-right mt-2 text-sm">枚数: {pageIndex + 1} / {signaturePages.length}</div>
          </div>
          {pageIndex < signaturePages.length - 1 && <div style={{ pageBreakBefore: 'always' }}></div>}
        </React.Fragment>
      ))}
    </div>
  );
};

export default PrintLayout;
