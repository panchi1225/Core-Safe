import { Zip, ZipPassThrough } from 'fflate';
import { fileName, reportLabel, safePath, PdfDestinationError, type ExportItem } from '../utils/bulkReports';
import { cleanupStaleZipFiles, acquireZipLease } from './zipTempFiles';

export interface DirectoryHandle {
  getDirectoryHandle(name: string, options?: { create: boolean }): Promise<DirectoryHandle>;
  getFileHandle(name: string, options?: { create: boolean }): Promise<{
    createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void>; abort(): Promise<void> }>;
  }>;
}
export interface PdfDestination {
  mode: 'folder' | 'zip';
  save(item: ExportItem, pdf: Blob): Promise<void>;
  finish(): Promise<Blob | null>;
  dispose(): Promise<void>;
  release(): Promise<void>;
}
export type ExportMode = 'auto' | PdfDestination['mode'];

// Called without preceding awaits to preserve the folder picker's activation.
// A retry requests the actual mode of its previous destination, including a
// ZIP chosen automatically by fallback. Explicit folder retries never switch.
export async function preparePdfDestination(mode: ExportMode): Promise<PdfDestination> {
  if (mode !== 'zip') {
    try {
      const pending = pickPdfDirectory();
      if (pending) return folderDestination(await pending);
      if (mode === 'folder') throw new Error('フォルダ保存に対応したChrome/Edgeで再試行してください。');
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (mode === 'folder' || (name !== 'SecurityError' && name !== 'NotSupportedError')) throw error;
    }
  }
  return zipDestination();
}

function destinationError(error: unknown): PdfDestinationError {
  return error instanceof PdfDestinationError ? error : new PdfDestinationError(
    `保存先を利用できません。${error instanceof Error ? error.message : '書き込みに失敗しました。'}`, error);
}

// Called directly from the click handler BEFORE loading modules/fetching data.
export function pickPdfDirectory(): Promise<DirectoryHandle> | null {
  const picker = (window as unknown as { showDirectoryPicker?: (options: { mode: string }) => Promise<DirectoryHandle> }).showDirectoryPicker;
  return window.isSecureContext && picker ? picker.call(window, { mode: 'readwrite' }) : null;
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  // Allow the browser to finish consuming large downloads before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function folderDestination(root: DirectoryHandle): PdfDestination {
  const nextSuffix = new Map<string, number>();
  return {
    mode: 'folder',
    async save(item, pdf) {
      try {
        const project = await root.getDirectoryHandle(safePath(item.project), { create: true });
        const category = await project.getDirectoryHandle(reportLabel(item.type), { create: true });
        const base = fileName(item).slice(0, -4);
        const key = `${safePath(item.project)}/${item.type}/${base}`.toLowerCase();
        let suffix = nextSuffix.get(key) || 1;
        let name = `${base}${suffix === 1 ? '' : '_' + suffix}.pdf`;
        // Never truncate an existing PDF, including files from earlier runs.
        for (;;) {
          try { await category.getFileHandle(name); }
          catch (error) {
            if ((error as { name?: string }).name === 'NotFoundError') break;
            if ((error as { name?: string }).name !== 'TypeMismatchError') throw error;
          }
          suffix++;
          name = `${base}_${suffix}.pdf`;
        }
        const handle = await category.getFileHandle(name, { create: true });
        const stream = await handle.createWritable();
        try { await stream.write(pdf); await stream.close(); nextSuffix.set(key, suffix + 1); }
        catch (error) { await stream.abort().catch(() => {}); throw error; }
      } catch (error) { throw destinationError(error); }
    },
    async finish() { return null; },
    async dispose() {},
    async release() {},
  };
}

const MAX_MEMORY_ZIP = 256 * 1024 * 1024;

// ZIP chunks are spooled to a temporary browser-private file when OPFS is
// available. Otherwise keep only ZIP bytes, with a bound to prevent exhaustion.
// Each PDF's raw buffer is released after its entry has been written.
export async function zipDestination(): Promise<PdfDestination> {
  let tempRoot: FileSystemDirectoryHandle | undefined;
  let tempFile: FileSystemFileHandle | undefined;
  let stream: FileSystemWritableFileStream | undefined;
  let releaseLease: (() => Promise<void>) | undefined;
  const tempName = `core-safe-${crypto.randomUUID()}.zip`;
  try {
    // Without Web Locks we use the bounded memory fallback: a cross-tab-safe
    // lifecycle for private ZIP files cannot otherwise be guaranteed.
    if (navigator.storage?.getDirectory && navigator.locks) {
      tempRoot = await navigator.storage.getDirectory();
      await cleanupStaleZipFiles(tempRoot);
      releaseLease = await acquireZipLease(tempName);
      tempFile = await tempRoot.getFileHandle(tempName, { create: true });
      stream = await tempFile.createWritable();
    }
  } catch {
    if (tempRoot) await tempRoot.removeEntry(tempName).catch(() => {});
    await releaseLease?.(); releaseLease = undefined;
    tempRoot = undefined; tempFile = undefined; stream = undefined;
  }
  const chunks: Blob[] = [];
  const paths = new Set<string>();
  let queued: Promise<void> = Promise.resolve();
  let fault: Error | undefined;
  let bytes = 0;
  let entries = 0;
  let finalized = false;
  const zip = new Zip((error, data) => {
    if (error) { fault = error; return; }
    if (fault) return;
    bytes += data.length;
    if (!stream && bytes > MAX_MEMORY_ZIP) {
      fault = new Error('ZIPが256MBを超えました。期間を短くするか、Chrome/Edgeのフォルダ保存を使用してください。');
      return;
    }
    // Copy away from fflate's entry buffer; queued writes are drained per PDF.
    const chunk = new Blob([new Uint8Array(data)]);
    if (stream) queued = queued.then(() => stream!.write(chunk)).catch(error => { fault = error; });
    else chunks.push(chunk);
  });
  const cleanup = async () => {
    chunks.length = 0;
    if (tempRoot) await tempRoot.removeEntry(tempName).catch(() => {});
    await releaseLease?.(); releaseLease = undefined;
  };
  return {
    mode: 'zip',
    async save(item, pdf) {
      if (fault) throw destinationError(fault);
      // Preflight memory fallback before adding any entry; earlier PDFs remain
      // downloadable even if this report exceeds the remaining memory budget.
      if (!stream && bytes + pdf.size + 65536 > MAX_MEMORY_ZIP) throw new PdfDestinationError('ZIPのメモリ上限です。期間を短くして再試行してください。');
      const prefix = `${safePath(item.project)}/${reportLabel(item.type)}/`;
      const base = fileName(item).slice(0, -4);
      let path = `${prefix}${base}.pdf`;
      for (let suffix = 2; paths.has(path.toLowerCase()); suffix++) path = `${prefix}${base}_${suffix}.pdf`;
      const buffer = new Uint8Array(await pdf.arrayBuffer());
      try {
        const entry = new ZipPassThrough(path);
        zip.add(entry);
        entry.push(buffer, true);
        await queued;
        if (fault) throw fault;
        paths.add(path.toLowerCase());
        entries++;
      } catch (error) { throw destinationError(error); }
    },
    async finish() {
      try {
        zip.end(); await queued;
        if (fault) throw fault;
        if (stream) await stream.close();
        if (!entries) { await cleanup(); finalized = true; return null; }
        const blob = tempFile ? await tempFile.getFile() : new Blob(chunks, { type: 'application/zip' });
        finalized = true;
        chunks.length = 0;
        // The returned OPFS File also backs the UI's manual download button.
        // Keep it alive until the UI releases this result; a fixed timeout here
        // would break downloads/retries after a long-running batch finishes.
        return blob;
      } catch (error) { throw destinationError(error); }
    },
    async dispose() {
      zip.terminate();
      if (!finalized) {
        await queued;
        if (stream) await stream.abort().catch(() => {});
        await cleanup();
      }
    },
    async release() { await cleanup(); },
  };
}
