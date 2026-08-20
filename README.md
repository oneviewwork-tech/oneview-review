# ONEVIEW Review

Internal platform for collecting and distributing employee performance feedback.

**Collect → Review → Confirm → Send**

Department Heads submit monthly feedback for employees in their own department. HR reviews each submission, previews the exact email that will go out, confirms it, and sends every confirmed email in one bulk action through Resend.

Part of the ONEVIEW family: Projects · People · Finance · Review.

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Database | PostgreSQL (Neon) via Prisma 6 |
| Auth | NextAuth v5, Credentials + JWT sessions |
| Email | Resend |
| Styling | Tailwind v4, hand-written UI primitives |
| Tests | Vitest |

---

## Local setup

```bash
npm install
cp .env.example .env      # then fill in real values
npx prisma migrate deploy # or `migrate dev` when changing the schema
npm run db:seed           # creates the two organizations
npm run dev
```

### Loading real people

`db:seed` creates the organizations and nothing else — no invented employees,
because a fake record is indistinguishable from a real one once mixed in.
Real people come from HR's spreadsheet:

```bash
npm run db:import -- "path/to/HRMS DATA - DEP.xlsx" HARISCO
```

One sheet per department; the importer matches employees on email, so
correcting the sheet and re-running updates in place rather than duplicating.
Rows without an email address are **reported and skipped** — email is how an
employee is identified here and where their review is delivered, so it cannot
be invented. Pass `HACA` as the last argument to load the other organization.

### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon **pooled** connection string. Used at runtime. |
| `DIRECT_URL` | yes | Neon **direct** (non-pooled) string. Used by Prisma Migrate. |
| `AUTH_SECRET` | yes | `openssl rand -base64 32`. Rotating it invalidates all sessions. |
| `RESEND_API_KEY` | yes in prod | Without it, dev logs emails to the console instead of sending. |
| `EMAIL_FROM` | yes in prod | Must be a Resend-verified domain, e.g. `ONEVIEW Review <no-reply@yourdomain.com>`. |

---

## Deploying to Vercel

1. **Import the repo** into Vercel. Framework preset: Next.js. No build-command overrides needed — `postinstall` runs `prisma generate`.
2. **Add the environment variables** above to Production (and Preview, if you want previews to work). Point Preview at a separate database if you don't want previews writing to production data.
3. **Run migrations against production** before the first deploy:
   ```bash
   DATABASE_URL="<prod pooled>" DIRECT_URL="<prod direct>" npx prisma migrate deploy
   ```
   Migrations are deliberately **not** run automatically at build time — a build failure mid-migration would leave the schema half-applied.
4. **Seed the first admin** (once):
   ```bash
   DATABASE_URL="<prod pooled>" DIRECT_URL="<prod direct>" npm run db:seed
   ```
   Then sign in as the admin, change the password when prompted, and create the real users from **Admin → Users**.
5. **Verify** `https://<your-domain>/api/health` returns `{"status":"ok"}`.

### Performance

The database is in Singapore (`ap-southeast-1`), and page latency is dominated by **network round trips, not query time** — measured against the live database, Postgres executes the dashboard aggregation in ~0.05 ms while a single round trip from outside the region costs ~85 ms.

Three things follow from that, all already in place:

1. **`vercel.json` pins the deployment to `sin1`**, so the app runs beside the database instead of calling across the world. If the database region ever changes, change this too.
2. **Every page issues its queries in parallel.** The HR overview runs five queries in ~117 ms total, barely more than one round trip — not 5 × 85 ms. When adding a query to a page, add it to the existing `Promise.all` rather than `await`ing it separately.
3. **Counts are aggregated in Postgres** (`groupBy`), never by fetching rows and calling `.length`.

### Idle, wake-up, and the 2–3 days a month this is actually used

This system is used intensively for a few days each review cycle and sits
untouched the rest of the month. Two things go cold in between:

- **The serverless function** — no warm instance to reuse, so the first
  request pays a cold start.
- **The Neon compute** — it auto-suspends after ~5 minutes idle.

Measured on this deployment: a cold request through `/api/warm` took
**2142 ms**; once warm the same call took **64 ms**. So the wake-up cost is
real, but it is paid *once*, by whoever signs in first.

**`GET /api/warm`** exists to pay that cost before a person does. It runs the
same shape of query the dashboard opens with, so the connection, the query
planner and the Prisma client are all warm afterwards. It needs no auth, so
an external pinger can call it.

**Do not leave a pinger running around the clock.** Pinging every few minutes
keeps the database compute awake 24/7, and Neon meters compute hours on its
smaller plans — a month of that can exhaust the allowance and get the
database suspended, which is a far worse outage than a 2-second cold start.
Check your plan's compute-hour allowance before scheduling anything.

For a system used a few days a month, the sensible options are, in order:

1. **Warm it up manually** on the morning of a review day — open
   `https://<your-domain>/api/warm` once, and everything after it is fast.
   Costs nothing, and covers the actual need.
2. **Schedule a pinger only for the days you're using it** (UptimeRobot,
   cron-job.org — both free) hitting `/api/warm` every 5 minutes, and pause
   it when the cycle is done.
3. **Disable scale-to-zero in Neon** if you're on a plan that allows it and
   want it permanently instant — this trades compute hours for latency, so
   only do it knowingly.

`src/lib/prisma.ts` also pings every 4 minutes when running on a long-lived
server (local `next start`), and deliberately skips it on Vercel, where there
is no persistent event loop between invocations for the timer to live in.

### Production notes

- Every account created by the seed or by an Admin starts with `mustChangePassword`, and the proxy holds the user on `/change-password` until it's done.
- Security headers (HSTS, `X-Frame-Options: DENY`, nosniff, Permissions-Policy) come from `next.config.ts`; the CSP is built per-request with a nonce in `src/proxy.ts` because Next's App Router streams inline scripts.
- Account lockout: 5 failed logins locks an account for 15 minutes.
- The Prisma keep-alive ping in `src/lib/prisma.ts` is skipped on Vercel (no persistent event loop between invocations); Neon cold starts are handled by the pooled endpoint instead.

---

## Roles

| Role | Can |
| --- | --- |
| **Department Head** | Submit feedback for employees **in their own department only** (enforced server-side, not just in the dropdown); revise submissions HR sends back; see their own submission history. |
| **HR** | See all departments, review and confirm submissions, request revisions, bulk-send confirmed emails, resend individual emails, view email history. |
| **Admin** | Everything HR and a Department Head can do, plus managing organizations' departments, employees, and user logins. Admins have no department of their own, so they pick organization → department when submitting a review. |

---

## The A/B/C templates

A, B, and C are **email template types, not performance grades**:

| Template | Used for |
| --- | --- |
| **A** | Strong performance / appreciation |
| **B** | Development focus areas |
| **C** | Performance improvement + action plan |

Template copy lives in one place — `src/domain/email/templates.ts`. The only part that varies per submission is the Department Head's `{{feedback}}`; `{{employee_name}}`, `{{month_name}}` and `{{year}}` are filled in automatically. Never duplicate template copy elsewhere in the app.

---

## Safeguards

- **One submission per employee per month** — enforced by a DB unique constraint, so two conflicting reviews can't reach the same employee.
- **No duplicate sends** — only `CONFIRMED` submissions are eligible for "Send All Confirmed"; `SENT` ones are excluded. Re-sending is an explicit, separate action.
- **Failed sends are never marked SENT** — the submission stays `CONFIRMED` with the error recorded, so it stays retryable.
- **Append-only audit trail** — logins, confirmations, revisions, and every send/failure. This also backs the Email History screen.

---

## Scripts

```bash
npm run dev          # dev server
npm run build        # production build
npm run test         # vitest
npm run db:seed          # create the two organizations (+ optional first admin)
npm run db:import -- <xlsx> [ORG]   # import employees from HR's spreadsheet
npm run db:cleanup-demo  # remove leftover @company.com demo records
npx prisma studio        # browse the database
```
