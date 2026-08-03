const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const marks = [
    {
      score: 85,
      assessment_id: "789d9cc2-3c1d-4355-a921-9ecbd5fa42e3",
      enrollment_id: "fd0877bf-48c1-42a3-8483-e7e1c15a834a",
      sheet_synced_score: 85
    },
    {
      score: 9,
      assessment_id: "fc1972d7-3edc-433b-a804-ee38fc5608cc",
      enrollment_id: "fd0877bf-48c1-42a3-8483-e7e1c15a834a",
      sheet_synced_score: 9
    },
    {
      score: 95,
      assessment_id: "60798b1e-f434-445f-bfa3-234d73ca1221",
      enrollment_id: "fd0877bf-48c1-42a3-8483-e7e1c15a834a",
      sheet_synced_score: 95
    }
  ];

  const { data, error } = await supabase.from("marks").upsert(marks, { onConflict: "enrollment_id, assessment_id" });
  console.log("Restored:", error || "Success");
}

main();
