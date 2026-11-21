import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { formatWeight } from "@/lib/format";
import type { CourseReport } from "@/lib/course-report";

const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (obtained: number, weight: number) => (weight > 0 ? `${Math.round((obtained / weight) * 1000) / 10}%` : "—");

// the marks breakdown a student sees for one course. the TA's "view report"
// page shows exactly this too.
export function CourseReportView({ report }: { report: CourseReport }) {
  const overallPct = report.weight > 0 ? (report.obtained / report.weight) * 100 : 0;

  return (
    <div className="space-y-8">
      <Card data-edge>
        <CardHeader>
          <CardTitle>Overall Performance</CardTitle>
          <CardDescription>
            Weighted average across {report.gradedCount} graded assessment{report.gradedCount !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-4xl font-bold tams-tile-value">
              {report.weight > 0 ? `${Math.round(overallPct * 10) / 10}%` : "—"}
            </span>
            <span className="text-sm text-muted-foreground">
              ({Math.round(report.weight * 10) / 10}% weight covered of 100%)
            </span>
          </div>
          <div className="mt-3 h-3 w-full max-w-md overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(overallPct, 100)}%` }}
            />
          </div>
          {report.groups.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {report.groups.map((g) => (
                <span key={g.type} className="rounded-full border px-3 py-1 text-xs">
                  <span className="text-muted-foreground">{g.label}:</span>{" "}
                  <span className="font-semibold">{r2(g.obtained)}</span>
                  <span className="text-muted-foreground"> / {formatWeight(g.possible)}</span>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-edge>
        <CardHeader>
          <CardTitle>Assessment Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {report.bestOfNotes.length > 0 && (
            <p className="mb-4 text-xs text-muted-foreground">{report.bestOfNotes.join(" ")}</p>
          )}
          {report.groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assessments have been created for this course yet.</p>
          ) : (
            <Accordion type="multiple" className="w-full" defaultValue={report.groups.map((g) => g.type)}>
              {report.groups.map((g) => (
                <AccordionItem key={g.type} value={g.type}>
                  <AccordionTrigger className="text-lg font-semibold hover-float px-2 rounded-md">
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      {g.label} ({g.rows.length})
                      <span className="text-sm font-normal text-muted-foreground">
                        {r2(g.obtained)} / {formatWeight(g.possible)} absolutes
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="tams-table-wrap mt-2">
                      <table className="tams-table">
                        <thead>
                          <tr>
                            <th>Assessment</th>
                            <th className="tams-numeral">Score</th>
                            <th className="tams-numeral">Total</th>
                            <th className="tams-numeral">Absolutes</th>
                            <th className="tams-numeral">Class Avg</th>
                            <th className="tams-numeral">Max</th>
                            <th className="tams-numeral">Min</th>
                            <th className="tams-numeral">Weight</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.rows.map((r) => (
                            <tr key={r.id} className="transition-colors">
                              <td>
                                <div>{r.title}</div>
                                {r.notCountedReason && (
                                  <div className="text-xs text-muted-foreground">{r.notCountedReason}</div>
                                )}
                              </td>
                              <td className="tams-numeral">{r.score !== null ? r.score : "—"}</td>
                              <td className="tams-numeral text-muted-foreground">{r.maxMarks}</td>
                              <td className="tams-numeral">{r.abs !== null ? `${r2(r.abs)}` : "—"}</td>
                              <td className="tams-numeral text-muted-foreground">
                                {r.classAvg !== null
                                  ? `${Math.round(r.classAvg * 10) / 10} (${r2(r.classAvgAbs ?? 0)} abs)`
                                  : "—"}
                              </td>
                              <td className="tams-numeral text-muted-foreground">{r.classHigh !== null ? r.classHigh : "—"}</td>
                              <td className="tams-numeral text-muted-foreground">{r.classLow !== null ? r.classLow : "—"}</td>
                              <td className="tams-numeral text-muted-foreground">{formatWeight(r.weight)}</td>
                            </tr>
                          ))}
                          <tr className="bg-muted/40 font-semibold">
                            <td>
                              {g.label} total
                              {g.note && <div className="text-xs font-normal text-muted-foreground">{g.note}</div>}
                            </td>
                            <td className="tams-numeral" colSpan={2} />
                            <td className="tams-numeral">{r2(g.obtained)}</td>
                            <td className="tams-numeral text-xs font-normal text-muted-foreground" colSpan={3}>
                              {pct(g.obtained, g.weight)} on graded
                            </td>
                            <td className="tams-numeral">{formatWeight(g.possible)}</td>
                          </tr>
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

      {report.groups.length > 0 && (
        <Card data-edge>
          <CardHeader>
            <CardTitle>Combined Total</CardTitle>
            <CardDescription>All counted marks added together</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="tams-table-wrap">
              <table className="tams-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="tams-numeral">Absolutes</th>
                    <th className="tams-numeral">Out of</th>
                    <th className="tams-numeral">On graded</th>
                  </tr>
                </thead>
                <tbody>
                  {report.groups.map((g) => (
                    <tr key={g.type}>
                      <td>{g.label}</td>
                      <td className="tams-numeral">{r2(g.obtained)}</td>
                      <td className="tams-numeral text-muted-foreground">{formatWeight(g.possible)}</td>
                      <td className="tams-numeral text-muted-foreground">{pct(g.obtained, g.weight)}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/40 font-semibold">
                    <td>Total</td>
                    <td className="tams-numeral">{r2(report.obtained)}</td>
                    <td className="tams-numeral">{formatWeight(report.possible)}</td>
                    <td className="tams-numeral">{pct(report.obtained, report.weight)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
