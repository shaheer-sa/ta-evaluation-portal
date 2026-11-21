import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { loadCourseReport } from "@/lib/course-report";
import { CourseReportView } from "@/components/course-report-view";
import { FeatureNote } from "@/components/updates/feature-note";
import type { Database } from "@/types/database";

type EnrollmentRow = Pick<Database["public"]["Tables"]["enrollments"]["Row"], "id" | "course_id" | "section_id"> & {
  courses: Pick<Database["public"]["Tables"]["courses"]["Row"], "code" | "name"> | null;
  sections: (Pick<Database["public"]["Tables"]["sections"]["Row"], "name"> & {
    terms: Pick<Database["public"]["Tables"]["terms"]["Row"], "name"> | null;
  }) | null;
};

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
  const { data: rawEnrollment } = await supabase
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

  const enrollment = rawEnrollment as unknown as EnrollmentRow | null;

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

  const [report] = await Promise.all([
    loadCourseReport(supabase, {
      id: enrollment.id,
      section_id: enrollment.section_id,
      course_id: enrollment.course_id,
    }),
    // the student is looking at these marks now: clear the "new marks" notice
    // (so the bell is up to date and the evening email skips them)
    supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", user.id)
      .eq("type", "marks_updated")
      .eq("related_id", enrollment.id)
      .eq("is_read", false)
      .then(({ error }) => {
        if (error) console.error("marks notice read failed:", error.code);
      }),
  ]);

  if (!report) {
    return <p className="text-muted-foreground">This course isn&apos;t set up yet. Ask your TA.</p>;
  }

  const course = enrollment.courses;
  const section = enrollment.sections;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/student">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>
      <div className="tams-pagehead">
        <div>
          <p className="tams-pagehead__eyebrow">STUDENT</p>
          <h1 className="tams-pagehead__title">
            {course?.code} — {course?.name}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground text-right hidden sm:block">
          {section?.terms?.name} · Section {section?.name}
        </p>
      </div>

      <FeatureNote id="course-totals" />
      <CourseReportView report={report} />
    </div>
  );
}
