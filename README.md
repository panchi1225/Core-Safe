<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/17T1NzjZZ7wXz5fTDypiXZ1qUllXCxD3v

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## 社員認証・公開QRの導入

公開QRでも有効token＋生年月日のサーバー照合後に、社員本人1名の必要情報だけを自動入力できます。[Functions設定・試行回数制限・テスト手順](docs/public-employee-autofill.md)を参照してください。手入力も維持します。

通常画面はFirebase Auth＋staffUsersの社員許可、公開アンケートはログイン不要の期限付きtokenを使用します。本番設定・Rulesの反映・旧QRの再発行が必要です。コード変更だけでは本番のアクセス制御は完了しません。

設定手順、データ構造、ローカルEmulatorテスト、PR #32との統合方針は[アクセス制御ガイド](docs/access-control.md)を参照してください。本番Firebaseへのデプロイはこの変更の作業中に実施していません。
