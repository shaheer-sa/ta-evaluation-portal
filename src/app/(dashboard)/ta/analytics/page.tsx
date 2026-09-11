import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { SectionPicker } from "./section-picker";
import { sortAssessments } from "@/lib/assessment-order";
import { PerformanceTable, type StudentPerformance, type AssessmentPerformance, type MarkEntry } from "./performance-table";

export default async function AnalyticsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const searchParams = await props.searchParams;
  const scId = typeof searchParams.sc === "string" ? searchParams.sc : "";

  const { data: activeTerm } = await supabase
    .from("terms")
    .select("id, name")
    .eq("is_active", true)
    .single();

  if (!activeTerm) {
    return (
      <div className="space-y-8">
        <div className="tams-pagehead">
          <div>
            <p className="tams-pagehead__eyebrow">TEACHING ASSISTANT</p>
            <h1 className="tams-pagehead__title">Analytics</h1>
          </div>
        </div>
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
    .select("id, name, section_courses(id, courses(code, name))")
    .eq("term_id", activeTerm.id);

  if (!sections || sections.length === 0) {
    return (
      <div className="space-y-8">
        <div className="tams-pagehead">
          <div>
            <p className="tams-pagehead__eyebrow">TEACHING ASSISTANT</p>
            <h1 className="tams-pagehead__title">Analytics ({activeTerm.name})</h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No sections found in the active term.
          </CardContent>
        </Card>
      </div>
    );
  }

  const options: { id: string; label: string }[] = [];
  sections.forEach((sec) => {
    sec.section_courses?.forEach((sc: { id: string; courses: { code: string, name: string } | null } | null) => {
      if (sc && sc.courses?.code) {
        const cName = sc.courses.name || "";
        const shortName = cName.length > 40 ? cName.slice(0, 39) + "…" : cName;
        options.push({
          id: sc.id,
          label: `${activeTerm.name} — Section ${sec.name} · ${shortName || "Course"} (${sc.courses.code})`,
        });
      }
    });
  });
  
  if (!scId) {
    return (
      <div className="space-y-8">
        <div className="tams-pagehead">
          <div>
            <p className="tams-pagehead__eyebrow">TEACHING ASSISTANT</p>
            <h1 className="tams-pagehead__title">Analytics</h1>
          </div>
          <p className="text-sm text-muted-foreground text-right hidden sm:block">
            Performance analysis for {activeTerm.name}.
          </p>
        </div>
        <SectionPicker options={options} />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a section to view performance
          </CardContent>
        </Card>
      </div>
    );
  }

  // STEP 2 — Once ?sc is set, fetch for that section_course via RPC:
  const { data: rpcData, error } = await supabase.rpc("analytics_for_section_course", {
    p_sc_id: scId,
  });

  if (error || !rpcData) {
    return <div>Invalid section course or data could not be loaded.</div>;
  }

  const { students, assessments, marks } = (rpcData as { 
    students: StudentPerformance[], 
    assessments: AssessmentPerformance[],
    marks: MarkEntry[] 
  }) || { students: [], assessments: [], marks: [] };
  const performance = students || [];
  const sortedAssessments = sortAssessments(assessments || []);

  const top3 = performance.filter(p => p.percentage !== null).slice(0, 3);
  const ranks = ["1ST", "2ND", "3RD"];

  return (
    <div className="space-y-8">
      <div className="tams-pagehead">
        <div>
          <p className="tams-pagehead__eyebrow">TEACHING ASSISTANT</p>
          <h1 className="tams-pagehead__title">Analytics</h1>
        </div>
        <p className="text-sm text-muted-foreground text-right hidden sm:block">
          Performance analysis for {activeTerm.name}.
        </p>
      </div>

      <div className="flex justify-between items-center">
        <SectionPicker options={options} />
      </div>

      {top3.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {top3.map((p, i) => (
            <div key={p.roll_number} className="tams-stat" data-cat="count">
              <div className="tams-stat__header">
                <span className="tams-stat__label">{ranks[i]}</span>
              </div>
              <div className="tams-stat__value">{p.percentage?.toFixed(1)}%</div>
              <div className="tams-stat__meta">{p.full_name}</div>
            </div>
          ))}
        </div>
      )}

      <Card data-edge className="mb-8">
        <CardContent>
          <div className="tams-table-wrap">
            <table className="tams-table">
              <thead>
                <tr>
                  <th>Assessment</th>
                  <th className="tams-numeral">Total Marks</th>
                  <th className="tams-numeral">Graded</th>
                  <th className="tams-numeral">Average</th>
                  <th className="tams-numeral">Highest</th>
                  <th className="tams-numeral">Lowest</th>
                </tr>
              </thead>
              <tbody>
                {sortedAssessments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted-foreground py-8">
                      No assessments found.
                    </td>
                  </tr>
                ) : (
                  sortedAssessments.map(a => (
                    <tr key={a.id} className="transition-colors">
                      <td>{a.title}</td>
                      <td className="tams-numeral">{a.total_marks}</td>
                      <td className="tams-numeral">{a.graded}</td>
                      <td className="tams-numeral">{a.avg !== null ? a.avg : "—"}</td>
                      <td className="tams-numeral">{a.high !== null ? a.high : "—"}</td>
                      <td className="tams-numeral">{a.low !== null ? a.low : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <PerformanceTable students={performance} sortedAssessments={sortedAssessments} marks={marks || []} />
    </div>
  );
}
