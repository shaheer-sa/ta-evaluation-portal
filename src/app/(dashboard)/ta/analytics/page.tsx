import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { SectionPicker, type PickerOption } from "./section-picker";
import { rankStudents, possibleByType } from "@/lib/analytics-rank";
import { AssessmentStats } from "./assessment-stats";
import { FeatureNote } from "@/components/updates/feature-note";
import { TopStudents } from "./top-students";
import { sortAssessments } from "@/lib/assessment-order";
import { PerformanceTable, type StudentPerformance, type AssessmentPerformance, type MarkEntry } from "./performance-table";

export default async function AnalyticsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const searchParams = await props.searchParams;
  const scId = typeof searchParams.sc === "string" ? searchParams.sc : "";

  // start the class numbers right away (when a class is picked) so they load
  // while the term and sections are fetched, instead of after them
  const rpcPromise = scId
    ? supabase.rpc("analytics_for_section_course", { p_sc_id: scId }).then((r) => r)
    : null;

  // the active term with its sections and classes, in one request
  const { data: activeTerm } = await supabase
    .from("terms")
    .select("id, name, sections ( id, name, section_courses ( id, best_of_quizzes, best_of_assignments, courses ( code, name ) ) )")
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

  const sections = activeTerm.sections;

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

  const options: PickerOption[] = [];
  sections.forEach((sec) => {
    sec.section_courses?.forEach((sc) => {
      if (sc && sc.courses?.code) {
        options.push({
          id: sc.id,
          section: sec.name,
          code: sc.courses.code,
          name: sc.courses.name || "",
        });
      }
    });
  });
  options.sort(
    (x, y) =>
      x.section.localeCompare(y.section, undefined, { numeric: true }) ||
      x.code.localeCompare(y.code, undefined, { numeric: true })
  );

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
  const { data: rpcData, error } = await rpcPromise!;

  if (error || !rpcData) {
    return <div>Invalid section course or data could not be loaded.</div>;
  }

  const { students, assessments, marks } = (rpcData as { 
    students: StudentPerformance[], 
    assessments: AssessmentPerformance[],
    marks: MarkEntry[] 
  }) || { students: [], assessments: [], marks: [] };
  const sortedAssessments = sortAssessments(assessments || []);

  // rank against the same total for everyone (missing marks count as 0),
  // not by the percentage of whatever happens to be marked
  const selectedSc = sections
    .flatMap((sec) => sec.section_courses || [])
    .find((sc) => sc?.id === scId);
  const { ranked: performance, possible, marked } = rankStudents(students || [], assessments || [], {
    quiz: selectedSc?.best_of_quizzes ?? null,
    assignment: selectedSc?.best_of_assignments ?? null,
  });

  const top3 = performance.filter((p) => p.overall !== null).slice(0, 3);

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

      <TopStudents students={top3} />

      <AssessmentStats
        assessments={sortedAssessments}
        marks={marks || []}
        names={Object.fromEntries(performance.map((p) => [p.roll_number, p.full_name]))}
      />

      <PerformanceTable
        students={performance}
        sortedAssessments={sortedAssessments}
        marks={marks || []}
        possible={possible}
        marked={marked}
        possibleTypes={possibleByType(assessments || [], {
          quiz: selectedSc?.best_of_quizzes ?? null,
          assignment: selectedSc?.best_of_assignments ?? null,
        })}
        scId={scId}
        filterNote={<FeatureNote key="analytics-filters" id="analytics-filters" />}
      />
    </div>
  );
}
