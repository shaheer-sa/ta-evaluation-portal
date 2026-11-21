"use client";

import { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatReleaseDate, KIND_LABELS, type UpdateKind } from "@/lib/updates";
import { useUpdates } from "@/components/updates/updates-provider";
import { MarksEmailToggle } from "@/components/updates/marks-email-toggle";
import { MailWarning } from "lucide-react";

const KIND_STYLES: Record<UpdateKind, string> = {
  new: "bg-primary text-primary-foreground",
  improved: "bg-secondary text-secondary-foreground",
  fixed: "bg-green-600/15 text-green-700 dark:text-green-400",
};

export function WhatsNew() {
  const ctx = useUpdates();
  // remember which releases were new when the page opened, so the "New" tag
  // stays visible while reading even though they get marked as seen
  const newOnOpen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!ctx?.ready || newOnOpen.current) return;
    newOnOpen.current = new Set(ctx.unseenReleases.map((r) => r.id));
    if (ctx.unseenReleases.length > 0) {
      ctx.markSeen(ctx.unseenReleases.map((r) => `release:${r.id}`));
    }
  }, [ctx]);

  if (!ctx) return null;

  return (
    <div className="space-y-8">
      <div className="tams-pagehead">
        <div>
          <p className="tams-pagehead__eyebrow">RELEASE NOTES</p>
          <h1 className="tams-pagehead__title">What&apos;s New</h1>
        </div>
        <p className="text-sm text-muted-foreground text-right hidden sm:block">
          The latest improvements and fixes in TAMS.
        </p>
      </div>

      {ctx.releases.length === 0 ? (
        <Card data-edge>
          <CardContent className="py-12 text-center text-muted-foreground">No release notes yet.</CardContent>
        </Card>
      ) : (
        <ol className="space-y-6">
          {ctx.releases.map((r) => {
            const isNew = newOnOpen.current?.has(r.id) || (!newOnOpen.current && ctx.unseenReleases.some((u) => u.id === r.id));
            return (
              <li key={r.id} id={`release-${r.id}`} className="scroll-mt-24">
                <Card data-edge>
                  <CardContent className="space-y-4 pt-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="tams-card__title text-lg">TAMS {r.title}</h2>
                        {isNew && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                            New
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Version {r.version} ·{" "}
                        <time dateTime={r.date}>{formatReleaseDate(r.date)}</time>
                      </span>
                    </div>
                    {r.summary[ctx.role] && <p className="text-sm text-muted-foreground">{r.summary[ctx.role]}</p>}
                    {r.notice?.[ctx.role] && (
                      <div className="flex gap-2.5 rounded-lg border border-amber-400/60 bg-amber-100/70 p-3 text-sm text-amber-950 dark:bg-amber-400/10 dark:text-amber-100">
                        <MailWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <p>{r.notice[ctx.role]}</p>
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
                            {item.action === "marks-email" && ctx.role === "student" && (
                              <div className="max-w-sm">
                                <MarksEmailToggle variant="card" />
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Thank you for using TAMS.
      </p>
    </div>
  );
}
