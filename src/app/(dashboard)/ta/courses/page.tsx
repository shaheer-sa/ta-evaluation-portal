import { createClient } from "@/lib/supabase/server";
import { createTerm, createCourse, updateTerm, deleteTerm, updateCourse, deleteCourse } from "./actions";
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

export default async function CoursesPage() {
  const supabase = await createClient();

  const [
    { data: terms, error: termsError },
    { data: courses, error: coursesError },
  ] = await Promise.all([
    supabase.from("terms").select("*").order("created_at", { ascending: false }),
    supabase.from("courses").select("*").order("code", { ascending: true }),
  ]);

  return (
    <div className="space-y-8">
      <div className="tams-pagehead">
        <div>
          <p className="tams-pagehead__eyebrow">TEACHING ASSISTANT</p>
          <h1 className="tams-pagehead__title">Terms & Courses</h1>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* ── Terms Section ──────────────────────────────────────── */}
        <div className="space-y-6">
          <Card data-edge>
            <CardHeader>
              <CardTitle>Create New Term</CardTitle>
              <CardDescription>
                Add a new semester (e.g., &quot;Fall 2024&quot;).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createTerm} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Term Name</Label>
                  <Input id="name" name="name" required placeholder="Spring 2025" />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    name="isActive"
                    defaultChecked
                    className="h-4 w-4 rounded border-gray-300 bg-background text-primary"
                  />
                  <Label htmlFor="isActive" className="font-normal">
                    Active Term
                  </Label>
                </div>
                <Button type="submit">Create Term</Button>
              </form>
            </CardContent>
          </Card>

          <Card data-edge>
            <CardHeader>
              <CardTitle>Existing Terms</CardTitle>
            </CardHeader>
            <CardContent>
              {termsError && <p className="text-destructive">Failed to load terms.</p>}
              {!terms?.length ? (
                <p className="text-sm text-muted-foreground">No terms found.</p>
              ) : (
                <ul className="space-y-3">
                  {terms.map((term) => (
                    <li
                      key={term.id}
                      className="tams-inset flex items-center justify-between p-3"
                    >
                      <span className="font-medium">{term.name}</span>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            term.is_active
                              ? "bg-green-500/20 text-green-500"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {term.is_active ? "Active" : "Inactive"}
                        </span>
                        <EntityActions
                          id={term.id}
                          itemName={term.name}
                          deleteAction={deleteTerm}
                          editAction={updateTerm}
                          editTitle="Edit Term"
                          editNode={
                            <>
                              <div className="space-y-2">
                                <Label htmlFor={`edit-term-${term.id}`}>Term Name</Label>
                                <Input id={`edit-term-${term.id}`} name="name" defaultValue={term.name} required />
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`edit-term-active-${term.id}`}
                                  name="isActive"
                                  defaultChecked={term.is_active}
                                  className="h-4 w-4 rounded border-gray-300 bg-background text-primary"
                                />
                                <Label htmlFor={`edit-term-active-${term.id}`} className="font-normal">
                                  Active Term
                                </Label>
                              </div>
                              <Button type="submit" className="w-full">Save Changes</Button>
                            </>
                          }
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Courses Section ────────────────────────────────────── */}
        <div className="space-y-6">
          <Card data-edge>
            <CardHeader>
              <CardTitle>Create New Course</CardTitle>
              <CardDescription>
                Add a new course you are TAing for.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createCourse} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Course Code</Label>
                    <Input id="code" name="code" required placeholder="CS101" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="courseName">Course Name</Label>
                    <Input id="courseName" name="name" required placeholder="Intro to CS" />
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <Label>Enable Features</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "enableCp", label: "Class Participation" },
                      { id: "enableAssignments", label: "Assignments" },
                      { id: "enableQuizzes", label: "Quizzes" },
                      { id: "enableReeval", label: "Re-evaluations" },
                    ].map((feature) => (
                      <div key={feature.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={feature.id}
                          name={feature.id}
                          defaultChecked
                          className="h-4 w-4 rounded border-gray-300 bg-background text-primary"
                        />
                        <Label htmlFor={feature.id} className="font-normal text-sm">
                          {feature.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <Button type="submit">Create Course</Button>
              </form>
            </CardContent>
          </Card>

          <Card data-edge>
            <CardHeader>
              <CardTitle>Existing Courses</CardTitle>
            </CardHeader>
            <CardContent>
              {coursesError && <p className="text-destructive">Failed to load courses.</p>}
              {!courses?.length ? (
                <p className="text-sm text-muted-foreground">No courses found.</p>
              ) : (
                <ul className="space-y-3">
                  {courses.map((course) => (
                    <li
                      key={course.id}
                      className="tams-inset flex flex-col gap-1 p-3 text-sm"
                    >
                      <div className="flex justify-between items-start">
                        <div className="font-medium">
                          {course.code} — {course.name}
                        </div>
                        <EntityActions
                          id={course.id}
                          itemName={`${course.code} - ${course.name}`}
                          deleteAction={deleteCourse}
                          editAction={updateCourse}
                          editTitle="Edit Course"
                          editNode={
                            <>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor={`edit-code-${course.id}`}>Course Code</Label>
                                  <Input id={`edit-code-${course.id}`} name="code" defaultValue={course.code} required />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`edit-name-${course.id}`}>Course Name</Label>
                                  <Input id={`edit-name-${course.id}`} name="name" defaultValue={course.name} required />
                                </div>
                              </div>
                              <div className="space-y-3 pt-2">
                                <Label>Enable Features</Label>
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { id: `enableCp-${course.id}`, name: "enableCp", label: "Class Participation", checked: course.enable_cp },
                                    { id: `enableAssignments-${course.id}`, name: "enableAssignments", label: "Assignments", checked: course.enable_assignments },
                                    { id: `enableQuizzes-${course.id}`, name: "enableQuizzes", label: "Quizzes", checked: course.enable_quizzes },
                                    { id: `enableReeval-${course.id}`, name: "enableReeval", label: "Re-evaluations", checked: course.enable_reeval },
                                  ].map((feature) => (
                                    <div key={feature.id} className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        id={feature.id}
                                        name={feature.name}
                                        defaultChecked={feature.checked}
                                        className="h-4 w-4 rounded border-gray-300 bg-background text-primary"
                                      />
                                      <Label htmlFor={feature.id} className="font-normal text-sm">
                                        {feature.label}
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <Button type="submit" className="w-full">Save Changes</Button>
                            </>
                          }
                        />
                      </div>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {course.enable_cp && <span>CP</span>}
                        {course.enable_assignments && <span>Assignments</span>}
                        {course.enable_quizzes && <span>Quizzes</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
