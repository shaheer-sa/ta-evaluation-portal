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
with a threaded reply conversation and email notifications via Gmail SMTP (nodemailer).

**Analytics.** Grade distributions and per-section class averages.

## Tech stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui ·
Supabase (Postgres + Auth) · Google Sheets API · Gmail SMTP (nodemailer)

## Getting started

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project and apply the schema

supabase/schema.sql is out of date and does not match production. Never run it against the live database. Database changes go in small files under supabase/migrations/ and are run one at a time in the Supabase SQL Editor.

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

Create an account in the Supabase Auth dashboard, then promote yourself in the SQL Editor:

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
(**Roster & Sync**) or importing a CSV. Accounts are created with an
initial password of `Tams@<roll_number>`. Upon their first login, students
are required to change this password before accessing the portal.

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

Email delivery uses Gmail SMTP (nodemailer). Set `GMAIL_USER` and `GMAIL_APP_PASSWORD` in `.env.local` before relying on notifications.

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
    email/           Gmail SMTP (nodemailer)
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

## Recent Updates

- **Google Sheets Sync**: Fixed a major bug where PostgREST bulk upsert crashed when pulling existing grades due to a Primary Key constraint violation on `id`. Sync is now completely stable.
- **TA Analytics**: Added an expandable "Marks Detail" view inside the Student Performance Table, showing detailed per-assessment grades for every student.
- **Notifications & Email**: Automated student query emails are now correctly addressed and dispatched to both TAs and students depending on the recipient role.
- **Query Status**: Statuses are now correctly formatted (e.g. `In review` instead of `in_review`) in all notifications.
