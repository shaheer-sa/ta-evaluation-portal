"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Edit2, Loader2 } from "lucide-react";
import { updateAssessment } from "@/app/(dashboard)/ta/assessments/actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import type { Database } from "@/types/database";

const ALL_ASSESSMENT_TYPES = [
  { value: "assignment", label: "Assignment", requirement: "enable_assignments" },
  { value: "quiz", label: "Quiz", requirement: "enable_quizzes" },
  { value: "cp", label: "Class Participation", requirement: "enable_cp" },
];

export function EditAssessmentDialog({
  assessment,
  courseFlags,
}: {
  assessment: Pick<Database["public"]["Tables"]["assessments"]["Row"], "id" | "title" | "type" | "max_marks" | "weight">;
  courseFlags?: { enable_cp?: boolean; enable_assignments?: boolean; enable_quizzes?: boolean };
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      formData.append("assessmentId", assessment.id);
      const result = await updateAssessment(formData);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Assessment updated successfully!");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="hover-float">
          <Edit2 className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form action={onSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Assessment</DialogTitle>
            <DialogDescription>
              Make changes to {assessment.title}. Click save when you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <fieldset disabled={isPending} className="contents group">
            <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                defaultValue={assessment.title}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                name="type"
                defaultValue={assessment.type}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {ALL_ASSESSMENT_TYPES.filter((t) => {
                  if (!courseFlags) return true;
                  const key = t.requirement as keyof typeof courseFlags;
                  return courseFlags[key] !== false;
                }).map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxMarks">Max Marks</Label>
              <Input
                id="maxMarks"
                name="maxMarks"
                type="number"
                step="0.5"
                min="0"
                defaultValue={assessment.max_marks}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Weight</Label>
              <Input
                id="weight"
                name="weight"
                type="number"
                step="0.1"
                min="0"
                max="100"
                defaultValue={assessment.weight}
                required
              />
            </div>
          </div>
          </fieldset>
          <DialogFooter>
            <Button type="submit" disabled={isPending} className="hover-float">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
