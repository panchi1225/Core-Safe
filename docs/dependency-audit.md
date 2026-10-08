# 最終候補の依存監査（2026-10-08）

> 過去のPR #34時点の記録です。Cloud Functions、Secret Manager、EMPLOYEE_AUTOFILL_KEY、Functions IAM、公開社員氏名一覧・生年月日本人確認は現在未使用・Spark版では廃止しました。旧構成のコマンドや導入条件は適用せず、現行の[Spark導入手順](production-rollout.md)を使用してください。Spark版の新しい実機検証結果として扱わないでください。

比較対象はPR #34の実装SHA `7f06e65b229c608c36d60551c70de059ee6ed858`と、取得時点のorigin/main `7c9105e87ca3e81b83d7142e27adb232bf46bdf3`。root/Functionsとmainの各lockfileに`npm audit --package-lock-only --json`を実行した。監査は公開npmレジストリだけへ接続し、本番Firebaseへ接続していない。`npm audit fix`や依存更新は実行していない。

| lockfile | Critical | High | Moderate | Low | 合計 |
| --- | ---: | ---: | ---: | ---: | ---: |
| PR #34 root | 1 | 16 | 9 | 1 | 27 |
| 現行main root | 2 | 13 | 3 | 1 | 19 |
| PR #34 Functions | 0 | 0 | 0 | 0 | 0 |

件数はnpmが報告する脆弱なパッケージ項目数で、独立した攻撃手法の数ではない。間接依存の親にも同じ原因が計上される。監査DBは更新されるため、将来の本番導入前に再監査する。

## 本番実行経路と判断

- 残存Criticalは`websocket-driver@0.7.4`。mainにも同じ版がある。Firebase → Realtime Database → faye-websocketの依存で、Core SafeはRealtime Databaseをimportしていない。Viteの本番buildの出力チャンクに対しrenderedLength>0のモジュールを調べ、websocket-driver/faye-websocketの収録が0であることを確認した。脆弱性自体は存在するが、今回の配布JSへの収録は確認されなかった。[上流アドバイザリ](https://github.com/advisories/GHSA-xv26-6w52-cph6)
- 既存Highの`@grpc/grpc-js@1.9.15`はFirebaseのNode用Firestore依存。Web buildはFirestoreのbrowser ESMを使用し、gRPCの収録は0だった。Functionsの別lockfileは監査0件。Webアプリの警告とFunctionsの実行依存を混同しない。[上流アドバイザリ](https://github.com/advisories/GHSA-m9gg-hp2v-232j)
- 既存moderateのfabricはsrcにimportがなく、配布チャンクの収録も0。依存として残る警告を削除済みとは扱わない。[上流アドバイザリ](https://github.com/advisories/GHSA-w22m-hvvm-xmwx)
- 新しく監査対象となった14パッケージはlockfile上すべて開発依存。主にFirebase CLIとTailwindの依存経路である。firebase-tools/Tailwindの実行モジュールも配布JSには収録されない。追加した画像PDFのjsPDF/html2canvas/fflateに今回の監査警告はなかった。
- ViteやCLI、gh-pages等のHighは開発・build・deploy環境の問題として残る。ブラウザ配布外だから全用途で安全とは判断しない。Viteのdev/previewを本番サーバーとして使わず、ローカル検証は`npm run dev -- --host 127.0.0.1`等で外部公開を避ける。信頼できる入力・checkoutでbuild/deployし、権限と資格情報を最小化する。[Viteのアドバイザリ](https://github.com/advisories/GHSA-p9ff-h696-f583)

**今回追加した本番の認証/QR/PDF経路へ到達するCritical/Highは確認できなかった。ただし全アドバイザリの悪用不能を証明したわけではなく、残存Highの開発/配布ツールは未解消。** 即時の無検証force更新は行わない。本番投入前に担当者が、互換性を検証した更新または上記の到達範囲と限定した運用に基づく明示的なリスク受容を行う。未判断なら投入を保留する。本番IAM・現行Rulesも未確認なので、CI成功だけで無条件の投入可とはしない。

## rootの残存項目

「既存」はmainにも脆弱項目として報告された名称、「追加」はPR #34でのみ報告された名称。親パッケージへの継承警告も含む。

| パッケージ | severity | 比較 |
| --- | --- | --- |
| @babel/core | low | 既存 |
| @google-cloud/pubsub | moderate | 追加・dev |
| @grpc/grpc-js | high | 既存 |
| @opentelemetry/core | moderate | 追加・dev |
| baseline-browser-mapping | moderate | 既存 |
| basic-ftp | high | 追加・dev |
| braces | high | 既存 |
| browserslist | high | 既存 |
| chokidar | high | 追加・dev |
| fabric | moderate | 既存 |
| fast-glob | high | 既存 |
| firebase-tools | high | 追加・dev |
| gaxios | moderate | 追加・dev |
| get-uri | high | 追加・dev |
| gh-pages | high | 既存 |
| globby | high | 既存 |
| micromatch | high | 既存 |
| pac-proxy-agent | high | 追加・dev |
| picomatch | high | 既存 |
| postcss-nested | moderate | 追加・dev |
| postcss-selector-parser | moderate | 追加・dev |
| proxy-agent | high | 追加・dev |
| re2 | moderate | 追加・dev/optional |
| tailwindcss | high | 追加・dev |
| uuid | moderate | 追加・dev |
| vite | high | 既存 |
| websocket-driver | critical | 既存 |

mainだけで報告された6項目は`@protobufjs/utf8`、nanoid、postcss、protobufjs、source-map-js、ws。lockfile解決の差で今回の監査結果から外れているが、これを目的に互換性未検証の更新をしたわけではない。

## 残る制限

件数確認で署名・画像を含む帳票本体が転送される問題と、実運用大量データの負荷は別の未解決事項。[メタデータ改善案](bulk-export-metadata-plan.txt)を維持し、破壊的移行はしていない。画像PDFの仕様も変更していない。本番IAM・Rules・費用・モバイル・実OSエラーの未確認項目は[導入手順](production-rollout.md)に明記している。
