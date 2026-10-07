import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import DailySafetyPrintLayout from '../components/DailySafetyPrintLayout';
import NewcomerSurveyPrintLayout from '../components/NewcomerSurveyPrintLayout';
import PrintLayout from '../components/PrintLayout';
import DisasterCouncilPrintLayout from '../components/DisasterCouncilPrintLayout';
import { restoreDailySafetyReport, sanitizeReportData } from '../utils/reportRestore';
import type { ExportType } from '../utils/bulkReports';
import pdfStyles from '../styles/pdf.css?inline';

export function reportLayout(type: ExportType, data: any): React.ReactElement {
  switch (type) {
    case 'DAILY_SAFETY': return <DailySafetyPrintLayout data={restoreDailySafetyReport(data)} />;
    case 'NEWCOMER_SURVEY': return <NewcomerSurveyPrintLayout data={sanitizeReportData(data, false)} />;
    case 'SAFETY_TRAINING': return <PrintLayout data={data} />;
    case 'DISASTER_COUNCIL': return <DisasterCouncilPrintLayout data={data} />;
    default: throw new Error('対応していない帳票種別です。');
  }
}

function timed<T>(promise: Promise<T>, message: string, timeout = 20000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeout);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

// Image PDFs are intentionally shared by individual downloads and bulk export.
// Existing print buttons remain browser-native. Rendering lives in an isolated
// document so DailySafetyPrintLayout's @page/body rules cannot affect the UI.
export async function generateReportPdf(type: ExportType, data: any): Promise<Blob> {
  const landscape = type === 'DAILY_SAFETY';
  const width = landscape ? 297 : 210;
  const height = landscape ? 210 : 297;
  const frame = document.createElement('iframe');
  frame.title = 'PDF生成';
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  Object.assign(frame.style, { position: 'fixed', left: '-20000px', top: '0', width: '1200px', height: '1300px', border: '0' });
  // Wait for the initial about:blank navigation before mounting React. Without
  // this, navigation can discard the rendered document and abort image.decode.
  const ready = new Promise<void>(resolve => { frame.onload = () => resolve(); });
  frame.src = 'about:blank';
  document.body.appendChild(frame);
  try { await timed(ready, 'PDF生成画面を準備できませんでした。'); }
  catch (error) { frame.remove(); throw error; }
  const frameDoc = frame.contentDocument!;
  const objectUrls: string[] = [];
  let root: ReturnType<typeof createRoot> | undefined;
  try {
    const css = frameDoc.createElement('style');
    css.textContent = pdfStyles + `
      html, body { margin: 0; background: white; }
      .print-page { width: 210mm; height: 297mm; margin: 0 !important; border: 0 !important; box-shadow: none !important; overflow: hidden; }
    `;
    frameDoc.head.appendChild(css);
    // Match the application's font faces without copying its scripts or UI.
    const fontLoads = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
      .filter(link => link.href.includes('fonts.googleapis.com'))
      .map(link => new Promise<void>((resolve, reject) => {
        const copy = link.cloneNode(true) as HTMLLinkElement;
        copy.onload = () => resolve();
        copy.onerror = () => reject(new Error('帳票のフォントを読み込めませんでした。'));
        frameDoc.head.appendChild(copy);
      }));
    const host = frameDoc.createElement('div');
    host.style.width = `${width}mm`;
    frameDoc.body.appendChild(host);
    root = createRoot(host);
    flushSync(() => root!.render(reportLayout(type, data)));
    await timed(Promise.all(fontLoads), '帳票のフォント読み込みがタイムアウトしました。');
    const images = Array.from(host.querySelectorAll<HTMLImageElement>('img'));
    // Fetch and decode each image explicitly: a missing/CORS-blocked signature
    // must fail this report instead of silently producing an incomplete PDF.
    for (const image of images) {
      if (!image.src.startsWith('data:')) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        try {
          const response = await fetch(image.src, { mode: 'cors', signal: controller.signal });
          if (!response.ok) throw new Error('帳票画像を取得できませんでした。');
          const url = URL.createObjectURL(await response.blob());
          objectUrls.push(url);
          image.src = url;
        } finally { clearTimeout(timer); }
      }
      try { await timed(image.decode(), '帳票画像の読み込みがタイムアウトしました。'); }
      catch { throw new Error(`${image.alt || '署名・電子印'}の画像を読み込めませんでした。`); }
      if (!image.naturalWidth) throw new Error('帳票画像を読み込めませんでした。');
    }
    await timed(frameDoc.fonts.ready, '帳票フォントの読み込みがタイムアウトしました。');
    const pages = Array.from(host.querySelectorAll<HTMLElement>(landscape ? '#print-area-wrapper' : '.print-page'));
    if (!pages.length) throw new Error('印刷レイアウトが見つかりませんでした。');
    const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true });
    for (let index = 0; index < pages.length; index++) {
      const page = pages[index];
      const bounds = page.getBoundingClientRect();
      let canvas: HTMLCanvasElement | undefined;
      try {
        canvas = await html2canvas(page, { scale: 2, backgroundColor: '#ffffff', logging: false,
          // Native foreignObject rendering serializes this page alone. Cancel
          // the document offset so later pages are not cropped to blank space.
          useCORS: true, imageTimeout: 20000, scrollX: 0, scrollY: 0, x: -bounds.left, y: -bounds.top,
          foreignObjectRendering: true });
        if (index) pdf.addPage('a4', landscape ? 'landscape' : 'portrait');
        pdf.addImage(canvas, 'PNG', 0, 0, width, height, undefined, 'FAST');
      } finally { if (canvas) { canvas.width = 0; canvas.height = 0; } }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return pdf.output('blob');
  } finally {
    root?.unmount();
    frame.remove();
    objectUrls.forEach(url => URL.revokeObjectURL(url));
  }
}
