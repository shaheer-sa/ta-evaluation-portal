import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Users, BookOpen, FileQuestion, ClipboardList } from "lucide-react";
import { formatStatus } from "@/lib/format";
import { rankStudents } from "@/lib/analytics-rank";
import type { AssessmentPerformance, StudentPerformance } from "./analytics/performance-table";
import { AtRiskCard, type AtRiskClass } from "./at-risk-card";

export default async function TADashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // independent lookups run together instead of one after another
  const [{ data: profile }, { data: activeTerm }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    // Get the active term — all stats are scoped to this
    supabase.from("terms").select("id, name").eq("is_active", true).single(),
  ]);

  const activeTermId = activeTerm?.id;

  // If there's no active term, everything will be zero — that's correct
  // because there's nothing to show.

  // Get section IDs for the active term
  const { data: activeSections } = activeTermId
    ? await supabase
        .from("sections")
        .select("id")
        .eq("term_id", activeTermId)
    : { data: [] };

  const activeSectionIds = (activeSections || []).map((s) => s.id);

  let studentCount = 0;
  let courseCount = 0;
  let assessmentCount = 0;
  let pendingQueries = 0;
  let atRisk: AtRiskClass[] = [];
  let recentQueries: {
    id: string;
    title: string;
    status: string;
    priority: string;
    created_at: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    profiles: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    enrollments?: any;
  }[] = [];

  if (activeSectionIds.length > 0) {
    const [countResult, sectionCoursesResult, enrollmentsResult] = await Promise.all([
      // Stat: Students enrolled in sections of the active term
      supabase.rpc("active_student_count", { p_section_ids: activeSectionIds }),
      // Courses + assessments both need the classes of the active term
      supabase
        .from("section_courses")
        .select("id, course_id, best_of_quizzes, best_of_assignments, sections ( name ), courses ( code )")
        .in("section_id", activeSectionIds),
      // Pending + recent queries both need the active enrollments
      supabase
        .from("enrollments")
        .select("id")
        .in("section_id", activeSectionIds)
        .eq("status", "active"),
    ]);

    studentCount = countResult.data || 0;

    const sectionCourses = sectionCoursesResult.data || [];
    // Deduplicate — a course could be linked to multiple sections
    courseCount = new Set(sectionCourses.map((sc) => sc.course_id)).size;

    const scIds = sectionCourses.map((sc) => sc.id);
    const enrollmentIds = (enrollmentsResult.data || []).map((e) => e.id);

    // class standings for the at-risk card, loaded alongside the stats below
    const standingsPromise = Promise.all(
      sectionCourses.map((sc) =>
        supabase.rpc("analytics_for_section_course", { p_sc_id: sc.id }).then((r) => ({ sc, data: r.data }))
      )
    );

    const [assessmentResult, pendingResult, recentResult] = await Promise.all([
      // Stat: Assessments in section-courses of the active term
      scIds.length > 0
        ? supabase
            .from("assessments")
            .select("*", { count: "exact", head: true })
            .in("section_course_id", scIds)
        : null,
      // Stat: Pending queries from students enrolled in the active term
      enrollmentIds.length > 0
        ? supabase
            .from("queries")
            .select("*", { count: "exact", head: true })
            .eq("status", "pending")
            .in("enrollment_id", enrollmentIds)
        : null,
      // Recent queries — also scoped to the active term
      enrollmentIds.length > 0
        ? supabase
            .from("queries")
            .select(`
              id,
              title,
              status,
              priority,
              created_at,
              profiles:student_id ( full_name, roll_number ),
              enrollments ( sections ( name ) )
            `)
            .in("enrollment_id", enrollmentIds)
            .order("created_at", { ascending: false })
            .limit(5)
        : null,
    ]);

    // students below a level, per class (same numbers as Analytics)
    const standings = await standingsPromise;
    const perClass = standings.map(({ sc, data }) => {
      const d = (data || {}) as { students?: StudentPerformance[]; assessments?: AssessmentPerformance[] };
      const { ranked } = rankStudents(d.students || [], d.assessments || [], {
        quiz: sc.best_of_quizzes ?? null,
        assignment: sc.best_of_assignments ?? null,
      });
      const info = sc as unknown as { sections: { name: string } | null; courses: { code: string } | null };
      return {
        scId: sc.id,
        label: `${info.sections?.name ?? "?"} · ${info.courses?.code ?? "?"}`,
        students: ranked
          .filter((s) => s.overall !== null)
          .map((s) => ({ roll: s.roll_number, name: s.full_name, overall: s.overall as number, missing: s.missing })),
      };
    });
    const rolls = [...new Set(perClass.flatMap((c) => c.students.map((s) => s.roll)))];
    const { data: emailRows } = rolls.length
      ? await supabase.from("profiles").select("roll_number, email").in("roll_number", rolls)
      : { data: [] as { roll_number: string | null; email: string | null }[] };
    const emailOf = new Map((emailRows || []).map((p) => [p.roll_number, p.email]));
    atRisk = perClass
      .map((c) => ({ ...c, students: c.students.map((s) => ({ ...s, email: emailOf.get(s.roll) ?? null })) }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

    assessmentCount = assessmentResult?.count || 0;
    pendingQueries = pendingResult?.count || 0;
    recentQueries = recentResult?.data || [];
  }

  const stats = [
    {
      title: "Students",
      value: studentCount,
      icon: Users,
      desc: activeTerm ? `Enrolled in ${activeTerm.name}` : "No active term",
    },
    {
      title: "Courses",
      value: courseCount,
      icon: BookOpen,
      desc: activeTerm ? `Linked in ${activeTerm.name}` : "No active term",
    },
    {
      title: "Assessments",
      value: assessmentCount,
      icon: ClipboardList,
      desc: activeTerm ? `Created in ${activeTerm.name}` : "No active term",
    },
    {
      title: "Pending Queries",
      value: pendingQueries,
      icon: FileQuestion,
      desc: "Awaiting your review",
    },
  ];


  const bentoCards = stats.map(s => {
    let cat = "count";
    let href = "";
    if (s.title === "Pending Queries") {
      cat = "pending";
      href = "/ta/queries";
    } else if (s.title === "Students") {
      href = "/ta/roster";
    } else if (s.title === "Courses") {
      cat = "neutral";
      href = "/ta/courses";
    } else if (s.title === "Assessments") {
      href = "/ta/assessments";
    }
    
    return {
      label: s.title,
      value: s.value,
      meta: s.desc,
      Icon: s.icon,
      cat,
      href
    };
  });

  return (
    <div className="space-y-8">
      <div className="tams-pagehead">
        <div>
          <p className="tams-pagehead__eyebrow">TEACHING ASSISTANT</p>
          <h1 className="tams-pagehead__title">Overview</h1>
        </div>
        <p className="text-sm text-muted-foreground text-right hidden sm:block">
          Welcome back, {profile?.full_name || "TA"}.
          {activeTerm && (
            <span className="ml-1 block">
              Active term: <span className="font-medium text-foreground">{activeTerm.name}</span>
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {bentoCards.map((c) => (
          <Link key={c.label} href={c.href} className="tams-stat" data-edge data-cat={c.cat}>
            <c.Icon size={18} strokeWidth={1.5} className="tams-stat__icon" />
            <p className="tams-stat__label">{c.label}</p>
            <p className="tams-stat__value">{c.value}</p>
            <div className="tams-stat__foot">
              <p className="tams-stat__meta">{c.meta}</p>
            </div>
          </Link>
        ))}
      </div>
      
      <AtRiskCard classes={atRisk} />

      {/* Recent Queries List */}
      <div className="tams-card" data-edge>
        <div className="mb-4">
          <h2 className="tams-card__title">Recent Queries</h2>
          <p className="tams-card__hint">
            Latest student queries and re-evaluation requests
            {activeTerm ? ` (${activeTerm.name})` : ""}
          </p>
        </div>
        <div>
          {recentQueries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent queries.</p>
          ) : (
            <div className="space-y-4">
              {recentQueries.map((q) => (
                <Link
                  key={q.id}
                  href={`/ta/queries?open=${q.id}`}
                  className="tams-inset flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                >
                  <div className="w-[140px] shrink-0">
                    <p className="font-medium text-sm">{q.profiles?.roll_number}</p>
                    <p className="text-xs text-muted-foreground truncate">{q.profiles?.full_name}</p>
                  </div>

                  <div className="w-[100px] shrink-0 hidden sm:block text-sm text-muted-foreground">
                    {q.enrollments?.sections?.name || "—"}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-medium truncate">{q.title}</p>
                    <p className="text-xs text-muted-foreground">{q.priority} priority</p>
                  </div>

                  <div
                    className="tams-pill shrink-0"
                    data-tone={q.status === "pending" ? "open" : q.status === "resolved" ? "done" : q.status === "rejected" ? "late" : "open"}
                  >
                    {formatStatus(q.status)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
