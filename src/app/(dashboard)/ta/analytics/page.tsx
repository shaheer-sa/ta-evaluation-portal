import { createClient } from "@/lib/supabase/server";
import { AnalyticsCharts } from "./analytics-charts";
import { Card, CardContent } from "@/components/ui/card";
import type { Database } from "@/types/database";

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const { data: activeTerm } = await supabase
    .from("terms")
    .select("id, name")
    .eq("is_active", true)
    .single();

  if (!activeTerm) {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No active term found. Create and activate a term to see analytics.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get active sections
  const { data: sections } = await supabase
    .from("sections")
    .select("id")
    .eq("term_id", activeTerm.id);

  const sectionIds = sections?.map((s) => s.id) || [];

  if (sectionIds.length === 0) {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">Analytics ({activeTerm.name})</h1>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No sections found in the active term.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch enrollments to know which marks belong to which section/course
  const { data: rawEnrollments } = await supabase
    .from("enrollments")
    .select(`
      id,
      sections ( name ),
      courses ( code )
    `)
    .in("section_id", sectionIds);

  type EnrollmentRow = Pick<Database["public"]["Tables"]["enrollments"]["Row"], "id"> & {
    sections: Pick<Database["public"]["Tables"]["sections"]["Row"], "name"> | null;
    courses: Pick<Database["public"]["Tables"]["courses"]["Row"], "code"> | null;
  };
  
  const enrollments = rawEnrollments as unknown as EnrollmentRow[] | null;

  const enrollmentIds = enrollments?.map((e) => e.id) || [];
  const enrollmentMap = new Map();
  
  enrollments?.forEach((e) => {
    enrollmentMap.set(e.id, {
      section: e.sections?.name || "Unknown",
      course: e.courses?.code || "Unknown",
    });
  });

  // Fetch marks
  const { data: rawMarks } = await supabase
    .from("marks")
    .select(`
      score,
      enrollment_id,
      assessments ( max_marks )
    `)
    .in("enrollment_id", enrollmentIds);

  type MarkRow = Pick<Database["public"]["Tables"]["marks"]["Row"], "score" | "enrollment_id"> & {
    assessments: Pick<Database["public"]["Tables"]["assessments"]["Row"], "max_marks"> | null;
  };

  const marks = rawMarks as unknown as MarkRow[] | null;

  // Process data for charts
  const distributionBins = Array(10).fill(0);
  const comparisonMap = new Map<string, { totalPct: number; count: number }>();

  marks?.forEach((m) => {
    const maxMarks = m.assessments?.max_marks;
    if (!maxMarks || maxMarks === 0) return;
    // Ungraded rows would otherwise land in the 0-10% bin and skew every
    // distribution and class average on this page.
    if (m.score === null || m.score === undefined) return;

    const pct = (Number(m.score) / maxMarks) * 100;
    if (!Number.isFinite(pct)) return;
    
    // 1. Bin for distribution (0-10, 11-20, ... 91-100)
    let binIndex = Math.floor(pct / 10);
    if (binIndex >= 10) binIndex = 9; // cap 100% at the last bin
    if (binIndex < 0) binIndex = 0;
    distributionBins[binIndex]++;

    // 2. Aggregate for comparisons
    const context = enrollmentMap.get(m.enrollment_id);
    if (context) {
      const key = `${context.course} - Sec ${context.section}`;
      const current = comparisonMap.get(key) || { totalPct: 0, count: 0 };
      current.totalPct += pct;
      current.count += 1;
      comparisonMap.set(key, current);
    }
  });

  const distributionData = distributionBins.map((count, i) => ({
    name: `${i * 10}-${(i + 1) * 10}%`,
    count,
  }));

  const comparisonData = Array.from(comparisonMap.entries())
    .map(([name, data]) => ({
      name,
      avg: Math.round((data.totalPct / data.count) * 10) / 10,
    }))
    .sort((a, b) => b.avg - a.avg); // Sort highest to lowest

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Performance metrics and trends for {activeTerm.name}.
        </p>
      </div>

      <AnalyticsCharts 
        distributionData={distributionData} 
        comparisonData={comparisonData} 
      />
    </div>
  );
}
