import React from 'react';
import { ReportData } from '../types';

interface Props {
  data: ReportData;
}

const PrintLayout: React.FC<Props> = ({ data }) => {
  // Helpers for table borders
  const tdClass = "border border-black px-2 py-1 align-middle";
  const labelClass = "text-center bg-gray-100 font-bold";

  // Calculate font size for project name to fit in one line
  const getProjectNameClass = (text: string) => {
    const len = text.length;
    if (len > 30) return "text-xl";     // ~30文字超
    if (len > 22) return "text-2xl";    // ~22-30文字
    if (len > 15) return "text-3xl";    // ~15-22文字
    if (len > 10) return "text-4xl";    // ~10-15文字
    return "text-5xl";                  // ~10文字以内
  };

  // Helper to render a roster page
  const renderRosterPage = (startIndex: number, signatures: any[], totalPageRows: number) => {
    const rows = [];
    for (let i = 0; i < totalPageRows; i++) {
      const sig = signatures[i];
      rows.push(
        // ★修正点1: 行の高さを h-24 から h-20 に変更して、ページ内に収まるように調整
        <tr key={startIndex + i} className="h-20"> 
          <td className="border border-black text-center text-xl font-bold">{startIndex + i + 1}</td>
          <td className="border border-black px-4 text-lg">
            {sig ? sig.company : ""}
          </td>
          <td className="border border-black px-2 text-center">
            {sig ? (
              <img 
                src={sig.signatureDataUrl} 
                alt={sig.name} 
                // ★修正点2: 画像の高さを h-20 から h-16 に調整
                className="h-16 w-auto max-w-full object-contain mx-auto" 
              />
            ) : null}
          </td>
        </tr>
      );
    }

    return (
      // ★修正点3: 上下の余白を p-[20mm] から p-[15mm] に減らして描画領域を確保
      <div className="print-page p-[15mm] flex flex-col h-full justify-between">
        <div>
          <h3 className="text-xl font-bold text-center mb-4">{data.month} 月度安全訓練実施者名簿 ({startIndex + 1}～{startIndex + totalPageRows})</h3>
          
          <table className="w-full border-collapse border-2 border-black">
            <thead>
              <tr className="h-10">
                <th className="border border-black bg-gray-100 py-1 w-20 text-lg">番号</th>
                <th className="border border-black bg-gray-100 py-1 w-1/3 text-lg">会社名</th>
                <th className="border border-black bg-gray-100 py-1 text-lg">参加者氏名 (署名)</th>
              </tr>
            </thead>
            <tbody>
              {rows}
            </tbody>
          </table>
          <div className="mt-2 text-right text-sm">
            {startIndex === 0 && data.signatures.length <= 10 ? `以上 ${data.signatures.length} 名` : 
             startIndex === 10 ? `以上 ${data.signatures.length} 名` : ""}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="font-serif text-black leading-tight">
      {/* PAGE 1: COVER */}
      <div className="print-page relative p-[20mm] flex flex-col justify-between items-center">
        {/* Project Name */}
        <div className="w-full text-center mt-24">
          <h1 className={`${getProjectNameClass(data.project)} font-bold mb-4 leading-normal`}>
            {data.project}
          </h1>
        </div>

        <div className="text-center my-auto">
          <h2 className="text-4xl font-bold border-b-4 border-double border-black pb-2 px-10 inline-block">
            安全教育・訓練報告書
          </h2>
        </div>

        <div className="text-center mb-20">
          <p className="text-4xl font-bold mb-16">{data.month} 月度</p>
          <div className="flex items-center justify-center gap-2">
            <span className="font-bold text-xl italic" style={{fontFamily: 'sans-serif'}}>
              <span className="bg-red-600 text-white px-1 mr-1">K</span>
              {data.contractor}
            </span>
          </div>
        </div>
      </div>

      {/* PAGE 2: DETAILS */}
      <div className="print-page p-[15mm]">
        <div className="border-2 border-black p-6 h-full">
          <h3 className="text-2xl font-bold mb-8 text-center">安全訓練実施内容</h3>

          <div className="grid grid-cols-[80px_1fr] gap-y-4 text-lg mb-8">
            <div className="col-span-2 h-8"></div>
            <div className="font-bold">実施日</div>
            <div>{new Date(data.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div className="font-bold">場　所</div>
            <div>{data.location}</div>
            <div className="font-bold">時　間</div>
            <div>{data.startTime} ～ {data.endTime} （休憩時間15分含む）</div>
            <div className="font-bold">実施者</div>
            <div>{data.instructor}</div>
            <div className="font-bold">内　容</div>
            <div className="space-y-2">
              <div className="flex"><span className="w-8">(1)</span> <span>今月の災害防止目標</span></div>
              <div className="flex"><span className="w-8">(2)</span> <span>今月の作業工程</span></div>
              <div className="flex"><span className="w-8">(3)</span> <span>{data.topic}</span></div>
              <div className="flex"><span className="w-8">(4)</span> <span>{data.caution}</span></div>
              <div className="flex"><span className="w-8">(5)</span> <span>web資料・動画による安全教育</span></div>
              <div className="flex"><span className="w-8">(6)</span> <span>質疑応答</span></div>
            </div>
          </div>

          <div className="mt-8">
            <h4 className="text-lg mb-4">実施写真</h4>
            <div className="w-full h-[400px] border border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
               {data.photoUrl ? (
                 <img src={data.photoUrl} alt="Evidence" className="max-w-full max-h-full object-contain" />
               ) : (
                 <div className="text-gray-400">（写真未添付）</div>
               )}
            </div>
          </div>
        </div>
      </div>

      {/* PAGE 3: ROSTER PAGE 1 (1-10) */}
      {renderRosterPage(0, data.signatures.slice(0, 10), 10)}

      {/* PAGE 4: ROSTER PAGE 2 (11-20) - Only if signatures > 10 */}
      {data.signatures.length > 10 && renderRosterPage(10, data.signatures.slice(10, 20), 10)}
    </div>
  );
};

export default PrintLayout;