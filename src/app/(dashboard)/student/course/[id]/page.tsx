import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { id: enrollmentId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch the enrollment
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select(`
      id,
      course_id,
      section_id,
      courses:course_id ( code, name ),
      sections:section_id ( name, terms:term_id ( name ) )
    `)
    .eq("id", enrollmentId)
    .eq("student_id", user.id)
    .single();

  if (!enrollment) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Enrollment not found.</p>
        <Link href="/student">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  // Find the section_course link
  const { data: sectionCourse } = await supabase
    .from("section_courses")
    .select("id")
    .eq("section_id", enrollment.section_id)
    .eq("course_id", enrollment.course_id)
    .single();

  // Fetch all assessments for this section-course
  const { data: assessments } = await supabase
    .from("assessments")
    .select("id, title, type, max_marks, weight")
    .eq("section_course_id", sectionCourse?.id || "")
    .order("created_at", { ascending: true });

  // Fetch marks for this enrollment
  const { data: marks } = await supabase
    .from("marks")
    .select("assessment_id, score")
    .eq("enrollment_id", enrollmentId);

  // Fetch class averages for each assessment via the database function
  const classAverages = new Map<string, number>();
  if (assessments) {
    // Run RPC calls in parallel — these are read-only and independent
    const avgResults = await Promise.all(
      assessments.map(async (a) => {
        const { data } = await supabase.rpc("get_class_average", {
          p_assessment_id: a.id,
        });
        return { id: a.id, avg: data as number | null };
      })
    );
    for (const r of avgResults) {
      if (r.avg !== null && r.avg !== undefined) {
        classAverages.set(r.id, r.avg);
      }
    }
  }

  // Build the table data
  const marksMap = new Map<string, number>();
  for (const m of marks || []) {
    marksMap.set(m.assessment_id, m.score);
  }

  let totalWeightedScore = 0;
  let totalWeight = 0;

  const rows = (assessments || []).map((a) => {
    const score = marksMap.get(a.id);
    const hasScore = score !== undefined;
    const pct = hasScore && a.max_marks > 0 ? (score / a.max_marks) * 100 : null;
    const classAvg = classAverages.get(a.id) ?? null;
    const classAvgPct = classAvg !== null && a.max_marks > 0
      ? (classAvg / a.max_marks) * 100
      : null;

    if (hasScore && a.max_marks > 0) {
      totalWeightedScore += (score / a.max_marks) * a.weight;
      totalWeight += a.weight;
    }

    return {
      id: a.id,
      title: a.title,
      type: a.type,
      maxMarks: a.max_marks,
      weight: a.weight,
      score: hasScore ? score : null,
      pct,
      classAvg,
      classAvgPct,
    };
  });

  const overallPct = totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const course = enrollment.courses as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const section = enrollment.sections as any;

  // Group rows by assessment type
  const groupedRows = rows.reduce((acc, r) => {
    const typeLabel = r.type.charAt(0).toUpperCase() + r.type.slice(1);
    if (!acc[typeLabel]) acc[typeLabel] = [];
    acc[typeLabel].push(r);
    return acc;
  }, {} as Record<string, typeof rows>);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/student">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {course?.code} — {course?.name}
          </h1>
          <p className="text-muted-foreground">
            {section?.terms?.name} · Section {section?.name}
          </p>
        </div>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Performance</CardTitle>
          <CardDescription>
            Weighted average across {rows.filter((r) => r.score !== null).length} graded
            assessment{rows.filter((r) => r.score !== null).length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">
              {totalWeight > 0 ? `${Math.round(overallPct * 10) / 10}%` : "—"}
            </span>
            <span className="text-sm text-muted-foreground">
              ({Math.round(totalWeight * 10) / 10}% weight covered of 100%)
            </span>
          </div>
          <div className="mt-3 h-3 w-full max-w-md rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(overallPct, 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Marks Accordion */}
      <Card>
        <CardHeader>
          <CardTitle>Assessment Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No assessments have been created for this course yet.
            </p>
          ) : (
            <Accordion type="multiple" className="w-full" defaultValue={Object.keys(groupedRows)}>
              {Object.entries(groupedRows).map(([type, items]) => (
                <AccordionItem key={type} value={type}>
                  <AccordionTrigger className="text-lg font-semibold capitalize hover-float px-2 rounded-md">
                    {type} ({items.length})
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="overflow-x-auto rounded-md border mt-2">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="p-3 text-left font-medium">Assessment</th>
                            <th className="p-3 text-right font-medium">Score</th>
                            <th className="p-3 text-right font-medium">Max</th>
                            <th className="p-3 text-right font-medium">%</th>
                            <th className="p-3 text-right font-medium">Class Avg</th>
                            <th className="p-3 text-right font-medium">Weight</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((r) => (
                            <tr
                              key={r.id}
                              className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                            >
                              <td className="p-3 font-medium">{r.title}</td>
                              <td className="p-3 text-right font-mono">
                                {r.score !== null ? r.score : "—"}
                              </td>
                              <td className="p-3 text-right font-mono text-muted-foreground">
                                {r.maxMarks}
                              </td>
                              <td className="p-3 text-right font-mono">
                                {r.pct !== null ? `${Math.round(r.pct * 10) / 10}%` : "—"}
                              </td>
                              <td className="p-3 text-right font-mono text-muted-foreground">
                                {r.classAvg !== null
                                  ? `${Math.round(r.classAvg * 10) / 10} (${Math.round((r.classAvgPct ?? 0) * 10) / 10}%)`
                                  : "—"}
                              </td>
                              <td className="p-3 text-right text-muted-foreground">
                                {r.weight}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
