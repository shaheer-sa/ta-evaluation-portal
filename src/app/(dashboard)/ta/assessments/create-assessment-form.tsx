"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAssessment } from "./actions";

const ALL_ASSESSMENT_TYPES = [
  { value: "assignment", label: "Assignment", requirement: "enable_assignments" },
  { value: "quiz", label: "Quiz", requirement: "enable_quizzes" },
  { value: "cp", label: "Class Participation", requirement: "enable_cp" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CreateAssessmentForm({ sectionCourses }: { sectionCourses: any[] }) {
  const [selectedSectionCourseId, setSelectedSectionCourseId] = useState("");
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const selectedCourse = sectionCourses.find(
    (sc) => sc.id === selectedSectionCourseId
  )?.courses;

  const availableTypes = ALL_ASSESSMENT_TYPES.filter((type) => {
    if (!type.requirement) return true;
    if (!selectedCourse) return true; // Show all by default if no class selected

    return selectedCourse[type.requirement] !== false;
  });

  return (
    <form
      ref={formRef}
      action={(formData) => {
        startTransition(async () => {
          try {
            await createAssessment(formData);
            toast.success("Assessment created");
            formRef.current?.reset();
            setSelectedSectionCourseId("");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (err: any) {
            toast.error(err.message || "Failed to create assessment");
          }
        });
      }}
      className="space-y-4"
    >
      <fieldset disabled={isPending} className="space-y-4 group">
      <div className="space-y-2">
        <Label htmlFor="sectionCourseId">Class</Label>
        <select
          id="sectionCourseId"
          name="sectionCourseId"
          required
          value={selectedSectionCourseId}
          onChange={(e) => setSelectedSectionCourseId(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Select a class...</option>
          {sectionCourses?.map((sc) => {
            const termName = sc.sections?.terms?.name;
            const sectionName = sc.sections?.name;
            const courseCode = sc.courses?.code;
            const courseName = sc.courses?.name;
            return (
              <option key={sc.id} value={sc.id}>
                {termName} — Section {sectionName} ({courseCode} {courseName})
              </option>
            );
          })}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <select
          id="type"
          name="type"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {availableTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          placeholder="e.g. Quiz 1"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="maxMarks">Max Marks</Label>
          <Input
            id="maxMarks"
            name="maxMarks"
            type="number"
            required
            step="0.5"
            min="0"
            placeholder="e.g. 20"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weight">Weight</Label>
          <Input
            id="weight"
            name="weight"
            type="number"
            required
            step="0.1"
            min="0"
            max="100"
            placeholder="e.g. 10"
          />
        </div>
      </div>

      </fieldset>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create Assessment"}
      </Button>
    </form>
  );
}
