import { createClient } from "@/lib/supabase/server";
import StudentQueriesClient from "./client-page";

export default async function StudentQueriesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: rawQueries } = await supabase
    .from("queries")
    .select(`
      id,
      title,
      description,
      priority,
      status,
      created_at,
      assessments:assessment_id ( title )
    `)
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  return <StudentQueriesClient initialQueries={(rawQueries as unknown as React.ComponentProps<typeof StudentQueriesClient>["initialQueries"]) || []} />;
}
