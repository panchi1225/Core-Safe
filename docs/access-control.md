# 社員認証と公開新規入場者QR

Spark版の本番構成はGitHub Pages、Firebase Authentication Email/Password、Cloud Firestore、Firestore Security Rulesのみです。無料枠内で運用し、課金変更やBlazeへのアップグレードは不要です。この変更はコード・Rules案・ローカル検証のみです。本番FirebaseのAuthentication設定、現在のSecurity Rules、App Check、既存データは確認・変更していません。Rulesファイルが存在するだけでは本番データは保護されません。管理者による設定、Rulesレビュー、反映後の実機検証が必要です。

## 調査した旧実装

React 19 / TypeScript / Vite / Firebase Web SDKを使用。`firebase.ts`はFirestoreの初期化のみで、AuthenticationとSecurity Rulesの定義はありませんでした。公開モードの`NewcomerSurveyWizard`も`getMasterData()`と`fetchEmployees()`を呼び、社員名簿の全件取得を要求する構造でした。実際に本番側で許可されていたかは未確認です。

旧QRはURLのproject/directorを信用し、URLを消して再読み込みで公開入口を失っていました。送信は社内共通draftsへのsaveDraftでした。MasterSettingsの既存の確認用パスワードはUI上の操作確認であり、アクセス制御には使用していません。

## データと権限

| 保存先 | フィールド / 用途 | 権限 |
| --- | --- | --- |
| staffUsers/{Auth UID} | `{active: true}`。社員アカウントとの対応は管理者が管理 | 認証済み本人の単一getのみ。クライアント書込み・一覧不可 |
| drafts / employees / masterData / diagramImages | 既存形式を維持 | Auth認証済み **かつ** staffUsers.active==trueの社員のみ |
| publicNewcomerForms/{UUID v4} | project, director, active, createdAt, createdBy=`staff`, expiresAt, contractorOptions | 社員が発行・管理。匿名は有効かつ期限内の指定tokenの単一getのみ |
| publicNewcomerFormAudit/{UUID v4} | createdBy=発行社員UID, createdAt | 社員のみ読取。発行時に設定と一括作成。クライアント更新・削除不可 |
| publicNewcomerSubmissions/{自動生成ID} | type=`NEWCOMER_SURVEY`, token, project, director, company, data, createdAt, lastModified | 有効tokenを使ったcreateのみ公開。匿名get/list/update/delete不可。社員は閲覧・編集・削除可 |

公開設定のcreatedByは発行区分だけです。社員UIDは公開しません。現場名・所長名・会社名一覧が公開可能な情報であることを発行社員が確認してください。社員の住所・電話・健康情報・印影等を公開設定へ複製しません。

`data`はアンケート項目だけの明示的な許可リストです。氏名・フリガナ、生年月日、性別、年齢、会社、下請次数、経験、職種、住所・連絡先、緊急連絡先、血液型、健診日、建退共、資格、誓約日、署名とcompanyInputTypeを保存します。継承した写真・訓練情報・管理フィールドは除外します。電気工事士等の資格チェックも既存画面に合わせています。

Rulesはトップレベルと本体のキー、型、数値範囲、文字列長、資格の型、PNG署名500,000文字上限を検証します。会社名は1〜200文字。masterの場合はtokenの候補内に限ります。createdAt/lastModifiedはserverTimestampとrequest.time一致を必須にしています。多数の数値が入力済みのデータと490KB署名でも評価上限に達しない実テストを含みます。

会社候補は発行時のmasterData.contractorsから会社名だけをコピーします（最大300社、1社200文字）。匿名に社内マスタ全体を取得させません。候補にない場合は「その他（手入力）」を表示し、従来どおりcompanyには文字列を保存します。公開時のproject/directorは固定表示で、Rulesでも設定との一致を検証します。

## 画面と保存

通常URL → メール＋パスワードログイン → staffUsersのサーバー確認 → 社員画面。未登録・active=false・確認エラー・キャッシュのみの許可状態では社員画面をマウントしません。権限取消・ログアウトで社員画面とその帳票状態をアンマウントします。サインアップ画面はありません。

公開ソースのINITIAL_MASTER_DATAはprojects/supervisors/workplaces/contractors/locationsを空配列とし、一般的な安全教育・職種・役割等だけを保持します。実マスタは社員権限でmasterData/generalから取得し、保存済み値を優先します。ドキュメント不存在・フィールド未登録は安全な初期値を使用し、自動作成・移行・上書きはしません。未設定時は既存のマスタ管理から登録できます。[初期マスタ整理](default-master-sanitization.md)を参照してください。

`?form=newcomer&token=...`は社員ゲートを経由しません。指定設定をサーバーから単一getし、既存アンケートの入力・署名・レイアウトを再利用します。公開モードではfetchEmployees・getMasterData・社内名簿による自動入力UI・saveDraftを使いません。公開QRの利用者は社員も含め全員手入力します。公開氏名一覧・生年月日本人確認・社員情報返却は現在未使用・Spark版では廃止しました。認証かつstaffUsers.activeの社員画面での従来の社員名選択→自動入力は維持します。社内サービスと初期マスタは別モジュールへ分離し、公開画面から読み込みません。初期マスタのexportと一般テンプレートは維持し、個人・現場・会社固有の初期候補は空配列へ整理しています。静的JSは公開資産なので秘密情報を初期定数に入れないでください。

URLのtokenを消さず、再読み込みでも同じ公開入口を保持します。URLのproject/directorは無視します。アプリからtokenをログ出力せず、HTMLにはno-referrerを指定しています。送信後は再取得せず完了表示します。処理中・完了後の重複クリックを防止し、通信失敗時も同じ送信IDを使います。ページを開き直しての重複回答や有効tokenを所持する第三者による大量送信を防ぐ仕組みではありません。

社員側のQR管理では現場・所長・必須期限を選んでcrypto.randomUUID()により発行します。発行済み一覧、QR表示、画像保存、印刷、無効化を用意しています。マスタ取得成功前は発行できません。無効化・期限切れはRulesのサーバー時刻で判定し、すでに開いたページからの送信も拒否します。

社員側の一覧は旧draftsと新公開送信を統合します。公開データの表示用IDを`public-newcomer/{id}`とし、編集・削除先を識別します。表示とPDFは同じNewcomerSurveyPrintLayoutです。個別編集では公開の自由入力会社も表示・修正できます。社員が既存の現場削除操作を明示的に確認した場合のみ、その現場のQRを無効化し、公開回答を100件ずつ削除してから従来の処理を続けます。発行監査は保持します。このPRの作業中に本番の削除・移行はしていません。

## 本番設定を人が行う手順（未実行）

[Spark版の本番導入・切戻し手順](production-rollout.md)を使用してください。現行Rulesの退避・構造確認、AuthアカウントとUID台帳、事前buildを準備し、メンテナンス中に新Rulesの伝播と拒否を確認してからstaffUsers.active、Pages、期限付きQRの順で切り替えます。Cloud Functions、Secret Manager、Functions IAMは現在未使用・Spark版では廃止し、準備・deploy不要です。今回の本番設定・データ変更は行っていません。

複合indexはこのPRでは不要です。社員限定の一覧はlastModified/createdAtの単一フィールドorderBy、現場削除はprojectへの単一フィールド等価クエリです。本番で単一フィールドindexを無効化している場合は管理者が確認してください。匿名の一覧取得を許可するRulesではありません。

App Checkは未導入・強制適用なしです。後で同じfirebase.tsのappに初期化し、監視後に導入できます。Authenticationが本人確認、Rulesが社員許可とデータ保護、App Checkが不正クライアント軽減を担います。有効QRからのスパム対策にはApp Checkやサーバー側のレート制限を別途検討してください。

## ローカル検証

Node 24、Java 21が必要です。すべてdemo-core-safeで実行し、テストに本番の資格情報は不要です。

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run build
npm run test:rules
git diff --check
```

Rulesテストは起動済みサーバーに勝手に本番接続せず、Firebase CLIが起動したdemo Emulatorで行います。`tests/rules/access.test.mjs`の拒否系だけでなく正常な作成・編集も実行します。プロキシ環境では127.0.0.1/localhostをNO_PROXYへ追加してください。

ブラウザ検証用には別ターミナルで `npx firebase emulators:start --only auth,firestore --project demo-core-safe` を起動します。架空SecretやFunctionsの準備は不要です。`FIRESTORE_EMULATOR_HOST=127.0.0.1:18080 node tests/seed-local.mjs`で架空データを用意し、`VITE_USE_FIREBASE_EMULATORS=true npm run dev`を実行します。PowerShellでは`$env:変数名='値'`で指定してください。staff@core-safe.local / Local-test-12345!はローカル専用の架空アカウントです。outsider@core-safe.localは同じパスワードでAuth認証できますが社員許可がありません。本番へ作成しないでください。

CIはmain宛てのpull_request、mainへのpush、workflow_dispatchでテストとビルドだけを実行し、Rulesやアプリをデプロイしません。権限はcontents: readのみです。最新PR SHAでのCI成功とmerge後のmain SHAでのpush CI全成功を確認し、後者のmain SHAを記録してから、管理者が別操作でPagesを公開します。main CI失敗・未確認時は公開禁止です。イベント別のdiff checkと手順は[本番導入手順](production-rollout.md)を参照してください。Node/Javaセットアップは[公式Node Action](https://github.com/actions/setup-node)と[公式Java Action](https://github.com/actions/setup-java)を使用します。

## PR #34の最終統合候補

PR #34はPR #32/#33のコミットを両方含みます。[統合記録](integration-access-bulk-pdf.md)に競合解消、両ソースserver read、個別PDF共用、権限取消/ログアウト時の中断を記録しています。PR #34採用時は元PRの個別mergeは不要です。元ブランチは変更せず、今回main mergeやcloseは行いません。

## Windows確認と残る確認

2026-10-08に人間がdemo-core-safeと架空データのWindows Chromeで、実フォルダへのPDF保存・目視・重複連番・ZIP展開、旧PR #34の公開QRの生年月日照合/自動入力（現在未使用・Spark版では廃止）と署名/公開提出から社員一覧/一括PDF対象化まで確認しました。[実機記録](windows-chrome-verification.md)を参照してください。

Spark版の本番Authentication/Rules/公開画面/App Checkは今回未検証です。Functions/Secret/IAMは現在未使用・Spark版では廃止しています。本番実スマートフォン、iOS Safari、Android Chrome、Edgeの全機能、実運用大量件数、実ディスク容量不足のOS挙動、本番権限取消中バッチ、全4帳票の通常入力・編集・保存・従来印刷の網羅確認も含めて未確認範囲を区別します。

[依存監査](dependency-audit.md)に現行mainとの比較とブラウザ配布モジュールの確認を記録しました。rootの警告は残ります。旧Functionsの監査は過去記録で、現在未使用・Spark版では廃止しています。互換性未検証のforce更新はしていません。既存の500KB超チャンク警告も残ります。
