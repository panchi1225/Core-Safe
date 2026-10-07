// Development-only fixture page. No live Firestore reads/writes or personal data.
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import BulkReportDownload from '../src/components/BulkReportDownload';
import { generateReportPdf, reportLayout } from '../src/services/reportPdf';
import { downloadBlob, zipDestination, type DirectoryHandle } from '../src/services/pdfDestination';
import { exportItem, type ExportConditions, type ExportItem } from '../src/utils/bulkReports';
import { INITIAL_DAILY_SAFETY_REPORT, INITIAL_NEWCOMER_SURVEY_REPORT, INITIAL_REPORT, INITIAL_DISASTER_COUNCIL_REPORT, INITIAL_MASTER_DATA, type SavedDraft } from '../src/types';
const svg = (text: string) => 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" fill="white"/><path d="M15 85 L50 20 L80 85 L140 30 L215 85" stroke="red" stroke-width="4" fill="none"/><text x="15" y="110" font-size="16">${text}</text></svg>`)));
const project = 'PDF検証用の架空現場';
const diary = { ...structuredClone(INITIAL_DAILY_SAFETY_REPORT), project, workDate: '2026-10-01', meetingDate: '2026-09-30', meetingConductor: '検証担当', sealImage: svg('電子印'),
  annotatedDiagramUrl: svg('配置図'), workEntries: [{ id: '1', workContent: '掘削・仮設作業', company: '架空建設', plannedWorkers: 5, machine2: '' }],
  actualWorkers: [{ entryIndex: 0, count: 4 }], safetyInstructions: ['重機との接触防止'], patrolRecord: { coordinationNotes: '安全確認', inspector: '検証担当', inspectionTime: '14:00', findings: '異常なし' } };
const newcomer = { ...structuredClone(INITIAL_NEWCOMER_SURVEY_REPORT), project, pledgeDateYear: 8, pledgeDateMonth: 10, pledgeDateDay: 1,
  nameSei: '試験', nameMei: '太郎', furiganaSei: 'シケン', furiganaMei: 'タロウ', company: '架空建設', director: '検証担当', signatureDataUrl: svg('署名'),
  qualifications: { ...INITIAL_NEWCOMER_SURVEY_REPORT.qualifications, slinging: true, license_regular: true } };

function Harness() {
  const [scenario, setScenario] = useState('case2');
  const [mode, setMode] = useState('folder');
  const [message, setMessage] = useState('');
  const [output, setOutput] = useState<Blob | null>(null);
  const [written, setWritten] = useState(0);
  const [generated, setGenerated] = useState(0);
  const [pickerCalls, setPickerCalls] = useState(0);
  const writeAttempts = useRef(0);
  const didFail = useRef(false);
  const fakeDirectory: DirectoryHandle = {
    async getDirectoryHandle() { return fakeDirectory; },
    async getFileHandle(_name, options) {
      if (!options?.create) throw new DOMException('missing', 'NotFoundError');
      return { async createWritable() { return { async write() {
        if (++writeAttempts.current === 50 && mode === 'fatal') throw new DOMException('検証用ディスク容量不足', 'QuotaExceededError');
        setWritten(n => n + 1);
      }, async close() {}, async abort() {} }; } };
    },
  };
  const testWindow = window as unknown as { showDirectoryPicker?: () => Promise<DirectoryHandle> };
  testWindow.showDirectoryPicker = mode === 'zip' ? undefined : mode === 'cancel'
    ? () => Promise.reject(new DOMException('cancelled', 'AbortError')) : () => { setPickerCalls(n => n + 1); return Promise.resolve(fakeDirectory); };
  const records: SavedDraft[] = scenario === 'empty' ? [] : scenario === 'case3'
    ? Array.from({ length: 300 }, (_, i) => ({ id: `d${i}`, type: 'DAILY_SAFETY', data: diary, lastModified: 100 }))
    : [...Array.from({ length: 31 }, (_, i) => ({ id: `d${i}`, type: 'DAILY_SAFETY' as const, data: { ...diary, workDate: `2026-10-${String(i + 1).padStart(2, '0')}` }, lastModified: 100 })),
      ...(scenario === 'case2' ? Array.from({ length: 18 }, (_, i) => ({ id: `s${i}`, type: 'NEWCOMER_SURVEY' as const, data: { ...newcomer, pledgeDateDay: i + 1 }, lastModified: 100 })) : [])];
  const source = {
    async getMasterData() { return { ...INITIAL_MASTER_DATA, projects: [project] }; },
    async fetchExportItems(conditions: ExportConditions) { return records.map(draft => exportItem(draft, conditions)).filter(item => item !== null); },
    async fetchExportDraft(item: { id: string }) { return records.find(draft => draft.id === item.id)!; },
    async generatePdf(item: ExportItem) {
      setGenerated(n => n + 1);
      if (scenario !== 'case3') return generateReportPdf(item.type, records.find(draft => draft.id === item.id)!.data);
      await new Promise(resolve => setTimeout(resolve, 5));
      if (scenario === 'case3' && item.id === 'd100' && !didFail.current) { didFail.current = true; throw new Error('テスト用の1件失敗'); }
      return new Blob(['%PDF-1.7 fixture for batch mechanics']);
    },
  };
  const samples = async () => {
    setOutput(null); setMessage('実際のPDFを生成しています…');
    const sink = await zipDestination();
    try {
      for (const [type, data] of [
        ['DAILY_SAFETY', diary], ['NEWCOMER_SURVEY', newcomer],
        ['SAFETY_TRAINING', { ...structuredClone(INITIAL_REPORT), project, date: '2026-10-01', photoUrl: svg('写真'), signatures: [{ company: '架空建設', name: '試験太郎', signatureDataUrl: svg('署名') }] }],
        ['DISASTER_COUNCIL', { ...structuredClone(INITIAL_DISASTER_COUNCIL_REPORT), project, date: '2026-10-01', reviewerSealImage: svg('電子印') }],
      ] as const) {
        setMessage(`${type}の実PDFを生成しています…`);
        const pdf = await generateReportPdf(type, data);
        await sink.save({ id: type, type, project, date: '2026-10-01', name: '', lastModified: 100 }, pdf);
      }
      setOutput(await sink.finish()); setMessage('実PDF生成成功：4帳票。署名・電子印・画像あり。');
    } catch (error) { setMessage(`実PDF生成失敗：${error instanceof Error ? error.message : error}`); }
    finally { await sink.dispose(); setTimeout(() => { void sink.release(); }, 60000); }
  };
  return <><div className="p-3 bg-yellow-100 space-x-3">
    <span>架空データ・本番接続なし</span>
    <label>検証ケース <select aria-label="検証ケース" value={scenario} onChange={e => { setScenario(e.target.value); setWritten(0); setGenerated(0); setPickerCalls(0); writeAttempts.current = 0; didFail.current = false; }}><option value="case1">ケース1：日誌31件</option><option value="case2">ケース2：31＋18件</option><option value="case3">ケース3：300件中1件失敗</option><option value="empty">0件</option></select></label>
    <label>検証保存先 <select aria-label="検証保存先" value={mode} onChange={e => { setMode(e.target.value); setWritten(0); setGenerated(0); setPickerCalls(0); writeAttempts.current = 0; }}><option value="folder">メモリ内のフォルダ</option><option value="zip">実ZIP</option><option value="cancel">フォルダ選択キャンセル</option><option value="fatal">50件目の保存先致命エラー</option></select></label>
    <span>書込み完了 {written}件 ／ 生成 {generated}件 ／ フォルダ選択 {pickerCalls}回</span>
    <button className="border p-2" onClick={() => void samples()}>実PDF4帳票を検証</button>
    {output && <button className="border p-2" onClick={() => downloadBlob(output, 'Core-Safe-test-pdfs.zip')}>検証PDF ZIPを保存</button>}
    <p role="status">{message}</p>
  </div><BulkReportDownload key={scenario + mode} source={source} onBack={() => {}} />
  <div className="bg-gray-200 p-6"><h2>既存の個別帳票レイアウト（比較用）</h2>{reportLayout('DAILY_SAFETY', diary)}{reportLayout('NEWCOMER_SURVEY', newcomer)}</div></>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
