// One student's marks in one class, worked out the same way everywhere:
// the student's course page and the TA's "view report" page both use this,
// so they always show the same numbers. best-of rules are applied.
import { sortAssessments } from "@/lib/assessment-order";
import { bestOfFromSectionCourse, countedAssessmentIds, type BestOf } from "@/lib/best-of";

type Supabase = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

export type ReportRow = {
  id: string;
  title: string;
  type: string;
  maxMarks: number;
  weight: number;
  score: number | null;
  abs: number | null;
  notCountedReason: string | null;
  classAvg: number | null;
  classHigh: number | null;
  classLow: number | null;
  classAvgAbs: number | null;
};

export type ReportGroup = {
  type: string;
  label: string;
  rows: ReportRow[];
  // absolutes earned on counted marks, and the weight of those counted marks
  obtained: number;
  weight: number;
  // weight of every assessment of this type that would count (best-of applied)
  possible: number;
  note: string | null;
};

export type CourseReport = {
  groups: ReportGroup[];
  obtained: number;
  weight: number;
  possible: number;
  gradedCount: number;
  bestOfNotes: string[];
};

const GROUP_LABELS: Record<string, string> = {
  assignment: "Assignments",
  quiz: "Quizzes",
  cp: "Class Participation",
  mid: "Midterm",
  final: "Final",
  project: "Project",
};

type AssessmentInput = {
  id: string;
  title: string;
  type: string;
  max_marks: number;
  weight: number;
  created_at: string;
};

export function buildCourseReport({
  assessments,
  scores,
  bestOf,
  classAverages,
}: {
  assessments: AssessmentInput[];
  scores: Map<string, number>;
  bestOf: BestOf;
  classAverages: Map<string, { avg: number; high: number; low: number }>;
}): CourseReport {
  const countedIds = countedAssessmentIds(assessments, scores, bestOf);
  const count = (type: string) => assessments.filter((a) => a.type === type).length;
  const totalQuizzes = count("quiz");
  const totalAssignments = count("assignment");

  const groups: ReportGroup[] = [];
  let gradedCount = 0;

  for (const a of sortAssessments(assessments)) {
    const score = scores.get(a.id);
    const hasScore = score !== undefined;
    if (hasScore) gradedCount++;
    const isCounted = hasScore && countedIds.has(a.id);

    let notCountedReason: string | null = null;
    if (hasScore && !isCounted) {
      if (a.type === "quiz" && bestOf.quiz) notCountedReason = `Not counted (best ${bestOf.quiz} of ${totalQuizzes})`;
      else if (a.type === "assignment" && bestOf.assignment)
        notCountedReason = `Not counted (best ${bestOf.assignment} of ${totalAssignments})`;
      else notCountedReason = "Not counted";
    }

    const weight = Number(a.weight) || 0;
    const abs = hasScore && isCounted && a.max_marks > 0 ? ((score as number) / a.max_marks) * weight : null;
    const stats = classAverages.get(a.id);
    const classAvg = stats?.avg ?? null;

    let group = groups.find((g) => g.type === a.type);
    if (!group) {
      group = {
        type: a.type,
        label: GROUP_LABELS[a.type] || a.type.charAt(0).toUpperCase() + a.type.slice(1),
        rows: [],
        obtained: 0,
        weight: 0,
        possible: 0,
        note: null,
      };
      groups.push(group);
    }

    group.rows.push({
      id: a.id,
      title: a.title,
      type: a.type,
      maxMarks: a.max_marks,
      weight,
      score: hasScore ? (score as number) : null,
      abs,
      notCountedReason,
      classAvg,
      classHigh: stats?.high ?? null,
      classLow: stats?.low ?? null,
      classAvgAbs: classAvg !== null && a.max_marks > 0 ? (classAvg / a.max_marks) * weight : null,
    });

    if (abs !== null) {
      group.obtained += abs;
      group.weight += weight;
    }
  }

  // what the whole type is worth: all weights, or the n biggest when best-of is set
  for (const g of groups) {
    const weights = g.rows.map((r) => r.weight).sort((x, y) => y - x);
    const limit = g.type === "quiz" ? bestOf.quiz : g.type === "assignment" ? bestOf.assignment : null;
    const counted = limit && limit < weights.length ? weights.slice(0, limit) : weights;
    g.possible = counted.reduce((s, w) => s + w, 0);
    if (g.type === "quiz" && bestOf.quiz) g.note = `Best ${bestOf.quiz} of ${totalQuizzes} count`;
    if (g.type === "assignment" && bestOf.assignment) g.note = `Best ${bestOf.assignment} of ${totalAssignments} count`;
  }

  const bestOfNotes: string[] = [];
  if (bestOf.quiz) bestOfNotes.push(`Best ${bestOf.quiz} of ${totalQuizzes} quizzes count.`);
  if (bestOf.assignment) bestOfNotes.push(`Best ${bestOf.assignment} of ${totalAssignments} assignments count.`);

  return {
    groups,
    obtained: groups.reduce((s, g) => s + g.obtained, 0),
    weight: groups.reduce((s, g) => s + g.weight, 0),
    possible: groups.reduce((s, g) => s + g.possible, 0),
    gradedCount,
    bestOfNotes,
  };
}

/**
 * Loads everything for one enrollment and builds its report. Works for the
 * student (their own enrollment) and the TA (any enrollment) because the
 * database rules decide what each can read. Returns null if the class isn't set up.
 */
export async function loadCourseReport(
  supabase: Supabase,
  enrollment: { id: string; section_id: string; course_id: string }
): Promise<CourseReport | null> {
  const [{ data: sectionCourse }, { data: marks }] = await Promise.all([
    supabase
      .from("section_courses")
      .select("id, best_of_quizzes, best_of_assignments")
      .eq("section_id", enrollment.section_id)
      .eq("course_id", enrollment.course_id)
      .single(),
    supabase.from("marks").select("assessment_id, score").eq("enrollment_id", enrollment.id),
  ]);

  if (!sectionCourse?.id) return null;

  const [{ data: assessments }, { data: rawAverages }] = await Promise.all([
    supabase
      .from("assessments")
      .select("id, title, type, max_marks, weight, created_at")
      .eq("section_course_id", sectionCourse.id)
      .order("created_at", { ascending: true }),
    supabase.rpc("class_averages_for_section_course", { p_sc_id: sectionCourse.id }),
  ]);

  const classAverages = new Map<string, { avg: number; high: number; low: number }>();
  if (rawAverages) {
    const avgObj = rawAverages as Record<string, { avg: number | null; high: number | null; low: number | null } | null>;
    for (const [id, stats] of Object.entries(avgObj)) {
      if (stats && stats.avg !== null && stats.avg !== undefined) {
        classAverages.set(id, { avg: stats.avg, high: stats.high as number, low: stats.low as number });
      }
    }
  }

  // a mark row with no score means "not graded yet", not zero
  const scores = new Map<string, number>();
  for (const m of marks || []) {
    if (m.score === null || m.score === undefined) continue;
    scores.set(m.assessment_id, Number(m.score));
  }

  return buildCourseReport({
    assessments: (assessments || []) as AssessmentInput[],
    scores,
    bestOf: bestOfFromSectionCourse(sectionCourse),
    classAverages,
  });
}
