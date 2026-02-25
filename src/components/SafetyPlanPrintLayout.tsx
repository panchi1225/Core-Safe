import React, { useMemo } from 'react';
import { SafetyPlanReportData, MasterData, INITIAL_MASTER_DATA } from '../types';
import { getDaysInMonth, getDay } from 'date-fns';

// 必要なヘルパー関数などをここにコピー
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const isJapaneseHoliday = (date: Date): boolean => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  // Fixed Holidays
  if (month === 1 && day === 1) return true;
  if (month === 2 && day === 11) return true;
  if (month === 2 && day === 23) return true;
  if (month === 4 && day === 29) return true;
  if (month === 5 && day === 3) return true;
  if (month === 5 && day === 4) return true;
  if (month === 5 && day === 5) return true;
  if (month === 8 && day === 11) return true;
  if (month === 11 && day === 3) return true;
  if (month === 11 && day === 23) return true;
  // Happy Mondays logic omitted for brevity, assuming standard non-business logic fits
  // Simple check for Vernal/Autumnal
  const vernal = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  const autumnal = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  if (month === 3 && day === vernal) return true;
  if (month === 9 && day === autumnal) return true;
  return false;
};

interface Props {
  data: SafetyPlanReportData;
}

const SafetyPlanPrintLayout: React.FC<Props> = ({ data }) => {
  // Styles
  const borderOuter = "border-2 border-black";
  const borderThin = "border border-gray-400";
  const headerBg = "bg-cyan-100";

  // Calculations
  const daysInMonth = useMemo(() => {
    const date = new Date(data.year, data.month - 1, 1);
    const totalDays = getDaysInMonth(date);
    const days = [];
    for (let i = 1; i <= totalDays; i++) {
      const current = new Date(data.year, data.month - 1, i);
      const isSun = getDay(current) === 0;
      const isSat = getDay(current) === 6;
      const isHol = isJapaneseHoliday(current);
      
      let colorClass = "";
      let bgClass = "";
      if (isSun || isHol) {
         colorClass = "text-red-600";
         bgClass = "bg-red-50";
      } else if (isSat) {
         colorClass = "text-blue-600";
         bgClass = "bg-blue-50";
      }
      days.push({ date: i, dayOfWeek: WEEKDAYS[getDay(current)], colorClass, bgClass });
    }
    return days;
  }, [data.year, data.month]);

  const bottomColSpans = useMemo(() => {
    const totalDays = daysInMonth.length;
    // 月曜始まり〜日曜終わりで週を分割
    const rawWeeks: number[] = [];
    let dayCount = 0;
    for (let d = 1; d <= totalDays; d++) {
      dayCount++;
      const currentDate = new Date(data.year, data.month - 1, d);
      const isSunday = getDay(currentDate) === 0;
      const isLastDay = d === totalDays;
      if (isSunday || isLastDay) {
        rawWeeks.push(dayCount);
        dayCount = 0;
      }
    }
    // 最初の週が4日以内なら第2週と合体
    if (rawWeeks.length >= 2 && rawWeeks[0] <= 3) {
      rawWeeks[1] = rawWeeks[0] + rawWeeks[1];
      rawWeeks.shift();
    }
    // 最後の週が3日以内なら前の週と合体
    if (rawWeeks.length >= 2 && rawWeeks[rawWeeks.length - 1] <= 4) {
      rawWeeks[rawWeeks.length - 2] = rawWeeks[rawWeeks.length - 2] + rawWeeks[rawWeeks.length - 1];
      rawWeeks.pop();
    }
    return rawWeeks;
  }, [daysInMonth.length, data.year, data.month]);

  // ★追加: 安全目標のデフォルト値（古いデータ互換性のため）
  const safetyGoals = data.safetyGoals || ["", "", ""];

  return (
    <div className="bg-white w-full h-full flex flex-col font-serif text-black px-[10mm] pt-[15mm] pb-[5mm]" style={{ width: '297mm', height: '210mm' }}>
      {/* HEADER */}
      <div className="flex justify-between items-start mb-2 h-[38mm]">
        <div className="flex-1 flex flex-col justify-center pb-2 h-full">
           <div className="flex items-end mb-4 pl-4">
              <span className="text-xl">令和{data.year - 2018}年{data.month}月度</span>
              <h1 className="text-3xl font-bold border-b-2 border-black ml-4 px-2 tracking-widest">工事施工安全管理計画表</h1>
           </div>
           <div className="flex flex-col gap-1 pl-4 text-sm">
              <div className="flex items-center"><span className="font-bold mr-2 w-16 text-right">工事名 :</span>{data.project}</div>
              <div className="flex items-center"><span className="font-bold mr-2 w-16 text-right">作業所 :</span>{data.location}</div>
           </div>
        </div>
        <div className="w-[100mm] h-full flex flex-col justify-end">
           <div className="text-[10px] text-right mb-0.5">作成日：{data.createdDate}　作成者：{data.author}</div>
           <table className={`w-full ${borderOuter} text-[10px] border-collapse`}>
             <colgroup><col className="w-[15%]" /><col className="w-[25%]" /><col className="w-[35%]" /><col className="w-[25%]" /></colgroup>
             <thead>
               <tr className={headerBg}>
                 <th className={`${borderThin} py-0.5 font-normal`}>行事予定</th>
                 <th className={`${borderThin} py-0.5 font-normal`}>月日</th>
                 <th className={`${borderThin} py-0.5 font-normal`}>役職</th>
                 <th className={`${borderThin} py-0.5 font-normal`}>氏名</th>
               </tr>
             </thead>
             <tbody>
               <tr>
                 <td className={`${borderThin} text-center`}>安全訓練</td>
                 <td className={`${borderThin} text-center`}>{data.trainingDate}</td>
                 <td className={`${borderThin} text-center`}>統括安全衛生責任者</td>
                 <td className={`${borderThin} text-center`}>{data.trainingLeader}</td>
               </tr>
               <tr>
                 <td className={`${borderThin} text-center`}>災害防止協議会</td>
                 <td className={`${borderThin} text-center`}>{data.councilDate}</td>
                 <td className={`${borderThin} text-center`}>副統括安全衛生責任者</td>
                 <td className={`${borderThin} text-center`}>{data.councilLeader}</td>
               </tr>
               <tr>
                 <td className={`${borderThin} text-center`}>社内パトロール</td>
                 <td className={`${borderThin} text-center`}>{data.patrolDate}</td>
                 <td className={`${borderThin} bg-gray-100`}></td>
                 <td className={`${borderThin} bg-gray-100`}></td>
               </tr>
             </tbody>
           </table>
        </div>
      </div>

      {/* GRID */}
      <div className="flex-1 flex flex-col border-2 border-black overflow-hidden relative">
         <table className="w-full h-full border-collapse table-fixed text-[10px]">
           <colgroup>
              <col className="w-[35mm]" />
              {daysInMonth.map(d => <col key={d.date} />)}
           </colgroup>
           <thead>
             <tr className="h-[8mm]">
               <th className={`${borderThin} ${headerBg} font-normal`}>今月の安全衛生目標</th>
               {/* ★修正: 目標の表示部分 */}
               <th className={`${borderThin} ${headerBg}`} colSpan={daysInMonth.length}>
                  <div className="flex justify-around text-xs font-bold items-center h-full">
                     {safetyGoals.map((goal, idx) => (
                        <div key={idx} className="flex items-center justify-center">
                           <span className="mr-1">{idx + 1}.</span>
                           <span>{goal}</span>
                        </div>
                     ))}
                  </div>
               </th>
             </tr>
             <tr className="h-[5mm]">
               <th className={`${borderThin} bg-gray-50 font-normal`}>月</th>
               <th className={`${borderThin} font-normal text-center`} colSpan={daysInMonth.length}>{data.month}月</th>
             </tr>
             <tr className="h-[5mm]">
               <th className={`${borderThin} bg-gray-50 font-normal`}>日</th>
               {daysInMonth.map(d => <th key={d.date} className={`${borderThin} font-normal text-center ${d.colorClass} ${d.bgClass}`}>{d.date}</th>)}
             </tr>
             <tr className="h-[5mm]">
               <th className={`${borderThin} bg-gray-50 font-normal`}>工 程</th>
               {daysInMonth.map(d => <th key={d.date} className={`${borderThin} font-normal text-center ${d.colorClass} ${d.bgClass}`}>{d.dayOfWeek}</th>)}
             </tr>
           </thead>
           <tbody>
              {data.processRows.map((row) => (
                <tr key={row.id} className="h-[6mm]">
                  <td className={`${borderThin} px-1 align-middle leading-none`}>
                     <div className="flex items-center">
                        <span className="text-[8px] transform -rotate-90 origin-center w-3 h-3 block whitespace-nowrap text-gray-500 mr-1">{row.category}</span>
                        <span className="font-bold text-[9px] truncate">{row.name}</span>
                     </div>
                  </td>
                  {daysInMonth.map(d => {
                    const active = row.bars.some(b => d.date >= b.startDay && d.date <= b.endDay);
                    return <td key={d.date} className={`${borderThin} p-0 relative ${d.bgClass}`}>{active && <div className="absolute inset-y-[30%] left-0 right-0 bg-blue-600"></div>}</td>;
                  })}
                </tr>
              ))}
              {Array.from({length: Math.max(0, 12 - data.processRows.length)}).map((_, i) => (
                 <tr key={`fill-${i}`} className="h-[6mm]"><td className={`${borderThin}`}></td>{daysInMonth.map(d => <td key={d.date} className={`${borderThin} ${d.bgClass}`}></td>)}</tr>
              ))}
           </tbody>
           <tfoot>
              <tr className="h-[12mm]">
                 <td className={`${borderThin} ${headerBg} text-center font-normal`}>予想される災害</td>
                 {bottomColSpans.map((span, i) => (
                   <td key={i} colSpan={span} className={`${borderThin} align-top p-0 text-[8px]`}>
                     <div className="flex flex-col h-full">
                       {[0, 1].map(j => (
                         <div key={j} className={`flex-1 border-b border-gray-300 last:border-b-0 flex items-center leading-tight ${span >= 5 ? 'pl-[0.5em]' : 'pl-0'}`}>
                           {(data.predictions[i] || [])[j]}
                         </div>
                       ))}
                     </div>
                   </td>
                 ))}
              </tr>
              <tr className="h-[25mm]">
                 <td className={`${borderThin} ${headerBg} text-center font-normal leading-tight`}>予想される災害<br/>への防止対策</td>
                 {bottomColSpans.map((span, i) => (
                   <td key={i} colSpan={span} className={`${borderThin} align-top p-0 text-[8px]`}>
                     <div className="flex flex-col h-full">
                       {[0, 1, 2, 3, 4].map(j => (
                         <div key={j} className={`flex-1 border-b border-gray-300 last:border-b-0 flex items-center leading-tight ${span >= 5 ? 'pl-[0.5em]' : 'pl-0'}`}>
                           {(data.countermeasures[i] || [])[j]}
                         </div>
                       ))}
                     </div>
                   </td>
                 ))}
              </tr>
              <tr className="h-[15mm]">
                 <td className={`${borderThin} ${headerBg} text-center font-normal leading-tight`}>重点点検項目</td>
                 {bottomColSpans.map((span, i) => (
                   <td key={i} colSpan={span} className={`${borderThin} align-top p-0 text-[8px]`}>
                     <div className="flex flex-col h-full">
                       {[0, 1, 2].map(j => (
                         <div key={j} className={`flex-1 border-b border-gray-300 last:border-b-0 flex items-center leading-tight ${span >= 5 ? 'pl-[0.5em]' : 'pl-0'}`}>
                           {(data.inspectionItems[i] || [])[j] ? `${j + 1}. ${(data.inspectionItems[i] || [])[j]}` : ''}
                         </div>
                       ))}
                     </div>
                   </td>
                 ))}
              </tr>
              <tr className="h-[6mm]">
                 <td className={`${borderThin} ${headerBg} text-center font-normal`}>安全当番</td>
                 {bottomColSpans.map((span, i) => <td key={i} colSpan={span} className={`${borderThin} p-0 text-center text-[9px]`}>{data.safetyDuty[i]}</td>)}
              </tr>
           </tfoot>
         </table>
      </div>
    </div>
  );
};

export default SafetyPlanPrintLayout;
