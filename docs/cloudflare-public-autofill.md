# 公開QRの社員自動入力（Spark + Cloudflare Free）

## 今回の範囲

実装・検証は `demo-core-safe`、ローカルworkerd/D1、承認済みCloudflare Free専用ステージング。架空社員だけを使用する。追加承認により本番専用Worker/D1を停止状態で作成したが、実社員同期・公開有効化、Firebase/Rules/Pages/Billing変更、QR再発行は行っていない。既存URL `?form=newcomer&token=...` をそのまま利用する。QR印刷デザインと新規作成STEPリセットは最新mainと同一。[停止状態の本番準備・追加試験・残作業](cloudflare-production-preparation.md)。

## 処理

1. 公開フォームは今までと同じ公開設定一件だけをFirestoreから取得。employees/masterDataは匿名取得しない。
2. 「松浦建設の社員」を選ぶとWorkerの `/candidates` から `{id,name}` だけ取得。
3. `/verify` に既存QR token・選択ID・西暦生年月日8桁をPOST。Workerが現行Rulesに従う匿名Firestore RESTでQRの有効性を確認。
4. WorkerがD1の試行制限とHMAC照合を実行。一致時だけAES-GCMで転記項目を復号し返す。返却直前にもQRを再確認する。
5. 社員画面と同じ `employeeSurveyFields` で自動入力。署名はコピーせず本人が記入する。通常の `publicNewcomerSubmissions` へのcreate、社員一覧、同じ個別/一括PDFを利用。
6. 松浦建設が古い `contractorOptions` にない場合は `companyInputType: 'other'`。既存Rulesを変更せず会社文字列を保持する。

氏名・入力方法を選び直すと、直前に自動入力した個人情報をクリアする。自動入力後は既存の署名を再利用せず、本人の署名を取り直す。複数社員の同時同期では最新の開始が古い同期を中止し、古いsnapshotの公開を防ぐ。

## 管理者承認が必要な保存対象・保存先

**実社員情報を複製する前に、この一覧・残存リスク・Cloudflare側の取扱いを管理者が確認し明示承認すること。今回のPRは承認・同期の代行をしない。**

保存先は管理者所有のCloudflare Freeアカウント内の専用D1。日本国内だけの保存を保証する構成ではない。所在地、委託先の規約・取扱い、社内の目的/周知/承認、アカウント管理者を本番設定前に確認する。

| データ | 保存方法・目的 |
| --- | --- |
| 氏名、選択ID | 氏名のみ平文、IDは秘密鍵付きHMACで生成。有効QRから選択するため |
| 生年月日の照合値 | 選択IDと生年月日を秘密鍵付きHMAC-SHA256。単純hash/平文照合値は保存しない |
| 氏名・フリガナ・元号年月日・性別・住所・電話・緊急連絡先・職種・経験年月・血液型/RH・健診年月日・資格 | AES-256-GCMで暗号化。照合成功時のアンケート転記に限定 |
| 同期のページ位置・件数・除外理由 | AES-GCMで暗号化。10分間の同期セッションのみ |
| 社員変更の安全管理ticket・許可社員UIDのHMAC | コピー無効化と未完了書込みの管理。社員氏名・変更内容は保存しない |
| 試行制限のキー | IP/選択IDをHMAC。生IP・入力DOBは保存しない。15分の制限管理 |

電子印、本人署名、社員マスタの管理項目、Auth ID token、Googleサービスアカウント秘密鍵は保存しない。Worker SecretのPAYLOAD_KEY/MATCH_KEYはそれぞれ独立した32バイト乱数（64桁hex）。フロント・D1・Gitへ入れない。管理者専用操作は別のWorker Secret `ADMIN_UIDS`（許可管理者のFirebase UID、複数時はカンマ区切り）と現行staffUsers.activeの両方で検証する。秘密値をログ・Git・フロントへ出さない。ログ/トレースは無効、アプリは要求本文・秘密・個人情報をconsole出力しない。

D1はWorker binding経由だけ。D1管理権限、Workerコード/Secret編集権限は管理者に限定しMFAを使用。D1閲覧者でも平文氏名は閲覧可能であり、Worker編集者は復号できるため、暗号化は管理者から情報を隠すものではない。

## 同期と失敗時

**初回導入時に管理者が一回同期する。以降は毎日のログイン・再同期・日付操作を一切要求しない。** 固定24時間の利用期限・日次失効を撤廃し、7日・30日後も同じ有効rosterを継続利用する。公開作業員の操作は従来の氏名選択・DOB照合・内容確認・本人署名・提出のまま。

Core Safeの社員マスタで登録・変更・削除を行うと、次の順序で自動反映する。

1. Worker `/sync/prepare` が公開rosterを無効化・削除し、進行中の古い同期を中止。変更ticketをD1に保持して応答する。
2. 無効化の確認後だけ、社員のFirebase ID tokenでFirestore REST commitを送る。現行Rulesに従い、setDoc merge相当の更新maskを使用する。署名画像等をWorkerに送らず、Firestoreの元データ/帳票は維持する。
3. Firestoreの成功応答後、`/sync/settle` で書込みの完了を通知し、ticket付きの一社員単位の同期を自動実行する。利用者が同期ボタンを押す必要はない。
4. 全取得が完了し、未完了書込みがなく、現在のgeneration/ownerが一致するときだけ原子的に公開する。同時更新で後の同期に置き換わった場合は、その安全な完了を自動で短時間待つ。

無効化に失敗した場合はFirestore変更を開始しない。保存・削除の結果が不明な場合は自動再送せず、旧情報の公開を停止したまま保存結果の確認を依頼する。Firestore成功・同期失敗は明確に区別して画面へ表示し、元の保存を巻き戻さない。公開QRは手入力を案内する。未完了ticketは時間経過で自動解除しないため、同期失敗で旧rosterが復活することはない。

オンラインREST保存を採用する理由は、SDKのオフライン書込みが後日送信され、復旧後のFirestoreだけを更新する状態を避けるため。設定未使用時の既存SDK保存は維持する。Firebase ID tokenの認証・Security Rulesは従来どおり。[Firestore REST認証](https://firebase.google.com/docs/firestore/use-rest-api)。

Firebaseの既存ID tokenをリクエストごとに使用し、Workerが `/staffUsers/{sub}` をFirestore RESTでGET。subのdecodeは経路の指定だけで、FirebaseがJWTと現行RulesのUID一致/activeを検証する。各社員取得も同じBearer tokenでRulesに従う。権限失効・ログアウト・別ユーザー・通信失敗で停止する。

署名/電子印を除くprojectionと、名前順のカーソル/readTimeを使用して**一回に一社員**を取得・暗号化する。上限200名、同期セッション10分。全社員の取得が終わるまで公開しない。更新の同期開始時に公開rosterを無効化し、失敗時は画面に明示して手入力へ誘導する。Firestoreで成功した社員保存を巻き戻さない。

有効な社員コピーは更新・削除・管理者停止まで継続保持する。毎時Cronは有効rosterを削除せず、期限切れ/旧ステージ・試行制限データ・確定済み変更ticketだけを掃除する。未完了書込みの安全管理ticketには社員の変更内容を含めず、結果を確認して復旧するまで公開停止を維持する。

長期保持により、Firestore外に暗号化された健康・連絡先情報と平文氏名が残る。退職・訂正・削除はCore Safeの社員画面で速やかに行い、Cloudflareアカウント/鍵の管理・アクセス権の棚卸しを行う。コピーの保存目的がなくなれば、管理者専用「公開自動入力を停止」または「全同期データを消去」でroster/同期セッションを消去し、停止状態を維持する。試行制限・未完了書込みticketは安全のため維持し、元のFirestore社員・帳票は削除しない。D1 Time TravelのFreeバックアップには最大7日間過去コピーが残り得る。即時の物理消去とは扱わない。

### 障害復旧・アプリ外変更だけの例外操作

- 通常運用はCore Safe社員マスタ画面から更新する。
- Firebase Console等で変更する場合は**先に**管理者専用操作で公開自動入力を停止し、Console変更後に「初回同期／例外時の復旧同期」を一回実行する。QR/tokenは変更しない。停止せずアプリ外から変更した内容は自動検出できないため、発見時は直ちに停止し正の社員マスタから復旧する。
- 未完了ticketがある障害時は、全端末の社員変更処理を止め、ログイン中の管理者がFirestoreで保存/削除結果を確認する。新しい社員変更を再送しない。開始から10分未満の未完了処理がある間は復旧を拒否する。
- 未完了要求が終了し正のマスタを確認した管理者だけが確認ダイアログに同意して復旧する。これは例外操作であり、日常・毎朝・毎日の操作ではない。自動タイマーでは安全管理ticketを解除しない。
- 保存済みrosterの全消去やPUBLIC_ENABLED=falseによる停止後、再開は管理者の明示操作による全取得完了後だけ。非管理者は停止・消去・手動再開・未完了状態の強制解除ができない。

不正DOB/転記項目は修復・推測せず除外し、同期結果に件数と理由を返す。社員名簿で正しい元号・年月日、必要項目を人が確認し、Core Safeで修正・保存すると自動同期する。公開候補には照合できる社員だけを掲載する。

## 防御と残存リスク

- 同一社員は15分間に最大10試行。5回失敗すると最終失敗から少なくとも15分ロック。IPを変更/別QRを使用しても社員単位のロックを維持。
- IPは15分に一覧/照合それぞれ100要求まで（現場Wi-Fiの共有IPを考慮）。成功で失敗数を無制限にリセットしない。SQLの条件付き更新で並列要求を制限する。
- エラーは汎用表示、成功/失敗/一覧すべてno-store。HTTPS、完全一致CORS origin、cookieなし。無効/期限切れQRは毎回拒否。
- DOBは強い本人認証ではない。氏名とDOBを知る人のなりすまし、名前一覧の収集、社員ロック/無料枠消費によるサービス妨害を完全には防げない。CORSは認証でもbot防止でもなく、同じOrigin配下の他サイトまで区別しない。
- Cloudflare Freeアカウント全体の利用量は他サービスと共有。上限/障害時は自動入力を止めて手入力を案内する。有料化/Blaze/Functionsへ切り替えない。

## 無料枠と設計上限（2026-10-14公式資料確認）

| 項目 | Free枠 | この機能の制限 |
| --- | --- | --- |
| Workers | 100,000 requests/day、CPU 10ms/要求、128MB | 公開2,000件/UTC日、同期1,000要求/UTC日。上限でDBカウンタを増やさず拒否 |
| D1 | 5,000,000読取行/日、100,000書込行/日 | 索引付きキー照会、候補最大200名、期限レコードの削除数も制限 |
| D1保存 | アカウント計5GB、1DB 500MB | 転記JSON最大8,000文字/社員、最大200名の有効rosterを保持。旧rosterは変更/消去時に削除 |
| D1 | 最大50 queries/要求、100 bind params/query | 同期一名単位。DBと外部RESTを合わせても50 subrequestsを大幅に下回る |
| Cron | 5 triggers/account | 一つの毎時削除Cronのみ |

一日2,000公開要求、200名の最大候補では候補一覧の走査は最大40万行。照合/制限と同期、索引の書込み・期限削除を含めても通常の設計上限は読取50万行程度、書込3万行程度の見積り。D1 `meta.rows_read/rows_written` で実績を本番前に測定すること。拒否後もWorkers要求数は消費するが、Freeは上限で停止し、自動課金アップグレードは行わない。

Firestore Sparkの読取50,000/日も既存アプリと共有。公開QR確認は一覧一回、成功照合では二回、同期では権限確認と一社員取得を各要求で行う。現行Rules内の参照も含め使用量を確認する。上限超過は汎用失敗となり手入力へ誘導する。

CPUは一社員単位・小さなJSON・Web Crypto・I/O待ちの分離で10msを目標とする。Freeステージングの架空31名でCPU観測最大8.625ms、P99 8.207ms、Worker errors 0をCloudflare GraphQLから測定した。D1集計は読取3,054行・書込1,625行で無料枠内。[実測・再現・限界](cloudflare-free-staging.md)を参照。サンプリングを含む結果であり、本番Firebase取得経路・最大200名・cold start・将来負荷の保証ではない。ローカル所要時間を課金CPUとして扱わない。管理者承認と本番条件の追加確認までは本番PUBLIC_ENABLED/SYNC_APPROVEDをfalseのまま維持し、CPU超過時は有料化せず有効化を停止する。

出典：[Workers limits](https://developers.cloudflare.com/workers/platform/limits/)、[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)、[D1 limits](https://developers.cloudflare.com/d1/platform/limits/)、[Firestore quotas](https://firebase.google.com/docs/firestore/quotas)。

## ローカル再現

Node24/Java21を使用。rootとworkerで `npm ci --ignore-scripts`。`worker/.dev.vars.example` を `.dev.vars` にコピー（架空キー、gitignore対象）。

1. `npm --prefix worker run migrate:local`
2. `firebase emulators:start --only auth,firestore --project demo-core-safe`
3. `FIRESTORE_EMULATOR_HOST=127.0.0.1:18080 node tests/seed-local.mjs`
4. `npm --prefix worker run dev`（127.0.0.1:18787）
5. `VITE_USE_FIREBASE_EMULATORS=true VITE_PUBLIC_AUTOFILL_URL=http://127.0.0.1:18787 npm run dev -- --host 127.0.0.1 --port 5178 --strictPort`
6. 社員 `staff@core-safe.local / Local-test-12345!` で名簿の初回同期（local専用管理者設定）。以降の追加・変更・削除は保存時に自動反映。
7. 未ログインで `http://127.0.0.1:5178/Core-Safe/?form=newcomer&token=11111111-1111-4111-8111-111111111111`。架空社員「検証 社員」、DOB19950101。

CIは継続利用・変更順序・同期失敗/消去を含むWorker/rootテスト、型/ビルド、Rules、workerd/D1/Auth/Firestore結合を実行する。時刻テストは架空時刻で24時間・7日・30日を進めて検証する。Cloudflare buildは **deploy --dry-run** のみ。Functions関連の処理なし。

## 本番初期設定（停止状態でのリソース準備のみ実施）

1. 管理者が保存対象/委託先/権限/残存リスクを承認。Cloudflare **Workers Free** とD1 Freeを確認、専用DBと限定権限を用意。
2. production.exampleを非Git管理の設定へコピー、D1 binding設定、独立したPAYLOAD_KEY/MATCH_KEYと管理者UID allowlistのADMIN_UIDSをWorker Secretへ設定。Google秘密鍵は不要。demo専用値 `demo-authorized-staff` はlocal MODEでしか管理者にならない。
3. 本番有効化前に、別のFreeステージング・demoデータでCPU/rows実測と削除Cronを検証。実社員は使用しない。
4. DB migrations（0001/0002）・停止状態のWorker配置・独立Secret・毎時Cronは追加承認下で準備済み。PUBLIC_ENABLED/SYNC_APPROVED、workers.dev/preview URLは無効、社員0件。別途承認後だけ接続検証、SYNC_APPROVEDの有効化、管理者による一回の初期同期と除外件数確認、PUBLIC_ENABLEDとフロントHTTPS URL設定を行う。以降は社員変更時の自動反映だけで日常運用できる。
5. フロントリリースは別途承認。QR URL/token/Rulesは更新不要。異常時はPUBLIC_ENABLED=falseまたはフロント接続URLを無効化して従来の手入力を継続する。開放Rulesへ戻さない。

本番DOB read-only監査：31名中2名、元号期間不一致1・年月日の不正値1。実値・氏名は資料/Gitへ保存していない。本番変更/補正は未実施。
