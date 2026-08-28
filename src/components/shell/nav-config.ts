interface NavItem {
  label: string;
  href: string;
  exact: boolean;
  /** two or three characters shown when the rail is collapsed */
  short: string;
}

export const TA_NAV: NavItem[] = [
  { href: "/ta", label: "Overview", exact: true, short: "OV" },
  { href: "/ta/courses", label: "Courses & Terms", exact: true, short: "CO" },
  { href: "/ta/sections", label: "Sections", exact: true, short: "SE" },
  { href: "/ta/roster", label: "Students", exact: false, short: "ST" },
  { href: "/ta/assessments", label: "Assessments", exact: true, short: "AS" },
  { href: "/ta/grading", label: "Grading", exact: true, short: "GR" },
  { href: "/ta/queries", label: "Queries", exact: true, short: "QU" },
  { href: "/ta/analytics", label: "Analytics", exact: true, short: "AN" },
];

export const STUDENT_NAV: NavItem[] = [
  { href: "/student", label: "My Grades", exact: true, short: "GR" },
  { href: "/student/queries", label: "Queries", exact: false, short: "QU" },
];
