# BraimTracker

Visual, mobile-first job tracker for managing yard work and property labor on a large residential property. Owner creates jobs with photo instructions, assigns them to a worker, worker uploads **before/after photos** and logs hours, owner reviews/approves and tracks payments.

Not a corporate timecard. Not a scheduling app. Just: "did the work actually get done, and what do I owe?"

---

## Tech stack

- **Frontend** — React 18 + TypeScript + Vite + Tailwind CSS + React Router
- **API** — Vercel Serverless Functions (TypeScript) in `/api`
- **ORM** — Prisma 5
- **Database** — Neon Postgres (free tier)
- **Photos** — Vercel Blob (client-upload flow — handles large phone photos)
- **Auth** — JWT. Owner logs in with a password from env. Workers log in with a 4-digit code.
- **PWA** — manifest + iOS meta tags so workers can "Add to Home Screen" for app-style use.

---

## Seed login credentials

After running the seed script:

| Role   | Login           |
|--------|-----------------|
| Owner  | password from `OWNER_PASSWORD` env var |
| Mike   | code `1234` (hourly rate $20) |
| Jake   | code `2345` (hourly rate $18) |
| Tom    | code `3456` (hourly rate $22) |

---

## Local setup

You need: Node 20+, a free [Neon](https://neon.tech) Postgres database, and (for photo uploads locally) a Vercel account with the Blob integration added to this project.

```bash
git clone https://github.com/jayscottaf/BraimTracker.git
cd BraimTracker
npm install

# Fill in .env.local with your values
cp .env.example .env.local
# Edit .env.local:
#   DATABASE_URL  = Neon connection string (pooled)
#   DIRECT_URL    = Neon direct connection
#   JWT_SECRET    = any long random string
#   OWNER_PASSWORD = your password

# Create tables and seed
npx prisma migrate dev --name init
npm run db:seed

# Run locally with Vercel dev (handles /api functions + Blob uploads)
npx vercel dev
# Or: frontend-only (API calls will fail without vercel dev)
# npm run dev
```

Open <http://localhost:3000>.

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. On [vercel.com](https://vercel.com), **Import Project** and pick the repo. Vercel auto-detects Vite + `/api` as serverless functions.
3. Add **Neon** from the Vercel integrations marketplace (it will set `DATABASE_URL` and `DIRECT_URL` automatically).
4. Add **Vercel Blob** from the Vercel integrations (sets `BLOB_READ_WRITE_TOKEN` automatically).
5. Add these env vars manually in Project Settings → Environment Variables:
   - `JWT_SECRET` — any long random string
   - `OWNER_PASSWORD` — your owner login password
6. Deploy. The build command (`npm run vercel-build`) runs `prisma migrate deploy` against Neon, so the schema gets created on first deploy.
7. After the first deploy, run the seed once against production:
   ```bash
   vercel env pull .env.production.local
   DATABASE_URL="$(grep ^DATABASE_URL .env.production.local | cut -d= -f2- | tr -d '"')" npm run db:seed
   ```

---

## Architecture (how it works)

```
Browser (React SPA)
        │
        │ 1. fetch /api/*
        ▼
Vercel Serverless Function  (api/**/*.ts)
        │
        ├─► Prisma Client ──► Neon Postgres
        │
        └─► @vercel/blob/client (for photo upload tokens)
                │
                │ 2. client uploads image directly to Blob
                ▼
        Vercel Blob Storage (returns public URL)
                │
                │ 3. client POSTs URL back to /api/photos
                ▼
        JobPhoto row written via Prisma
```

**Request flow for the 7 priority operations:**

1. **Create job** — `POST /api/jobs` (owner) → row + ActivityLog CREATED.
2. **Assign worker** — `POST /api/jobs/:id/assign` → snapshots worker's hourly rate onto the job if mode is HOURLY.
3. **Upload instruction photos** — owner uses `<PhotoUploader>` which calls `/api/photos/upload` for a signed token, uploads to Vercel Blob, then the webhook persists the row.
4. **Worker before/after** — same flow, with `type: BEFORE` or `AFTER`.
5. **Log hours** — worker taps the timer button → `POST /api/jobs/:id/start` then `/stop`. Or `POST /api/time/manual` for fallback entry.
6. **Owner approves** — `POST /api/jobs/:id/approve` → recomputes `totalOwed`, creates a `Payment` row, status → APPROVED.
7. **Track payment** — `POST /api/payments/:id/mark-paid` → Payment.paid=true, Job.status → PAID.

**Billing logic** (`api/_lib/billing.ts`):
- `HOURLY` jobs: `totalOwed = actualHours × hourlyRate` (recomputed on every time event)
- `FLAT` jobs: `totalOwed = flatRate` (fixed regardless of hours, but hours still tracked for records)
- On approve, owner can override `actualHours` and `totalOwed` — override wins.

---

## V2 ideas (prioritized)

1. **★ Instruction photo markup / annotation** — "Circle what to trim, X out what to leave." Canvas overlay saved alongside the photo. This is the single biggest leverage feature — it's how you manage work remotely without being on-site.
2. **Recurring jobs** — "Mulch every spring", "Pool bed edging weekly".
3. **SMS notifications via Twilio** — worker gets a text when a job is assigned; owner gets a text when a job is submitted for review.
4. **Weather-aware scheduling** — don't prompt for outdoor jobs when rain is forecast.
5. **Multi-property** — second house, rental, etc. Zones nest under a Property.
6. **Expense tracking** — mulch delivery, gas, supplies tied to a job.
7. **PDF invoices/receipts** — for tax records.
8. **Worker ratings + notes** — private star rating + notes per worker over time.
9. **Offline-first** — service worker so workers can start timers and queue photo uploads with spotty connectivity.
10. **Two-tier rates** — labor vs. foreman rate on the same worker.

---

## Terminal commands (quick reference)

```bash
# Install
npm install

# DB
npx prisma migrate dev --name <name>   # create + apply a migration locally
npx prisma migrate deploy              # apply existing migrations (CI/prod)
npx prisma studio                      # browse DB in a GUI
npm run db:seed                        # run prisma/seed.ts

# Dev
npx vercel dev                         # full-stack (recommended)
npm run dev                            # Vite only

# Build
npm run build                          # prisma generate + typecheck + vite build

# Deploy
vercel deploy                          # preview
vercel deploy --prod                   # production
```

---

## Out of scope (intentionally)

- Payroll / W-2 / tax forms
- Complex scheduling or calendars
- In-app chat
- GPS / location tracking
- Multi-tenant / SaaS
- SSO / OAuth
