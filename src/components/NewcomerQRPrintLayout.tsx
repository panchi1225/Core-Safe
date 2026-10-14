import React, { forwardRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import '../styles/newcomerQrPrint.css';

// Applied only to this QR's react-to-print iframe, never to other reports.
export const NEWCOMER_QR_PAGE_STYLE = `
  @page { size: A4 portrait; margin: 0; }
  @media print {
    html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
    .no-print { display: none !important; }
  }
`;

interface Props {
  project: string;
  director: string;
  url: string;
}

const NewcomerQRPrintLayout = forwardRef<HTMLElement, Props>(({ project, director, url }, ref) => (
  <section ref={ref} className="newcomer-qr-sheet" aria-label="新規入場者アンケートQR印刷帳票">
    <header className="newcomer-qr-sheet__header">
      <h1>新規入場者アンケート</h1>
      <p>Web入力フォーム</p>
    </header>

    <div className="newcomer-qr-sheet__details">
      <div className="newcomer-qr-sheet__field">
        <p className="newcomer-qr-sheet__label">工事名</p>
        <p className={`newcomer-qr-sheet__project${project.length > 60 ? ' newcomer-qr-sheet__project--long' : ''}`}>{project}</p>
      </div>
      <div className="newcomer-qr-sheet__field">
        <p className="newcomer-qr-sheet__label">作業所長</p>
        <p className="newcomer-qr-sheet__director">{director}</p>
      </div>
    </div>

    <div className="newcomer-qr-sheet__entry">
      <div className="newcomer-qr-sheet__qr-frame">
        <QRCodeCanvas value={url} size={1024} level="H" includeMargin
          style={{ width: '90mm', height: 'auto', maxWidth: '100%', aspectRatio: '1 / 1' }} />
      </div>
      <p className="newcomer-qr-sheet__instruction">スマートフォンで読み取ってください</p>
      <p className="newcomer-qr-sheet__notes">※iPhone/Android対応<br />※アプリのインストールは不要です</p>
    </div>

    <footer className="newcomer-qr-sheet__footer">
      <p>Core Safe -安全書類作成支援システム-</p>
      <p className="newcomer-qr-sheet__company">松浦建設株式会社</p>
    </footer>
  </section>
));

NewcomerQRPrintLayout.displayName = 'NewcomerQRPrintLayout';
export default NewcomerQRPrintLayout;
