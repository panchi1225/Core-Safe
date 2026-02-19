import React from 'react';
import { DisasterCouncilReportData } from '../types';

interface Props {
  data: DisasterCouncilReportData;
}

const DisasterCouncilPrintLayout: React.FC<Props> = ({ data }) => {
  // Helpers for table styling
  const borderClass = "border border-black";
  const headerClass = "bg-green-100 text-center font-bold py-1";
  
  // Format date: YYYY/M/D
  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  // Ensure subcontractors list fills at least a few rows for visuals
  const subRows = Math.max(10, data.subcontractorAttendees.length);
  const blankSubRows = Array.from({ length: subRows - data.subcontractorAttendees.length });

  // Dynamic font size for Project Name to fit in one line
  const getProjectNameClass = (text: string) => {
    const len = text.length;
    if (len > 45) return "text-lg";    // かなり長い場合
    if (len > 35) return "text-xl";    // 長い場合
    if (len > 25) return "text-2xl";   // やや長い場合
    if (len > 15) return "text-3xl";   // 普通
    return "text-4xl";                 // 短い場合は大きく
  };

  // Expand short role names to full formal names for printing
  const getFullRoleName = (role: string | undefined) => {
    if (!role) return "";
    if (role === "統括") return "統括安全衛生責任者";
    if (role === "副統括") return "副統括安全衛生責任者";
    return role;
  };

  // Dynamic font size for Roles to fit in one line (specifically for 副統括安全衛生責任者)
  const getRoleClass = (role: string | undefined) => {
    const text = getFullRoleName(role); // Check length based on expanded name
    if (!text) return "";
    const len = text.length;
    if (len > 10) return "text-xs tracking-tighter"; // For 副統括安全衛生責任者 (11 chars)
    if (len > 8) return "text-sm";
    return "";
  };

  return (
    <div className="font-serif text-black leading-tight">
      {/* PAGE 1: COVER */}
      <div className="print-page relative p-[25mm] flex flex-col justify-between items-center text-center">
        {/* Top: Count */}
        <div className="mt-16 text-3xl font-normal tracking-widest">
          第　{data.count}　回
        </div>

        {/* Middle Top: Project Name */}
        <div className="mt-20 px-4 w-full flex items-center justify-center min-h-[4rem]">
          <h1 className={`${getProjectNameClass(data.project)} font-normal mb-4 leading-normal whitespace-nowrap`}>
            {data.project}
          </h1>
        </div>

        {/* Center: Title */}
        <div className="my-auto">
          <h2 className="text-5xl font-normal tracking-[0.2em] leading-loose">
            災 害 防 止 協 議 会
          </h2>
        </div>

        {/* Bottom: Date & Contractor */}
        <div className="mb-24 w-full">
          <div className="text-2xl mb-16">
            開催日： {formatDate(data.date)}
          </div>

          <div className="flex items-center justify-center gap-3">
             {/* Logo removed as requested */}
            <span className="font-bold text-2xl">
              {data.contractor}
            </span>
          </div>
        </div>
      </div>

      {/* PAGE 2: AGENDA */}
      <div className="print-page p-[30mm] flex flex-col items-center">
        {/* Title: Underlined with padding */}
        <div className="mt-20 mb-24 border-b-2 border-black px-12 pb-2">
           <h2 className="text-4xl font-normal tracking-[0.2em] ml-2">次　第</h2>
        </div>

        {/* Content List */}
        <div className="w-full max-w-lg space-y-12 text-2xl">
          <div className="flex items-baseline">
            <span className="w-16 text-right mr-8 font-serif">1</span>
            <span>統括安全衛生責任者挨拶</span>
          </div>
          <div className="flex items-baseline">
            <span className="w-16 text-right mr-8 font-serif">2</span>
            <span>月間工程説明</span>
          </div>
          <div className="flex items-baseline">
            <span className="w-16 text-right mr-8 font-serif">3</span>
            <span>職種間の作業調整の検討</span>
          </div>
          <div className="flex items-baseline">
            <span className="w-16 text-right mr-8 font-serif">4</span>
            <span>各職種からの提案事項</span>
          </div>
          <div className="flex items-baseline">
            <span className="w-16 text-right mr-8 font-serif">5</span>
            <span>その他協議事項</span>
          </div>
          <div className="flex items-baseline">
            <span className="w-16 text-right mr-8 font-serif">6</span>
            <span>次回開催日の連絡</span>
          </div>
        </div>
      </div>

      {/* PAGE 3: ROSTER */}
      {/* 修正箇所: style={{ pageBreakAfter: 'always' }} を削除しました。
          これにより、画面プレビュー時に無駄な空白ページ（4ページ目）が生成されるのを防ぎます。
          印刷時の改ページは親コンポーネント（Wizard側）で制御、または必要に応じてクラスで対応します。 */}
      <div className="print-page p-[20mm]">
        {/* Header */}
        <div className="flex justify-between items-end mb-4 px-2">
           <div className="text-xl font-bold">第 {data.count} 回</div>
           <h3 className="text-2xl font-bold text-center flex-1">災害防止協議会出席者名簿</h3>
           <div className="w-16"></div> {/* Spacer for center alignment */}
        </div>

        {/* Info Table */}
        <table className={`w-full border-collapse mb-6 ${borderClass}`}>
          <tbody>
            <tr>
              <td className={`${borderClass} p-2 w-32 text-center`}>作 業 所 名</td>
              <td className={`${borderClass} p-2`}>芝崎作業所</td>
            </tr>
            <tr>
              <td className={`${borderClass} p-2 text-center`}>開 催 日 時</td>
              <td className={`${borderClass} p-2`}>
                {formatDate(data.date)}
              </td>
            </tr>
            <tr>
              <td className={`${borderClass} p-2 text-center`}>場　所</td>
              <td className={`${borderClass} p-2`}>{data.location}</td>
            </tr>
          </tbody>
        </table>

        {/* General Contractor Attendees (元請) */}
        <div className="mb-6">
           <table className={`w-full border-collapse ${borderClass}`}>
             <thead>
               <tr>
                 <th className={`${borderClass} ${headerClass}`} colSpan={4}>元　請　出　席　者</th>
               </tr>
               <tr>
                 <th className={`${borderClass} w-1/4 py-1 font-normal`}>職　務　名</th>
                 <th className={`${borderClass} w-1/4 py-1 font-normal`}>氏　名</th>
                 <th className={`${borderClass} w-1/4 py-1 font-normal`}>職　務　名</th>
                 <th className={`${borderClass} w-1/4 py-1 font-normal`}>氏　名</th>
               </tr>
             </thead>
             <tbody>
               {/* Row 1 */}
               <tr className="h-12">
                 <td className={`${borderClass} px-2 align-middle ${getRoleClass(data.gcAttendees[0]?.role)}`}>{getFullRoleName(data.gcAttendees[0]?.role)}</td>
                 <td className={`${borderClass} px-2 align-middle text-center text-lg`}>{data.gcAttendees[0]?.name}</td>
                 <td className={`${borderClass} px-2 align-middle ${getRoleClass(data.gcAttendees[1]?.role)}`}>{getFullRoleName(data.gcAttendees[1]?.role)}</td>
                 <td className={`${borderClass} px-2 align-middle text-center text-lg`}>{data.gcAttendees[1]?.name}</td>
               </tr>
               {/* Row 2 */}
               <tr className="h-12">
                 <td className={`${borderClass} px-2 align-middle ${getRoleClass(data.gcAttendees[2]?.role)}`}>{getFullRoleName(data.gcAttendees[2]?.role)}</td>
                 <td className={`${borderClass} px-2 align-middle text-center text-lg`}>{data.gcAttendees[2]?.name}</td>
                 <td className={`${borderClass} px-2 align-middle ${getRoleClass(data.gcAttendees[3]?.role)}`}>{getFullRoleName(data.gcAttendees[3]?.role)}</td>
                 <td className={`${borderClass} px-2 align-middle text-center text-lg`}>{data.gcAttendees[3]?.name}</td>
               </tr>
               {/* Row 3 */}
               <tr className="h-12">
                 <td className={`${borderClass} px-2 align-middle ${getRoleClass(data.gcAttendees[4]?.role)}`}>{getFullRoleName(data.gcAttendees[4]?.role)}</td>
                 <td className={`${borderClass} px-2 align-middle text-center text-lg`}>{data.gcAttendees[4]?.name}</td>
                 <td className={`${borderClass} px-2 align-middle ${getRoleClass(data.gcAttendees[5]?.role)}`}>{getFullRoleName(data.gcAttendees[5]?.role)}</td>
                 <td className={`${borderClass} px-2 align-middle text-center text-lg`}>{data.gcAttendees[5]?.name}</td>
               </tr>
               {/* Row 4 */}
               <tr className="h-12">
                 <td className={`${borderClass} px-2 align-middle ${getRoleClass(data.gcAttendees[6]?.role)}`}>{getFullRoleName(data.gcAttendees[6]?.role)}</td>
                 <td className={`${borderClass} px-2 align-middle text-center text-lg`}>{data.gcAttendees[6]?.name}</td>
                 <td className={`${borderClass} px-2 align-middle ${getRoleClass(data.gcAttendees[7]?.role)}`}>{getFullRoleName(data.gcAttendees[7]?.role)}</td>
                 <td className={`${borderClass} px-2 align-middle text-center text-lg`}>{data.gcAttendees[7]?.name}</td>
               </tr>
             </tbody>
           </table>
        </div>

        {/* Subcontractor Attendees (専門工事会社) */}
        <div>
          <table className={`w-full border-collapse ${borderClass}`}>
            <thead>
              <tr>
                <th className={`${borderClass} ${headerClass}`} colSpan={3}>専 門 工 事 会 社　 安 全 衛 生 委 員　 出 席 者</th>
              </tr>
              <tr>
                <th className={`${borderClass} w-1/3 py-1 font-normal`}>会　社　名</th>
                <th className={`${borderClass} w-1/3 py-1 font-normal`}>役 職 又は 職 務 名</th>
                <th className={`${borderClass} w-1/3 py-1 font-normal`}>氏　名</th>
              </tr>
            </thead>
            <tbody>
              {data.subcontractorAttendees.map((sub) => (
                <tr key={sub.id} className="h-12">
                  <td className={`${borderClass} px-2 align-middle`}>{sub.company}</td>
                  <td className={`${borderClass} px-2 align-middle`}>{sub.role}</td>
                  <td className={`${borderClass} px-2 align-middle text-center`}>
                    {sub.signatureDataUrl ? (
                      <img src={sub.signatureDataUrl} alt={sub.name} className="h-10 mx-auto object-contain" />
                    ) : (
                       sub.name
                    )}
                  </td>
                </tr>
              ))}
              {blankSubRows.map((_, idx) => (
                <tr key={`blank-${idx}`} className="h-12">
                  <td className={`${borderClass}`}></td>
                  <td className={`${borderClass}`}></td>
                  <td className={`${borderClass}`}></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};

export default DisasterCouncilPrintLayout;
