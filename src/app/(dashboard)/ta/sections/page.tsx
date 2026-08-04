import { createClient } from "@/lib/supabase/server";
import { createSection, linkCourseToSection } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SectionsPage() {
  const supabase = await createClient();

  // Fetch active terms for dropdowns
  const { data: terms } = await supabase
    .from("terms")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  // Fetch all courses for dropdowns
  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .order("code", { ascending: true });

  // Fetch sections with their terms and mapped courses
  const { data: sections } = await supabase
    .from("sections")
    .select(`
      id,
      name,
      term_id,
      terms ( name ),
      section_courses (
        id,
        course_id,
        courses ( code, name )
      )
    `)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sections</h1>
        <p className="text-muted-foreground">
          Create sections for active terms and link courses to them.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* ── Create Section ──────────────────────────────────────── */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create New Section</CardTitle>
              <CardDescription>
                Add a new section (e.g., &quot;Section A&quot;) to an active term.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createSection} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="termId">Term</Label>
                  <select
                    id="termId"
                    name="termId"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Select a term...</option>
                    {terms?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Section Name</Label>
                  <Input id="name" name="name" required placeholder="e.g. A" />
                </div>
                <Button type="submit">Create Section</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Link Course to Section</CardTitle>
              <CardDescription>
                Enable a specific course for a section.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={linkCourseToSection} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sectionId">Section</Label>
                  <select
                    id="sectionId"
                    name="sectionId"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Select a section...</option>
                    {sections?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(s.terms as any)?.name} — Section {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="courseId">Course</Label>
                  <select
                    id="courseId"
                    name="courseId"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Select a course...</option>
                    {courses?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit">Link Course</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* ── Existing Sections ────────────────────────────────────── */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Existing Sections</CardTitle>
            </CardHeader>
            <CardContent>
              {!sections?.length ? (
                <p className="text-sm text-muted-foreground">No sections found.</p>
              ) : (
                <div className="space-y-4">
                  {sections.map((section) => (
                    <div
                      key={section.id}
                      className="rounded-md border p-4 space-y-3"
                    >
                      <div className="font-semibold">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(section.terms as any)?.name} — Section {section.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p className="mb-1 font-medium text-foreground">Linked Courses:</p>
                        {section.section_courses.length === 0 ? (
                          <p className="italic">No courses linked yet.</p>
                        ) : (
                          <ul className="list-inside list-disc">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {section.section_courses.map((sc: any) => {
                              const course = Array.isArray(sc.courses) ? sc.courses[0] : sc.courses;
                              return (
                                <li key={sc.id}>
                                  {course?.code} — {course?.name}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
