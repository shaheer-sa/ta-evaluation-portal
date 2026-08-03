import { createClient } from "@/lib/supabase/server";
import { AnalyticsCharts } from "./analytics-charts";
import { Card, CardContent } from "@/components/ui/card";

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
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(`
      id,
      sections ( name ),
      courses ( code )
    `)
    .in("section_id", sectionIds);

  const enrollmentIds = enrollments?.map((e) => e.id) || [];
  const enrollmentMap = new Map();
  
  enrollments?.forEach((e) => {
    enrollmentMap.set(e.id, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      section: (e.sections as any)?.name || "Unknown",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      course: (e.courses as any)?.code || "Unknown",
    });
  });

  // Fetch marks
  const { data: marks } = await supabase
    .from("marks")
    .select(`
      score,
      enrollment_id,
      assessments ( max_marks )
    `)
    .in("enrollment_id", enrollmentIds);

  // Process data for charts
  const distributionBins = Array(10).fill(0);
  const comparisonMap = new Map<string, { totalPct: number; count: number }>();

  marks?.forEach((m) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maxMarks = (m.assessments as any)?.max_marks;
    if (!maxMarks || maxMarks === 0) return;

    const pct = (m.score / maxMarks) * 100;
    
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
