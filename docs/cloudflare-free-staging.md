# Cloudflare Free実測前の準備（2026-10-14）

## 現時点の状態

PR #36に最新main `08a10fd4b216aab99453e161de87e83d0631a744` を取り込んだ。PR #37の印刷3ファイルはmainと同一で、PR差分から除かれている。社員自動入力・同期の製品コードは今回変更していない。

Wrangler `whoami` は未認証。管理者認証待ちのため、Cloudflareリソース作成、Secret登録、クラウドdeploy・同期、CPU/D1実測は**未実施**。本番有効化の可否はまだ判断できない。ローカルテストや見積りを実測結果として扱わない。

## 管理者の次の操作

管理者PCで `worker` ディレクトリから `node node_modules/wrangler/bin/wrangler.js login` を実行し、管理者本人がCloudflareのOAuth画面でアカウント・権限を確認して承認する。ブラウザのCloudflareログインだけではCLI認証にならない。パスワード・OAuth token・API keyをチャットやGitへ貼らない。認証完了後に `whoami` で対象アカウントを確認する。

ステージング構築前に対象アカウントがWorkers Freeであること、D1 Freeの利用量・空き、既存サービスと共有する無料枠を確認する。有料なら課金変更をせず停止する。

## 認証後に構築する専用ステージング

- 本番名とは別のWorkerとD1を使用し、架空社員31名と架空QRだけを用意する。本番ドメイン/ルート、実社員、実QR、Firestore `core-safe` へ接続しない。
- 現状のlocal設定は127.0.0.1のEmulator専用であり、そのままクラウドへdeployしても接続できない。production設定は本番 `core-safe` を指すため、架空検証に流用しない。
- エッジ検証には専用の架空Firestore相当データ取得層が別途必要。Service Binding等で専用fixtureに閉じ、対象projectと外向き接続先を検査する。同期・暗号化・D1・試行制限の本体と本番認証経路は維持する。試験用認証を本番経路へ組み込まない。
- 管理用アクセス・鍵はステージング専用。Googleサービスアカウント秘密鍵は使用しない。CORS/no-store・上限を維持する。試験の要求本文、鍵、Authorizationをログへ保存しない。
- このデータ取得層・ステージング設定は認証後の作業対象であり、構築済みではない。

## 実測項目と判定

Workers Freeは100,000要求/日、HTTP/CronのCPU上限10ms。D1 Freeは5,000,000読取行/日、100,000書込行/日、アカウント合計5GB。料金変更はしない。

| 試験 | 確認する内容 |
| --- | --- |
| 初回同期 | 架空31名、一要求一名、全取得後だけ公開、除外理由の件数 |
| 候補・正誤照合 | 候補は氏名とopaque IDのみ、正DOBだけ転記全項目、誤DOBは個人情報なし |
| 試行制限 | 連続誤入力ロック、社員/IP/日次上限、汎用エラー |
| 更新 | 追加・変更・削除の自動同期、保存前無効化、途中失敗/結果不明時に旧情報を再公開しない |
| 継続利用 | 架空の同期時刻を24時間超・7日・30日前へ設定し、定期掃除後も有効コピーが利用可能。無効/期限切れQRは拒否 |
| UI | ローカル架空フォームで転記内容・本人署名・提出・社員一覧/PDFへの反映。公開QRにログインは要求しない |
| CPU | CloudflareのCPU指標を冷起動/通常/各操作で取得。ローカル壁時計やリクエスト所要時間で代用しない。サンプリング/集計の限界とCPU超過エラーを記録 |
| D1 | 試験前後の専用DBのrows_read/rows_written・ストレージ、各操作の実績と日次想定を記録。クエリ数だけで無料枠内と判断しない |

CPU/行数の指標を取得できない場合は「未確認」とする。上限超過・継続的CPU超過・異常時に旧情報が取得可能なら、本番有効化をせず改修・再検証する。無料枠内の実績と既存サービスを含む余裕が確認できるまで運用可能と確定しない。

## 個人情報の取扱いと本番移行のゲート

保存対象、暗号化、権限、停止/削除は [公開QRの設計資料](cloudflare-public-autofill.md) を参照。有効コピーは訂正/削除まで保持し、電子印・本人署名・管理情報は複製しない。氏名は候補用に平文、転記情報はAES-256-GCM、DOB照合値はHMAC-SHA256。管理者限定の鍵/操作、試行制限、例外復旧を維持する。D1 Free Time Travelには最大7日過去コピーが残り得る。

DOB不整合2名は本番へのread-only照会で再確認し、対象と元データを管理者専用Windows DPAPI暗号化台帳へ保存した。氏名・DOB・文書IDはGit/ログ/チャットに記載しない。元号期間不一致1件、年月日の不正値1件。本人または正しい記録で管理者が確認し、推測補正しない。今回は本番修正・実社員のCloudflare同期を行っていない。

本番導入には、実測成功、管理者によるCloudflareの保存項目・取扱い/保管場所・権限の確認、DOB修正、実社員同期の**別途明示承認**が必要。今回のステージング許可を本番deploy・PR merge・Pages公開・実社員同期の承認として扱わない。

出典：[Wrangler認証](https://developers.cloudflare.com/workers/wrangler/commands/general/)、[Workers limits](https://developers.cloudflare.com/workers/platform/limits/)、[Workers metrics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/)、[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)。
