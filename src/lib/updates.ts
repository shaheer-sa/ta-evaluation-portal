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
  action?: "marks-email" | "push"; // shows a setting right under the item
};

export type Release = {
  version: string; // shown to users, e.g. "1.4" (raise it with every release)
  id: string; // a-z, 0-9 and dashes only (stored as "release:<id>")
  date: string; // YYYY-MM-DD
  title: string;
  summary: Partial<Record<Audience, string>>;
  // an important message shown in a highlighted box with this release
  notice?: Partial<Record<Audience, string>>;
  popup?: boolean; // open it in a popup once, the next time the user visits
  items: ReleaseItem[];
};

export const RELEASES: Release[] = [
  {
    version: "1.7",
    id: "2026-11-22-notify-settings",
    date: "2026-11-22",
    title: "Notification Settings Update",
    summary: {
      ta: "Notifications stay on after logging out, and fewer duplicate emails.",
      student: "Notifications stay on after logging out, and fewer duplicate emails.",
    },
    items: [
      {
        kind: "improved",
        title: "Notifications stay on",
        body: "Notifications on a device now stay on when you log out and log back in, until you turn them off.",
        audience: ["ta", "student"],
      },
      {
        kind: "improved",
        title: "Fewer duplicate emails",
        body: "If notifications are on for one of your devices, TAMS no longer also sends you an email for the same update. If a notification can't reach any of your devices, you will still get the email.",
        audience: ["ta", "student"],
      },
    ],
  },
  {
    version: "1.6",
    id: "2026-11-22-push",
    date: "2026-11-22",
    title: "Notifications Update",
    popup: true,
    summary: {
      ta: "Get TAMS notifications on your phone or computer.",
      student: "Get TAMS notifications on your phone or computer.",
    },
    items: [
      {
        kind: "new",
        title: "Notifications on your device",
        body: "Turn on Notifications on this device at the bottom of the notifications panel to get an alert for new marks, query replies and status changes, even when TAMS isn't open. On iPhone, first add TAMS to your Home Screen from the Share menu, then open it from there.",
        audience: ["student"],
        action: "push",
      },
      {
        kind: "new",
        title: "Notifications on your device",
        body: "Turn on Notifications on this device at the bottom of the notifications panel to get an alert for new queries, replies, issue reports and password reset requests, even when TAMS isn't open. On iPhone, first add TAMS to your Home Screen from the Share menu, then open it from there.",
        audience: ["ta"],
        action: "push",
      },
    ],
  },
  {
    version: "1.5",
    id: "2026-11-22-marks",
    date: "2026-11-22",
    title: "Marks and Progress Update",
    popup: true,
    summary: {
      ta: "A list of students who may need support on the Overview, and the version number in the sidebar.",
      student: "Notifications for new marks, and an optional email when marks are posted.",
    },
    notice: {
      student:
        "Emails from TAMS are sent from tams.official.notifications@gmail.com. If you don't find an email from TAMS in your inbox, please check your Spam folder and mark it as Not spam, so future emails arrive in your inbox.",
    },
    items: [
      {
        kind: "new",
        title: "Students who may need support",
        body: "The Overview page now lists the students in each class whose overall percentage is below a level you choose (30%, 40%, 50% or 60%). Select a name to open their full report, or use Email them to write to the group.",
        audience: ["ta"],
      },
      {
        kind: "new",
        title: "New marks notifications",
        body: "You are now notified in TAMS when new marks are posted in any of your courses. Select the notification to open that course's marks.",
        audience: ["student"],
      },
      {
        kind: "new",
        title: "Email for new marks",
        body: "You can also choose to get an email when new marks are posted. It is off unless you turn it on. When it is on, TAMS sends one email in the evening listing any new marks you haven't viewed yet. You can change this at any time from the notifications panel.",
        audience: ["student"],
        action: "marks-email",
      },
      {
        kind: "new",
        title: "Version number",
        body: "The current TAMS version is shown at the bottom of the sidebar. Select it to open the What's New page.",
        audience: ["ta", "student"],
      },
    ],
  },
  {
    version: "1.4",
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
    version: "1.3",
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
    version: "1.2",
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
    version: "1.1",
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

// the version of the newest release, shown in the sidebar
export const CURRENT_VERSION = RELEASES[0]?.version ?? "1.0";

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
  "bell-push": {
    release: "2026-11-22",
    title: "Notifications on your phone",
    body: "Turn on notifications from the bell to get an alert when new marks are posted or your query gets a reply.",
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

export function daysSince(date: string) {
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
