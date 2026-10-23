import { sortAssessments } from "@/lib/assessment-order";

export type SectionCourseInfo = {
  id: string;
  best_of_quizzes?: number | null;
  best_of_assignments?: number | null;
  quiz_total_weight?: number | null;
  assignment_total_weight?: number | null;
  sections?: {
    name?: string | null;
    terms?: {
      name?: string | null;
      is_active?: boolean | null;
    } | null;
  } | null;
  courses?: {
    code?: string | null;
    name?: string | null;
    enable_cp?: boolean | null;
    enable_assignments?: boolean | null;
    enable_quizzes?: boolean | null;
  } | null;
};

export type AssessmentItem = {
  id: string;
  section_course_id: string;
  type: "assignment" | "quiz" | "mid" | "final" | "project" | "cp";
  title: string;
  max_marks: number;
  weight: number;
  created_at?: string | null;
  section_courses?: SectionCourseInfo | null;
};

export type AssessmentGroup = {
  sectionCourseId: string;
  sectionCourse: SectionCourseInfo | null;
  label: string;
  isActiveTerm: boolean;
  assessments: AssessmentItem[];
  quizCount: number;
  assignmentCount: number;
  cpCount: number;
};

export function sectionCourseLabel(sc: SectionCourseInfo | null | undefined) {
  const termName = sc?.sections?.terms?.name || "Term";
  const sectionName = sc?.sections?.name || "Sec";
  const courseCode = sc?.courses?.code || "Course";
  return { termName, sectionName, courseCode, label: `${termName} — Section ${sectionName} · ${courseCode}` };
}

// one group per class: active term first, then section name (3B before 3C),
// then course code. inside a group: assignments, quizzes, cp by number
export function groupAssessments(
  assessments: AssessmentItem[],
  sectionCourses: SectionCourseInfo[]
): AssessmentGroup[] {
  const map = new Map<string, AssessmentGroup>();

  for (const a of assessments) {
    let g = map.get(a.section_course_id);
    if (!g) {
      const sc =
        a.section_courses ||
        sectionCourses.find((s) => s.id === a.section_course_id) ||
        null;
      g = {
        sectionCourseId: a.section_course_id,
        sectionCourse: sc,
        label: sectionCourseLabel(sc).label,
        isActiveTerm: Boolean(sc?.sections?.terms?.is_active),
        assessments: [],
        quizCount: 0,
        assignmentCount: 0,
        cpCount: 0,
      };
      map.set(a.section_course_id, g);
    }
    g.assessments.push(a);
    if (a.type === "quiz") g.quizCount++;
    else if (a.type === "assignment") g.assignmentCount++;
    else if (a.type === "cp") g.cpCount++;
  }

  const opts = { numeric: true, sensitivity: "base" } as const;
  const groups = Array.from(map.values()).sort((a, b) => {
    if (a.isActiveTerm !== b.isActiveTerm) return a.isActiveTerm ? -1 : 1;
    const sec = (a.sectionCourse?.sections?.name || "").localeCompare(
      b.sectionCourse?.sections?.name || "", undefined, opts);
    if (sec !== 0) return sec;
    return (a.sectionCourse?.courses?.code || "").localeCompare(
      b.sectionCourse?.courses?.code || "", undefined, opts);
  });

  for (const g of groups) g.assessments = sortAssessments(g.assessments);
  return groups;
}
