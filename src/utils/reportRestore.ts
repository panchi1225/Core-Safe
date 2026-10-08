import { DailySafetyReportData, INITIAL_DAILY_SAFETY_REPORT, NewcomerSurveyReportData, INITIAL_NEWCOMER_SURVEY_REPORT } from '../types';
const SAFETY_INSTRUCTIONS_COUNT = 10;

// Shared with the individual Wizards: identical legacy-data restoration.
export function restoreDailySafetyReport(initialData: DailySafetyReportData): DailySafetyReportData {
      const restored = structuredClone(initialData);
      const si = restored.safetyInstructions || [];
      // 【修正】10個に合わせてリストア
      restored.safetyInstructions = Array.from(
        { length: SAFETY_INSTRUCTIONS_COUNT },
        (_, i) => si[i] || ''
      );
      if (!restored.actualWorkers) restored.actualWorkers = [];
      if (!restored.step3AdditionalWorkEntries) restored.step3AdditionalWorkEntries = [];
      if (!restored.step3MachineryEntries || !Array.isArray(restored.step3MachineryEntries)) restored.step3MachineryEntries = [];
      if (!restored.step3MaterialEntries || !Array.isArray(restored.step3MaterialEntries)) restored.step3MaterialEntries = [];
      /* 【修正】基本確認事項: 10項目対応のフォールバック（item8〜item10を補完） */
      if (!restored.step3ConfirmationItems) {
        restored.step3ConfirmationItems = { item1: '', item2: '', item3: '', item4: '', item5: '', item6: '', item7: '', item8: '', item9: '', item10: '' };
      } else {
        if (!('item8' in restored.step3ConfirmationItems)) (restored.step3ConfirmationItems as any).item8 = '';
        if (!('item9' in restored.step3ConfirmationItems)) (restored.step3ConfirmationItems as any).item9 = '';
        if (!('item10' in restored.step3ConfirmationItems)) (restored.step3ConfirmationItems as any).item10 = '';
      }
      /* 【修正】当現場確認事項: 10項目対応のフォールバック（item8〜item10を補完） */
      if (!restored.step3SiteConfirmationItems) {
        restored.step3SiteConfirmationItems = { item1: '', item2: '', item3: '', item4: '', item5: '', item6: '', item7: '', item8: '', item9: '', item10: '' };
      } else {
        if (!('item8' in restored.step3SiteConfirmationItems)) (restored.step3SiteConfirmationItems as any).item8 = '';
        if (!('item9' in restored.step3SiteConfirmationItems)) (restored.step3SiteConfirmationItems as any).item9 = '';
        if (!('item10' in restored.step3SiteConfirmationItems)) (restored.step3SiteConfirmationItems as any).item10 = '';
      }
      if (!restored.stageConfirmation) restored.stageConfirmation = '';
      if (!restored.witnessConfirmation) restored.witnessConfirmation = '';
      if (!restored.machineryEntries || !Array.isArray(restored.machineryEntries)) restored.machineryEntries = [''];
      if (restored.participantsPrimeCount === undefined) restored.participantsPrimeCount = 0;
      if (restored.participantsSubCompanyCount === undefined) restored.participantsSubCompanyCount = 0;
      if (restored.participantsSubWorkerCount === undefined) restored.participantsSubWorkerCount = 0;
      if (!restored.dumpTrucks) restored.dumpTrucks = { incoming: 0, outgoing: 0 };
      if (!restored.patrolRecord) {
        restored.patrolRecord = {
          coordinationNotes: '',
          inspector: '',
          inspectionTime: '14:00',
          findings: '',
        };
      }
      /* STEP5: step5InspectionChecklistのフォールバック */
      if (!restored.step5InspectionChecklist) {
        restored.step5InspectionChecklist = INITIAL_DAILY_SAFETY_REPORT.step5InspectionChecklist;
      }
      /* 【修正1】既存データの workEntries に machine2 がない場合のフォールバック */
      if (restored.workEntries) {
        restored.workEntries = restored.workEntries.map((entry: any) => ({
          ...entry,
          machine2: entry.machine2 ?? '',
        }));
      }
      return restored;
}

export const sanitizeReportData = (data: any, useNewDefaults = !data): NewcomerSurveyReportData => {
  let base = INITIAL_NEWCOMER_SURVEY_REPORT;

  if (useNewDefaults) {
    base = {
      ...base,
      experienceYears: null as any,
      experienceMonths: null as any,
      healthCheckYear: null as any,
      healthCheckMonth: null as any,
      healthCheckDay: null as any,
      pledgeDateYear: null as any,
      pledgeDateMonth: null as any,
      pledgeDateDay: null as any,
      project: "",
      director: "",
      company: ""
    };

    // 当日日付の自動設定
    const today = new Date();
    const reiwaYear = today.getFullYear() - 2018;
    base.pledgeDateYear = reiwaYear;
    base.pledgeDateMonth = today.getMonth() + 1;
    base.pledgeDateDay = today.getDate();
  }

  if (data) {
    const safeQualifications = { ...INITIAL_NEWCOMER_SURVEY_REPORT.qualifications, ...(data.qualifications || {}) };
    base = { ...base, ...data, qualifications: safeQualifications };
  }

  return base;
};
