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

  // 工事名の動的フォントサイズ
  const getProjectNameClass = (text: string) => {
    const len = text.length;
    if (len > 45) return "text-lg";
    if (len > 35) return "text-xl";
    if (len > 25) return "text-2xl";
    if (len > 15) return "text-3xl";
    return "text-4xl";
  };

  // 出席者を10行固定で表示（空行を埋める）
  const attendeeRows = Array.from({ length: 10 }, (_, i) => data.attendees?.[i] || { company: "", role: "", name: "" });
  return (
    // 修正箇所2: h-autoを削除し、余計なスタイルを排除
    <div className="font-serif text-black leading-tight bg-white">
      {/* PAGE 1: COVER */}
      <div className="print-page relative p-[25mm] flex flex-col justify-between items-center text-center page-break-after-always">
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

      {/* PAGE 2: 議題 */}
      <div className="print-page p-[15mm] page-break-after-always">
        {/* ヘッダー */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold tracking-widest">災 害 防 止 協 議 会</h2>
        </div>

        {/* 基本情報テーブル */}
        <table className={`w-full border-collapse mb-4 ${borderClass}`}>
          <tbody>
            <tr>
              <td className={`${borderClass} ${headerClass} w-28 text-sm`}>工事名</td>
              <td className={`${borderClass} p-2 text-sm`} colSpan={3}>{data.project}</td>
            </tr>
            <tr>
              <td className={`${borderClass} ${headerClass} text-sm`}>開催日時</td>
              <td className={`${borderClass} p-2 text-sm`}>{data.date ? formatDate(data.date) : ''}　{data.startTime}～{data.endTime}</td>
              <td className={`${borderClass} ${headerClass} w-20 text-sm`}>場所</td>
              <td className={`${borderClass} p-2 text-sm`}>{data.location}</td>
            </tr>
            <tr>
              <td className={`${borderClass} ${headerClass} text-sm`}>主催者</td>
              <td className={`${borderClass} p-2 text-sm`} colSpan={3}>{data.hostRole}　{data.hostName}</td>
            </tr>
          </tbody>
        </table>

        {/* 議題テーブル */}
        <table className={`w-full border-collapse mb-4 ${borderClass}`}>
          <thead>
            <tr>
              <th className={`${borderClass} ${headerClass} w-48 text-sm`}>議題</th>
              <th className={`${borderClass} ${headerClass} text-sm`}>内容</th>
            </tr>
          </thead>
          <tbody>
            {(data.agendaItems || []).map((item, idx) => (
              <tr key={idx}>
                <td className={`${borderClass} p-2 text-sm font-bold align-top`}>{item.title}</td>
                <td className={`${borderClass} p-2 text-sm whitespace-pre-wrap align-top`} style={{ minHeight: '2.5rem' }}>{item.content}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* フッター情報 */}
        <table className={`w-full border-collapse ${borderClass}`}>
          <tbody>
            <tr>
              <td className={`${borderClass} ${headerClass} w-28 text-sm`}>次回開催日</td>
              <td className={`${borderClass} p-2 text-sm`}>{data.nextMeetingDate ? formatDate(data.nextMeetingDate) : ''}</td>
              <td className={`${borderClass} ${headerClass} w-20 text-sm`}>備考</td>
              <td className={`${borderClass} p-2 text-sm`}>{data.remarks}</td>
            </tr>
            <tr>
              <td className={`${borderClass} ${headerClass} text-sm`}>確認者</td>
              <td className={`${borderClass} p-2 text-sm`}>{data.reviewerRole}　{data.reviewerName}</td>
              <td className={`${borderClass} ${headerClass} text-sm`}>印</td>
              <td className={`${borderClass} p-2 text-center`}>
                {data.reviewerSealId ? <span className="text-sm">（電子印）</span> : ''}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* PAGE 3: 出席者名簿 */}
      <div className="print-page p-[15mm]">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold tracking-widest">出 席 者 名 簿</h2>
          <div className="text-sm mt-2">第 {data.count} 回　{data.date ? formatDate(data.date) : ''}</div>
        </div>

        <table className={`w-full border-collapse ${borderClass}`}>
          <thead>
            <tr>
              <th className={`${borderClass} ${headerClass} w-10 text-sm`}>No.</th>
              <th className={`${borderClass} ${headerClass} text-sm`}>会社名</th>
              <th className={`${borderClass} ${headerClass} text-sm`}>役職</th>
              <th className={`${borderClass} ${headerClass} text-sm`}>氏名</th>
            </tr>
          </thead>
          <tbody>
            {attendeeRows.map((att, idx) => (
              <tr key={idx} className="h-12">
                <td className={`${borderClass} text-center text-sm`}>{idx + 1}</td>
                <td className={`${borderClass} px-2 text-sm align-middle`}>{att.company}</td>
                <td className={`${borderClass} px-2 text-sm align-middle`}>{att.role}</td>
                <td className={`${borderClass} px-2 text-sm align-middle text-center`}>{att.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DisasterCouncilPrintLayout;