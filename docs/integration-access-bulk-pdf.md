# PR #34 最終統合候補と検証記録

> 過去のPR #34時点の記録です。Cloud Functions、Secret Manager、EMPLOYEE_AUTOFILL_KEY、Functions IAM、公開社員氏名一覧・生年月日本人確認は現在未使用・Spark版では廃止しました。旧構成のコマンドや導入条件は適用せず、現行の[Spark導入手順](production-rollout.md)を使用してください。Spark版の新しい実機検証結果として扱わないでください。

`integration/access-control-bulk-pdf` はPR #33の58e39499a11d5a92969cf5dc2e43ed1876f57ac1を土台に、PR #32の50c3f5cdcc287a0f1ac6b3d6494f5334a3c73574を取り込んだPR #34の最終統合候補です。両コミットが祖先であることをGitで再確認しました。元の両ブランチ、main、本番Firebaseは変更せず、統合PRはDraftで維持します。採用時はPR #34のみをmainへ反映し、#32/#33の個別mergeは不要です。

[Windows Chromeの人間による実機確認](windows-chrome-verification.md)、[本番導入・切戻し](production-rollout.md)、[依存監査](dependency-audit.md)を参照してください。

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

最終候補ではローカルとCIともフロントNode 24、Functions Node 22、Java 21を使用します。10月7日の初期ローカル検証だけはFunctions EmulatorにもNode 24を使用していました。

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

### 2026-10-07の結果

npm testは65件、Rulesは36件、Functions単体は20件、Functions実HTTP Emulatorは19件成功。両方のnpm ci、フロント／Functionsのtypecheckとbuild、git diff --checkも成功しました。CIで不足したoptional peer依存を検出したため、node_modulesのない作業ディレクトリでnpm 11.19.0を使ってlockfileを補正し、全ステップの成功を確認しました。

10月7日のCodexブラウザ検証では社員ログイン・4種別計5件・逐次ZIP収録まで確認しました。実ファイル保存等はその時点では確認できず、以下の10月8日の人間による実機確認で補完されました。

ログアウト後の公開QRから架空社員を選び、生年月日19950101のFunctions照合・本人情報の反映、資格入力、画面での架空署名、既存プレビュー、公開createの保存完了まで確認しました。公開プレビューに社員用PDF保存ボタンはありません。権限失効中の停止はコンポーネントとRulesテストで確認し、ブラウザのバッチ途中での失効は未確認です。既存4帳票のすべての通常入力・編集・保存・印刷ダイアログ操作をブラウザで完走した検証ではありません。

### 2026-10-08：人間によるWindows Chrome実機確認

demo-core-safeと架空データだけで、実showDirectoryPicker、Windowsフォルダへの5PDF保存、現場/種別の階層、PDF実ファイルの正常表示、旧新アンケートの同じレイアウトと署名・会社・現場・所長、再保存の連番、ZIPダウンロードと実展開を確認しました。匿名QRから架空社員の生年月日照合・自動入力・署名・送信後、社員一覧でアンケート3件/合計6件として一括PDF対象へ反映される一連動作も確認済みです。[確認者・範囲・配色](windows-chrome-verification.md)に記録しました。

10月8日の最終整理ではnpm test 65件、Rules 36件、Functions単体20件、Functions実HTTP Emulator19件が再度すべて成功しました。両npm ci --ignore-scripts、両typecheck/build、git diff --checkも成功。フロントNode 24.13.0/npm 11.6.2、Functions実行Node 22.23.3、Java 21.0.12.1を使用し、Functions Emulatorのnode@22起動も確認しました。CIと同じNode 24でのFunctions依存導入時はengine警告が出ますが、実行はNode 22です。既存の500KB超チャンク警告は残ります。GitHub Actionsはdeployを行わず、最終文書コミットの結果とリンクをPR本文に記録します。

## 制限と導入順

件数確認の本文転送問題は両コレクションに残ります。メタデータ案に両ソースを追記しましたが、index/migration/backfillは実施しません。

既存アンケートPrintLayoutにはelectricianの専用チェック欄がありません。入力・保存・社員自動入力には残ります。今回レイアウトの変更はせず、既存との差異を増やしていません。資格の印刷項目の改善は別途確認が必要です。

本番Firebase/Auth/Rules/Functions/Secret/IAM/App Check、本番実スマートフォン、iOS Safari/Android Chrome/Edgeの全機能、実運用大量件数、実ディスク容量不足時のOS挙動、本番権限取消中の実バッチは未確認です。実機確認済みの通常保存と、スタブで確認した致命エラー・大量件数を区別します。

導入はPR #34を採用します。事前buildと管理者準備後、メンテナンス中に新Rulesを先に保護し、正しいUIDを許可、2Functions、Pages、期限付きQRの順で反映する[具体的な手順](production-rollout.md)を用意しました。本番設定確認・依存リスク判断・別途承認が必要です。今回merge/deploy/Secret作成/本番データ変更/元PR closeは行いません。
