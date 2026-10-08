# 公開初期マスタの整理

> 過去のPR #34時点の記録です。Cloud Functions、Secret Manager、EMPLOYEE_AUTOFILL_KEY、Functions IAM、公開社員氏名一覧・生年月日本人確認は現在未使用・Spark版では廃止しました。旧構成のコマンドや導入条件は適用せず、現行の[Spark導入手順](production-rollout.md)を使用してください。Spark版の新しい実機検証結果として扱わないでください。

PR #34の`2236ce79ce09827f57fea6e631a007a95b7c5124`を基準に、公開ソース・今後の静的フロントJSへ個人/現場/会社固有のマスタ値を含めないよう整理した。本番Firebaseへの接続・更新、データ移行、Git履歴の書換えは行わない。

## 初期値と実マスタ

| INITIAL_MASTER_DATAの項目 | 最終初期値 |
| --- | --- |
| projects / supervisors / workplaces / contractors / locations | 空配列 |
| roles / topics / jobTypes / goals / predictions / countermeasures | 個人・現場固有情報のない既存一般テンプレート |
| subcontractors / processes / cautions / machines / equipment / safetyInstructionItems | 従来どおり空配列 |

実際のマスタは`masterData/general`に保存し、従来の`getMasterData`が保存済みフィールドを優先する。認証かつstaffUsers.active社員だけが取得できるRulesを維持する。不存在・未登録フィールドは安全な初期値を使用し、初期値取得によるFirestore書込みはない。未設定項目は既存の社員向けマスタ管理から登録できる。既存ドキュメント・保存処理・取得処理・アクセス制御を変更しない。

公開QRは引き続き社内masterDataを取得せず、社員が発行時にcontractorsから公開設定のcontractorOptionsへ複製する。既存QRの設定値も今回変更しない。社員自動入力のcompany固定値は仕様として維持し、Functions/本人照合は変更しない。

## 現在のツリーと検索

削除対象は初期マスタの実社員氏名、実工事名、実作業所名、会社/場所の候補。リポジトリのソース・docs・tests・README等を確認した。また、実データが写っていた未参照の`pdf_current.png`を現在のツリーから削除した。これは旧検証画像で、アプリやテストから参照されていない。画像内の情報は文字列検索で検出できないため、目視確認を併用した。

削除した個人/現場名を再び公開docsやテストへ列挙しない。検証には架空の現場・所長・社員を使用する。build後、削除対象の全文と特徴的な部分文字列を使って追跡対象ファイルとdistの全ファイルを検索する。

3つの追加回帰テストで、マスタ不存在、部分登録、保存済み値優先とフィールド単位登録を確認する。既存の匿名QRで社内マスタ取得ゼロ・会社候補/手入力・社員自動入力のテストも維持する。全テスト・型チェック・build・差分チェックとCIの結果はPR本文へ記録する。

ローカル検証はフロント68件、Rules36件、Functions単体20件、Functions実HTTP Emulator19件、両typecheck/build、git diff --checkがすべて成功した。現在のリポジトリ102ファイルと本番buildのdist18ファイルで削除対象の6検索パターン（全文/氏名や現場名の部分文字列）を照合し、該当0件。distではUnicodeエスケープ表記も確認した。これは削除対象についての検索で、過去履歴の消去や全個人情報の自動検出を保証するものではない。

## 今回の削除の範囲

変更は現在のPRブランチと今後のbuild成果物に限る。mainや過去Gitコミット、旧Pages配布物、ブラウザキャッシュ、既存の外部コピーから情報が消えたとは扱わない。force rewrite・本番deployは行わず、過去履歴からの完全削除や既配布物の更新は人間が別途判断する。Auth/Rules/token/Functions/公開回答/個別・一括PDF/確定アンバー配色は変更しない。
