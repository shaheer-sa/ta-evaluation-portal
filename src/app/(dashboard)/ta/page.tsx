import { createClient } from "@/lib/supabase/server";
import MagicBento from "@/components/react-bits/MagicBento";
import { Users, BookOpen, FileQuestion, ClipboardList } from "lucide-react";

export default async function TADashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  // Get the active term — all stats are scoped to this
  const { data: activeTerm } = await supabase
    .from("terms")
    .select("id, name")
    .eq("is_active", true)
    .single();

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

  // Stat: Students enrolled in sections of the active term
  let studentCount = 0;
  if (activeSectionIds.length > 0) {
    const { count } = await supabase
      .from("enrollments")
      .select("student_id", { count: "exact", head: true })
      .in("section_id", activeSectionIds);
    studentCount = count || 0;
  }

  // Stat: Courses linked to sections of the active term
  let courseCount = 0;
  if (activeSectionIds.length > 0) {
    const { data: sectionCourses } = await supabase
      .from("section_courses")
      .select("course_id")
      .in("section_id", activeSectionIds);
    // Deduplicate — a course could be linked to multiple sections
    const uniqueCourses = new Set((sectionCourses || []).map((sc) => sc.course_id));
    courseCount = uniqueCourses.size;
  }

  // Stat: Assessments in section-courses of the active term
  let assessmentCount = 0;
  if (activeSectionIds.length > 0) {
    const { data: scIds } = await supabase
      .from("section_courses")
      .select("id")
      .in("section_id", activeSectionIds);

    if (scIds && scIds.length > 0) {
      const { count } = await supabase
        .from("assessments")
        .select("*", { count: "exact", head: true })
        .in("section_course_id", scIds.map((sc) => sc.id));
      assessmentCount = count || 0;
    }
  }

  // Stat: Pending queries from students enrolled in the active term
  // Queries join through enrollment → section → term
  let pendingQueries = 0;
  if (activeSectionIds.length > 0) {
    const { data: activeEnrollmentIds } = await supabase
      .from("enrollments")
      .select("id")
      .in("section_id", activeSectionIds);

    if (activeEnrollmentIds && activeEnrollmentIds.length > 0) {
      const { count } = await supabase
        .from("queries")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .in("enrollment_id", activeEnrollmentIds.map((e) => e.id));
      pendingQueries = count || 0;
    }
  }

  // Recent queries — also scoped to the active term
  let recentQueries: {
    id: string;
    title: string;
    status: string;
    priority: string;
    created_at: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    profiles: any;
  }[] = [];

  if (activeSectionIds.length > 0) {
    const { data: activeEnrollmentIds } = await supabase
      .from("enrollments")
      .select("id")
      .in("section_id", activeSectionIds);

    if (activeEnrollmentIds && activeEnrollmentIds.length > 0) {
      const { data } = await supabase
        .from("queries")
        .select(`
          id,
          title,
          status,
          priority,
          created_at,
          profiles:student_id ( full_name, roll_number )
        `)
        .in("enrollment_id", activeEnrollmentIds.map((e) => e.id))
        .order("created_at", { ascending: false })
        .limit(5);
      recentQueries = data || [];
    }
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

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-600",
    in_review: "bg-blue-500/10 text-blue-600",
    resolved: "bg-green-500/10 text-green-600",
    rejected: "bg-red-500/10 text-red-600",
  };

  const bentoCards = stats.map(s => ({
    label: s.title,
    value: s.value,
    title: s.title,
    description: s.desc,
  }));

  return (
    <div className="space-y-8">
      <div className="tams-page-head">
        <h1 className="text-3xl font-bold tracking-tight">TA Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {profile?.full_name || "TA"}.
          {activeTerm && (
            <span className="ml-1">
              Active term: <span className="font-medium text-foreground">{activeTerm.name}</span>
            </span>
          )}
        </p>
      </div>

      <MagicBento cards={bentoCards} />
      
      {/* Recent Queries List */}
      <div className="tams-card tams-glass-strong">
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
                <div
                  key={q.id}
                  className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  style={{ borderColor: 'var(--tams-glass-border)', background: 'var(--tams-glass)' }}
                >
                  <div className="space-y-1">
                    <p className="font-medium">{q.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {q.profiles?.full_name} ({q.profiles?.roll_number}) -{" "}
                      {q.priority} priority
                    </p>
                  </div>
                  <div
                    className={`tams-pill`}
                    data-tone={q.status === "pending" ? "open" : q.status === "resolved" ? "done" : q.status === "rejected" ? "late" : "open"}
                  >
                    {q.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
