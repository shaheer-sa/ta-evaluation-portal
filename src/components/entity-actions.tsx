"use client";

import { ReactNode, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function EntityActions({
  id,
  itemName,
  deleteAction,
  editAction,
  editNode,
  editTitle,
  editDescription,
  type = "default",
  affectedStudentsCount,
  affectedMarksCount,
}: {
  id: string;
  itemName: string;
  deleteAction: (formData: FormData) => void | Promise<void> | Promise<ActionResult>;
  editAction?: (formData: FormData) => void | Promise<void> | Promise<ActionResult>;
  editNode?: ReactNode;
  editTitle?: string;
  editDescription?: string;
  type?: "default" | "unlink";
  affectedStudentsCount?: number;
  affectedMarksCount?: number;
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);

  const [isPending, startTransition] = useTransition();

  async function handleEditSubmit(formData: FormData) {
    if (!editAction) return;
    startTransition(async () => {
      try {
        const result = await editAction(formData);
        if (result && (result as ActionResult).ok === false) {
          toast.error((result as ActionResult & { ok: false }).message);
          return;
        }
        setIsEditOpen(false);
        toast.success("Changes saved successfully!");
      } catch {
        toast.error("Couldn't complete that. Please refresh and sign in again.");
      }
    });
  }

  async function handleDeleteSubmit(formData: FormData) {
    if (!deleteAction) return;
    startTransition(async () => {
      try {
        const result = await deleteAction(formData);
        if (result && (result as ActionResult).ok === false) {
          toast.error((result as ActionResult & { ok: false }).message);
          return;
        }
        toast.success("Deleted successfully");
      } catch {
        toast.error("Couldn't complete that. Please refresh and sign in again.");
      }
    });
  }

  return (
    <div className="flex items-center space-x-1">
      {editNode && editAction && (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
              <Pencil size={15} />
              <span className="sr-only">Edit</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editTitle || "Edit"}</DialogTitle>
              {editDescription && <DialogDescription>{editDescription}</DialogDescription>}
            </DialogHeader>
            <form action={handleEditSubmit} className="space-y-4 pt-4">
              <fieldset disabled={isPending} className="contents group">
                <input type="hidden" name="id" value={id} />
                {editNode}
              </fieldset>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
            {type === "unlink" ? <X size={15} /> : <Trash2 size={15} />}
            <span className="sr-only">{type === "unlink" ? "Unlink" : "Delete"}</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {type === "unlink" ? "Unlink" : "Delete"} &quot;{itemName}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {type === "unlink" 
                ? "This will remove the course from this section."
                : (
                  <span className="space-y-2 block">
                    <span>This action cannot be undone. This will permanently delete this item and ALL associated data (including related sections, assessments, and marks).</span>
                    {(affectedStudentsCount !== undefined || affectedMarksCount !== undefined) && (
                      <span className="block mt-2 font-medium text-destructive">
                        Warning: This will destroy records for {affectedStudentsCount ?? 0} student(s) and {affectedMarksCount ?? 0} mark(s).
                      </span>
                    )}
                  </span>
                )
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <form action={handleDeleteSubmit}>
              <fieldset disabled={isPending} className="contents group">
                <input type="hidden" name="id" value={id} />
                <Button type="submit" variant="destructive">
                  {isPending ? "Processing…" : (type === "unlink" ? "Yes, unlink it" : "Yes, delete it")}
                </Button>
              </fieldset>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
