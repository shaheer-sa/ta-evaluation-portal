"use client";

import { useTransition, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ClientForm({
  action,
  successMessage,
  submitText = "Submit",
  pendingText = "Saving…",
  children,
  className,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (formData: FormData) => Promise<any> | void;
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
      action={(formData) => {
        startTransition(async () => {
          try {
            await action(formData);
            if (successMessage) toast.success(successMessage);
            formRef.current?.reset();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (err: any) {
            toast.error(err.message || "Action failed");
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
