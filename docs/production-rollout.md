# PR #34 本番導入・切戻し手順（すべて未実行）

2026-10-08作成。PR #34を最終統合候補とする。実装基準は`7f06e65b229c608c36d60551c70de059ee6ed858`。今回行うのは文書化・ローカル検証・PR本文・CIの更新だけ。本書の本番コマンドは**将来、別途承認を得た管理者が実行する例**であり、今回は実行していない。本番コンソールやAPIにも接続していない。

## 1. コードから確認した構成

| 項目 | 値と根拠 |
| --- | --- |
| Firebase projectId | `core-safe`：`src/firebase.ts` |
| Auth domain | `core-safe.firebaseapp.com`：同上 |
| フロント公開URL | `https://panchi1225.github.io/Core-Safe/`：package.jsonのhomepage、vite.config.tsのbase |
| Pages pathname | `/Core-Safe/`：vite.config.ts。末尾スラッシュ付きURLを運用する |
| Functions region | `asia-northeast1`：FunctionsのoptionsとWebのgetFunctionsが一致 |
| Functions本番CORS | `https://panchi1225.github.io`：パスを含まないorigin。CORSは認証やRulesの代替ではない |
| Functionsランタイム | Node 22：firebase.jsonとfunctions/package.json |
| 配布 | `npm run deploy` → `gh-pages -d dist`。predeployでVite build。Firebase Hostingではない |
| 開発Emulator | DEVかつVITE_USE_FIREBASE_EMULATORS=trueのときのみdemo-core-safe、Firestore18080/Auth19099/Functions15001、127.0.0.1 |

これは設定値の確認であり、本番プロジェクトの存在・有効プロバイダ・現在のデプロイ状態を確認したものではない。production buildはDEV=falseなので、demo設定を使う安全なステージングビルドにはならない。別Firebaseのステージングには、別途Web設定・CORSの明示的な構成変更とレビューが必要。

## 2. 本番投入を保留する条件

以下が一つでも未解決ならメンテナンス開始・本番投入を保留する。

- 現行Rulesの保存とレビュー、既存データ構造・index・コレクション名の衝突、データ復旧方法が未確認。
- 社員UID・Email/Password・許可対象・公開する会社名/氏名と生年月日照合による個人情報返却の運用承認が未確定。INITIAL_MASTER_DATAの現場/所長/作業所/会社/場所候補は空配列へ整理し、一般テンプレートだけを配布する。過去Git履歴や既配布の旧JSからの削除は別途判断・更新が必要。
- Functions実行サービスアカウント、Secret参照、必要API・課金・予算・公開Callableの呼出権限が未確認。
- [依存監査](dependency-audit.md)の残存警告について、互換性を確認した更新または到達範囲に基づく担当者の明示的なリスク受容がない。
- Pagesの公開元がgh-pages/rootであること、ロールバック担当者、メンテナンス時間、最終確認に使う実端末・社員・現場が未確認。

現行コードの機能テスト成功だけを、本番設定の完了として扱わない。App Checkは初回導入の必須条件にはしない。

## 3. 事前準備（承認後に管理者が行う）

1. Firebase Consoleで対象が`core-safe`であることを確認。現在公開中のFirestore Rules全文・反映日時・利用DBを保存する。暗号化した管理者用保存先へ退避し、復元ファイルと担当者を記録する。現行Pages配布のgh-pagesコミット、mainコミット、既存Functionsのソース/設定/region/ランタイム/実行SA/Secretバージョンも記録する。個人情報のバックアップをリポジトリに置かない。
2. `drafts`のdata.project、`publicNewcomerSubmissions`のproject、社員の生年月日形式、masterData、diagramImages、日付・タイムスタンプ・単一フィールドindexを確認する。新規名称staffUsers/publicNewcomerForms/監査/カウンタが既存利用されていたら内容をレビューする。今回はデータ移行・メタデータbackfill・index追加を前提にしない。
3. AuthenticationのEmail/Passwordを有効にし、管理者が社員アカウントを発行する。利用者本人へ別の安全な経路で初期資格情報を渡す。公開サインアップUIはないが、UIがないことだけで第三者アカウントを排除できるわけではない。staffUsersが社員許可を決める。
4. 各社員の正確なAuth UIDを取得し、許可台帳を用意する。`staffUsers/{uid}`の`active`は文字列ではなくboolean。**現在のRulesがクライアントからstaffUsersを書けないと確認できない限り、この段階でactive=trueを登録しない。** 本書では新Rulesの反映後に管理者が登録する。部署名やメールだけでUIDを推定しない。
5. Authenticationのauthorized domainsにホスト名`panchi1225.github.io`が適切に登録されているか確認する（origin文字列や/Core-Safe/ではない）。Auth domainはcore-safe.firebaseapp.comのまま。不要なドメインを広げない。
6. Functions v2の課金プラン、Cloud Functions/Cloud Run/Cloud Build/Artifact Registry/Secret Manager/Firestore等の必要サービス、組織ポリシー、asia-northeast1、実行SAとビルド/デプロイ主体を管理者が確認する。必要なものだけ有効にする。管理者と実行SAを区別し、Owner/Editorを実行SAに推奨しない。
7. 下記の方法でSecretを準備する。既存Secretがある場合は勝手に上書き・ローテーションせず、利用関数とバージョンを確認する。
8. **PR #34の最新SHAのPR CI全成功 → 承認されたPR #34のみmainへmerge → main push CI開始 → そのmain SHAのCI全成功を確認 → SHAと実行URLを記録 → 初めてPages deploy**の順序を守る。main CIが失敗・未開始・実行中・キャンセル・未確認の場合はPages deployを禁止する。main更新とPages公開は別操作で、CIに自動deployは含まれない。ローカルをclean installし、Functions/フロントを事前buildして切替時間を短くする。

### CIのイベントと比較範囲

`.github/workflows/access-tests.yml`はmain宛ての`pull_request`、mainへの`push`、`workflow_dispatch`で同じ検証を実行する。checkoutは`fetch-depth: 0`、権限は`contents: read`のみ。フロントNode 24、Functions Node 22、Java 21を維持し、本番Firebase操作やPages deploy、Secret操作は行わない。Rules/Functionsの通信先はテスト用`demo-core-safe` Emulatorだけ。

差分検証は`.github/scripts/check-diff.mjs`がイベントファイルから安全にSHAを取得し、シェルへ補間せず`git diff --check`を実行する。

- PR：`pull_request.base.sha`からcheckout済み`HEAD`（通常はPRの検証用merge commit）まで。
- main push：`before`から`github.sha`まで。複数コミットを含むpush全体を検証する。旧tipが取得済み履歴にない場合は、そのSHAだけをoriginから取得する。取得できなければ比較不能としてCIを失敗させ、狭い範囲の成功に置き換えない。ブランチ新規作成のゼロSHAだけは対象コミットの第一親、root commitなら空treeとの比較にする。
- 手動実行：checkout済み`HEAD`の第一親から`HEAD`まで。merge commitも第一親を使用し、root commitは空treeと比較する。過去の全履歴を対象にしない。

比較範囲の回帰テストもCIで実行する。手動実行は補助検証であり、上記のmain push CI成功条件を置き換えない。この変更時点ではmain merge・main pushの実動作・手動イベント実行は未実施で、PR CIとローカルのイベント別テストで検証する。

### Secret生成・設定例：実行禁止（将来の管理者用）

仕様は暗号学的乱数32バイトを64桁hexへ変換した`EMPLOYEE_AUTOFILL_KEY`。本番値をGit、GitHub Actionsログ、フロントJS、Firestore、.env、.secret.localへ保存しない。生成や登録をCIで実行しない。以下は承認済みの管理者PCで、リポジトリroot・依存導入済み・Firebase CLI認証済みの場合のPowerShell例。実際の値をコマンド引数や画面へ出力せず、子プロセスの標準入力だけへ渡す。PowerShellの文字列パイプでhexを直接渡すと改行が混入するため、Node内のBuffer入力を使う。

```powershell
# 本番用。今回は実行しない。新規Secretの場合だけ、登録先を確認して実行。
@'
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const bytes = randomBytes(32);
const hex = Buffer.from(bytes.toString('hex'), 'ascii');
bytes.fill(0);
try {
  const child = spawnSync(process.execPath, [
    resolve('node_modules/firebase-tools/lib/bin/firebase.js'),
    'functions:secrets:set', 'EMPLOYEE_AUTOFILL_KEY',
    '--project', 'core-safe', '--data-file', '-', '--non-interactive'
  ], { input: hex, stdio: ['pipe', 'inherit', 'inherit'] });
  if (child.error) throw child.error;
  process.exitCode = child.status ?? 1;
} finally { hex.fill(0); }
'@ | node --input-type=commonjs
```

`--non-interactive`により既存Secretの関連関数再deploy/旧バージョン削除の対話を避ける。既存Secretへの実行でも新バージョンは作られるため、無断で再実行しない。登録後はSecretの名前・バージョン・IAMだけ確認し、値をログへ取得しない。新Secretバージョンを利用するには対象関数の再deployが必要。旧バージョンは切戻し期間中に破棄しない。[Firebase Secret管理](https://firebase.google.com/docs/functions/config-env)

### 実行サービスアカウントの権限

コードは`serviceAccount`を明示していない。v2は通常Compute Engineの既定SAを使用するが、実際の本番の設定・既存継承は未確認。共有SAの権限を無断で削ると他処理へ影響する。専用SAに変更する場合は両関数のoptionsへ`serviceAccount`を指定する別途レビューが必要で、本作業では行っていない。[実行SA指定](https://firebase.google.com/docs/functions/manage-functions)

Admin SDKはFirestore Rulesを迂回しIAMを使用する。この実装に必要な候補は`datastore.entities.get/list/create/update`（社員・公開設定の読取、レートカウンタの作成/更新）と`datastore.databases.get`（トランザクション）。SDKのDBメタデータ取得で必要なら`datastore.databases.getMetadata`も追加する。カスタムロールを対象DBで実検証し、不要なdelete/index管理/DB管理を含めない。既定`roles/datastore.user`は削除等も含むため「最小権限」と扱わない。IAMはコレクション別のSecurity Rulesを代用しない。[Firestore IAM権限表](https://docs.cloud.google.com/firestore/native/docs/security/iam)

Secret参照は対象Secretだけへの`roles/secretmanager.secretAccessor`に限定する。実行SAにSecret作成・全Secret管理権限は不要。Secret登録・デプロイ主体の権限、Cloud Build用SA、Googleのサービスエージェントの権限は別に管理する。[Secret Managerアクセス制御](https://docs.cloud.google.com/secret-manager/docs/access-control)

公開Callableはこの2サービスだけが未ログインから呼べる必要がある。Cloud Runのinvoker/組織ポリシーを確認する。公開呼出しを可能にすることは、FirestoreやSecretの匿名読取を許可することではない。**本番IAMを確認して限定できない場合はdeployを保留する。**

## 4. 推奨切替：メンテナンス中にRulesを先に保護

フロント先行は、新画面の認証表示だけで旧Rulesの保護不足が残る。さらに旧Rulesが開放的ならstaffUsersの自己許可やpublicNewcomerFormsの偽造も起こり得る。したがって、事前buildの後に短いメンテナンスを設け、**新Rules → 許可UID → Functions → Pages → QR**の順で切り替える。旧フロントが一時的にpermission-deniedになる停止時間を受け入れ、保護を未完成のまま公開しない。

1. 作業時間・旧QRの停止・社員画面の一時停止を告知。古いタブを閉じてもらい、バックアップと切戻し担当を確認する。告知だけでは古いクライアントのアクセスを技術的に止められない。
2. 新Rulesを対象プロジェクトへ限定deployする（次のコードブロック）。新クエリ/リスナーは最大約1分、既存リスナーは最大約10分の反映遅延があり得る。成功ログだけで完了とせず、伝播を待ち匿名/未許可の社内読取・staffUsers書込み・公開設定一覧が拒否されることを確認する。[Rules反映時間](https://firebase.google.com/docs/firestore/security/get-started)
3. 管理者が台帳の正しいUIDに`staffUsers/{uid}: {active: true}`を登録する。クライアントからの登録は禁止。既存未知UIDを無条件に有効化しない。取消はactive=false、必要に応じAuthアカウント無効化・トークン取消も管理者が行う。
4. Node 22で下記2Functionsだけdeployする。既存Rulesが新コレクションを確実に保護すると別途確認できた場合だけ事前deployを検討できるが、この調査では確認できていないので先行を推奨しない。
5. Functionsのregion・ランタイム・実行SA・Secret参照・invokerを確認する。無効/不正tokenが拒否されることをCallable形式で確認する。GETでURLが開くことやCORSの成功だけを正常動作としない。まだ公開有効QRを配布しない。
6. 下記手順で、記録済みmain SHAのmain push CI全成功を再確認したうえで、そのSHAのbuild済みフロントだけをGitHub Pagesへdeploy。main CI失敗時は公開しない。gh-pagesへのpushとPages公開完了は別時点。Pagesのdeployment完了を待ち、/Core-Safe/で新しいハッシュのJSを読み込むことを確認する。キャッシュした旧タブは閉じ、再読込する。
7. 社員ログイン・通常入力/保存/編集・新旧回答一覧・個別PDF・一括PDFを確認。未許可Authアカウントと匿名が社内データを直接取得できないことも確認する。
8. 社員画面から現場ごとの期限付きtoken QRを新規発行する。URLは`https://panchi1225.github.io/Core-Safe/?form=newcomer&token=<新規発行token>`。発行監査、会社名候補と氏名公開の承認、現場・所長・期限を確認する。旧tokenなしQRとURL直書きproject/director方式は再利用しない。掲示物・共有リンクを交換し、旧QRは再発行案内になることを確認する。
9. 実スマートフォンでログインなしQR → 本人照合/手入力 → 署名 → 提出 → 社員一覧 → 一括PDFを確認。誤生年月日・無効token・期限切れも拒否されることを確認する。Functionsは生年月日という推測可能情報で照合するため、強い本人認証として運用しない。
10. 本番Windows Chromeで少数実データのフォルダ/重複回避/ZIPを確認。段階的に件数を増やし、監視・エラー・通信量・費用を確認する。権限取消バッチ・実OSエラー・Edge/iOS/Androidの検証結果を別途記録する。
11. 機能・拒否系・キャッシュ更新・掲示物交換が完了してからメンテナンス解除する。障害時は解除せず切戻し判断へ進む。

### Rules deploy例（未実行）

```powershell
# 承認後、承認済みmainのrootで実行。Hostingや他サービスをdeployしない。
npx firebase deploy --only firestore:rules --project core-safe
```

firebase.jsonが参照する`firestore.rules`を反映する。index deploy、データ移行は含めない。本番のDB構成と対象が(default)で適切か事前確認する。[Firebase CLI](https://firebase.google.com/docs/cli)

### Functions deploy例（未実行）

```powershell
# Node 22、承認済みmain、Secret/IAM/新Rulesの準備完了後のみ。
npm --prefix functions ci --ignore-scripts
npm run build:functions
npx firebase deploy --only functions:listPublicEmployeeCandidates,functions:verifyEmployeeAutofill --project core-safe
```

regionはCLI引数で上書きせず、functions/src/index.tsの`asia-northeast1`を利用する。firebase.jsonのpredeployでもFunctions buildを実行する。`firebase deploy`だけ、`--only functions`だけ、`--force`は使わない。削除や他関数変更を提示されたら停止して確認する。[Functions導入](https://firebase.google.com/docs/functions/get-started)

## 5. main → clean install → build → GitHub Pages（未実行）

承認済みPR #34の最新PR CI全成功を確認してから、将来の管理者が実施する。現在の最終候補はDraftのまま。本書作成時点ではmergeしない。merge後のmain push CI全成功を確認し、そのmain SHAを記録するまではPages deployを禁止する。

```powershell
# 将来のmerge。PR #34の最新SHA・全CI成功・main差分を確認してから行う。
gh pr ready 34 --repo panchi1225/Core-Safe
gh pr merge 34 --merge --repo panchi1225/Core-Safe
git switch main
git pull --ff-only origin main
git status --short
git rev-parse HEAD
# 変更が表示されたら止める。reset/cleanで消さない。
$approvedMainSha = git rev-parse HEAD
# mergeにより自動開始した、そのmain SHAのpush CIを選ぶ。
$mainCiRuns = @(gh run list --repo panchi1225/Core-Safe --workflow access-tests.yml --branch main --event push --commit $approvedMainSha --limit 1 --json databaseId,headSha,event | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0 -or $mainCiRuns.Count -ne 1) { throw 'main push CIが未確認です。Pages deployは禁止。' }
gh run watch $mainCiRuns[0].databaseId --repo panchi1225/Core-Safe --exit-status
if ($LASTEXITCODE -ne 0) { throw 'main CIが成功していません。Pages deployは禁止。' }
$mainCi = gh run view $mainCiRuns[0].databaseId --repo panchi1225/Core-Safe --json status,conclusion,headSha,event,url | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $mainCi.status -ne 'completed' -or $mainCi.conclusion -ne 'success' -or $mainCi.event -ne 'push' -or $mainCi.headSha -ne $approvedMainSha) { throw 'main SHAとCI成功が一致しません。Pages deployは禁止。' }
# approvedMainShaとmainCi.urlを管理者の記録に残す。
# フロントの検証条件はNode 24。
npm ci --ignore-scripts
npm --prefix functions ci --ignore-scripts
npm test
npm run typecheck
npm run build
# distの /Core-Safe/ の資産参照を確認し、承認済みSHAを記録。
# メンテナンス中、Rules/Functions確認後だけ実行。
if ((git rev-parse HEAD) -ne $approvedMainSha -or (git status --porcelain)) { throw '検証済みSHAから変更されています。Pages deployは禁止。' }
npm run deploy
```

`npm run deploy`のpredeployが再buildし、そのdistを`gh-pages`ブランチへ公開する。GitHub設定のPages sourceがgh-pagesのrootであること、deploy権限・公開のdeployment結果を確認する。別ブランチ・mainのソースディレクトリをそのまま配布しない。Firebase Hosting deployは不要。[gh-pagesの配布方式](https://github.com/tschaub/gh-pages)

## 6. Rules再監査結果（リポジトリだけを確認）

| 対象 | 判定 |
| --- | --- |
| drafts/employees/masterData/diagramImages | 認証かつstaffUsers.active==trueでのみread/write。未認証・未許可Authを拒否 |
| staffUsers | 認証済み本人の単一getだけ。本人が未許可でも許可確認のgetは可能。list/client writeは全員禁止 |
| publicNewcomerForms | 匿名はUUID v4の指定token、有効かつサーバー時刻で期限内のgetのみ。匿名list禁止。社員管理は監査ドキュメントと同時発行、project/director変更は禁止 |
| publicNewcomerFormAudit | 社員のみ読取/発行時create。UIDは匿名公開設定へ置かない。update/delete禁止 |
| publicNewcomerSubmissions | 公開createは有効token/固定現場・所長/会社整合/許可フィールド/型・上限/server timestampで検証。匿名read/list/update/delete禁止。社員は閲覧・編集・削除可 |
| employeeAutofillRateLimits / employeeAutofillMappings | 認証社員を含めクライアントread/write全禁止 |
| その他 | catch-allでread/write禁止 |

demo project名やテストUIDによる許可例外はRulesにない。テストのRules無効化はfixture投入用の管理操作だけで、アプリや本番Rulesには含まれない。Rulesは自己申告の真実性、署名画像の実体、全日付の暦としての正しさまで保証しない。会社名候補の公開可否は発行社員の運用責任。

一括PDFはFirebase Web SDKで両ソースをserver readし、Rulesを適用する。Admin SDKによる一括取得APIは追加していない。権限取消・ログアウト時の中断を維持。ただし開始済みの生成/通信や1ファイル保存が即時に中断する保証ではない。Functionsの限定的なAdmin読取は別経路で、有効token/生年月日/不透明ID/返却項目限定/レート制限を確認する。

Functionsのレート制限は氏名一覧と生年月日照合に適用する。Firestoreへの公開回答createには同じ制限を適用していないため、有効tokenを持つ第三者による多数投稿は防ぎ切れない。QRの配布範囲・期限・無効化、提出件数/費用の監視を運用に含める。App Checkを後日導入しても回答者の本人性や投稿回数を自動的に保証するものではない。

## 7. 切戻し

1. メンテナンスを維持し、新QRを無効化する。問題がある社員はstaffUsers.active=falseとAuth無効化を必要に応じ実施。提出済み回答を削除せず退避・保持する。
2. フロントは、記録した安全な配布コミットのソースを別のclean checkoutでbuildし、同じgh-pagesへ再deployする。force pushで履歴を消さない。旧版がAuth非対応なら新Rulesで社内機能は動かないため、旧画面へ戻しただけで復旧完了とはしない。安全に直せる新Auth対応版への修正を優先する。
3. Rulesは保存した旧Rulesと新データ構成をレビューし、必要な安全な版を一時設定ファイルで限定deployする。**保存済みだからという理由で匿名読取可能な旧Rulesへ戻さない。** 旧Rulesが安全でない、または互換性がないなら、社内/公開とも閉じたメンテナンスを続け修正する。反映遅延と古いリスナーも再確認する。
4. Functionsは保存した旧ソース・ランタイム・SA・Secret参照でこの2つだけ再deployする。新規関数を停止する必要がある場合だけ、関数名とregionを確認し`npx firebase functions:delete listPublicEmployeeCandidates verifyEmployeeAutofill --region asia-northeast1 --project core-safe`を管理者判断で実行する。これは破壊的操作なので通常deployに混ぜない。手入力フォームの可否もRules/フロントと合わせて判断する。
5. Secretは旧バージョンを保持し、旧Functionsが参照するバージョンを確認する。安易に再生成しない。鍵変更で既発行の15分有効IDとレートIDが変わり、氏名一覧の再取得が必要になる。Secretの旧版参照/再登録が必要なら値をCLIログへ取得せず管理者のSecret運用手順で行う。
6. Authenticationは他の利用状況を確認してから戻す。社員アカウントを一括削除しない。staffUsersの取消とAuth無効化を対象UIDだけに行い、プロバイダの無効化は他アプリへの影響を確認する。アカウント削除・再作成でUIDが変わるため台帳と許可が不一致になり得る。
7. 交換済みのtoken QRは旧フロントで解釈できない。旧QRへ単純に戻すと固定現場/所長の保護が失われる可能性がある。QRを停止・掲示差替えし、token対応版と安全なRulesがそろうまで再開しない。旧QRの互換入口を追加して迂回しない。

旧Rulesを保存した管理者専用ディレクトリで、Firebase CLI用の一時firebase.jsonを用意する例（未実行）：

```json
{"firestore":{"rules":"saved-reviewed-firestore.rules"}}
```

```powershell
# saved-reviewed-firestore.rulesが安全・互換と判断された場合だけ。
npx firebase deploy --only firestore:rules --project core-safe --config rollback.firebase.json
```

## 8. PR #32 / #33 とApp Check

PR #32の`50c3f5cdcc287a0f1ac6b3d6494f5334a3c73574`、PR #33の`58e39499a11d5a92969cf5dc2e43ed1876f57ac1`はどちらもPR #34の祖先。merge-base --is-ancestorで確認した。競合解消後の機能は[統合記録](integration-access-bulk-pdf.md)と実機/自動テストで確認した。PR #34を採用するなら#32/#33の個別main mergeは不要。

PR #34のmerge成功とmainに機能が残ることを確認した後だけ、以下で元PRをcloseする。今回は実行しない。

```powershell
gh pr close 32 --repo panchi1225/Core-Safe --comment "PR #34で統合済み。個別mergeは不要です。"
gh pr close 33 --repo panchi1225/Core-Safe --comment "PR #34で統合済み。個別mergeは不要です。"
```

App Checkは初回は未導入・非強制。後日、管理者がWebアプリとGitHub PagesドメインをreCAPTCHA Enterprise等に登録 → 同じFirebase appにWeb SDKを初期化 → 本物の社員/匿名QR/モバイルとFunctionsの指標を監視 → false rejectionや非対応端末の扱いを確認 → 対象FunctionsのenforceAppCheckとFirestore強制を段階的に導入する。debug tokenを本番JSに置かない。Auth/Rules/生年月日照合を置き換えない。[Web導入](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)、[Functions強制](https://firebase.google.com/docs/app-check/cloud-functions)

## 9. 人間が完了させる最終チェックリスト

- [ ] 最新PR SHAの全CI成功を確認してからmergeし、main push CI全成功を確認。そのmain SHAとCI実行URL、main差分、Pagesの現行/切戻しSHAを記録。失敗・未確認ならPages deploy禁止。
- [ ] 現行Rulesを保存してレビュー。既存構造・index・新名称の衝突と安全な復旧を確認。
- [ ] Email/Password、authorized domain、社員UID台帳と登録対象を確認。
- [ ] 公開氏名/会社候補/本人照合後の返却情報・生年月日照合の限界を運用承認。
- [ ] runtime SA/IAM/Secretバージョン/課金/API/region/予算/監視を確認。共有SAへの影響を確認。
- [ ] 残存依存警告を更新または到達範囲のリスクとして明示的に受容。
- [ ] メンテナンスを開始し、新Rules伝播と匿名/未許可の拒否を確認してからUID許可・Functions・Pagesを反映。
- [ ] 新社員画面、旧新アンケート、個別/一括PDF、Functions正常/拒否/制限/手入力を確認。
- [ ] 期限付きQR発行・旧QR交換・無効化/期限切れ拒否、実スマートフォン署名と送信を確認。
- [ ] 本番Windows実保存/ZIP、段階的大量件数、権限取消、Edge/iOS/Android等の残る確認を記録。
- [ ] 機能と拒否系を確認してメンテナンス解除。PR #34採用後のみ#32/#33を統合済みclose。

今回、このチェックリストの本番項目は未実施である。
