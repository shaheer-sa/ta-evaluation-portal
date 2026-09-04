"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ActionResult } from "@/lib/action-result";

export function DeleteAssessmentButton({
  assessmentId,
  assessmentLabel,
  deleteAction,
}: {
  assessmentId: string;
  assessmentLabel: string;
  deleteAction: (formData: FormData) => void | Promise<void> | Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleDelete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const result = await deleteAction(fd);
        if (result && (result as ActionResult).ok === false) {
          toast.error((result as ActionResult & { ok: false }).message);
          return;
        }
        toast.success("Assessment deleted");
        setOpen(false);
      } catch {
        toast.error("Couldn't complete that. Please refresh and sign in again.");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
        >
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{assessmentLabel}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            Deleting this assessment will permanently remove all marks
            students have received on it. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form onSubmit={handleDelete}>
            <input type="hidden" name="assessmentId" value={assessmentId} />
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Deleting…" : "Yes, delete it"}
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
