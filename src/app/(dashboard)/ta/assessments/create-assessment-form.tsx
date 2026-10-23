"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAssessment } from "./actions";
import { formatWeight } from "@/lib/format";
import { autoWeight, categoryBestOf, categoryTotal } from "@/lib/category-weight";

const ALL_ASSESSMENT_TYPES = [
  { value: "assignment", label: "Assignment", requirement: "enable_assignments" },
  { value: "quiz", label: "Quiz", requirement: "enable_quizzes" },
  { value: "cp", label: "Class Participation", requirement: "enable_cp" },
];

export function CreateAssessmentForm({
  sectionCourses,
  typeCounts,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sectionCourses: any[];
  // how many of each type a class already has, key is `${sectionCourseId}:${type}`
  typeCounts: Record<string, number>;
}) {
  const [selectedSectionCourseId, setSelectedSectionCourseId] = useState("");
  const [type, setType] = useState("");
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

  // the select shows the first available type when nothing valid is picked
  const currentType = availableTypes.some((t) => t.value === type) ? type : availableTypes[0]?.value ?? "";
  const selectedSc = sectionCourses.find((sc) => sc.id === selectedSectionCourseId);
  const autoTotal = categoryTotal(selectedSc, currentType);
  let autoInfo: { weight: number; text: string } | null = null;
  if (autoTotal !== null) {
    const newCount = (typeCounts[`${selectedSectionCourseId}:${currentType}`] || 0) + 1;
    const best = categoryBestOf(selectedSc, currentType);
    const counted = best && best < newCount ? best : newCount;
    const weight = autoWeight(autoTotal, best, newCount);
    const plural = currentType === "quiz" ? "quizzes" : "assignments";
    autoInfo = {
      weight,
      text: `${formatWeight(autoTotal)} ÷ ${counted}${best && best < newCount ? ` (best ${best})` : ` ${plural}`} = ${formatWeight(weight)} each. The others update too.`,
    };
  }

  return (
    <form
      ref={formRef}
      action={(formData) => {
        startTransition(async () => {
          try {
            const result = await createAssessment(formData);
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            toast.success("Assessment created");
            formRef.current?.reset();
            setSelectedSectionCourseId("");
            setType("");
          } catch {
            toast.error("Failed to create assessment");
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
          {(() => {
            const hasActiveTerm = sectionCourses?.some((sc) => sc.sections?.terms?.is_active);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const renderOption = (sc: any) => {
              const termName = sc.sections?.terms?.name || "Term";
              const sectionName = sc.sections?.name || "Sec";
              const courseCode = sc.courses?.code || "Code";
              const cName = sc.courses?.name || "";
              const shortName = cName.length > 40 ? cName.slice(0, 39) + "…" : cName;
              return (
                <option key={sc.id} value={sc.id}>
                  {termName} — Section {sectionName} · {shortName || "Course"} ({courseCode})
                </option>
              );
            };

            if (!hasActiveTerm) {
              return sectionCourses?.map(renderOption);
            }

            const active = (sectionCourses || []).filter((sc) => sc.sections?.terms?.is_active);
            const past = (sectionCourses || []).filter((sc) => !sc.sections?.terms?.is_active);

            return (
              <>
                {active.map(renderOption)}
                {past.length > 0 && (
                  <optgroup label="Past terms">
                    {past.map(renderOption)}
                  </optgroup>
                )}
              </>
            );
          })()}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <select
          id="type"
          name="type"
          required
          value={currentType}
          onChange={(e) => setType(e.target.value)}
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
          <Label htmlFor="maxMarks">Total Marks</Label>
          <Input
            id="maxMarks"
            name="maxMarks"
            type="number"
            required
            step="any"
            min="0"
            placeholder="e.g. 20"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weight">Weight</Label>
          {autoInfo ? (
            <>
              <input type="hidden" name="weight" value={Math.round(autoInfo.weight * 10000) / 10000} />
              <div className="flex h-10 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">
                {formatWeight(autoInfo.weight)} (auto)
              </div>
            </>
          ) : (
            <Input
              id="weight"
              name="weight"
              type="number"
              required
              step="any"
              min="0"
              max="100"
              placeholder="e.g. 10"
            />
          )}
        </div>
      </div>
      {autoInfo && (
        <p className="-mt-2 text-xs text-muted-foreground">{autoInfo.text}</p>
      )}

      </fieldset>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create Assessment"}
      </Button>
    </form>
  );
}
