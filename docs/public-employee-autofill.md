# 公開社員自動入力の廃止（Spark版）

PR #34に存在したCloud Functionsによる公開社員氏名一覧・生年月日本人確認・社員情報返却は、**現在未使用・Spark版では廃止**しました。専用UI/service、functions/、Secret ManagerのEMPLOYEE_AUTOFILL_KEY、runtime SA/IAM、カウンタ/マッピングは使用しません。旧build/deploy/Secret準備手順は実行しないでください。

公開QRは全利用者が手入力します。employeesと社内masterを読み取らず、現場・所長・会社候補はtoken設定から取得します。「その他（手入力）」、署名、create-only提出、社員一覧・既存PDFは維持します。社員も公開QRでは手入力します。

認証かつstaffUsers.activeの社員画面では、従来の社員名選択→employees情報の自動入力を維持します。生年月日のサーバー照合はありません。既存DOBの不整合2件は今回変更しません。

現行手順は[Spark本番導入](production-rollout.md)と[アクセス制御](access-control.md)を参照してください。課金変更やBlazeへの移行は導入条件ではありません。
