# 公開QRの社員自動入力（Spark + Cloudflare Free）

## 今回の範囲

実装・検証は `demo-core-safe` とローカルworkerd/D1、架空社員だけ。本番Cloudflare作成・デプロイ・実社員同期、Firebase/Rules/Pages/Billing変更、QR再発行は行っていない。既存URL `?form=newcomer&token=...` をそのまま利用する。検証済みのA4 QR印刷レイアウトを含む。

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
| 試行制限のキー | IP/選択IDをHMAC。生IP・入力DOBは保存しない。15分の制限管理 |

電子印、本人署名、社員マスタの管理項目、Auth ID token、Googleサービスアカウント秘密鍵は保存しない。Worker SecretのPAYLOAD_KEY/MATCH_KEYはそれぞれ独立した32バイト乱数（64桁hex）。フロント・D1・Gitへ入れない。ログ/トレースは無効、アプリは要求本文・秘密・個人情報をconsole出力しない。

D1はWorker binding経由だけ。D1管理権限、Workerコード/Secret編集権限は管理者に限定しMFAを使用。D1閲覧者でも平文氏名は閲覧可能であり、Worker編集者は復号できるため、暗号化は管理者から情報を隠すものではない。

## 同期と失敗時

社員名簿の「公開QR用社員情報を再同期」で初期同期/再同期。社員保存・削除後も再同期する。Firebaseの既存ID tokenをリクエストごとに使用し、Workerが `/staffUsers/{sub}` をFirestore RESTでGET。subのdecodeは経路の指定だけで、FirebaseがJWTと現行RulesのUID一致/activeを検証する。各社員取得も同じBearer tokenでRulesに従う。権限失効・ログアウト・別ユーザー・通信失敗で停止。

署名/電子印を除くprojectionと、名前順のカーソル/readTimeを使用して**一回に一社員**を取得・暗号化する。上限200名、同期セッション10分。全社員の取得が終わるまで公開しない。更新の同期開始時に公開rosterを無効化し、失敗時は画面に明示して手入力へ誘導する。Firestoreで成功した社員保存を巻き戻さない。

同期済みデータは24時間で公開利用を停止。少なくとも一日一回、ログイン済み社員が再同期する運用が必要。毎時のCronが期限切れの複製を削除（最大25時間）、失敗したステージも期限後に削除。D1 Time TravelではFreeの7日間の過去コピーが残り得る。即時の物理消去とは扱わない。Firebase Console等でアプリ外から社員を修正した場合も再同期が必要。

不正DOB/転記項目は修復・推測せず除外し、同期結果に件数と理由を返す。社員名簿で正しい元号・年月日、必要項目を人が確認して修正後に再同期する。公開候補には照合できる社員だけを掲載する。

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
| D1保存 | アカウント計5GB、1DB 500MB | 転記JSON最大8,000文字/社員、署名画像なし、旧rosterを保存し続けない |
| D1 | 最大50 queries/要求、100 bind params/query | 同期一名単位。DBと外部RESTを合わせても50 subrequestsを大幅に下回る |
| Cron | 5 triggers/account | 一つの毎時削除Cronのみ |

一日2,000公開要求、200名の最大候補では候補一覧の走査は最大40万行。照合/制限と同期、索引の書込み・期限削除を含めても通常の設計上限は読取50万行程度、書込3万行程度の見積り。D1 `meta.rows_read/rows_written` で実績を本番前に測定すること。拒否後もWorkers要求数は消費するが、Freeは上限で停止し、自動課金アップグレードは行わない。

Firestore Sparkの読取50,000/日も既存アプリと共有。公開QR確認は一覧一回、成功照合では二回、同期では権限確認と一社員取得を各要求で行う。現行Rules内の参照も含め使用量を確認する。上限超過は汎用失敗となり手入力へ誘導する。

CPUは一社員単位・小さなJSON・Web Crypto・I/O待ちの分離で10msを目標とする。**ローカルWindowsのV8サンプリングはネットワーク待ちもtimeDeltasに混ざり、Cloudflareの課金CPUの証明には使えなかった。本番エッジの10ms以内を確認済みとは扱わない。** 有料化せず、Freeの架空データ専用ステージングでcold/warm、最大200名の一覧、同期、正誤照合を測定し、10ms超過が継続する場合は有効化を停止して再設計する。この確認と管理者承認までは本番設定のPUBLIC_ENABLED/SYNC_APPROVEDをfalseのまま維持する。

出典：[Workers limits](https://developers.cloudflare.com/workers/platform/limits/)、[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)、[D1 limits](https://developers.cloudflare.com/d1/platform/limits/)、[Firestore quotas](https://firebase.google.com/docs/firestore/quotas)。

## ローカル再現

Node24/Java21を使用。rootとworkerで `npm ci --ignore-scripts`。`worker/.dev.vars.example` を `.dev.vars` にコピー（架空キー、gitignore対象）。

1. `npm --prefix worker run migrate:local`
2. `firebase emulators:start --only auth,firestore --project demo-core-safe`
3. `FIRESTORE_EMULATOR_HOST=127.0.0.1:18080 node tests/seed-local.mjs`
4. `npm --prefix worker run dev`（127.0.0.1:18787）
5. `VITE_USE_FIREBASE_EMULATORS=true VITE_PUBLIC_AUTOFILL_URL=http://127.0.0.1:18787 npm run dev -- --host 127.0.0.1 --port 5178 --strictPort`
6. 社員 `staff@core-safe.local / Local-test-12345!` で名簿の再同期。
7. 未ログインで `http://127.0.0.1:5178/Core-Safe/?form=newcomer&token=11111111-1111-4111-8111-111111111111`。架空社員「検証 社員」、DOB19950101。

CIはWorker unit23件、rootの既存68+公開UI3件、型/ビルド、Rules、workerd/D1/Auth/Firestore結合を実行する。Cloudflare buildは **deploy --dry-run** のみ。Functions関連の処理なし。

## 本番初期設定（このPRでは未実施）

1. 管理者が保存対象/委託先/権限/残存リスクを承認。Cloudflare **Workers Free** とD1 Freeを確認、専用DBと限定権限を用意。
2. production.exampleを非Git管理の設定へコピー、D1 binding設定、独立したPAYLOAD_KEY/MATCH_KEYをWorker Secretへ設定。Google秘密鍵は不要。
3. 本番有効化前に、別のFreeステージング・demoデータでCPU/rows実測と削除Cronを検証。実社員は使用しない。
4. 別途本番変更承認が出たら、DB migration、Worker配置、SYNC_APPROVEDの有効化、許可社員による初期同期と除外件数確認、PUBLIC_ENABLEDとフロントHTTPS URL設定を行う。
5. フロントリリースは別途承認。QR URL/token/Rulesは更新不要。異常時はPUBLIC_ENABLED=falseまたはフロント接続URLを無効化して従来の手入力を継続する。開放Rulesへ戻さない。

本番DOB read-only監査：31名中2名、元号期間不一致1・年月日の不正値1。実値・氏名は資料/Gitへ保存していない。本番変更/補正は未実施。
