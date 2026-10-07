import React, { useEffect, useRef, useState } from 'react';
import { fetchExportDraft, fetchExportItems, getMasterData } from '../services/firebaseService';
import { conditionError, EXPORT_TYPES, reportLabel, runBatch, safePath, type ExportConditions, type ExportItem, type BatchResult } from '../utils/bulkReports';
import { downloadBlob, preparePdfDestination, type ExportMode, type PdfDestination } from '../services/pdfDestination';

const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const defaultSource = {
  fetchExportDraft, fetchExportItems, getMasterData,
  async generatePdf(item: ExportItem, data: any) {
    const { generateReportPdf } = await import('../services/reportPdf');
    return generateReportPdf(item.type, data);
  },
};

export default function BulkReportDownload({ onBack, source = defaultSource }: { onBack: () => void; source?: typeof defaultSource }) {
  const [conditions, setConditions] = useState<ExportConditions>(() => {
    const now = new Date();
    return { project: '', start: localDate(new Date(now.getFullYear(), now.getMonth(), 1)), end: localDate(now),
      types: ['DAILY_SAFETY', 'NEWCOMER_SURVEY'] };
  });
  const [projects, setProjects] = useState<string[]>([]);
  const [masterError, setMasterError] = useState('');
  const [items, setItems] = useState<ExportItem[] | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<BatchResult | null>(null);
  const [retryItems, setRetryItems] = useState<ExportItem[]>([]);
  const [retryMode, setRetryMode] = useState<ExportMode>('auto');
  const [archive, setArchive] = useState<{ blob: Blob; name: string } | null>(null);
  const cancel = useRef(false);
  const running = useRef(false);
  const scanController = useRef<AbortController | null>(null);
  const batchController = useRef<AbortController | null>(null);
  const initialLoad = useRef<AbortController | null>(null);
  const releaseArchive = useRef<(() => Promise<void>) | null>(null);
  const clearArchive = () => {
    const release = releaseArchive.current;
    releaseArchive.current = null;
    // Let any active browser download consume its File before deleting OPFS.
    if (release) setTimeout(() => { void release(); }, 60000);
    setArchive(null);
  };

  const loadProjects = async () => {
    initialLoad.current?.abort();
    const controller = new AbortController(); initialLoad.current = controller;
    setMasterError('');
    try { const master = await source.getMasterData(); if (!controller.signal.aborted) setProjects(master.projects); }
    catch { if (!controller.signal.aborted) setMasterError('現場一覧を取得できませんでした。'); }
  };
  useEffect(() => {
    void loadProjects();
    return () => {
      initialLoad.current?.abort(); scanController.current?.abort(); batchController.current?.abort(); cancel.current = true;
      const release = releaseArchive.current;
      if (release) setTimeout(() => { void release(); }, 60000);
    };
  }, []);
  useEffect(() => {
    if (!busy) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [busy]);

  const change = (patch: Partial<ExportConditions>) => {
    scanController.current?.abort();
    setConditions(previous => ({ ...previous, ...patch }));
    setItems(null); setResult(null); setRetryItems([]); clearArchive(); setStatus(''); setError('');
  };
  const inspect = async () => {
    const invalid = conditionError(conditions);
    if (invalid) { setError(invalid); return; }
    scanController.current?.abort();
    const controller = new AbortController(); scanController.current = controller;
    setScanning(true); setItems(null); setError(''); setStatus(''); setResult(null); setRetryItems([]); clearArchive();
    try {
      const found = await source.fetchExportItems(conditions, controller.signal);
      if (!controller.signal.aborted) {
        setItems(found);
        if (!found.length) setStatus('対象となる帳票がありません。');
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? `対象帳票の取得に失敗しました。${e.message}` : '対象帳票の取得に失敗しました。');
    } finally { if (scanController.current === controller) setScanning(false); }
  };

  const save = async (targets: ExportItem[], mode: ExportMode = 'auto') => {
    if (running.current) return;
    if (!targets.length) { setStatus('対象となる帳票がありません。'); return; }
    running.current = true; cancel.current = false;
    const controller = new AbortController(); batchController.current = controller;
    setBusy(true); setError(''); setStatus('保存先を準備しています。');
    setProgress({ done: 0, total: targets.length });
    let destination: PdfDestination | undefined;
    let finished: BatchResult | undefined;
    try {
      // Preserve transient activation: showDirectoryPicker is invoked before
      // the first await, dynamic import, or Firestore request.
      destination = await preparePdfDestination(mode);
      controller.signal.throwIfAborted();
      setRetryMode(destination.mode);
      // A cancelled folder picker leaves the previous result/retry list intact.
      setResult(null); clearArchive();
      finished = await runBatch(targets, async item => {
        controller.signal.throwIfAborted();
        let draft;
        try { draft = await source.fetchExportDraft(item, conditions, controller.signal); }
        catch (error) {
          if (['permission-denied', 'unauthenticated'].includes((error as { code?: string }).code || '')) {
            controller.abort(); cancel.current = true;
          }
          throw error;
        }
        controller.signal.throwIfAborted();
        const pdf = await source.generatePdf(item, draft.data);
        controller.signal.throwIfAborted();
        await destination!.save(item, pdf);
      }, (count, total, item) => {
        setProgress({ done: count, total });
        setStatus(`${total}件中 ${Math.min(count + 1, total)}件を${destination!.mode === 'folder' ? '保存' : 'PDF化'}中：${reportLabel(item.type)} ${item.date}`);
      }, () => cancel.current);
      if (controller.signal.aborted) {
        setResult(finished); setRetryItems([]);
        setStatus('認証状態または社員権限が変更されたため、処理を中止しました。');
        return;
      }
      setStatus(destination.mode === 'zip' ? 'ZIPを仕上げています。' : '保存結果を確認しています。');
      const blob = await destination.finish();
      if (blob) {
        const name = `${safePath(conditions.project)}_${conditions.start}_${conditions.end}_帳票.zip`;
        releaseArchive.current = () => destination!.release();
        setArchive({ blob, name }); downloadBlob(blob, name);
      }
      setResult(finished);
      setRetryItems([...finished.failures.map(failure => failure.item), ...finished.unprocessed]);
      if (finished.destinationError) setError(finished.destinationError);
      setStatus(finished.destinationError ? `保存先エラーにより停止しました。${finished.unprocessed.length}件が未保存です。`
        : finished.cancelled ? '処理を中止しました。完了したPDFは保存されています。'
        : destination.mode === 'folder' ? `${finished.succeeded}件のPDFを保存しました。`
          : finished.succeeded ? `${finished.succeeded}件のPDFを含むZIPのダウンロードを開始しました。` : '保存できたPDFはありません。');
    } catch (e) {
      if (controller.signal.aborted) return;
      if (!destination && (e as { name?: string }).name === 'AbortError') {
        setStatus('フォルダ選択をキャンセルしました。'); return;
      }
      const message = e instanceof Error ? e.message : '保存処理に失敗しました。';
      setError(message);
      if (destination?.mode === 'zip') {
        const failures = finished?.failures || [];
        const failedIds = new Set(failures.map(f => f.item.id));
        // An OPFS/ZIP finalization failure invalidates the whole archive; do not
        // claim earlier entries are saved. Every other item is still unsaved.
        setResult({ succeeded: 0, cancelled: false, failures,
          unprocessed: targets.filter(item => !failedIds.has(item.id)), destinationError: message });
        setRetryItems(targets);
        setStatus('ZIPを完成できなかったため、PDFは保存されていません。保存先を確認して再試行してください。');
      } else if (finished) {
        setResult(finished); setRetryItems([...finished.failures.map(f => f.item), ...finished.unprocessed]);
      } else { setStatus('保存処理を開始できませんでした。'); }
    } finally {
      await destination?.dispose().catch(() => {});
      running.current = false; setBusy(false);
    }
  };

  const locked = busy || scanning;
  return <div className="no-print min-h-screen bg-gray-50 pb-12">
    <header className="bg-slate-800 text-white px-4 py-4 flex items-center justify-between">
      <h1 className="font-bold text-lg">帳票一括ダウンロード</h1>
      <button disabled={busy} onClick={onBack} className="font-bold disabled:opacity-50">ホームに戻る</button>
    </header>
    <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-5">
      <p className="text-gray-600">現場・期間・帳票種別を指定し、保存対象の件数を確認してください。</p>
      <section className="bg-white rounded-xl shadow-md p-6 space-y-5">
        <fieldset disabled={locked} className="space-y-5">
          <div><label htmlFor="bulk-project" className="block font-bold mb-2">現場</label>
            <select id="bulk-project" value={conditions.project} onChange={e => change({ project: e.target.value })} className="w-full p-3 border rounded-lg bg-white">
              <option value="">選択してください</option>
              {projects.map(project => <option key={project}>{project}</option>)}
            </select>
            {masterError && <p role="alert" className="text-red-600 mt-2">{masterError} <button onClick={() => void loadProjects()} className="underline">再読み込み</button></p>}
          </div>
          <div><p className="font-bold mb-2">対象期間</p><div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="bulk-start" className="block text-sm mb-1">開始日</label><input id="bulk-start" type="date" value={conditions.start} onChange={e => change({ start: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
            <div><label htmlFor="bulk-end" className="block text-sm mb-1">終了日</label><input id="bulk-end" type="date" value={conditions.end} onChange={e => change({ end: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
          </div><p className="text-xs text-gray-500 mt-2">日誌：作業日 ／ アンケート：誓約日 ／ その他：開催日。日付がない旧データは最終保存日を使用します。</p></div>
          <fieldset><legend className="font-bold mb-2">帳票種別</legend>
            <div className="flex gap-4 text-sm text-blue-700 mb-3"><button onClick={() => change({ types: EXPORT_TYPES.map(entry => entry.type) })}>すべて選択</button><button onClick={() => change({ types: [] })}>すべて解除</button></div>
            <div className="grid sm:grid-cols-2 gap-3">{EXPORT_TYPES.map(entry => <label key={entry.type} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer">
              <input type="checkbox" checked={conditions.types.includes(entry.type)} onChange={e => change({ types: e.target.checked ? [...conditions.types, entry.type] : conditions.types.filter(type => type !== entry.type) })} className="w-5 h-5" />{entry.label}
            </label>)}</div>
          </fieldset>
          <button onClick={() => void inspect()} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold">対象件数を確認</button>
        </fieldset>
        {scanning && <p role="status">対象帳票を確認しています…</p>}
      </section>
      {items !== null && <section className="bg-white rounded-xl shadow-md p-6 space-y-4">
        <h2 className="font-bold text-lg">保存対象</h2>
        <dl className="space-y-2">{EXPORT_TYPES.filter(entry => conditions.types.includes(entry.type)).map(entry => <div className="flex justify-between" key={entry.type}><dt>{entry.label}</dt><dd>{items.filter(item => item.type === entry.type).length}件</dd></div>)}</dl>
        <p className="border-t pt-3 text-right font-bold text-lg">合計 {items.length}件</p>
        <button disabled={locked || !items.length} onClick={() => void save(items)} className="w-full py-3 bg-green-600 text-white rounded-lg font-bold disabled:bg-gray-400">PDF一括保存</button>
        <button disabled={locked || !items.length} onClick={() => void save(items, 'zip')} className="w-full py-2 text-blue-700 border rounded-lg disabled:opacity-50">ZIPでダウンロード</button>
        <p className="text-sm text-gray-500">対応するChrome/Edgeではフォルダを1回選択します。非対応環境ではZIPを1回ダウンロードします。現場名／帳票種別のフォルダへ保存し、同名ファイルには連番を付けます。</p>
        <p className="text-xs text-gray-500">既存の帳票レイアウトを画像PDFとして保存します。文字の選択・検索はできません。従来の印刷も引き続き利用できます。</p>
      </section>}
      {error && <p role="alert" className="bg-red-50 text-red-700 p-4 rounded-lg break-words">{error}</p>}
      {status && <p role="status" aria-live="polite" className="font-bold text-slate-700 break-words">{status}</p>}
      {busy && <div className="space-y-3"><progress value={progress.done} max={progress.total || 1} aria-label="PDF一括保存の進捗" className="w-full h-4" /><p>{progress.total}件中 {progress.done}件完了</p><button onClick={() => { cancel.current = true; }} className="px-4 py-2 bg-gray-200 rounded-lg">現在の帳票が完了したら中止</button></div>}
      {result && <section className="bg-white rounded-xl shadow-md p-6 space-y-3">
        <h2 className="font-bold text-lg">処理結果</h2><p>{result.succeeded}件 {archive ? 'ZIP収録成功' : '保存成功'} ／ {result.failures.length}件 保存失敗</p>
        {!!result.unprocessed.length && <p>{result.unprocessed.length}件 未保存・未処理{result.destinationError ? '（保存先エラーにより停止）' : ''}</p>}
        {!!result.failures.length && <ul className="max-h-64 overflow-auto space-y-2">{result.failures.map(({ item, message }) => <li key={item.id} className="text-sm text-red-700 break-words">{item.date} {reportLabel(item.type)} {item.name}（ID: {item.id}）：{message}</li>)}</ul>}
        {!!retryItems.length && <button disabled={locked} onClick={() => void save(retryItems, retryMode)} className="px-4 py-3 bg-blue-600 text-white rounded-lg font-bold">失敗・未処理の{retryItems.length}件を再試行</button>}
        {archive && <button onClick={() => downloadBlob(archive.blob, archive.name)} className="px-4 py-3 border rounded-lg text-blue-700">作成したZIPをダウンロード</button>}
      </section>}
    </main>
  </div>;
}
