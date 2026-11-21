"use client";

import { Sparkles, X } from "lucide-react";
import { FEATURE_NOTES, noteIsActive } from "@/lib/updates";
import { useUpdates } from "./updates-provider";

// small sticky note next to a new feature, until the user dismisses it
export function FeatureNote({ id, className = "" }: { id: string; className?: string }) {
  const ctx = useUpdates();
  if (!ctx || !ctx.ready) return null;
  const note = FEATURE_NOTES[id];
  const key = `note:${id}`;
  if (!note || !noteIsActive(id, ctx.role) || ctx.isSeen(key)) return null;

  return (
    <div className={`tams-feature-note ${className}`} role="note" aria-label={note.title}>
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider">{note.title}</p>
        <p className="mt-0.5 text-sm leading-snug">{note.body}</p>
      </div>
      <button
        type="button"
        onClick={() => ctx.markSeen([key])}
        className="tams-feature-note__close"
        aria-label="Got it, hide this note"
      >
        Got it
      </button>
      <button
        type="button"
        onClick={() => ctx.markSeen([key])}
        className="tams-feature-note__x"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
