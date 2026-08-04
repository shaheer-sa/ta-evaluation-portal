export interface NavItem {
  label: string;
  href: string;
  /** two or three characters shown when the rail is collapsed */
  short: string;
}

export const TA_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/ta/dashboard', short: 'DS' },
  { label: 'Courses', href: '/ta/courses', short: 'CO' },
  { label: 'Sections', href: '/ta/sections', short: 'SE' },
  { label: 'Students', href: '/ta/students', short: 'ST' },
  { label: 'Assessments', href: '/ta/assessments', short: 'AS' },
  { label: 'Grading', href: '/ta/grading', short: 'GR' },
  { label: 'Queries', href: '/ta/queries', short: 'QU' },
  { label: 'Sheet sync', href: '/ta/sync', short: 'SY' }
];

export const STUDENT_NAV: NavItem[] = [
  { label: 'My grades', href: '/student/grades', short: 'GR' },
  { label: 'My queries', href: '/student/queries', short: 'QU' }
];

/** Longest matching href wins, so /ta/courses/[id] still highlights Courses. */
export function activeIndexFor(items: NavItem[], pathname: string): number | null {
  let best = -1;
  let bestLen = 0;
  items.forEach((item, i) => {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (item.href.length > bestLen) {
        best = i;
        bestLen = item.href.length;
      }
    }
  });
  return best === -1 ? null : best;
}
