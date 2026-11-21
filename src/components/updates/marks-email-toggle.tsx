"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";

// one shared copy of the setting, so the bell and the popup stay in sync
let cached: boolean | null = null;
let loading: Promise<boolean | null> | null = null;
const listeners = new Set<(v: boolean) => void>();

function load() {
  if (cached !== null) return Promise.resolve(cached);
  loading ??= fetch("/api/email-prefs")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (d && typeof d.marksEmail === "boolean") cached = d.marksEmail;
      return cached;
    })
    .catch(() => null)
    .finally(() => {
      loading = null;
    });
  return loading;
}

function publish(v: boolean) {
  cached = v;
  listeners.forEach((fn) => fn(v));
}

export const SPAM_HINT =
  "If you don't find it in your inbox, check your Spam folder and mark it as Not spam.";

/** "Email me about new marks" switch (students). Off by default. */
export function MarksEmailToggle({ variant = "panel" }: { variant?: "panel" | "card" }) {
  const [on, setOn] = useState<boolean | null>(cached);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listeners.add(setOn);
    load().then((v) => v !== null && setOn(v));
    return () => {
      listeners.delete(setOn);
    };
  }, []);

  if (on === null) return null;

  async function toggle() {
    const next = !on;
    setBusy(true);
    try {
      const res = await fetch("/api/email-prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marksEmail: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save your choice. Please try again.");
      publish(next);
      toast.success(next ? "You'll get an email when new marks are posted." : "Marks emails turned off.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your choice. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn(variant === "panel" ? "border-t px-3 py-2" : "rounded-lg border bg-muted/40 px-3 py-2.5")}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <Mail className={cn("h-3.5 w-3.5", on && "text-primary")} aria-hidden="true" />
          Email me about new marks
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Email me about new marks"
          disabled={busy}
          onClick={toggle}
          className="relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-60"
          style={{ background: on ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.45)" }}
        >
          <span
            className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
            style={{ left: 2, transform: on ? "translateX(16px)" : "translateX(0)" }}
          />
        </button>
      </div>
      {on && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{SPAM_HINT}</p>}
    </div>
  );
}
