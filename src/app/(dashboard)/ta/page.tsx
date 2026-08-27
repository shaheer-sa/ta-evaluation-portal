import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
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
      .in("section_id", activeSectionIds)
      .eq("status", "active");
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
      .in("section_id", activeSectionIds)
      .eq("status", "active");

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
      .in("section_id", activeSectionIds)
      .eq("status", "active");

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


  const bentoCards = stats.map(s => {
    let cat = "count";
    let href = "";
    if (s.title === "Pending Queries") {
      cat = "pending";
      href = "/ta/queries";
    } else if (s.title === "Students") {
      href = "/ta/roster";
    } else if (s.title === "Courses") {
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
          <h1 className="tams-pagehead__title">Dashboard</h1>
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
                <div
                  key={q.id}
                  className="tams-inset flex items-center justify-between p-4"
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
