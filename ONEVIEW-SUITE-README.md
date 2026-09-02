# The ONEVIEW Suite — What I've Built

Four internal platforms for HARIS & CO / HACA, each solving a different
operational problem for the business. This document is a plain-English
overview of each — what it is, why it exists, and how it works — for anyone
who wants the full picture without reading the code.

| Product | Solves | Stack | Status |
|---|---|---|---|
| **ONEVIEW People** | HR — people, attendance, leave, payroll | Next.js · Prisma · Postgres (Supabase) | Live in production |
| **ONEVIEW Finance** | Accounts & finance across UAE + India | Next.js · Prisma · Postgres (Neon) | Live in production |
| **ONEVIEW Review** | Monthly performance feedback → email | Next.js · Prisma · Postgres (Neon) | Live in production |
| **ONEVIEW** (Business Performance Platform) | Company-wide ops & marketing intelligence | React/Vite + Node/Express | Live (Vercel + Render) |

All four are role-gated (no page trusts the client — every sensitive action
re-checks permission on the server), keep an audit trail of who did what, and
are deployed with the database region and the app region matched on purpose,
not by accident.

---

## 1. ONEVIEW People — the HRMS

**What it is.** The system of record for every employee at the company —
their profile, their attendance, their leave, their payroll, and everything
that happens around joining, growing, and eventually leaving.

**Why it exists.** Before this, attendance came off a biometric device with
no link back to payroll, leave was tracked ad hoc, and payslips were
manual. One system now owns all of it, so the numbers agree with each other
by construction instead of by someone reconciling spreadsheets.

**How it works — what's inside:**

- **Employees** — full profile (personal, statutory, banking, documents,
  emergency contacts), org structure (departments, designations, reporting
  lines), and a searchable directory.
- **Attendance** — ingests real biometric device punches, reconciles them
  into daily in/out sessions (handles both "alternating" and "reader-labeled"
  device conventions), computes late/early-checkout minutes against each
  employee's shift, and gives HR a bulk import path for days the device
  report needs manual reconciliation.
- **Leave** — accrual engine (quarterly casual/sick, monthly menstrual/WFH,
  annual restricted holiday — each with its own eligibility rule), a
  two-level manager → HR approval flow, on-duty requests, and comp-off.
- **Payroll** — monthly pay runs computed from each employee's salary
  structure: PF (12%, capped), ESI (only below the wage limit), professional
  tax, and Loss-of-Pay proration that correctly splits a leave request across
  a month boundary instead of double-charging it. Interns get a separate,
  simpler flat-stipend calculation. Produces payslip PDFs and a statutory PF
  export.
- **Probation & exit management** — tracks probation completion and
  confirmation, and a full exit workflow (notice period → clearance →
  settlement) with per-department clearance sign-off.
- **Reports** — attendance reports by person or by whole department (PDF,
  Excel, or an on-screen view), an attrition/remote-work-by-department
  dashboard for admins, and audit/activity logs of every sensitive action
  and data change in the system.
- **Helpdesk** — an internal ticketing flow for payroll/IT/HR/attendance
  queries, so those don't happen over chat with no record.
- **ONEVIEW Assistant** — a conversational AI assistant built into the app
  (Groq-hosted LLM with tool-calling) that answers real questions in plain
  English — *"how many people are absent today?", "who's from Engineering
  and on leave?"* — by calling the same underlying, permission-checked
  actions the rest of the app uses, never by querying the database directly.
  Every query is logged the same way a human action would be.
- **Admin tools** — user/role management, department/designation/shift
  configuration, bulk employee and bulk salary import from spreadsheets
  (with a downloadable template and full validation before anything commits),
  and a demo-mode toggle that spins up an entirely separate local database
  seeded with fabricated data, so the app can be presented or tested without
  ever touching a real employee's information.

---

## 2. ONEVIEW Finance

**What it is.** The internal finance platform covering both the UAE and
India entities, in their own currencies, with a combined view converted to
a single reporting currency.

**Why it exists.** The business runs two entities in two currencies; before
this, "what's our combined position" meant manually converting and merging
two separate sets of books. This gives management one dashboard for that,
while the accounts team still works entity-by-entity in native currency.

**How it works — two workspaces:**

- **Accounts** (day-to-day) — inflow/outflow entry, client and vendor
  records, master data, and a Zoho Sheets import path for bringing in
  existing records rather than re-keying them.
- **Finance View** (management) — UAE, India, and Combined dashboards, with
  an explicit AED ↔ INR conversion layer and exchange-rate management, so
  the combined number is always traceable back to the rate that produced it.

Deployed with its serverless functions pinned to the same region as its
database (Singapore) — without that, every query round-trips halfway around
the world, turning a sub-millisecond query into a multi-second page load.

---

## 3. ONEVIEW Review

**What it is.** The platform that turns monthly performance feedback into
an actual email in the employee's inbox, with a review step in between so
nothing goes out un-checked.

**Why it exists.** Department heads writing feedback and HR sending it by
hand doesn't scale past a handful of people, and gives no record of what was
actually sent or when. This makes the whole flow — write, review, confirm,
send — a system with a paper trail.

**How it works:** **Collect → Review → Confirm → Send.**

- A **Department Head** submits feedback for employees in their own
  department only (enforced on the server, not just hidden in the UI).
- **HR** sees every submission, previews the *exact* email that will be
  sent, and either confirms it or sends it back for revision.
- Confirmed emails go out **in one bulk action** through Resend — a failed
  send is recorded as failed and stays retryable, never silently marked as
  sent.
- Three email templates (**A** — appreciation, **B** — development areas,
  **C** — improvement + action plan) are template *types*, not grades, with
  their copy centralized in one place so it's never duplicated or drifts.
- **Safeguards:** one submission per employee per month (a database
  constraint, not just a UI check), no duplicate sends, and an append-only
  audit trail covering logins, confirmations, revisions, and every email
  attempt.

Same region-matching discipline as Finance, plus a documented cold-start
story: the database auto-suspends after 5 minutes idle (it's only used
intensively a few days a month), so a `/api/warm` endpoint exists to pay
that cold-start cost once, deliberately, instead of the first real user
paying it by accident.

---

## 4. ONEVIEW — Business Performance Platform

**What it is.** The widest-scoped of the four: a company-wide business
intelligence platform pulling live data from Zoho Projects and Sprout
Social into one place, with executive-level reporting and drill-down all
the way from the company total down to a single task.

**Why it exists.** Delivery data lived in Zoho, social performance lived in
Sprout, and getting a company-wide picture meant opening both and doing the
math by hand. This syncs both into one system so the COO-level view and the
department-level detail come from the same numbers.

**How it works — by area:**

- **Delivery Operations** — company → department → project → task
  drill-down, synced from Zoho Projects; a delivery tracker; COO reports;
  and a data-quality center for catching sync issues before they reach a
  report.
- **Social Performance** — Sprout Social data by profile, network,
  engagement, and reach, with per-client breakdowns.
- **Marketing, Leads, and Shopify** — dedicated dashboards for marketing
  performance, lead pipeline, and store performance, alongside the
  delivery/social data rather than in separate tools.
- **Staff performance** — scorecards and a leaderboard hub.
- **Client reporting** — a client-facing report hub, generated per client
  and per department, plus a daily report view.
- **ONEVIEW Assistant** — a second AI assistant (this one Gemini-powered),
  answering plain-English questions over the synced data: a fast rule engine
  handles the obvious questions, Gemini with tool access handles the
  complex ones, with a conversational fallback if neither has a direct
  answer.

Ships as two deployable halves — a React/Vite frontend on Vercel and a
Node/Express API on Render — and can run entirely on mock data locally
before any real Zoho/Sprout credentials are wired in, which is also how new
UI work gets designed and reviewed before it touches the live integrations.

---

## What ties all four together

- **Server-side permission checks, always.** In every product, the actual
  security boundary is the server action / API route, never the UI — a
  button being hidden is a convenience, not the enforcement.
- **Audit trails, not just data.** People, Review, and the Business
  Performance Platform all keep a record of who did what and when, not just
  the current state.
- **Deploy where the data lives.** Finance and Review are both explicitly
  pinned to run in the same region as their database, with the actual
  round-trip-time numbers measured and written down — not assumed.
- **Real data in, fabricated data for demos.** People's demo mode and the
  Business Performance Platform's mock mode both exist for the same reason:
  so the product can be shown, tested, or designed against without ever
  risking real records.
- **AI where it earns its place.** Two of the four ship a conversational
  assistant, and in both cases it's built to call the same permission-checked
  logic the rest of the app uses — it narrates real data, it doesn't have
  its own back door to the database.
