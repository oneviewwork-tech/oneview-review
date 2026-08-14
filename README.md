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
npm run db:seed
npm run dev
```

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
| **Admin** | Manage departments, employees, and user logins. |

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
npm run db:seed      # seed departments, employees, and starter users
npx prisma studio    # browse the database
```
