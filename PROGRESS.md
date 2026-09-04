# TAMS — Bug Fix Progress Log

Last updated: this session. Read this before doing anything else if
you're picking this back up in a new conversation — it tells you
what's actually been verified and fixed vs. what's still open.

## Security

- `.env.local` contains a **live Supabase service role key**. Treat it
  as compromised and **rotate it in the Supabase dashboard** — it was
  uploaded to an AI sandbox for debugging, which is reason enough on
  its own regardless of anything else. (Not included in this zip —
  see note at the bottom.)

## Fixed and build-verified in this session

1. **Term activation bug** (`src/app/(dashboard)/ta/courses/actions.ts`)
   - Root cause: `createTerm()` did a raw `insert` into `terms`
     instead of going through the `activate_term()` database function.
   - Correction to the original bug report: this does NOT silently
     create multiple active terms — the schema's unique index on
     `terms.is_active` prevents that at the database level (confirmed
     by reproducing it directly against Postgres). The real symptom is
     an unhandled `duplicate key value violates unique constraint
     "one_active_term_only"` error the moment a TA tries to create a
     second active term.
   - Fix: insert the new term as `is_active: false`, then call
     `supabase.rpc("activate_term", { p_term_id })` when the TA wants
     it active. Tested end-to-end against a real Postgres instance
     with the actual schema before and after the fix.

4. **Assessment deletion had no confirmation**
   (`src/components/ui/alert-dialog.tsx` — new,
   `src/components/delete-assessment-button.tsx` — new,
   `src/app/(dashboard)/ta/assessments/page.tsx` — updated)
   - Added the shadcn `AlertDialog` component (new dependency:
     `@radix-ui/react-alert-dialog`, already added to `package.json`)
   - Deleting an assessment now requires an explicit "Yes, delete it"
     confirmation and states plainly that it removes all student marks
     for that assessment.

5. **Forgot-password lacked roll-number parity with login**
   (`src/app/(auth)/forgot-password/page.tsx`,
   `src/app/api/auth/forgot-password/route.ts`)

6. **Google Sheets Sync - Smart Memory & Resilience**
   (`src/app/api/sync/google/route.ts`)
   - Re-architected the sync engine to process students in batches, handle errors gracefully, and report per-student success/failure metrics to the UI.
   - Introduced a Smart Memory system (`sheet_synced_score`) that powers robust two-way syncing.
   - Added a "Safe Mode" that prevents destructive grade deletions from TAMS if a TA accidentally wipes a column in the Google Sheet (it now restores the grades back to the sheet instead).
   - Replaced UUID column headers with human-readable Assessment Names to keep the Google Sheet clean.
   - Hardened the student lookup logic to map heavily by `roll_number` instead of just generated emails, preventing sync breaks during email format migrations (e.g. switching to `@cfd.nu.edu.pk`).

7. **Auth Callback Hash-Fragment Bug**
   (`src/app/auth/callback/page.tsx` — new Client component)
   - Fixed a critical login lockout loop where Supabase sent legacy `#access_token` hash fragments for password resets that the server-side Next.js router couldn't read.
   - Replaced the server `route.ts` with a Client-Side Component `page.tsx` that natively hooks into `@supabase/ssr`'s hash fragment detection, instantly establishing the session and redirecting the user safely to the New Password screen.
   - Now accepts a roll number or an email, resolved to the account's
     email via the same admin-client lookup pattern `login/route.ts`
     already used. Enumeration protection preserved (same generic
     success response either way).

6. **Reset-password page had no session guard**
   (`src/app/(auth)/reset-password/page.tsx`)
   - The page previously rendered the "set new password" form for
     anyone who opened the URL, whether or not they'd arrived via a
     valid recovery link. It now checks for a real session on load;
     if there isn't one, it shows a "this link isn't valid" screen
     with a path to request a new one, instead of a form that would
     silently fail.
   - Note: middleware.ts still intentionally allows this route through
     regardless of auth state (`RESET_ROUTE` bypass) — that's correct
     and unchanged; the actual guard now lives in the component, which
     is where the real gap was.

7. **Google Sheets sync rewrite**
   (`src/app/api/sync/google/route.ts`,
   `src/app/(dashboard)/ta/roster/page.tsx`)
   - Replaced the serial loop with 300ms delays with a
     concurrency-limited batch approach (batches of 5 students at a
     time via `Promise.all`, sequential between batches).
   - Response changed from `{ success: true, message: "Sync complete!" }`
     to a structured `SyncResponse` with `invited`, `existing`, and
     `failed` arrays (each with email, roll number, name, outcome,
     and error detail), plus `gradesWritten` flag and `totalProcessed`.
   - Roster page now displays the breakdown in a dedicated "Sync
     Results" card after each sync, with per-student outcome lists.
   - Enrollment insert now tolerates `23505` unique-constraint
     violations (already enrolled), categorized as "existing" rather
     than silently skipped.

8. **Wired up `get_class_average()` RPC**
   (`src/app/(dashboard)/student/course/[id]/page.tsx`)
   - Calls `supabase.rpc("get_class_average", { p_assessment_id })`
     for each assessment, run in parallel via `Promise.all`.
   - Student assessment breakdown table now has a "Class Avg" column
     showing the class average score and percentage alongside their
     own score.

9. **TA dashboard stats scoped to the active term**
   (`src/app/(dashboard)/ta/page.tsx`)
   - All four stat cards (Students, Courses, Assessments, Pending
     Queries) now filter through: active term → sections → enrollments
     / section_courses / assessments / queries.
   - Recent queries list is also term-scoped.
   - Stat descriptions now reference the active term name instead of
     generic "all sections" text.
   - If there's no active term, all stats show zero (correct behavior).

10. **Threaded replies on queries**
    (`src/app/api/queries/replies/route.ts` — new,
    `src/components/query-thread.tsx` — new,
    `src/app/(dashboard)/ta/queries/page.tsx` — updated,
    `src/app/(dashboard)/student/queries/page.tsx` — updated,
    `src/types/database.ts` — updated)
    - New API route at `/api/queries/replies` with GET (fetch replies
      for a query) and POST (create reply with cross-party
      notifications).
    - New `QueryThread` client component: chat-like UI with TA
      messages right-aligned and student messages left-aligned,
      Enter-to-send, timestamp formatting.
    - Both TA and student query pages now have a "Thread" toggle
      button per query that expands the reply thread inline.
    - Added `Reply` interface to `database.ts`.

11. **Resend Email Integration**
    (`src/lib/email.ts` — new,
    `src/app/api/queries/route.ts` — updated,
    `.env.local.example` — updated)
    - Installed `resend`.
    - Added a reusable email sending utility in `src/lib/email.ts` that safely falls back if the API key is missing or is a placeholder.
    - Updated query API to send emails to all TAs when a student creates a query.
    - Updated query API to send an email to the student when a TA updates their query's status.
    - Added `RESEND_API_KEY` to the environment files.

12. **Database Type Generation**
    (`src/types/database.ts` — updated,
    `src/app/(dashboard)/ta/sections/page.tsx` — updated,
    `src/app/(dashboard)/ta/assessments/page.tsx` — updated)
    - Replaced handwritten generic interfaces with a comprehensive Supabase `Database` type definition, structured exactly as the CLI generates.
    - Removed all `@ts-expect-error` suppressions from nested join fetches across the dashboard, as they are now fully statically typed by the new schema (with `any` casts where Supabase JS strictly inferred arrays).

13. **Analytics Dashboard**
    (`src/app/(dashboard)/ta/analytics/page.tsx` — new,
    `src/app/(dashboard)/ta/analytics/analytics-charts.tsx` — new,
    `src/app/(dashboard)/layout.tsx` — updated)
    - Installed `recharts`.
    - Built an analytics dashboard available in the TA navigation.
    - Added Grade Distribution (bar chart) across all assessments.
    - Added Class Averages (pie chart) for cross-section and cross-course performance comparisons.
    - The data is scoped dynamically to the currently active term.

14. **Action result and error handling standardization**
    - Converted all server actions in `courses/actions.ts` and `sections/actions.ts` to return `ActionResult` instead of throwing errors.
    - Wrapped client-side transitions in `entity-actions.tsx`, `client-form.tsx`, `edit-assessment-dialog.tsx`, and `delete-assessment-button.tsx` with `try/catch` blocks to gracefully handle synchronous throws (like `requireTA()` session failures) and clear pending states.
    - Parameterized `friendlyDbError` to include the specific entity name (e.g., "That course already exists", "That section is still linked").
    - Fixed a bug in `linkCourseToSection` where Postgres constraint `23505` (already linked) was swallowed, falsely reporting success.

15. **Mark clearance persistence and Google Sync reconciliation**
    - Root cause: Deleting a mark via the grading UI removed the row entirely, which caused the next Google Sync to re-import the old grade from the sheet because TAMS no longer had a record of the clearance.
    - Fix: Modified `api/grading/route.ts` to update the mark to `score = null, sheet_synced_score = null` instead of doing a hard `delete()`. 
    - Updated `api/sync/google/route.ts` to detect this `null/null` state and push a blank string to the Google Sheet, properly erasing the grade on both sides.
    - Updated `roster-client.tsx` to treat `null` scores exactly like missing rows, displaying "—" instead of a blank cell.

16. **Input validation enhancements**
    - Added string trimming, non-empty, and length constraint validations to `createTerm`, `updateTerm`, `createCourse`, `updateCourse`, `createSection`, and `updateSection`.
    - Corrected the default-password reuse check in `api/auth/complete-first-login/route.ts` to perform a case-insensitive exact match against the student's roll number, preventing bypasses like `tams@...` instead of `Tams@...`.
    - Swapped the validation order in `grading-client.tsx` so that out-of-bounds `invalidRows` are rejected before prompting the TA to confirm deletions.

17. **Schema Drift Documentation**
    - Recorded a `drop not null` fix for the `marks.score` column in `supabase/schema.sql` that had previously been applied directly to the live database.
    - Prepared SQL queries for the TA to run to detect any other schema or constraint drift between `schema.sql` and the live database.

## Corrected understanding (not "fixed" because nothing was actually broken)

- **"Missing `get_class_average()` function"** — it is NOT missing.
  It exists in the schema (unchanged from what was built and tested
  earlier). Nothing in the app currently *calls* it — that's a wiring
  gap on the student course detail page, not a missing database
  function. Don't recreate it; just call it from
  `src/app/(dashboard)/student/course/[id]/page.tsx` when you get to
  that.

## Verified as real, NOT yet fixed

- **#7 — Database typing**: `src/types/database.ts` is hand-written,
  not generated. 28 occurrences of `@ts-expect-error`/`any` across the
  codebase (mostly around Supabase's nested join return types) confirmed
  via grep.
- **#8 — Dashboard stats not scoped to the active term**
  (`src/app/(dashboard)/ta/page.tsx`): student/course/assessment/query
  counts are all-time, not filtered to the currently active term.
  Confirmed by reading the actual queries — none of them join through
  `terms.is_active`.
- **#10 — No reply-threading UI**: the `replies` table exists in the
  schema and is fully RLS-protected, but `src/app/api/queries/route.ts`
  only handles query creation and status updates — no endpoint reads
  or writes to `replies`.
- **#11 — Resend not integrated**: confirmed zero references to
  "resend" anywhere in `src/`.
- **#12 — No analytics page**: confirmed no analytics route/page
  exists in the project at all.

## Setup note for the person picking this back up

This zip does **not** include `node_modules` (regenerate with
`npm install`) or `.env.local` (contains live secrets — copy your own
local copy back in, and see the security note above about rotating
the service role key). `.env.local.example` shows the required shape.

## Future Requirements Logged (Pending Next Phase)

- **Forget Password Polish**: Verify the entire password reset flow from end-to-end (email delivery, link click, session establishment, and password update submission) and ensure edge case errors are handled.
- **Grading Section Search**: Implement a dynamic search bar in the grading section allowing TAs to quickly filter students by Roll Number or Name.
- **Edit Assessments**: Add a "Rename/Edit" feature to the assessment section so TAs can rename existing quizzes and assignments directly in the dashboard without deleting them.
- **Categorized Dropdowns (Student Portal)**: Separate the student grades view into distinct sections (Assignments, Quizzes, Class Participation) using accordion/dropdown components to unclutter the interface.
- **Global UI/UX Layout Centralization**: Center and align all major content `div` containers across the app to achieve a cleaner, more professional desktop and mobile layout.
- **Micro-interactions (Floating Hover)**: Inject dynamic CSS micro-animations to all interactive elements. Buttons, icons, and cards should gently "float" or elevate (`transform: translateY(-2px)`) when hovered, reinforcing a premium, dynamic feel.
