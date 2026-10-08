# Spark版 本番導入・切戻し手順（未実行）

PR #35は確定main `e7299d0e147a2cb0335380735f564fc47fd581d6`を基準とする。現行公開版のgh-pagesは`9bb30bfe1cce24bb5ce750253420c70143cfcab4`。今回の作業は新ブランチ・PRとローカル/CI検証だけで、merge、本番設定、データ、公開版は変更しない。

## 本番構成と無料枠

**Firebase Spark（無料プラン）で運用する。** 本番構成はGitHub Pages、Firebase Authentication Email/Password、Cloud Firestore、Firestore Security Rulesのみ。帳票描画・画像PDF・フォルダ/ZIP保存はブラウザ内で処理する。Blazeへのアップグレードや課金設定を導入条件にしない。

Cloud Functions、Cloud Run、Secret Manager、EMPLOYEE_AUTOFILL_KEY、Functions runtime SA/IAM、公開社員氏名一覧・生年月日本人確認は現在未使用・Spark版では廃止。API有効化、Secret作成、SA作成、専用IAM設定、Functions deployは不要。過去のPR #34用手順を実行しない。

Cloud Firestoreの無料枠は1DB/project、保存1GiB、読取50,000件/日、書込20,000件/日、削除20,000件/日、転送10GiB/月（2026-10-08の[公式上限](https://firebase.google.com/docs/firestore/quotas#free-quota)を確認）。日次枠は太平洋時間の深夜頃にリセットされる。料金・上限は運用時にも[公式Sparkプラン](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)で確認する。無制限に動作する保証ではなく、無料枠内で運用する。

許可確認やRulesの追加読取、社員一覧、一括帳票の本文取得・生成直前再取得も利用量に含まれる。一括PDFの件数確認では署名・画像入り本文が転送される現行制限を維持する。利用量・保存容量・送信件数を管理者が監視し、上限接近時は利用頻度や件数を抑える。制限時に課金プランを自動変更しない。TTL自動削除・PITR・マネージドバックアップ等の課金機能を前提にしない。社内データの退避は別途承認された安全な方法を用意し、Gitや公開ストレージへ置かない。

## 権限と公開QR

- drafts / employees / masterData / diagramImages：認証かつstaffUsers.active==trueの社員だけ。
- staffUsers：認証済み本人getのみ、client list/write禁止。公開signup画面なし。管理者がUID台帳を管理する。
- publicNewcomerForms：匿名は有効・期限内tokenの単一getのみ、list禁止。社員が期限付きQRを発行・無効化する。
- publicNewcomerFormAudit：社員専用、設定発行と原子的に作成。公開設定に社員UIDを載せない。
- publicNewcomerSubmissions：有効tokenでcreateだけ匿名許可。匿名read/list/update/deleteは禁止。社員は旧draftsと合わせて閲覧・編集・PDF出力。
- catch-all deny：廃止したカウンタ/マッピングを含むその他のclientアクセスを拒否。

匿名公開QRは全員が手入力する。employees・masterDataを取得せず、社員氏名一覧も公開しない。会社候補は社員がQR発行時にcontractorsからコピーしたスナップショットで、「その他（手入力）」を維持する。社員ログイン後の社員名選択による自動入力は従来どおり。生年月日不整合2件は公開照合廃止により導入ブロッカーではなく、今回修正・移行しない。

## 導入前の確認（将来、別途承認を受けた管理者が行う）

1. PR #35の最新SHAで全CI成功、差分、Spark構成、[依存監査](dependency-audit.md)の残存リスク受容を確認する。PR #34のCI成功をPR #35の確認として代用しない。
2. 現行Rules全文、main/gh-pages SHA、社内データの安全な退避先と担当者を記録する。現在の匿名全read/write Rulesはまだ本番に残っているため、コード上のRulesだけで保護済みと扱わない。
3. AuthenticationのEmail/Passwordだけを有効にする計画、`panchi1225.github.io`のauthorized domain、管理者発行の社員アカウントと正確なUIDを確認する。匿名/Google/電話provider追加、誰でも許可社員登録できる運用を導入しない。
4. 既存データ・単一フィールドindex・コレクション名を確認。破壊的migration、master上書き、DOB修正は不要。公開会社候補と現場名/所長名の公開可否を確認する。
5. PR #35最新PR CI全成功 → 承認後merge → main push CI全成功 → そのmain SHAとCI URL記録、の順序を守る。main CIが失敗・未開始・実行中・キャンセル・未確認ならPages deploy禁止。検証済みSHAのclean checkoutをbuildする。

## メンテナンス中の切替（今回は実行しない）

**新Rules → 拒否確認 → 許可UID → Pages → 期限付きQR**の順序を守る。旧画面が一時permission-deniedとなる停止時間を受け入れる。

1. 時間・旧QR停止・担当者・切戻しを告知し、現行Rulesと公開版を退避する。
2. 対象を`--project core-safe`に限定して承認済み新Rulesだけを反映する。indexや他サービスをまとめてdeployしない。[Rules反映遅延](https://firebase.google.com/docs/firestore/security/get-started)を考慮し、匿名/未許可Authの社内読取、staffUsers書込、公開設定listが拒否されることを実確認する。
3. 拒否が確認できてから管理者が正しい`staffUsers/{uid}: {active: true}`を登録する。クライアント登録は禁止。開放的な旧Rulesの状態では先にUIDを有効化しない。
4. main push CI全成功と記録済みSHAの一致を確認してから、Node 24でclean install/buildしたそのSHAだけをGitHub Pagesへ公開する。公開元はgh-pages/root、pathnameは/Core-Safe/。CI自体にはdeployはない。公開反映と新JSの読み込みを確認する。
5. 社員ログイン・未許可拒否・通常入力/保存/編集・マスタ・4帳票の個別/一括PDFを確認する。画像PDF方式、署名、アンバー配色、フォルダ/ZIP、重複連番は維持する。
6. 社員画面で承認された現場の期限付きtoken QRを発行し、会社候補・所長・有効期限を確認。旧project/director直書きQRを使わず、掲示・共有リンクを交換する。
7. 実スマートフォンで公開手入力 → 署名 → 提出 → 社員一覧 → PDFを確認。無効/期限切れtoken、別現場偽装、匿名再読取が拒否されることを確認する。
8. Windows Chrome/Edgeで保存とZIP展開、利用量・エラーを確認し、完了後にメンテナンスを解除する。

公開フォームは回答者の本人性を証明しない。有効tokenを知る第三者の多数createを止めるサーバーレート制限はない。期限・無効化、掲示範囲、提出件数と無料枠監視を運用に含める。App Checkは初回非必須・未導入で、導入する場合は別途検証する。Auth/Rulesの代替にしない。

## CIとローカル検証

Node 24 / Java 21。`npm ci --ignore-scripts`、`npm test`、`npm run typecheck`、`npm run build`、`npm run test:rules`、CI diff range test、event diff checkを実行。Rulesはdemo-core-safeのFirestore Emulatorのみ。Functions Emulatorや架空Secretは不要。

srcと配布JSにFunctions import・callable・鍵の参照がないことを確認する。Firebase共通SDKには製品名一覧の文字列`@firebase/functions`と`@firebase/functions-compat`が含まれるが、SDK名称情報でありFunctionsモジュールの読込み・通信ではない。`tests/spark.test.mjs`では実際の本番モジュールグラフにFunctionsが含まれないことも検証する。

workflowはmain宛pull_request、main push、workflow_dispatch。`contents: read`と`fetch-depth: 0`を維持する。PRはbase SHA→HEAD、pushはbefore→github.sha、手動は第一親→HEAD（rootは空tree）。比較元が失われたpushは正確なSHAを取得し、取得不能ならCI失敗としてPages公開を禁止する。手動CIはmain push CI成功条件を置き換えない。

## 切戻し

メンテナンスを維持し、問題のQRを無効化する。提出済み回答は保持し、安全な退避を確認する。記録済みの安全なSpark/Auth対応ソースをclean checkoutでbuildし、承認を受けて公開する。Git履歴をforce rewriteしない。

**匿名全read/writeの旧Rulesへ戻さない。** Auth非対応の旧フロントは新Rules下で社内機能が動かない可能性がある。安全なRulesとAuth対応フロントが揃うまで閉じたメンテナンスを継続する。staffUsersの取消やAuth無効化は管理者判断で対象UIDだけに行い、一括ユーザー削除はしない。

旧公開社員自動入力は現在未使用・Spark版では廃止。旧Functions/Secret/IAMを新規作成・有効化・deployする切戻しを行わない。今回の本番操作はすべて未実行。
