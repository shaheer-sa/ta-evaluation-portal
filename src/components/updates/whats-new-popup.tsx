"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, MailWarning } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KIND_LABELS, type Release, type UpdateKind } from "@/lib/updates";
import { useUpdates } from "./updates-provider";
import { MarksEmailToggle } from "./marks-email-toggle";
import { PushToggle } from "@/components/push-toggle";

const KIND_STYLES: Record<UpdateKind, string> = {
  new: "bg-primary text-primary-foreground",
  improved: "bg-secondary text-secondary-foreground",
  fixed: "bg-green-600/15 text-green-700 dark:text-green-400",
};

/** opens once for important releases the user hasn't seen yet */
export function WhatsNewPopup() {
  const ctx = useUpdates();
  const [shown, setShown] = useState<Release[] | null>(null);

  // pick the releases once, when "seen" has loaded
  useEffect(() => {
    if (!ctx?.ready || shown !== null) return;
    setShown(ctx.unseenReleases.filter((r) => r.popup));
  }, [ctx, shown]);

  if (!ctx || !shown || shown.length === 0) return null;
  const role = ctx.role;
  const open = shown.some((r) => !ctx.isSeen(`release:${r.id}`));

  function close() {
    ctx?.markSeen(shown!.map((r) => `release:${r.id}`));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" aria-hidden="true" />
            What&apos;s new in TAMS
          </DialogTitle>
          <DialogDescription>
            {shown.length === 1 ? shown[0].summary[role] : "Here are the latest changes."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {shown.map((r) => (
            <section key={r.id} className="space-y-3">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">TAMS {r.title}</span> · Version {r.version}
              </p>
              {r.notice?.[role] && (
                <div className="flex gap-2.5 rounded-lg border border-amber-400/60 bg-amber-100/70 p-3 text-sm text-amber-950 dark:bg-amber-400/10 dark:text-amber-100">
                  <MailWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>{r.notice[role]}</p>
                </div>
              )}
              <ul className="space-y-3">
                {r.items.map((item) => (
                  <li key={item.title} className="flex gap-3">
                    <span
                      className={cn(
                        "mt-0.5 h-fit shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        KIND_STYLES[item.kind]
                      )}
                    >
                      {KIND_LABELS[item.kind]}
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.body}</p>
                      </div>
                      {item.action === "marks-email" && role === "student" && <MarksEmailToggle variant="card" />}
                      {item.action === "push" && <PushToggle variant="card" />}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" asChild>
            <Link href={`/${role}/updates`} onClick={close}>
              View all updates
            </Link>
          </Button>
          <Button onClick={close}>Got it</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
