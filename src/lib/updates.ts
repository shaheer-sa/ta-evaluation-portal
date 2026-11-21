// Release notes. Every update that changes what people see gets an entry here
// (newest first). They show in the bell under "Updates" and on the What's New
// page, and each user's "seen" state is kept in the database (user_seen).
//
// Writing style: formal, short, user-facing. Say what changed and where to find
// it. Use "New", "Improved" or "Fixed" for each item.

export type UpdateKind = "new" | "improved" | "fixed";
export type Audience = "ta" | "student";

export type ReleaseItem = {
  kind: UpdateKind;
  title: string;
  body: string;
  audience: Audience[];
};

export type Release = {
  id: string; // a-z, 0-9 and dashes only (stored as "release:<id>")
  date: string; // YYYY-MM-DD
  title: string;
  summary: Partial<Record<Audience, string>>;
  items: ReleaseItem[];
};

export const RELEASES: Release[] = [
  {
    id: "2026-11-22-reports",
    date: "2026-11-22",
    title: "Issue Reports Update",
    summary: {
      ta: "Screenshots in issue reports now open on the same page.",
    },
    items: [
      {
        kind: "improved",
        title: "Screenshot viewer",
        body: "Select a screenshot in an issue report to view it full size without leaving the page. Close it with the × button, the Esc key, or by clicking outside the image. Use the arrows to move between screenshots.",
        audience: ["ta"],
      },
    ],
  },
  {
    id: "2026-11-22-filters",
    date: "2026-11-22",
    title: "Analytics Filter Update",
    summary: {
      ta: "More ways to filter students in Analytics.",
    },
    items: [
      {
        kind: "improved",
        title: "More filter conditions",
        body: "The Analytics filter now supports less than, less than or equal to, equal to, greater than or equal to, and greater than, for assignment, quiz or overall absolutes.",
        audience: ["ta"],
      },
    ],
  },
  {
    id: "2026-11-22",
    date: "2026-11-22",
    title: "November Update",
    summary: {
      ta: "New student reports and filters in Analytics, and release notes in TAMS.",
      student: "Clearer course breakdowns and release notes in TAMS.",
    },
    items: [
      {
        kind: "new",
        title: "Student reports in Analytics",
        body: "Open any student's complete course report from Analytics using View full report. It lists assignment and quiz marks separately, followed by the combined total, exactly as the student sees it.",
        audience: ["ta"],
      },
      {
        kind: "new",
        title: "Filter students by absolutes",
        body: "Show only the students below a chosen number of absolutes in assignments, quizzes or overall. Best-of rules are applied to every total.",
        audience: ["ta"],
      },
      {
        kind: "improved",
        title: "Assignment and quiz totals per student",
        body: "The Analytics table now shows each student's assignment and quiz absolutes next to their overall total.",
        audience: ["ta"],
      },
      {
        kind: "improved",
        title: "Separate totals on your course page",
        body: "Your course page now shows a total for assignments and a total for quizzes, followed by a combined total of all counted marks.",
        audience: ["student"],
      },
      {
        kind: "improved",
        title: "Issue report follow-up",
        body: "When a reported issue is marked as fixed, the student who reported it is notified in TAMS and by email. Reports that cannot be sent now show an error code to help with troubleshooting.",
        audience: ["ta"],
      },
      {
        kind: "new",
        title: "Release notes",
        body: "Updates to TAMS are now announced in your notifications and listed on the What's New page.",
        audience: ["ta", "student"],
      },
    ],
  },
  {
    id: "2026-11-16",
    date: "2026-11-16",
    title: "Design and Performance Update",
    summary: {
      ta: "Dark mode, a refreshed design, faster pages and a clearer Analytics ranking.",
      student: "Dark mode, a refreshed design and faster pages.",
    },
    items: [
      {
        kind: "new",
        title: "Dark mode",
        body: "Switch between light and dark mode with the moon icon in the top bar. Your choice is remembered on this device.",
        audience: ["ta", "student"],
      },
      {
        kind: "improved",
        title: "Refreshed design",
        body: "A new navy sidebar, clearer headings and colour-coded summary cards make pages easier to scan.",
        audience: ["ta", "student"],
      },
      {
        kind: "improved",
        title: "Faster loading",
        body: "Pages load noticeably faster, especially on mobile data and slower connections.",
        audience: ["ta", "student"],
      },
      {
        kind: "fixed",
        title: "Analytics ranking",
        body: "Students with only a few marks entered no longer rank above students who have all their marks. Missing marks now count as zero in the ranking.",
        audience: ["ta"],
      },
      {
        kind: "improved",
        title: "Max and Min",
        body: "Highest and Lowest are now labelled Max and Min. In Analytics, select a Max or Min value to see which students scored it.",
        audience: ["ta"],
      },
    ],
  },
];

// new-feature sticky notes: shown next to the feature until dismissed, and
// only for a few weeks after the release
export const FEATURE_NOTES: Record<string, { release: string; title: string; body: string; audience: Audience }> = {
  "analytics-filters": {
    release: "2026-11-22",
    title: "New in Analytics",
    body: "Filter the class below a number of absolutes, see assignment and quiz totals per student, and open a full student report from any row.",
    audience: "ta",
  },
  "analytics-filter-conditions": {
    release: "2026-11-22",
    title: "New in Analytics",
    body: 'Choose a condition for the filter: less than, equal to, greater than, or their "or equal to" versions.',
    audience: "ta",
  },
  "course-totals": {
    release: "2026-11-22",
    title: "New on this page",
    body: "Assignments and quizzes now have their own totals, with a combined total at the end.",
    audience: "student",
  },
  "bell-updates": {
    release: "2026-11-22",
    title: "Release notes",
    body: "TAMS updates now appear in your notifications under Updates.",
    audience: "student",
  },
};

const NOTE_DAYS = 21; // sticky notes stop showing after this
const RELEASE_DAYS = 45; // releases older than this aren't shown as unread

function daysSince(date: string) {
  return (Date.now() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000;
}

/** releases with only the items for this role (empty releases dropped) */
export function releasesFor(role: Audience): Release[] {
  return RELEASES.map((r) => ({ ...r, items: r.items.filter((i) => i.audience.includes(role)) })).filter(
    (r) => r.items.length > 0
  );
}

export function isRecentRelease(r: Release) {
  return daysSince(r.date) <= RELEASE_DAYS;
}

export function noteIsActive(noteId: string, role: Audience) {
  const n = FEATURE_NOTES[noteId];
  return !!n && n.audience === role && daysSince(n.release) <= NOTE_DAYS;
}

export function formatReleaseDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const KIND_LABELS: Record<UpdateKind, string> = { new: "New", improved: "Improved", fixed: "Fixed" };
