require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from("enrollments")
    .select(`
      id,
      profiles:student_id ( email ),
      marks ( id, assessment_id, score, sheet_synced_score )
    `)
    .limit(10);
  console.log("Error:", error);
  console.log("Enrollments:", JSON.stringify(data, null, 2));
}

main();
