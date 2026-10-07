# PR #32＋PR #33 統合検証

統合専用の `integration/access-control-bulk-pdf` はPR #33の58e39499a11d5a92969cf5dc2e43ed1876f57ac1を土台に、PR #32の50c3f5cdcc287a0f1ac6b3d6494f5334a3c73574を取り込んだ検証用です。元の両ブランチ、main、本番Firebaseは変更しません。統合PRはDraftで維持します。

## 競合と方針

Gitが報告した競合はREADME.md、package.json、package-lock.json、src/App.tsx、src/components/NewcomerSurveyWizard.tsx、src/services/firebaseService.tsの6ファイルです。vite-env.d.tsはGit競合なしです。

- App: PR #33のAccessApp→公開入口／StaffGate→社員Appを保持し、社員Appだけに一括ダウンロードを追加。旧QRのproject/directorを信用する入口は戻しません。
- Wizard: 公開社員自動入力・公開create・会社選択を保持。復元共通処理と個別PDFを追加し、ReportPdfButtonは社員画面だけに表示。
- Firebase service: REPORT_SOURCESと個別編集・削除アダプターを保持し、両ソースの一括検索と生成直前の共通server readを追加。
- package: 両方のテストと依存を残し、最終package.jsonからlockを再生成。Functions側package/lockは変更しません。
- README: 認証・公開QR・Functionsと、一括PDF・フォルダ・ZIP・制限の説明を両方保持。

## 取得と停止

draftsはdata.project、publicNewcomerSubmissionsはprojectで絞り、各ソース独立のdocumentIdカーソルで25件ずつgetDocsFromServerします。期間・4種別の条件とsortは共通です。公開回答はasPublicDraftでpublic-newcomer/<ID>へ変換します。

fetchExportDraftはgetReportFromServerで1件ずつサーバー再取得し、種類・日付・氏名・更新時刻・条件一致を確認します。公開回答の不正なtypeも検出します。旧と公開アンケートは同じNewcomerSurveyPrintLayoutを使用します。PDF生成自体を変更していません。

StaffGateの権限取消・ログアウトでBulkReportDownloadがunmountすると、検索とバッチのAbortControllerを中止します。保存先の準備後、Firestore取得前後、PDF生成後にチェックし、後続の取得・生成へ進みません。permission-denied/unauthenticatedもバッチ全体を中止します。SDKの通信や生成開始済みの処理そのものを中断するものではありません。すでに保存中のフォルダ1ファイルは完了し得ます。

個別帳票の生成失敗は継続、PdfDestinationErrorは停止、ZIP上限・OPFS失敗・再試行方式・上書き回避を維持します。showDirectoryPickerはユーザー操作から最初のawaitより前に呼びます。

## 検証

Node 24、FunctionsはNode 22、Java 21を使用します。

```sh
npm ci --ignore-scripts
npm --prefix functions ci --ignore-scripts
npm test
npm run test:rules
npm run test:functions
npm run typecheck:functions
npm run test:functions:emulator
npm run typecheck
npm run build
npm run build:functions
git diff --check
```

追加テストはintegrationAccess.test.mjs、integrationExport.test.mjs、Rulesの両ソースserver query/権限取消です。両PRの既存テストを削除していません。フロントテストはファイルごとに分離し、各PRのグローバルfixture同士の干渉を避けます。

ローカルブラウザでは既存手順でauth/firestore/functionsのdemo-core-safe Emulator、架空鍵、VITE_USE_FIREBASE_EMULATORS=trueのViteを起動します。tests/seed-local.mjsで社員・QR・旧新アンケートと他3帳票を用意します。fixtureは本番へ使用しません。公開フォームの実提出に使う署名は画面で描画するPNGです。

## 制限と導入順

件数確認の本文転送問題は両コレクションに残ります。メタデータ案に両ソースを追記しましたが、index/migration/backfillは実施しません。

既存アンケートPrintLayoutにはelectricianの専用チェック欄がありません。入力・保存・社員自動入力には残ります。今回レイアウトの変更はせず、既存との差異を増やしていません。資格の印刷項目の改善は別途確認が必要です。

本番Auth/Rules/Functions/鍵/IAM/App Check、実Windowsのpicker・保存先・権限・ディスクエラー、実スマートフォンのQR・署名は未確認です。スタブ成功を実Windows確認として扱いません。

将来PR #33→PR #32の順に導入する場合、まず本番設定と実機をステージングで確認し、別途承認後にPR #33をmainへ入れます。その後PR #32を更新済みmainへ合わせ、この統合ブランチの競合解消・取得アダプター・中断・テストを移植して再CI・実機確認します。この検証PRを自動でマージしたり、PR #32/#33を閉じたりしません。
