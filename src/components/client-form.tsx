"use client";

import { useTransition, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

export function ClientForm({
  action,
  successMessage,
  submitText = "Submit",
  pendingText = "Saving…",
  children,
  className,
}: {
  action: (formData: FormData) => void | Promise<void> | Promise<ActionResult>;
  successMessage?: string;
  submitText?: string;
  pendingText?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          try {
            const result = await action(formData);
            if (result && (result as ActionResult).ok === false) {
              toast.error((result as ActionResult & { ok: false }).message);
              return;
            }
            if (successMessage) toast.success(successMessage);
            formRef.current?.reset();
          } catch {
            toast.error("Couldn't complete that. Please refresh and sign in again.");
          }
        });
      }}
    >
      <fieldset disabled={isPending} className="contents group">
        {children}
      </fieldset>
      <Button type="submit" disabled={isPending} className="mt-4">
        {isPending ? pendingText : submitText}
      </Button>
    </form>
  );
}
