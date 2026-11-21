import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReportsList, type IssueReport } from "./reports-list";

export const metadata = { title: "Issue Reports — TAMS" };

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("issue_reports")
    .select(
      "id, category, message, page_url, user_agent, status, created_at, resolved_at, screenshot_paths, profiles:reporter_id ( full_name, roll_number, email )"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data as unknown as (Omit<IssueReport, "screenshots"> & { screenshot_paths: string[] })[]) || [];

  // screenshots live in a private bucket: make short-lived links for this page.
  // only reached by the ta (middleware), and the rows above came through the
  // ta's own database access
  const allPaths = rows.flatMap((r) => r.screenshot_paths || []);
  const links = new Map<string, string>();
  if (allPaths.length > 0) {
    const { data: signed } = await createAdminClient()
      .storage.from("issue-screenshots")
      .createSignedUrls(allPaths, 60 * 60);
    for (const item of signed || []) {
      if (item.path && item.signedUrl) links.set(item.path, item.signedUrl);
    }
  }

  const reports: IssueReport[] = rows.map(({ screenshot_paths, ...r }) => ({
    ...r,
    screenshots: (screenshot_paths || []).map((p) => links.get(p)).filter((u): u is string => !!u),
  }));

  return (
    <div className="space-y-8">
      <div className="tams-pagehead">
        <div>
          <p className="tams-pagehead__eyebrow">TEACHING ASSISTANT</p>
          <h1 className="tams-pagehead__title">Issue Reports</h1>
        </div>
        <p className="text-sm text-muted-foreground text-right hidden sm:block">
          Problems students reported with the website.
        </p>
      </div>
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm" role="alert">
          Couldn&apos;t load issue reports (code {error.code || "unknown"}). The database setup for reports may be
          incomplete. Run the latest SQL migration in Supabase, then refresh.
        </p>
      )}
      <ReportsList reports={reports} />
    </div>
  );
}
