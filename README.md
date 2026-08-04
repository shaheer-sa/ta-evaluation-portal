# TAMS — Teaching Assistant Management System

A role-based web application that removes the administrative friction Teaching
Assistants face when managing multiple sections, large rosters, grading, and
student communication across a semester. It works as a specialised LMS
micro-portal built around the day-to-day workflow of a university TA.

## Features

**Role-based access.** Two roles, enforced in middleware, in every API route,
and in Postgres Row Level Security. TAs administer courses, sections,
students, grading and queries. Students see only their own grades and can
raise and reply to queries.

**Term and course management.** Create academic terms and activate one at a
time. Dashboard stats, analytics and the TA query list all scope to the
active term. Courses map to sections (CS101 → Section A).

**Roster and Google Sheets sync.** Two-way sync with an external spreadsheet.
Safe Mode never deletes a mark from TAMS because a sheet cell went blank, so
a cleared or malformed sheet can't destroy grade data.

**Assessments and grading.** Quizzes, assignments, midterms, finals, projects
and class participation with custom max marks and weights. The grading table
validates every score against the assessment maximum before saving and writes
the whole class in one batched upsert.

**Queries (ticketing).** Students raise disputes against a specific
assessment. TAs triage through `pending → in_review → resolved / rejected`
with a threaded reply conversation and email notifications via Resend.

**Analytics.** Grade distributions and per-section class averages via
Recharts.

## Tech stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui ·
Supabase (Postgres + Auth) · Google Sheets API · Resend · Recharts

## Getting started

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project and apply the schema

Open the Supabase dashboard → **SQL Editor** → paste the entire contents of
[`supabase/schema.sql`](supabase/schema.sql) → **Run**.

This creates every table, index, enum, function, trigger and Row Level
Security policy the application expects. It is idempotent — safe to re-run.

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in the values. `.env.local.example` documents what each one is for and
where to find it. At minimum you need the three Supabase variables; Google
Sheets sync and email notifications degrade gracefully without their keys.

> **Never** prefix `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_`. That key
> bypasses all Row Level Security and must stay server-side.

### 4. Create your first TA

Every new account defaults to `student`. Sign up through the app or the
Supabase Auth dashboard, then promote yourself in the SQL Editor:

```sql
update profiles set role = 'ta' where email = 'you@university.edu';
```

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000.

## How students get accounts

TAs create student accounts in bulk by syncing a Google Sheet roster
(**Roster & Sync**) or importing a CSV. Accounts are created with a
cryptographically random password that nobody ever sees or types — students
claim their account through **Forgot password** on the login page, which
emails them a reset link.

Students sign in with either their email or their roll number.

## Google Sheets sync setup

1. Create a Google Cloud service account and enable the Google Sheets API.
2. Download the JSON key; copy `client_email` and `private_key` into
   `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY`.
3. Share the target spreadsheet with the service account email as an
   **Editor**, or the sync returns a 403.

The sheet's first tab is the roster. Rows 1–4 are metadata headers; student
data starts at row 5. Row 4 must contain `RollNo` and `Name` columns.

## Email delivery

Resend's shared `onboarding@resend.dev` sender only delivers to the address
that owns your Resend account — every message to a student is accepted by the
API and then silently dropped. Verify a domain at
[resend.com/domains](https://resend.com/domains) and set `RESEND_FROM_EMAIL`
before relying on notifications.

## Project structure

```
src/
  app/
    (auth)/          login, forgot-password, reset-password
    (dashboard)/     ta/* and student/* routes
    api/             route handlers (auth, grading, queries, sync)
  components/        shared components + shadcn/ui primitives
  lib/
    supabase/        browser, server, middleware and admin clients
    auth-guard.ts    requireTA() guard for Server Actions
    email.ts         Resend wrapper with HTML escaping
  types/database.ts  Postgres schema types
supabase/schema.sql  tables, RLS policies, functions, triggers
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
