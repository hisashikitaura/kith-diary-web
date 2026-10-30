# Kith Diary Web

Journey風のパーソナル日記アプリ（Next.js App Router + TypeScript + Firebase）。

- Live: https://kith-diary.web.app
- Firebase project: `kith-diary`

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS v4
- Firebase Auth (Google), Firestore, Storage
- Static export (`output: 'export'`) → Firebase Hosting `out/`
- App Check via `ReCaptchaEnterpriseProvider`（サイトキー未設定時はスキップ）

## Features

1. Google ログイン / ログアウト（許可メールは環境変数で指定）
2. タイムライン（`date_journal` 降順・ページネーション）
3. 新規作成（本文・任意写真・任意場所・任意日付）
4. 詳細表示・削除（Firestore document id）
5. キーワード検索（クライアント側スキャン）
6. カレンダー日付フィルタ
7. 設定（位置情報トグル・ログアウト）
8. 日本語 UI

## Data model

```
users/{uid}/entries/{entryId}
```

Fields: `id`, `text`, `date_journal`, `date_modified`, `photos`, `address`, `type`, `timezone`, optional `ai_comment` / `ai_comment_requested`.

Document id matches Journey `id` when present. Photos are stored at `users/{uid}/entries/{entryId}/{filename}`.

## Local setup

```bash
cp .env.example .env.local
# Fill NEXT_PUBLIC_FIREBASE_* (and optional NEXT_PUBLIC_RECAPTCHA_SITE_KEY)

npm install
npm run dev
```

Open http://localhost:3000

### Env vars

| Key | Required | Notes |
|-----|----------|-------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | yes | Firebase web config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | yes | e.g. `kith-diary.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | yes | `kith-diary` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | yes | Storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | yes | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | yes | |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | no | App Check; skipped if empty |

**Do not commit `.env.local`.** Only `.env.example` (empty placeholders) is tracked.

## Build & deploy

```bash
npm run build   # writes static site to out/
```

Deploy with Firebase CLI (from this directory):

```bash
firebase use kith-diary
firebase deploy --only hosting
# optionally also rules:
firebase deploy --only firestore:rules,storage
```

`firebase.json` points Hosting at `out/` and includes Firestore / Storage rules paths.

Rules are generated from `*.rules.template`: set `NEXT_PUBLIC_OWNER_EMAIL` in `.env.local`, then run `npm run gen:rules` before deploying rules. Cloud Functions read `OWNER_EMAIL` from `functions/.env.<project>` (gitignored).

## Project layout

```
src/
  app/                 # layout + page (static export)
  components/          # UI: timeline, compose, detail, search, calendar, settings
  lib/                 # firebase, auth, entries, types, dates
firestore.rules
storage.rules
firebase.json
.env.example
```

## Notes

- Auth is gated client-side and by Firestore/Storage rules to the owner email (env `NEXT_PUBLIC_OWNER_EMAIL` / functions `OWNER_EMAIL`).
- Passkey / WebAuthn and AI comment generation exist on the live/iOS side but are not required for this rebuild; `ai_comment` is displayed when present.
- App Check enforcement stays OFF; initialization is best-effort.

## AI分析（Gemini / Vertex AI）

「AI分析」ボタンから、期間（30日 / 90日 / 全期間）を選んで日記を分析します。
Cloud Function `analyzeDiary`（2nd gen, asia-northeast1）がサーバー側で本人（`users/{uid}/entries`）の日記だけを Admin SDK で読み、
本文と日付のみ（最大200件・合計約6万文字）を Vertex AI の Gemini（`gemini-2.5-flash`、`functions/src/index.ts` の定数で変更可）に送ります。
APIキーは使わず、関数のサービスアカウント（ADC）で認証します。Firestore ルールは変更していません。

### 初回セットアップ（コンソール作業）
1. Google Cloud コンソール（プロジェクト `kith-diary`）で **Vertex AI API**（`aiplatform.googleapis.com`）を有効化
   `gcloud services enable aiplatform.googleapis.com --project kith-diary`
2. 関数の実行サービスアカウント（既定: `<PROJECT_NUMBER>-compute@developer.gserviceaccount.com`）に **Vertex AI ユーザー**（`roles/aiplatform.user`）を付与
   `gcloud projects add-iam-policy-binding kith-diary --member=serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com --role=roles/aiplatform.user`
3. デプロイ
   ```
   cd functions && npm install && cd ..
   npm run build
   firebase deploy --only functions,hosting
   ```

### 費用
Blaze プランの従量課金。Gemini Flash は入力100万トークンあたり数十円程度で、1回の分析（最大6万文字）は通常1円前後です。Cloud Functions も無料枠内に収まることがほとんどです。念のため Cloud Billing で予算アラートの設定を推奨します。

### プライバシー
Vertex AI（有料・Google Cloud 規約）経由のため、送信した日記は Google のモデル学習に使われません。不正利用監視のため一時的に処理されることはあります。無料の Gemini Developer API キーは使っていません。
