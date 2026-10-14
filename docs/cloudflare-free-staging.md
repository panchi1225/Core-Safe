# Cloudflare Freeステージング検証（2026-10-14）

## 統合・環境

main `e5c94846c8112a7318ef290e7aaa79d9deac9b98` をPR #36へ統合。PR #38のSTEPリセットと回帰テスト15件、PR #37のQR印刷3ファイルはmainと同一。PR #36はDraft・未merge。本番Firebase/Pages/Rules/Auth/社員・帳票・QRデータ/Billingは未変更。

管理者のOAuth承認後、専用Worker `core-safe-public-autofill-staging`、D1 `core-safe-autofill-staging`（binding `DB`）を作成した。URLは `https://core-safe-public-autofill-staging.paaaaanchi1225.workers.dev`。Workersプラン画面でFree・現在のプラン・月額0ドルを再確認。既存 `lineworks-proxy` のetag・更新日時は作業前後で同一。

実社員データ0件。本番Firebase接続0件。tokenは架空専用 `33333333-3333-4333-8333-333333333333`、CORSは `http://127.0.0.1:5178` のみ。URLだけをブラウザで開いても帳票アプリにはならない。

PAYLOAD_KEY/MATCH_KEY/STAGING_AUTH_KEYは独立した32バイト乱数。Worker Secretに設定し、管理者専用の非GitファイルへWindows DPAPI暗号化して退避。所有者・ACL・暗号化/復号を確認。鍵・認証情報・要求本文はGit/ログ/レポートに保存しない。Workerのログ/トレース永続保存は無効。

## 本番と分離した方式

`worker/staging/build.mjs` がbuild時だけFirestore取得層を架空D1取得層へ置き換え、製品の `worker/src/index.mjs` の同期・暗号化・照合・制限・公開処理を共用する。バンドルに本番Firestore取得層や `firestore.googleapis` が入らないことをbuildで検査する。本番認証コードは変更していない。

staging認証は専用鍵で署名した短期JWTで、署名・issuer・audience・subject・role・期限を検証する。MODE/マーカー/project/nameのガードを持つ。fixture管理APIは署名済みJWTが必要で、既知の架空IDと操作だけを受け付ける。社員のデータ本体は入力できず、コードから架空情報を生成する。電子印/本人署名/管理情報は転記コピーから除外する。

クラウドからローカルEmulatorへ接続しない。本番取得層を使う経路は、別のローカルworkerd/D1 + demo-core-safe Auth/Firestoreで検証した。許可社員ID token、匿名/未許可拒否、匿名employees get/list拒否、保存前無効化、REST保存・削除と自動同期を確認。架空クラウド試験を本番Firebaseへの接続試験とは扱わない。

## 実環境の結果

試験期間は日本時間2026-10-14 22:25:35〜22:28:54、クライアント実行247要求。

| 試験 | 結果 |
| --- | --- |
| 初回31名 | 一要求一社員で同期し、全取得後だけ公開 |
| 候補・全転記 | 氏名/opaque IDだけの31候補。正DOBで全31名の許可転記項目が期待値と一致 |
| 誤DOB・制限 | 個人情報を返さず拒否。5回失敗後、正DOBも429で一時拒否 |
| 24時間超・7日・30日 | 架空の古い同期日時を設定し、共用scheduled掃除処理後も取得成功。期間試験中のsync呼出し0件 |
| 追加・更新 | 無効化→架空source変更→確定通知→同じticket/sync経路で反映。32名へ追加、旧住所を置換 |
| 同期失敗 | source保存後の取得失敗を注入。旧コピーは503で取得不可。例外復旧後だけ再開 |
| 削除 | 対象の候補・転記情報を取得不可。最終31名 |
| QR | 不正/無効/期限切れの架空tokenを拒否 |
| 管理操作 | 未署名fixture操作・外部社員データ入力を拒否 |

クラウドの変更試験はfixture管理APIと製品のticket経路を使用した。Core Safe保存イベントからの自動呼出しと実Firestore REST保存は、アプリ単体テストおよびEmulator結合テストで検証済み。本番Firestore保存を試したものではない。

## 実CPU・D1使用量

Cloudflare GraphQL `workersInvocationsAdaptive` を専用Worker/試験時間帯で照会。正式スキーマのmicroseconds表記を確認してmsへ換算した。ローカル所要時間で代用していない。

| 指標 | Cloudflare実測 |
| --- | ---: |
| CPU P50 / P90 / P99 | 4.381 / 6.251 / 8.207 ms |
| 観測CPU最大 | 8.625 ms |
| Worker errors | 0 |
| 集計要求 / sampleInterval | 248 / 1.0376569 |
| D1集計読取 / 書込 | 3,054 / 1,625行 |
| DB容量 | 188,416 bytes（184 KiB） |
| アカウント直近24時間 | 256要求、errors 0 |

各D1レスポンスのmeta合計は読取2,512行・書込1,542行・1,692クエリ。Analyticsは適応サンプリングと観測窓/計上方法の差があり、一致を要求しない。より大きいCloudflare集計も報告し、拒否/失敗時のクエリと架空source取得層も対象に含む。

Free枠はWorkers100,000要求/日・CPU10ms/要求、D1読取5,000,000行/日・書込100,000行/日・アカウント計5GB。今回の31名検証はCPU/要求/容量とも無料枠内。D1日次枠の約0.061%/1.625%を使用。有料化・Blaze・Functionsは使用していない。

観測最大値はサンプリングを含み、将来の全要求を保証しない。この31名試験時点ではcold start、200名、同時更新は未実測だった。2026-10-15の追加試験は [本番準備・追加実測](cloudflare-production-preparation.md) に記録する。本番Firebase取得経路は引き続き未検証。上限/障害時は手入力へ案内し、有料化しない。

## 再現・CI

Node24/Java21、root/workerの `npm ci --ignore-scripts`。

- `npm test`（96件。PR #38回帰15件を含む）/ `npm run typecheck` / `npm run build`
- `npm --prefix worker test`（37件）/ `npm --prefix worker run build`（local deploy --dry-runのみ）
- `npm --prefix worker run build:staging` / `npm --prefix worker run test:staging`（CIへ追加）
- `npm run test:rules`（36件）/ `npm run test:autofill:emulator`
- CI差分範囲テスト / `git diff --check`

CIにはCloudflare資格情報を登録せず、クラウドdeploy/同期を行わない。`wrangler.staging.example.jsonc` のDB IDはstaging専用値で設定する。生成バンドル・ローカル接続設定・鍵はGitへ入れない。

クラウド試験は `worker/staging/test-remote.mjs` のrunRemoteを非Gitの管理者専用launcherから実行。鍵はメモリ内で渡す。seed済みなら無条件に再投入しない。400要求・読取10万行・書込2万行の試験停止ガードを設定。

## 本番導入に残る作業

1. 保存項目・委託先/保存先（日本国内限定ではない）・MFA/アクセス権・長期保持・削除方法・DOB認証の残存リスクを管理者が確認し、実社員同期を別途明示承認する。
2. 本番専用Worker/D1/独立鍵/管理者allowlist・CORSは追加承認により停止状態で準備済み。staging認証/fixtureは本番に混入させない。実社員同期・公開有効化は別途承認を待つ。
3. 毎時Cron、停止/例外復旧、D1 Time Travelの最大7日残存を確認する。今回の時刻試験は共用掃除処理の実行で、実クラウドCronの発火待ちではない。
4. 本番取得経路とピークのCPU、既存サービスと共有するCloudflare/Firebaseの日次枠を、別途承認範囲で確認する。
5. DOB不整合2名は既存の管理者専用DPAPI暗号化台帳で確認。今回本番を再照会していない。氏名/DOB/IDをGit/ログ/チャットに出さず、推測修正しない。
6. 承認後だけ初回本番同期・除外件数確認・PR merge/Pages公開/本番有効化。通常の毎日再同期は不要。アプリ外更新は停止→例外復旧同期。

保管/削除の詳細は [設計資料](cloudflare-public-autofill.md)。staging許可は本番merge/deploy/実社員同期の承認ではない。

出典：[Workers limits](https://developers.cloudflare.com/workers/platform/limits/)、[Workers metrics](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/)、[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)。
