<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/17T1NzjZZ7wXz5fTDypiXZ1qUllXCxD3v

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## 帳票一括ダウンロード

ホームの「帳票一括ダウンロード」から、現場・開始日・終了日・帳票種別を指定し、「対象件数を確認」→「PDF一括保存」を押します。安全衛生日誌、新規入場者アンケート、安全訓練、災害防止協議会に対応します。

- HTTPS上の対応Chrome/Edgeでは、File System Access APIの`showDirectoryPicker({ mode: 'readwrite' })`でフォルダを1回選択します。現場名／帳票種別の下へ1帳票1PDFを逐次保存します。
- 非対応環境では、同じ階層のZIPを1回ダウンロードします。「ZIPでダウンロード」も選べます。
- ファイル名は`YYYY-MM-DD_帳票種別_氏名.pdf`（氏名はアンケートのみ）。Windowsの禁則文字・予約名・長さを処理し、既存ファイルや同名帳票には連番を付け、上書きしません。
- 日誌は`workDate`→`meetingDate`、アンケートは誓約日（`pledgeDateYear`は令和年）、その他は`date`で期間を判定します。帳票の日付がない旧データは最終保存日の端末ローカル日付を使います。
- 1件の生成・保存エラーで全件を中止しません。結果と失敗帳票を表示し、失敗・未処理だけ再試行できます。対象確認後に変更・削除された帳票は再確認を促します。

### 帳票描画と既存機能

既存の`DailySafetyPrintLayout`、`NewcomerSurveyPrintLayout`、`PrintLayout`、`DisasterCouncilPrintLayout`を直接利用します。旧データの復元を`reportRestore.ts`へ共通化し、変更前の処理との一致を回帰テストします。個別プレビューの「PDF保存」と一括保存は同じ`generateReportPdf`を呼びます。既存の「印刷」、入力、Firestoreへの保存処理は維持します。

既存出力がブラウザの印刷だったため、一括出力は了承された画像PDF方式です。日本語の細かいセルの文字切れを避けるため、html2canvasのブラウザ描画（foreignObject）を使用し、ページごとにjsPDFへ格納します。文字の選択・検索はできず、ブラウザ印刷のPDFとの完全一致は保証しません。安全管理計画表はWizard内の別レイアウトを使うため、今回の対象から外しています。

### データ取得とメモリ

既存のFirebase Web SDK・`db`を使用し、Admin SDKや権限を迂回するAPIは追加しません。現場を指定したクエリで25件ずつ取得し、一覧にはID・種別・日付・氏名・更新日時だけを保持します。一括機能は`getDocsFromServer`／`getDocFromServer`でサーバーから取得し、オフラインの古いキャッシュで権限確認を省略しません。生成時に1件ずつ再取得して、取得拒否・変更・削除を検出します。リポジトリにはAuthenticationの実装やSecurity Rulesの定義がないため、デプロイ済みRulesの現場・ユーザー別の権限保証はFirebase側で確認が必要です。この変更でRulesを緩和することはありません。

PDFごとに生成→保存→canvas・iframe・画像URLの解放を行います。ZIPは利用可能ならOPFSへ逐次書き込み、利用できなければZIPバイトのみをメモリに保持し、256MBを上限にします。ZIP結果を画面で保持している間は手動ダウンロードが可能です。結果を破棄した後にダウンロード猶予を置いて一時ファイルを削除します。ブラウザの強制終了時には一時ファイルがサイトデータに残る場合があります。

### 検証

```sh
npm ci
npm test
npm run typecheck
npm run build
```

既存のlint設定はありません。Node 24のテストランナーを使います。Firestoreのページ取得・権限エラー・更新検出はSDKスタブ、フォルダ保存はDirectoryHandleスタブで検証します。

`npm run dev`の後、`/Core-Safe/tests/browser.html`では本番データへの読み書きなしで架空データの画面検証ができます。ケース1・2は実際のPDF生成、ケース3は300件の処理と1件の生成失敗を模擬します。フォルダ保存先はメモリ内のスタブで、ZIPは実ファイルです。「実PDF4帳票を検証」では署名・電子印・画像を含む全4帳票のPDFを生成します。検証ページは本番ビルドには含まれません。
