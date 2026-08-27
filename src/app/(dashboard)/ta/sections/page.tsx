import { createClient } from "@/lib/supabase/server";
import { createSection, linkCourseToSection, updateSection, deleteSection, unlinkCourseFromSection } from "./actions";
import { EntityActions } from "@/components/entity-actions";
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
import type { Database } from "@/types/database";

type SectionRow = Pick<Database["public"]["Tables"]["sections"]["Row"], "id" | "name" | "term_id"> & {
  terms: Pick<Database["public"]["Tables"]["terms"]["Row"], "name"> | null;
  section_courses: (Pick<Database["public"]["Tables"]["section_courses"]["Row"], "id" | "course_id"> & {
    courses: Pick<Database["public"]["Tables"]["courses"]["Row"], "code" | "name"> | null;
  })[];
};

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
  const { data: rawSections } = await supabase
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

  const sections = rawSections as unknown as SectionRow[] | null;

  return (
    <div className="space-y-8">
      <div className="tams-pagehead">
        <div>
          <p className="tams-pagehead__eyebrow">TEACHING ASSISTANT</p>
          <h1 className="tams-pagehead__title">Sections</h1>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* ── Create Section ──────────────────────────────────────── */}
        <div className="space-y-6">
          <Card data-edge>
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

          <Card data-edge>
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
                        {s.terms?.name} — Section {s.name}
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
          <Card data-edge>
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
                      className="tams-inset p-4 space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div className="font-semibold">
                          {section.terms?.name} — Section {section.name}
                        </div>
                        <EntityActions
                          id={section.id}
                          itemName={`Section ${section.name}`}
                          deleteAction={deleteSection}
                          editAction={updateSection}
                          editTitle="Edit Section"
                          editNode={
                            <>
                              <div className="space-y-2">
                                <Label htmlFor={`edit-term-${section.id}`}>Term</Label>
                                <select
                                  id={`edit-term-${section.id}`}
                                  name="termId"
                                  defaultValue={section.term_id}
                                  required
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  {terms?.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`edit-name-${section.id}`}>Section Name</Label>
                                <Input id={`edit-name-${section.id}`} name="name" defaultValue={section.name} required />
                              </div>
                              <Button type="submit" className="w-full">Save Changes</Button>
                            </>
                          }
                        />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p className="mb-1 font-medium text-foreground">Linked Courses:</p>
                        {section.section_courses.length === 0 ? (
                          <p className="italic">No courses linked yet.</p>
                        ) : (
                          <ul className="list-inside list-disc">
                            {section.section_courses.map((sc) => {
                              const course = sc.courses;
                              return (
                                <li key={sc.id} className="flex items-center justify-between group">
                                  <span>{course?.code} — {course?.name}</span>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <EntityActions
                                      id={sc.id}
                                      itemName={`${course?.code} from Section ${section.name}`}
                                      deleteAction={unlinkCourseFromSection}
                                      type="unlink"
                                    />
                                  </div>
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
