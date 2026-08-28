import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { SectionPicker } from "./section-picker";

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
    .select("id, name, section_courses(id, courses(code))")
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
    sec.section_courses?.forEach((sc: { id: string; courses: { code: string } | null } | null) => {
      if (sc && sc.courses?.code) {
        options.push({
          id: sc.id,
          label: `${sec.name} — ${sc.courses.code}`,
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

  type StudentPerformance = {
    full_name: string;
    roll_number: string;
    graded: number;
    obtained: number;
    total_weight: number;
    percentage: number | null;
  };

  const performance = (rpcData as StudentPerformance[]) || [];

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

      <Card data-edge>
        <CardContent>
        <div className="tams-table-wrap">
          <table className="tams-table">
            <thead>
              <tr>
                <th>Roll Number</th>
                <th>Student</th>
                <th className="tams-numeral">Graded</th>
                <th className="tams-numeral">Weight Obtained</th>
                <th className="tams-numeral">Total Weight</th>
                <th className="tams-numeral">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {performance.map(p => (
                <tr key={p.roll_number} className="transition-colors">
                  <td>{p.roll_number}</td>
                  <td>{p.full_name}</td>
                  <td className="tams-numeral">
                    {p.graded === 0 ? "—" : p.graded}
                  </td>
                  <td className="tams-numeral">
                    {p.graded === 0 ? "—" : p.obtained}
                  </td>
                  <td className="tams-numeral">
                    {p.graded === 0 ? "—" : p.total_weight}
                  </td>
                  <td className="tams-numeral">
                    {p.percentage === null ? "—" : `${p.percentage}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}
