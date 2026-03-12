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

      {/* PAGE 2: 本文 */}
      <div className="print-page p-[10mm] text-[12px]" style={{ lineHeight: '1.65' }}>
        {/* タイトル */}
        <div className="text-center mb-2">
          <h2 className="text-[17px] font-bold tracking-[0.15em]">災 害 防 止 協 議 会 議 事 録</h2>
        </div>

        {/* 基本情報 */}
        <div style={{ marginBottom: '2px' }}>
          <table className="border-collapse" style={{ borderSpacing: 0 }}>
            <tbody>
              <tr style={{ height: '24px' }}>
                <td className="font-bold pr-1" style={{ whiteSpace: 'nowrap', width: '6em', textAlign: 'justify', textAlignLast: 'justify' }}>工事名</td>
                <td className="px-2">：</td>
                <td>{data.project}</td>
              </tr>
              <tr style={{ height: '24px' }}>
                <td className="font-bold pr-1" style={{ whiteSpace: 'nowrap', width: '6em', textAlign: 'justify', textAlignLast: 'justify' }}>開催日時</td>
                <td className="px-2">：</td>
                <td>{data.date ? formatDate(data.date) : ''}　{data.startTime}～{data.endTime}</td>
              </tr>
              <tr style={{ height: '24px' }}>
                <td className="font-bold pr-1" style={{ whiteSpace: 'nowrap', width: '6em', textAlign: 'justify', textAlignLast: 'justify' }}>開催方法</td>
                <td className="px-2">：</td>
                <td>{data.meetingMethod || '現地開催'}</td>
              </tr>
              <tr style={{ height: '24px' }}>
                <td className="font-bold pr-1" style={{ whiteSpace: 'nowrap', width: '6em', textAlign: 'justify', textAlignLast: 'justify' }}>開催場所</td>
                <td className="px-2">：</td>
                <td>{data.location}</td>
              </tr>
              <tr style={{ height: '24px' }}>
                <td className="font-bold pr-1" style={{ whiteSpace: 'nowrap', width: '6em', textAlign: 'justify', textAlignLast: 'justify' }}>主催者</td>
                <td className="px-2">：</td>
                <td>{data.hostRole}　{data.hostName}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 基本情報→出席者の間：1行分スペース */}
        <div style={{ height: '16px' }}></div>

        {/* 出席者 */}
        <div>
          <div className="font-bold text-[12.5px] mb-1">【出席者】</div>
          <table className="w-full border-collapse" style={{ border: '2px solid #555' }}>
            <thead>
              <tr style={{ height: '20px' }} className="bg-gray-50">
                <th className="font-bold text-center" style={{ width: '44px', borderRight: '1px solid #ccc', borderBottom: '1px solid #888' }}>No.</th>
                <th className="font-bold text-center" style={{ width: '44%', borderRight: '1px solid #ccc', borderBottom: '1px solid #888' }}>会社名</th>
                <th className="font-bold text-center" style={{ width: '25%', borderRight: '1px solid #ccc', borderBottom: '1px solid #888' }}>役職・職務名</th>
                <th className="font-bold text-center" style={{ borderBottom: '1px solid #888' }}>氏名</th>
              </tr>
            </thead>
            <tbody>
              {attendeeRows.map((att, idx) => (
                <tr key={idx} style={{ height: '18px' }}>
                  <td className="text-center" style={{ borderRight: '1px solid #ccc', borderBottom: '1px solid #ddd' }}>{idx + 1}</td>
                  <td className="px-1" style={{ borderRight: '1px solid #ccc', borderBottom: '1px solid #ddd' }}>{att.company}</td>
                  <td className="px-1 text-center" style={{ borderRight: '1px solid #ccc', borderBottom: '1px solid #ddd' }}>{att.role}</td>
                  <td className="px-1 text-center" style={{ borderBottom: '1px solid #ddd' }}>{att.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 出席者→協議内容の間：1行分スペース */}
        <div style={{ height: '16px' }}></div>

        {/* 協議内容 */}
        <div>
          <div className="font-bold text-[12.5px] mb-1">【協議内容】</div>
          <div style={{ paddingLeft: '1em' }}>
            {(data.agendaItems || []).map((item, idx) => (
              <div key={idx} style={{ minHeight: '58px', marginBottom: '2px' }}>
                <div className="font-bold text-[12px]">{item.title}</div>
                <div className="whitespace-pre-wrap text-[12px]" style={{ paddingLeft: '1em' }}>
                  {idx === 5 ? (data.nextMeetingDate ? formatDate(data.nextMeetingDate) : '次回開催予定日未定') : (item.content ? `　${item.content}` : '')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 備考 */}
        <div style={{ marginTop: '4px' }}>
          <span className="font-bold">備考：</span>{data.remarks}
        </div>

        {/* 備考→確認者の間：2行分スペース */}
        <div style={{ height: '32px' }}></div>

        {/* 確認者（右寄せ、枠なし） */}
        <div className="flex justify-end items-center gap-2">
          <span>確認者：{data.reviewerRole}　{data.reviewerName}</span>
          {data.reviewerSealImage ? (
            <img src={data.reviewerSealImage} alt="電子印" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          ) : (
            <span>㊞</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default DisasterCouncilPrintLayout;
