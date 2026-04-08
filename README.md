# Private Assistant PWA (Next.js)

Production-ready private personal assistant with chat-based expense tracking, reminders, and notes.

## Stack

- Next.js 16 (App Router)
- Tailwind CSS 4
- SQLite (`better-sqlite3`) with repository abstraction
- Auth via signed session cookie (JWT with `jose`)
- `node-cron` reminder scheduler
- PWA via `next-pwa`

## Features

- Password-protected app and APIs
- Chat UI (WhatsApp/Telegram style)
- Intent parsing for:
  - `expense_add`
  - `expense_report`
  - `reminder_create`
  - `note_create`
  - `note_list`
  - `note_search`
  - `fallback`
- Notes support:
  - save/list/search/delete
- Message persistence
- Offline-first queue:
  - expense + note commands work offline and sync when online
- Installable PWA with manifest + service worker

## Folder Structure

```text
app/
  api/
    auth/{login,logout,session}/route.ts
    chat/route.ts
    messages/route.ts
    notes/route.ts
    notes/[id]/route.ts
    expenses/route.ts
    expenses/report/route.ts
    reminders/route.ts
    sync/route.ts
  chat/page.tsx
  login/page.tsx
  manifest.ts
  offline/page.tsx
  layout.tsx
  page.tsx
components/
  chat-client.tsx
lib/
  auth/{guards.ts,session.ts}
  chat/{brain.ts,parser.ts}
  config/env.ts
  db/client.ts
  repositories/
    index.ts
    types.ts
    sqlite/*
  scheduler/reminder-scheduler.ts
  shared/types.ts
instrumentation.ts
proxy.ts
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env.local
```

3. Start development:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Command Examples

- `spent 250 food`
- `weekly expense report`
- `remind me gym at 7pm`
- `note: buy milk tomorrow`
- `save note project ideas #work`
- `show notes`
- `find note about gym`
- `delete note 2`

## API Endpoints

- `POST /api/chat`
- `GET /api/notes`
- `POST /api/notes`
- `DELETE /api/notes/:id`
- `POST /api/expenses`
- `GET /api/expenses/report?range=daily|weekly|monthly`
- `GET /api/reminders`
- `POST /api/reminders`
- `GET /api/messages`
- `POST /api/sync`

## Deploy

### Vercel

1. Push repository to GitHub.
2. Import project into Vercel.
3. Add environment variables from `.env.example`.
4. Deploy.

Note: `node-cron` is best-effort on serverless platforms because instances can sleep. For guaranteed reminder execution, use Render background worker or a dedicated scheduler process.

### Render (recommended for scheduler reliability)

1. Create a new Web Service from this repo.
2. Build command: `npm install && npm run build`
3. Start command: `npm run start`
4. Add env vars.
5. Set persistent disk path and keep `DATABASE_URL=./data/personal-assistant.db` (or move to mounted disk path).

## Switching Database Provider

`lib/repositories/index.ts` centralizes provider selection via `DB_PROVIDER`.

- `sqlite` is implemented.
- `mongodb` is intentionally unimplemented placeholder, ready for repository drop-in without changing route handlers/chat logic.
