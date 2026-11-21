import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { loadCourseReport } from "@/lib/course-report";
import { CourseReportView } from "@/components/course-report-view";

export const metadata = { title: "Student Report — TAMS" };

// the TA's view of one student's course report, the same breakdown the
// student sees on their own course page. opened from Analytics.
export default async function TaStudentReportPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const scId = typeof searchParams.sc === "string" ? searchParams.sc : "";
  const roll = typeof searchParams.roll === "string" ? searchParams.roll.trim() : "";
  const backHref = scId ? `/ta/analytics?sc=${encodeURIComponent(scId)}` : "/ta/analytics";

  const back = (
    <Link href={backHref}>
      <Button variant="ghost" size="sm">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Analytics
      </Button>
    </Link>
  );

  const notFound = (msg: string) => (
    <div className="space-y-4">
      {back}
      <p className="text-muted-foreground">{msg}</p>
    </div>
  );

  if (!scId || !roll) return notFound("Pick a student from Analytics to see their report.");

  const supabase = await createClient();
  const [{ data: rawSc }, { data: student }] = await Promise.all([
    supabase
      .from("section_courses")
      .select("id, section_id, course_id, sections ( name, terms ( name ) ), courses ( code, name )")
      .eq("id", scId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id, full_name, roll_number, email")
      .eq("roll_number", roll)
      .eq("role", "student")
      .maybeSingle(),
  ]);

  const sc = rawSc as unknown as {
    id: string;
    section_id: string;
    course_id: string;
    sections: { name: string; terms: { name: string } | null } | null;
    courses: { code: string; name: string } | null;
  } | null;

  if (!sc) return notFound("That class wasn't found.");
  if (!student) return notFound(`No student with roll number ${roll} was found.`);

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, section_id, course_id, status")
    .eq("student_id", student.id)
    .eq("section_id", sc.section_id)
    .eq("course_id", sc.course_id)
    .maybeSingle();

  if (!enrollment) return notFound(`${student.full_name || roll} isn't enrolled in this class.`);

  const report = await loadCourseReport(supabase, {
    id: enrollment.id,
    section_id: enrollment.section_id,
    course_id: enrollment.course_id,
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">{back}</div>
      <div className="tams-pagehead">
        <div>
          <p className="tams-pagehead__eyebrow">STUDENT REPORT</p>
          <h1 className="tams-pagehead__title">{student.full_name || roll}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {student.roll_number}
            {student.email ? ` · ${student.email}` : ""}
            {enrollment.status !== "active" ? ` · ${enrollment.status}` : ""}
          </p>
        </div>
        <p className="text-sm text-muted-foreground text-right hidden sm:block">
          {sc.courses?.code} — {sc.courses?.name}
          <br />
          {sc.sections?.terms?.name} · Section {sc.sections?.name}
        </p>
      </div>
      <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        This is the same breakdown the student sees on their course page.
      </p>
      {report ? (
        <CourseReportView report={report} />
      ) : (
        <p className="text-muted-foreground">This class isn&apos;t set up yet.</p>
      )}
    </div>
  );
}
