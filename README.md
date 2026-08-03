# Teaching Assistant Management System

This is a comprehensive management system built for Teaching Assistants to streamline course management, grading, and student communication. It was built to solve the real-world administrative overhead of managing multiple sections, grades, and student queries across a semester.

## Core Features

- Role-Based Access: Secure dashboards for both TAs and Students.
- Term and Section Management: Activate specific terms and scope all data (grades, queries, etc.) to the currently active term.
- Google Sheets Syncing: Automated batch synchronization to import student rosters directly from Google Sheets.
- Assessment Tracking: Create assignments, quizzes, and exams with custom weighting.
- Grading System: Input and track student grades with automatic class average calculations.
- Query Management: Students can submit queries regarding their assessments, and TAs can resolve them through threaded conversations.
- Automated Email Notifications: Uses Resend to automatically notify TAs of new queries and notify students when their queries are updated.
- Analytics Dashboard: Visualizations using Recharts for grade distributions and class average comparisons.

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Shadcn UI
- Supabase (Postgres & Auth)
- Resend (Email Integration)
- Google Sheets API
- Recharts (Analytics)

## Getting Started

1. Clone the repository.
2. Install dependencies with `npm install`.
3. Set up a Supabase project and apply the database schema.
4. Add your environment variables to a `.env.local` file (use `.env.local.example` as a reference).
5. Run the development server with `npm run dev`.
6. Open `http://localhost:3000` in your browser.
