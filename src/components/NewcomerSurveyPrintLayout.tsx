import React from 'react';
import { NewcomerSurveyReportData } from '../types';

interface Props {
  data: NewcomerSurveyReportData;
}

// 工事名の長さに応じてフォントサイズを返す関数
const getProjectNameClass = (text: string) => {
  if (!text) return "text-[10px]";
  const len = text.length;
  if (len > 40) return "text-[6px]";
  if (len > 30) return "text-[7px]";
  if (len > 20) return "text-[8px]";
  return "text-[10px]";
};

const NewcomerSurveyPrintLayout: React.FC<Props> = ({ data }) => {
  if (!data) return null;
  const qual = data.qualifications || {};

  const borderClass = "border-b border-r border-black";
  
  const CheckBox = ({ checked, label }: { checked: boolean | undefined; label: string }) => (
    <div className="flex items-center text-[10px] leading-tight mb-0.5">
      <div className={`w-3.5 h-3.5 border border-black flex items-center justify-center mr-1.5 text-[10px] shrink-0 font-sans ${checked ? "font-bold" : ""}`}>
        {checked ? "✔" : ""}
      </div>
      <span className="whitespace-nowrap">{label}</span>
    </div>
  );

  const JOB_TYPES = ["土工", "鳶", "大工", "オペ", "鉄筋工", "交通整理人", "その他"];

  return (
    <div className="font-serif text-black leading-tight bg-white relative">
      <div className="print-page p-[12mm] flex flex-col box-border" style={{ height: '297mm', width: '210mm' }}>
        
        <h1 className="text-3xl font-bold text-center mb-6 tracking-[0.5em] shrink-0">新規入場者アンケート</h1>

        <div className="w-full border-2 border-black flex-1 flex flex-col overflow-hidden">
          
          {/* Row 1: Name / Birth / Gender */}
          <div className="flex border-b border-black shrink-0 h-[64px]">
            <div className={`w-24 ${borderClass} bg-gray-50 flex flex-col justify-center items-center p-1`}>
              <span className="text-[10px] mb-1">カ　　　ナ</span>
              <span className="font-bold text-base">氏　　　名</span>
            </div>
            <div className={`w-64 ${borderClass} p-1 flex flex-col justify-center`}>
               <div className="text-xs text-center w-full mb-0.5">{data.furiganaSei}　{data.furiganaMei}</div>
               <div className="text-xl text-center font-bold">{data.nameSei}　{data.nameMei}</div>
            </div>
            <div className={`w-24 ${borderClass} bg-gray-50 flex items-center justify-center font-bold text-sm text-center`}>
              生年月日
            </div>
            <div className={`flex-1 ${borderClass} flex items-center justify-center p-1`}>
               <div className="flex items-center gap-1.5">
                 <div className="flex flex-col text-[10px] leading-none mr-1 gap-1">
                   <div className={`w-4 h-4 flex items-center justify-center ${data.birthEra === 'Showa' ? 'border border-black rounded-full font-bold' : 'text-gray-400'}`}>昭</div>
                   <div className={`w-4 h-4 flex items-center justify-center ${data.birthEra === 'Heisei' ? 'border border-black rounded-full font-bold' : 'text-gray-400'}`}>平</div>
                 </div>
                 <span className="text-lg font-bold">{data.birthYear}</span>
                 <span className="text-xs">年</span>
                 <span className="text-lg font-bold">{data.birthMonth}</span>
                 <span className="text-xs">月</span>
                 <span className="text-lg font-bold">{data.birthDay}</span>
                 <span className="text-xs">日</span>
               </div>
            </div>
            <div className={`w-24 border-b border-black flex flex-col items-center justify-center p-1`}>
               <div className="flex gap-3 mb-1 text-sm">
                  <span className={data.gender === 'Male' ? 'font-bold rounded-full border border-black w-5 h-5 flex items-center justify-center' : 'w-5 h-5 flex items-center justify-center text-gray-400'}>男</span>
                  <span>・</span>
                  <span className={data.gender === 'Female' ? 'font-bold rounded-full border border-black w-5 h-5 flex items-center justify-center' : 'w-5 h-5 flex items-center justify-center text-gray-400'}>女</span>
               </div>
               <div className="flex items-end gap-0.5">
                 <span className="text-lg font-bold">{data.age}</span>
                 <span className="text-[10px]">歳</span>
               </div>
            </div>
          </div>

          {/* Row 2: Company / Experience */}
          <div className="flex border-b border-black shrink-0 h-[48px]">
             <div className={`w-24 ${borderClass} bg-gray-50 flex items-center justify-center font-bold p-1 text-sm`}>
               所属会社名
             </div>
             <div className={`flex-1 ${borderClass} px-3 flex items-center`}>
                <span className="text-base font-bold">{data.company}</span>
             </div>
             <div className={`w-32 ${borderClass} flex items-center justify-center p-1 text-[11px]`}>
                ( <span className="w-6 text-center text-base font-bold">{data.subcontractorRank}</span> 次) 下請け
             </div>
             <div className={`w-24 ${borderClass} bg-gray-50 flex items-center justify-center font-bold p-1 text-sm`}>
               経験年数
             </div>
             <div className={`w-40 border-b border-black flex items-center justify-center p-1`}>
                <span className="text-lg font-bold w-6 text-right mr-1">{data.experienceYears}</span>
                <span className="text-xs mr-2">年</span>
                <span className="text-lg font-bold w-5 text-right mr-1">{data.experienceMonths}</span>
                <span className="text-xs">ヶ月</span>
             </div>
          </div>

          {/* Row 3: Job Type */}
          <div className="flex border-b border-black shrink-0 h-[40px]">
            <div className={`w-24 ${borderClass} bg-gray-50 flex items-center justify-center font-bold p-1 text-sm`}>
              職　　　種
            </div>
            <div className={`flex-1 border-b border-black px-2 flex items-center text-sm`}>
              <div className="flex flex-nowrap items-center w-full">
                {JOB_TYPES.map((job, idx) => (
                  <React.Fragment key={job}>
                    <div className="flex items-center whitespace-nowrap">
                      <span className={`px-1 ${data.jobType === job ? 'border border-black rounded-full font-bold' : ''}`}>
                        {job}
                      </span>
                      {idx < JOB_TYPES.length - 1 && <span className="text-gray-400 mx-1">・</span>}
                    </div>
                  </React.Fragment>
                ))}
                <div className="flex items-center whitespace-nowrap ml-1">
                  <span>（</span>
                  <span className="inline-block min-w-[100px] text-center px-1 italic">
                     {data.jobType === 'その他' ? data.jobTypeOther : ''}
                  </span>
                  <span>）</span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 4: Address / Phone */}
          <div className="flex border-b border-black shrink-0 h-[48px]">
             <div className={`w-24 ${borderClass} bg-gray-50 flex items-center justify-center font-bold p-1 text-sm`}>
               現　住　所
             </div>
             <div className={`flex-1 ${borderClass} px-3 flex items-center text-sm`}>
               {data.address}
             </div>
             <div className={`w-16 ${borderClass} bg-gray-50 flex flex-col items-center justify-center font-bold text-[10px] p-1 leading-tight`}>
                <span>本人</span>
                <span>電話</span>
             </div>
             <div className={`w-48 border-b border-black px-3 flex items-center justify-center text-base font-bold tracking-wider`}>
               {data.phone}
             </div>
          </div>

          {/* Row 5: Emergency Contact */}
          <div className="flex border-b border-black shrink-0 h-[48px]">
             <div className={`w-24 ${borderClass} bg-gray-50 flex items-center justify-center font-bold p-1 text-sm`}>
               緊急連絡先
             </div>
             <div className={`w-12 ${borderClass} bg-gray-50 flex items-center justify-center font-bold p-1 text-[10px]`}>
               氏名
             </div>
             <div className={`flex-1 ${borderClass} px-3 flex items-center text-sm`}>
               {data.emergencyContactSei}　{data.emergencyContactMei}
             </div>
             <div className={`w-16 ${borderClass} bg-gray-50 flex items-center justify-center font-bold p-1 text-sm`}>
               続柄
             </div>
             <div className={`w-20 ${borderClass} flex items-center justify-center text-sm font-bold`}>
               {data.emergencyContactRelation}
             </div>
             <div className={`w-16 ${borderClass} bg-gray-50 flex flex-col items-center justify-center font-bold text-[10px] p-1 leading-tight`}>
                <span>緊急</span>
                <span>電話</span>
             </div>
             <div className={`w-48 border-b border-black px-3 flex items-center justify-center text-base font-bold tracking-wider`}>
               {data.emergencyContactPhone}
             </div>
          </div>

          {/* Row 6: Blood / Health */}
          <div className="flex border-b border-black shrink-0 h-[48px]">
            <div className={`w-24 ${borderClass} bg-gray-50 flex items-center justify-center font-bold p-1 text-sm`}>
              血　液　型
            </div>
            <div className={`flex-1 ${borderClass} p-1 flex items-center justify-center gap-2`}>
              <span className="text-lg font-bold w-6 text-center">{data.bloodType}</span>
              <span className="text-xs">型</span>
              <span className="ml-4 text-xs font-bold">（ ＲＨ </span>
              {data.bloodTypeRh === 'Unknown' || data.bloodTypeRh === undefined ? (
                <span className="w-10 text-center text-xs">不明</span>
              ) : (
                <span className="w-10 text-center border-b border-black text-lg font-bold">
                  {data.bloodTypeRh === 'Plus' ? '+' : '-'}
                </span>
              )}
              <span className="text-xs font-bold"> ）</span>
            </div>
            <div className={`w-32 ${borderClass} bg-gray-50 flex items-center justify-center font-bold text-[10px] p-1 text-center leading-tight`}>
              健康診断受診日
            </div>
            <div className={`w-64 border-b border-black p-1 flex items-center justify-center`}>
              <span className="text-xs mr-1">令和</span>
              <span className="text-lg font-bold w-8 text-right mr-1">{data.healthCheckYear}</span>
              <span className="text-xs mr-2">年</span>
              <span className="text-lg font-bold w-6 text-right mr-1">{data.healthCheckMonth}</span>
              <span className="text-xs mr-2">月</span>
              <span className="text-lg font-bold w-6 text-right mr-1">{data.healthCheckDay}</span>
              <span className="text-xs">日</span>
            </div>
          </div>
          
          {/* Row 7: Kentaikyo */}
          <div className="flex border-b border-black shrink-0 h-[40px]">
             <div className={`w-1/2 ${borderClass} bg-gray-50 flex items-center justify-center font-bold p-1 text-sm`}>
               建退共の加入状況
             </div>
             <div className={`w-1/2 border-b border-black flex items-center justify-center gap-10 p-1`}>
               <div className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded-full border border-black flex items-center justify-center`}>
                     {data.kentaikyo === 'Joined' && <div className="w-2 h-2 bg-black rounded-full"></div>}
                  </div>
                  <span className={`text-sm ${data.kentaikyo === 'Joined' ? 'font-bold' : ''}`}>加入している</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded-full border border-black flex items-center justify-center`}>
                     {data.kentaikyo === 'NotJoined' && <div className="w-2 h-2 bg-black rounded-full"></div>}
                  </div>
                  <span className={`text-sm ${data.kentaikyo === 'NotJoined' ? 'font-bold' : ''}`}>加入していない</span>
               </div>
             </div>
          </div>

          {/* --- QUALIFICATIONS SECTION --- */}
          <div className="p-4 flex-1 flex flex-col border-b border-black">
             <div className="font-bold text-xs mb-3">あなたが現在取得している資格にレを記入して下さい。</div>
             
             <div className="flex-1 grid grid-cols-3 gap-2">
                {/* Column 1 */}
                <div className="flex flex-col border-r border-dashed border-gray-400 pr-2">
                   <div className="font-bold text-[10px] mb-2 text-center bg-gray-100 py-0.5">【 技能講習 】</div>
                   <div className="flex flex-col gap-0.5">
                      <CheckBox checked={qual.vehicle_leveling} label="車輌系建設機械（整地、積込運搬等）" />
                      <CheckBox checked={qual.vehicle_demolition} label="車輌系建設機械（解体用）" />
                      <CheckBox checked={qual.mobile_crane} label="小型移動クレーン" />
                      <CheckBox checked={qual.slinging} label="玉掛" />
                      <CheckBox checked={qual.gas_welding} label="ガス溶接" />
                      <CheckBox checked={qual.earth_retaining} label="土留め支保工作業主任者" />
                      <CheckBox checked={qual.excavation} label="地山掘削作業主任者" />
                      <CheckBox checked={qual.scaffolding} label="足場組立て等作業主任者" />
                      <CheckBox checked={qual.formwork} label="型枠支保工作業主任者" />
                      <CheckBox checked={qual.oxygen_deficiency} label="酸素欠乏危険作業主任者" />
                      <CheckBox checked={qual.rough_terrain} label="不整地運搬車" />
                   </div>
                </div>

                {/* Column 2 */}
                <div className="flex flex-col border-r border-dashed border-gray-400 pr-2 pl-2">
                   <div className="font-bold text-[10px] mb-2 text-center bg-gray-100 py-0.5">【 特別教育 】</div>
                   <div className="flex flex-col gap-0.5">
                      <CheckBox checked={qual.arc_welding} label="アーク溶接" />
                      <CheckBox checked={qual.grinding_wheel} label="研削といし取替え業務" />
                      <CheckBox checked={qual.low_voltage} label="低圧電気取扱" />
                      <CheckBox checked={qual.roller} label="ローラー運転業務" />
                      <CheckBox checked={qual.asbestos} label="石綿取り扱い業務" />
                   </div>
                </div>

                {/* Column 3 */}
                <div className="flex flex-col pl-2">
                   <div className="font-bold text-[10px] mb-2 text-center bg-gray-100 py-0.5">【 その他 】</div>
                   <CheckBox checked={qual.foreman} label="職長教育" />
                   
                   <div className="mt-1 pt-1 border-t border-dashed border-gray-300"></div>
                   <CheckBox checked={(qual as any).license_regular} label="普通自動車免許" />
                   <CheckBox checked={(qual as any).license_large} label="大型自動車免許" />
                   <CheckBox checked={(qual as any).license_large_special} label="大型特殊自動車免許" />
                   <CheckBox checked={(qual as any).license_towing} label="牽引自動車免許" />
                   
                   <div className="mt-auto pt-2">
                      <div className="text-[9px] font-bold mb-1 text-gray-600">
                        ※上記以外に資格をお持ちでしたらご記入下さい。
                      </div>
                      <div className="space-y-1">
                        <div className="border-b border-black h-4 text-[10px] px-1 italic">{qual.otherText1}</div>
                        <div className="border-b border-black h-4 text-[10px] px-1 italic">{qual.otherText2}</div>
                        <div className="border-b border-black h-4 text-[10px] px-1 italic">{qual.otherText3}</div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
          
          {/* --- PLEDGE SECTION --- */}
          <div className="p-3 bg-gray-50 flex-1 flex flex-col justify-between shrink-0 h-[180px]">
            <div>
              <h3 className="font-bold text-sm mb-2 flex items-center">
                <span className="w-1 h-4 bg-black mr-2"></span>
                新規入場時誓約
              </h3>
              
              {/* ★修正: pl-2 -> pl-10 に変更し、右へ3文字分程度移動 */}
              <ul className="list-none pl-10 space-y-1 text-xs leading-snug">
                 <li className="flex items-start"><span className="mr-1.5">-</span>私は当作業所の新規入場時教育を受けました。</li>
                 <li className="flex items-start"><span className="mr-1.5">-</span>作業所の遵守事項やルールを厳守し作業します。</li>
                 <li className="flex items-start"><span className="mr-1.5">-</span>どんな小さなケガでも、必ず当日に報告します。</li>
                 <li className="flex items-start"><span className="mr-1.5">-</span>自分の身を守り、また周囲の人の安全にも気を配ります。</li>
                 <li className="flex items-start"><span className="mr-1.5">-</span>危険個所を発見したときは、直ちに現場責任者へ連絡します。</li>
                 <li className="flex items-start"><span className="mr-1.5">-</span>作業中は有資格者証を携帯します。</li>
                 <li className="flex items-start"><span className="mr-1.5">-</span>記載した個人情報を労務・安全管理に使用することに同意します。</li>
                 <li className="flex items-start"><span className="mr-1.5">-</span>上記の事項を相違なく報告します。</li>
              </ul>
            </div>

            <div className="flex justify-between items-end px-1 mt-auto">
               {/* Left: Project Info */}
               <div className="w-[50%] space-y-2">
                  <div className="flex items-end border-b border-black pb-0.5">
                    <span className="text-[9px] font-bold w-12 mb-0.5 whitespace-nowrap">現場名</span>
                    <span className={`flex-1 font-bold px-1 text-center ${getProjectNameClass(data.project)}`}>
                      {data.project}
                    </span>
                  </div>
                  <div className="flex items-end border-b border-black pb-0.5">
                    <span className="text-[9px] font-bold w-12 mb-0.5">作業所長名</span>
                    <span className="flex-1 text-sm font-bold text-center">{data.director}</span>
                    <span className="text-[9px] ml-1 mb-0.5">殿</span>
                  </div>
               </div>

               {/* Right: Date & Signature */}
               <div className="w-[45%] flex flex-col items-end">
                  <div className="flex justify-center items-baseline mb-1 text-[10px] font-bold w-full">
                     <span className="mr-1">令和</span>
                     <span className="text-base w-6 text-center mx-0.5">{data.pledgeDateYear}</span>
                     <span>年</span>
                     <span className="text-base w-5 text-center mx-0.5">{data.pledgeDateMonth}</span>
                     <span>月</span>
                     <span className="text-base w-5 text-center mx-0.5">{data.pledgeDateDay}</span>
                     <span>日</span>
                  </div>
                  
                  <div className="flex w-full items-end border-2 border-black bg-white h-[50px] relative">
                     <span className="absolute left-1 top-1 text-[9px] font-bold text-gray-400">署名</span>
                     <div className="flex-1 h-full flex items-center justify-center p-1">
                        {data.signatureDataUrl ? (
                          <img src={data.signatureDataUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="text-gray-200 text-[9px]">(ここに署名)</span>
                        )}
                     </div>
                  </div>
               </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default NewcomerSurveyPrintLayout;
