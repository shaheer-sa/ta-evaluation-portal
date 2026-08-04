import { createClient } from "@/lib/supabase/server";
import { createTerm, createCourse } from "./actions";
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Terms & Courses</h1>
        <p className="text-muted-foreground">
          Manage academic terms and the courses you are assisting in.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* ── Terms Section ──────────────────────────────────────── */}
        <div className="space-y-6">
          <Card>
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

          <Card>
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
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <span className="font-medium">{term.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          term.is_active
                            ? "bg-green-500/20 text-green-500"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {term.is_active ? "Active" : "Inactive"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Courses Section ────────────────────────────────────── */}
        <div className="space-y-6">
          <Card>
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

          <Card>
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
                      className="flex flex-col gap-1 rounded-md border p-3 text-sm"
                    >
                      <div className="font-medium">
                        {course.code} — {course.name}
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
