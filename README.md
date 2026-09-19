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

1. Google ログイン / ログアウト（許可メール: `owner@example.com`）
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

Rules also live under `firebase/` for convenience.

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

- Auth is gated client-side and by Firestore/Storage rules to `owner@example.com`.
- Passkey / WebAuthn and AI comment generation exist on the live/iOS side but are not required for this rebuild; `ai_comment` is displayed when present.
- App Check enforcement stays OFF; initialization is best-effort.
