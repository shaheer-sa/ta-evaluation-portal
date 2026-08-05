import { createClient } from "@/lib/supabase/server";
import { StatStrip, GradeCard, CourseGrade, GradesGrid } from "@/components/student/GradesOverview";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import Link from "next/link";
import { ArrowRight, BarChart2, TrendingUp } from "lucide-react";
import { ParticleCard } from "@/components/react-bits/MagicBento";

export default async function StudentDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, roll_number")
    .eq("id", user.id)
    .single();

  // Fetch pending queries for the student
  const { count: pendingQueries } = await supabase
    .from("queries")
    .select("*", { count: "exact", head: true })
    .eq("student_id", user.id)
    .eq("status", "pending");

  // Fetch the student's enrollments with courses and marks
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(`
      id,
      course_id,
      section_id,
      courses:course_id ( id, code, name ),
      sections:section_id ( name, terms:term_id ( name ) ),
      marks ( score, assessments:assessment_id ( title, max_marks, weight ) )
    `)
    .eq("student_id", user.id);

  // Calculate weighted percentage per enrollment
  const courseCards: CourseGrade[] = (enrollments || []).map((e) => {
    let totalWeightedScore = 0;
    let totalWeight = 0;
    const breakdown: { label: string; score: number; max: number; weight: number }[] = [];
    let gradedCount = 0;

    for (const m of e.marks) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const assessment = m.assessments as any;
      if (
        assessment &&
        assessment.max_marks > 0 &&
        m.score !== null &&
        m.score !== undefined
      ) {
        gradedCount++;
        const pct = Number(m.score) / assessment.max_marks;
        if (Number.isFinite(pct)) {
          totalWeightedScore += pct * assessment.weight;
          totalWeight += assessment.weight;
        }
        
        breakdown.push({
          label: assessment.title || "Assessment",
          score: Number(m.score),
          max: assessment.max_marks,
          weight: assessment.weight,
        });
      }
    }

    const weightedPct = totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;
    
    // Sort breakdown by weight (highest first) and take top 3
    breakdown.sort((a, b) => b.weight - a.weight);
    const topBreakdown = breakdown.slice(0, 3).map(b => ({
      label: b.label,
      score: b.score,
      max: b.max,
    }));

    return {
      id: e.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      code: (e.courses as any)?.code || "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      title: (e.courses as any)?.name || "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      section: (e.sections as any)?.name || "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      term: (e.sections as any)?.terms?.name || "",
      gradedCount,
      totalCount: e.marks.length,
      percentage: Math.round(weightedPct * 10) / 10,
      weightCovered: Math.round(totalWeight * 10) / 10,
      breakdown: topBreakdown,
    };
  });

  const overall = courseCards.length > 0 
    ? courseCards.reduce((sum, c) => sum + c.percentage, 0) / courseCards.length
    : 0;

  return (
    <div className="max-w-[1200px] mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">My Grades</h1>
        <p className="text-muted-foreground">
          Welcome back, {profile?.full_name || "Student"} ({profile?.roll_number}).
        </p>
      </div>

      <GradesGrid>
        <StatStrip
          overall={courseCards.length > 0 ? `${overall.toFixed(1)}%` : "—"}
          courseCount={courseCards.length}
          pendingQueries={pendingQueries || 0}
        />



        {courseCards.length === 0 ? (
          <Card className="border-none bg-white/[0.03] backdrop-blur-xl">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                You are not enrolled in any courses yet. Your TA will add you once the semester begins.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-4">
            {/* Performance Entry Card as a MagicBento box */}
            <Link href="/student/performance" className="block h-full">
              <ParticleCard 
                className="mc-card mc-card--glow h-full p-8 flex flex-col group relative overflow-hidden transition-all hover:-translate-y-1" 
                enableTilt={true}
                particleCount={25}
              >
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                
                <div className="relative z-10 flex flex-col items-center text-center justify-center h-full">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 border border-primary/20">
                    <TrendingUp className="w-8 h-8 text-primary" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-white mb-3 tracking-tight group-hover:text-primary transition-colors">
                    Performance Analytics
                  </h3>
                  
                  <p className="text-sm text-white/50 leading-relaxed mb-6">
                    Compare your absolute scores against the class average and track your overall standing.
                  </p>
                  
                  <div className="mt-auto flex items-center gap-2 text-primary text-sm font-medium opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                    View full report <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </ParticleCard>
            </Link>

            {courseCards.map((c) => (
              <GradeCard key={c.code} course={c} />
            ))}
          </div>
        )}
      </GradesGrid>
    </div>
  );
}
