import React, { useRef, useState } from 'react';
import { downloadBlob } from '../services/pdfDestination';
import { fileName, reportDate, type ExportType } from '../utils/bulkReports';

export default function ReportPdfButton({ type, data }: { type: ExportType; data: any }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  const save = async () => {
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    try {
      const { generateReportPdf } = await import('../services/reportPdf');
      const blob = await generateReportPdf(type, data);
      const date = reportDate({ id: '', type, data, lastModified: Date.now() })!;
      downloadBlob(blob, fileName({ id: '', type, project: data.project, date,
        name: type === 'NEWCOMER_SURVEY' ? `${data.nameSei || ''}${data.nameMei || ''}` : '', lastModified: 0 }));
    } catch (e) { setError(e instanceof Error ? e.message : 'PDF生成に失敗しました。'); }
    finally { running.current = false; setBusy(false); }
  };
  return <div><button disabled={busy} onClick={() => void save()} className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold text-sm disabled:opacity-50">{busy ? 'PDF生成中…' : 'PDF保存'}</button>{error && <p role="alert" className="text-sm text-red-300 max-w-xs">{error}</p>}</div>;
}
