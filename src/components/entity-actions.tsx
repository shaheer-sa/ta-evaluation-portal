"use client";

import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
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
}: {
  id: string;
  itemName: string;
  deleteAction: (formData: FormData) => void | Promise<void>;
  editAction?: (formData: FormData) => void | Promise<void>;
  editNode?: ReactNode;
  editTitle?: string;
  editDescription?: string;
  type?: "default" | "unlink";
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);

  async function handleEditSubmit(formData: FormData) {
    if (!editAction) return;
    try {
      await editAction(formData);
      setIsEditOpen(false);
      toast.success("Changes saved successfully!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save changes");
    }
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
              <input type="hidden" name="id" value={id} />
              {editNode}
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
                : "This action cannot be undone. This will permanently delete this item and ALL associated data (including related sections, assessments, and marks)."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <form action={deleteAction}>
              <input type="hidden" name="id" value={id} />
              <Button type="submit" variant="destructive">
                {type === "unlink" ? "Yes, unlink it" : "Yes, delete it"}
              </Button>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
