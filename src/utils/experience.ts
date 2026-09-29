export const EXPERIENCE_REFERENCE_LABEL = '2026年10月1日';

const EXPERIENCE_REFERENCE_DATE = new Date(2026, 9, 1);

/** 名簿の基準日時点の経験年数を、指定日時点の経験年数に換算する。 */
export const calculateCurrentExperience = (years: number, months: number, date: Date = new Date()) => {
  // 基準日は月初なので、月が替わるごとに経験月数を1か月進める。
  const elapsedMonths = (date.getFullYear() - EXPERIENCE_REFERENCE_DATE.getFullYear()) * 12
    + date.getMonth() - EXPERIENCE_REFERENCE_DATE.getMonth();
  const totalMonths = Math.max(0, years * 12 + months + elapsedMonths);

  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
  };
};
