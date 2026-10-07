# 社員認証と公開新規入場者QR

この変更はコード・Rules案・ローカル検証のみです。本番FirebaseのAuthentication設定、現在のSecurity Rules、App Check、既存データは確認・変更していません。Rulesファイルが存在するだけでは本番データは保護されません。管理者による設定、Rulesレビュー、反映後の実機検証が必要です。

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

`?form=newcomer&token=...`は社員ゲートを経由しません。指定設定をサーバーから単一getし、既存アンケートの入力・署名・レイアウトを再利用します。公開モードではfetchEmployees・getMasterData・社内名簿による自動入力UI・saveDraftを使いません。[公開用Functions](public-employee-autofill.md)で氏名選択と生年月日の簡易照合に成功した社員1名の必要項目だけを自動入力できます。社内サービスと初期マスタは別モジュールへ分離し、公開画面から読み込みません。初期マスタの値自体と従来のexportは維持しています。静的JSは公開資産なので秘密情報を初期定数に入れないでください。

URLのtokenを消さず、再読み込みでも同じ公開入口を保持します。URLのproject/directorは無視します。アプリからtokenをログ出力せず、HTMLにはno-referrerを指定しています。送信後は再取得せず完了表示します。処理中・完了後の重複クリックを防止し、通信失敗時も同じ送信IDを使います。ページを開き直しての重複回答や有効tokenを所持する第三者による大量送信を防ぐ仕組みではありません。

社員側のQR管理では現場・所長・必須期限を選んでcrypto.randomUUID()により発行します。発行済み一覧、QR表示、画像保存、印刷、無効化を用意しています。マスタ取得成功前は発行できません。無効化・期限切れはRulesのサーバー時刻で判定し、すでに開いたページからの送信も拒否します。

社員側の一覧は旧draftsと新公開送信を統合します。公開データの表示用IDを`public-newcomer/{id}`とし、編集・削除先を識別します。表示とPDFは同じNewcomerSurveyPrintLayoutです。個別編集では公開の自由入力会社も表示・修正できます。社員が既存の現場削除操作を明示的に確認した場合のみ、その現場のQRを無効化し、公開回答を100件ずつ削除してから従来の処理を続けます。発行監査は保持します。このPRの作業中に本番の削除・移行はしていません。

## 本番設定を人が行う手順（未実行）

1. 本番の現行Rules・Firestore設定・既存コレクションを確認し、バックアップとロールバック手順を用意する。staffUsers等の新しい名称が本番にすでに存在する場合は内容を監査し、無条件に上書きしない。
2. ステージングFirebaseでEmail/PasswordプロバイダとWeb設定、authorized domains（GitHub Pagesならpanchi1225.github.io）を確認する。テスト用demo設定を本番ビルドに流用しない。
3. Firebase Consoleで管理者が社員Authアカウントを発行し、その正確なUIDのstaffUsersにactiveを登録する。クライアントの自己登録で社員許可を作らない。Console/IAM管理者を限定する。取消時はstaffUsers.active=falseで即時にデータアクセスを止め、必要に応じAuthアカウントも無効化する。
4. 本Rulesをステージングに反映して本物の社員権限・匿名フォーム・無効化・期限切れを検証する。既存データの読取・保存・削除・4帳票の印刷を確認する。
5. 本番導入は承認後、メンテナンス時間に新フロントとRulesを整合させて反映する。旧画面のまま新Rulesだけ反映すると社員機能と旧QRが利用できなくなる。逆順でもRules反映までサーバーの保護は完了しない。準備した許可UID以外がactiveになっていないことも確認する。
6. 社員ログイン後に現場ごとの期限付きQRを発行し直し、掲示物を交換する。tokenなしの旧QRは再発行依頼画面になり、送信の迂回経路にはならない。

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

ブラウザ検証用には別ターミナルで`npx firebase emulators:start --only auth,firestore --project demo-core-safe`を起動。`FIRESTORE_EMULATOR_HOST=127.0.0.1:18080 node tests/seed-local.mjs`で架空データを用意し、`VITE_USE_FIREBASE_EMULATORS=true npm run dev`を実行します。PowerShellでは`$env:変数名='値'`で指定してください。staff@core-safe.local / Local-test-12345!はローカル専用の架空アカウントです。outsider@core-safe.localは同じパスワードでAuth認証できますが社員許可がありません。本番へ作成しないでください。

CIはpull_requestでテストとビルドだけを実行し、Rulesやアプリをデプロイしません。Node/Javaセットアップは[公式Node Action](https://github.com/actions/setup-node)と[公式Java Action](https://github.com/actions/setup-java)を使用します。

## PR #32との統合

統合専用ブランチでは[統合検証ガイド](integration-access-bulk-pdf.md)のとおり両ソースの一括PDFと権限失効時中断を追加しています。以下はPR #33単体作成時点の導入方針の記録です。元のPR #32と#33のブランチは更新していません。

このブランチはmain（7c9105e）から分岐し、未マージのPR #32を取り込んでいません。画像PDF、html2canvas/jsPDF、フォルダ保存、ZIP、逐次生成のコードは変更していません。

この認証PR側で`REPORT_SOURCES`、`reportLocation()`、`asPublicDraft()`、`getReportFromServer()`を用意しました。認証対応を先に導入し、その後PR #32を最新mainへ合わせます。PR #32側の対象一覧取得はREPORT_SOURCESの両コレクションを社員権限で取得し、現場・日付・帳票種別を判定する必要があります。公開回答はtypeがNEWCOMER_SURVEY、現場フィールドはproject、旧データはdata.projectです。表示IDのprefixを保持し、PDF直前の再取得にgetReportFromServerを使ってください。既存の帳票日付・ファイル名・サニタイズ関数とPDFレンダラーは共用し、新旧双方を対象にするテストと、権限失効・ログアウト時にバッチを中止するテストをPR #32側へ追加します。現状PR #32との統合動作は未検証です。

## 残る確認

本番の現行Rules、Authプロバイダ・UID・authorized domains・index設定・Console/IAM権限・App Check・データ量は未確認です。スマートフォンのカメラから実QRを開く操作、iOS/Safari/Android/Edgeの実端末、実署名、実際の印刷PDF保存、長時間オフライン、PR #32との組合せは本番投入前にステージングで確認してください。Chromeのローカルエミュレータ画面とスマートフォン幅、匿名の社内データ取得ゼロのコンポーネントテストは別の検証です。

依存監査では既存mainにもあるfabric 7.2.0、Firebase 12.9.0配下の@grpc/grpc-js 1.9.15とwebsocket-driver 0.7.4に警告があります。このPRで本番依存のバージョンは変更せず、互換性を評価した更新は別途必要です。ビルドには既存Firebase SDKを含む500KB超チャンクの警告があります。
