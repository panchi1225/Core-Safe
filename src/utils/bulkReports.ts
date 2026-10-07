import type { ReportTypeString, SavedDraft } from '../types';

// Safety plan currently prints a separate, editable Wizard sheet; do not substitute
// the unused SafetyPlanPrintLayout (its design differs from the existing output).
export const EXPORT_TYPES = [
  { type: 'DAILY_SAFETY', label: '安全衛生日誌' },
  { type: 'NEWCOMER_SURVEY', label: '新規入場者アンケート' },
  { type: 'SAFETY_TRAINING', label: '安全訓練' },
  { type: 'DISASTER_COUNCIL', label: '災害防止協議会' },
] as const;
export type ExportType = typeof EXPORT_TYPES[number]['type'];
export interface ExportConditions { project: string; start: string; end: string; types: ExportType[] }
export interface ExportItem { id: string; type: ExportType; project: string; date: string; name: string; lastModified: number }

export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function reportDate(draft: SavedDraft): string | null {
  const data = draft.data || {};
  if (draft.type === 'DAILY_SAFETY') {
    if (validDate(data.workDate)) return data.workDate;
    if (validDate(data.meetingDate)) return data.meetingDate;
  } else if (draft.type === 'NEWCOMER_SURVEY') {
    // The date displayed on this form is the pledge date, stored as Reiwa year.
    if (Number.isInteger(data.pledgeDateYear) && data.pledgeDateYear > 0 && data.pledgeDateYear < 1000) {
      const date = `${2018 + data.pledgeDateYear}-${String(data.pledgeDateMonth).padStart(2, '0')}-${String(data.pledgeDateDay).padStart(2, '0')}`;
      if (validDate(date)) return date;
    }
  } else if (validDate(data.date)) return data.date;
  // Legacy entries without a form date use the existing list's lastModified fallback.
  if (typeof draft.lastModified !== 'number' || !Number.isFinite(draft.lastModified)) return null;
  const date = new Date(draft.lastModified);
  if (isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function conditionError(conditions: ExportConditions): string | null {
  if (!conditions.project) return '現場を選択してください。';
  if (!validDate(conditions.start) || !validDate(conditions.end)) return '開始日と終了日を指定してください。';
  if (conditions.start > conditions.end) return '終了日は開始日以降を指定してください。';
  if (!conditions.types.length) return '帳票種別を選択してください。';
  return null;
}

export function exportItem(draft: SavedDraft, conditions: ExportConditions): ExportItem | null {
  const date = reportDate(draft);
  if (!conditions.types.includes(draft.type as ExportType) || draft.data?.project !== conditions.project ||
      !date || date < conditions.start || date > conditions.end) return null;
  return { id: draft.id, type: draft.type as ExportType, project: conditions.project, date,
    name: draft.type === 'NEWCOMER_SURVEY' ? [draft.data.nameSei, draft.data.nameMei].filter(Boolean).join('') : '',
    lastModified: draft.lastModified };
}

export function safePath(value: string): string {
  let safe = value.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_').replace(/[. ]+$/g, '').trim();
  // Keep a segment well below Windows' 255 UTF-16 code unit limit.
  safe = Array.from(safe).slice(0, 80).join('').replace(/[. ]+$/g, '');
  if (/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(safe)) safe = '_' + safe;
  return safe || '名称未設定';
}

export function reportLabel(type: ReportTypeString): string {
  return EXPORT_TYPES.find(entry => entry.type === type)?.label || type;
}

export function fileName(item: ExportItem): string {
  return `${item.date}_${reportLabel(item.type)}${item.name ? '_' + safePath(item.name) : ''}.pdf`;
}

export interface ExportFailure { item: ExportItem; message: string }
export interface BatchResult { succeeded: number; failures: ExportFailure[]; cancelled: boolean }

// Only one generate+save promise is in flight; no PDF/DOM/canvas collection is retained.
export async function runBatch(items: ExportItem[], process: (item: ExportItem) => Promise<void>,
  progress: (done: number, total: number, item: ExportItem) => void, cancelled: () => boolean = () => false): Promise<BatchResult> {
  const result: BatchResult = { succeeded: 0, failures: [], cancelled: false };
  for (let index = 0; index < items.length; index++) {
    if (cancelled()) { result.cancelled = true; break; }
    const item = items[index];
    progress(index, items.length, item);
    try { await process(item); result.succeeded++; }
    catch (error) { result.failures.push({ item, message: error instanceof Error ? error.message : 'PDF保存に失敗しました。' }); }
    progress(index + 1, items.length, item);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return result;
}
