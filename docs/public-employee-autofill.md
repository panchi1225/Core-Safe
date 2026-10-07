# 公開QRの社員自動入力

通常社員画面のFirebase Authentication＋staffUsers、公開QRの有効tokenという方針を維持します。公開端末へemployees/masterDataの取得権限は追加していません。本番へは未反映です。

## 処理と返却項目

公開フォームの`listPublicEmployeeCandidates({token})`はCallable Functions経由です。サーバーは有効・期限内tokenを確認し、Admin SDKで氏名と有効状態だけを取得。employeePublicIdとdisplayNameだけを返します（最大1000件、超過時は取得を止め手入力を案内）。active=falseが明示された社員は除外します。既存EmployeeDataにactiveは必須ではありません。

氏名選択と西暦8桁の入力後、`verifyEmployeeAutofill({token,employeePublicId,birthDate})`がtoken、ID、日付形式・暦、社員の存在・有効状態、生年月日一致をサーバーで確認します。返却直前にもtokenを確認し、成功した社員1名の許可項目だけを返します。

返す項目: company=松浦建設株式会社、nameSei/nameMei、furiganaSei/furiganaMei、birthEra/birthYear/birthMonth/birthDay、gender、bloodType/bloodTypeRh、address、phone、emergencyContactSei/emergencyContactMei/emergencyContactRelation/emergencyContactPhone、healthCheckYear/healthCheckMonth/healthCheckDay、jobType、experienceYears/experienceMonths、許可されたqualifications。

電子印sealImage、社員doc ID、社員番号、Auth UID、認証情報、管理項目、更新時刻、他社員、未知資格項目は返しません。現場／所長／署名を上書きする項目も返しません。経験年数・職種の反映は従来と同じ関数です。QR会社候補に松浦建設株式会社があればmaster、なければotherとし、会社選択＋手入力を維持します。API障害や未登録時も手入力で提出でき、氏名一覧の再読込を用意しています。通常社員画面は名前選択だけの従来方式です。

## 不透明IDと生年月日

既存社員IDはDate.now()由来の値もあります。元IDは公開しません。AES-256-GCMでID、QR token、有効期限を認証付き暗号化し、毎回新しいnonceで不透明なIDを作ります。有効期限15分、別QRへの転用・改ざん・期限切れ・鍵変更は拒否。ID対応表や社員データ移行は不要です。15分経過後は「氏名一覧を再読込」を押してください。手入力したアンケートは保持されます。

鍵はSecret ManagerのEMPLOYEE_AUTOFILL_KEY（暗号学的乱数32バイトの64桁hex）。社員のPINやパスワードを作るものではありません。生年月日を別の秘密フィールド・カウンタ・マッピングへ保存しません。

既存birthEra/birthYear/birthMonth/birthDayを都度変換します。昭和は1925＋年、平成は1988＋年、令和は2018＋年。実際の改元日・閏日・未来日まで検証。Showa/Heisei/Reiwa、日本語表記、AD/Gregorian/Western/西暦を受け付けます。西暦記録は既存フォームの和暦へ変換。昭和以前などフォームに表現できない記録、不正暦、不整合は同じ失敗として手入力を案内し、元データは変更しません。

生年月日は推測可能な簡易確認です。AuthやstaffUsersの代替ではなく、生年月日を知る第三者が本人を装える限界があります。本番前に社員情報の公開範囲とこの方式の運用可否を確認してください。

## レート制限とエラー

Admin専用employeeAutofillRateLimitsをFirestoreトランザクションで更新し、全インスタンス共通で制限します。時間窓60秒、成功・失敗とも計数し、成功でリセットしません。

- 照合: token＋社員で5回、全token共通の同一社員で10回／60秒。
- 照合の補助制限: token＋接続元で20回、token全体で500回／60秒。
- 氏名一覧: token＋接続元で30回、token全体で500回／60秒。

公開IDを再発行しても元の社員IDで制限が継続。接続元だけを信用する方式ではありません。接続元はrawRequest.ipを補助に使い、クライアント指定IDや転送ヘッダーを独自に採用しません。プロキシ配下で接続元を共有する可能性はステージングで確認してください。

超過時は待機または手入力を案内し、元の窓から60秒経過すると自動解除。長期・永久ロックはありません。継続攻撃で短い制限を繰り返し発生させられる限界は残り、App Checkや監視は今後の検討事項です。

カウンタIDはHMACで不透明化。本文はwindowStart、attempts、expiresAtのみで、生年月日・token・社員ID・IPを平文保存しません。expiresAtは24時間後、TTLを管理者が設定すると回収できます。TTL削除を待たずwindowStartで制限を解除。全クライアントのread/list/create/update/deleteはRulesで拒否。マッピング用の名称も拒否していますが実際には作成しません。

不存在ID・生年月日不一致・不整合は同じpermission-deniedと「本人確認ができませんでした。氏名と生年月日を確認してください。」です。レート超過だけresource-exhausted、内部エラーは一般的なunavailable。アプリコードから入力・token・個人情報・鍵をログ出力しません。

## ローカル・CI

フロントはNode 24、Functionsの本番対象とCIはNode 22。Java 21を用意します。

```sh
npm ci --ignore-scripts
npm --prefix functions ci --ignore-scripts
npm test
npm run typecheck
npm run build
npm run test:rules
npm run test:functions
npm run typecheck:functions
npm run test:functions:emulator
git diff --check
```

Functionsの実HTTPテストはdemo-core-safe限定。起動スクリプトが架空鍵のfunctions/.secret.localを一時作成して終了後に削除します。既存ファイルは上書きしません。クラウドのSecret Managerへはアクセスしません。

画面確認はbuild:functions後、functions/.secret.localへEMPLOYEE_AUTOFILL_KEYと64桁の架空hexを設定（Git管理禁止）。`npx firebase emulators:start --only auth,firestore,functions --project demo-core-safe`、架空fixtureのseed、`VITE_USE_FIREBASE_EMULATORS=true npm run dev`を使います。Firestore 18080、Auth 19099、Functions 15001、すべて127.0.0.1です。架空社員「検証 社員」の生年月日は19950101。PowerShellの環境変数指定は既存開発手順を参照してください。

新規Functions依存のgaxios 6.7.1配下でuuidの利用がv4のみであることを確認し、API互換性のある修正版11.1.1以上へ限定overrideしています。既存フロント依存は変更していません。

## 将来の本番設定・デプロイ（未実行）

1. 社員認証・staffUsers・Rulesの導入手順をステージングで完了し、既存employeesの生年月日形式と公開可能な氏名範囲を確認。
2. 管理者がFunctions用の課金プラン・API・IAM・Firestoreへの実行サービスアカウント権限・asia-northeast1の利用を確認し、必要範囲に限定。
3. Secret ManagerにEMPLOYEE_AUTOFILL_KEYを32バイト乱数hexとして登録し、実行サービスアカウントだけに参照権限を付与。リポジトリ／静的サイトへ鍵を含めない。
4. Node 22でFunctions依存をclean installしてbuild。人がステージングへ`firebase deploy --only functions:listPublicEmployeeCandidates,functions:verifyEmployeeAutofill --project <staging-project>`を実行。公開Callableを呼べるCloud Run invoker設定を確認。CORSは本番GitHub Pages originを許可しているため、別のステージングoriginは明示的にコードへ設定。
5. Rulesをレビューしステージングに反映。WebのregionとAPIを整合させ、匿名の直接Firestore拒否、候補・全照合・制限・手入力を実機検証。
6. カウンタexpiresAtのTTL、ログ保持・監視・予算通知を必要に応じ設定。TTLはレート制限の正しさに必須ではありません。
7. 別途承認後にのみ本番鍵・Functions・Rules・フロントを反映。CLIのprojectを毎回明示し、架空鍵は本番で使用しない。

このPR更新ではAuth／Rules／Functions／Hosting／App Checkの本番反映、社員データの一括変更は行いません。CIにもデプロイはありません。

参考: [Callable Functions](https://firebase.google.com/docs/functions/callable)、[ローカル検証](https://firebase.google.com/docs/functions/local-emulator)、[Secret管理](https://firebase.google.com/docs/functions/config-env)。
