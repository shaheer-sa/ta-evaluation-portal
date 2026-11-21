"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, BellOff } from "lucide-react";
import { pushSupport, resyncPush, turnOffPush, turnOnPush, type PushSupport } from "@/lib/push-client";

type State = "loading" | "on" | "off" | "denied";

/** "Notifications on this device" row at the bottom of the bell */
export function PushToggle({ variant = "panel" }: { variant?: "panel" | "card" }) {
  const box = variant === "panel" ? "border-t px-3" : "rounded-lg border bg-muted/40 px-3";
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = pushSupport();
    setSupport(s);
    if (s !== "ok") return;
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    resyncPush()
      .then((on) => setState(on ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  if (support === null || support === "no-key" || (support === "ok" && state === "loading")) return null;

  if (support === "ios-install") {
    return (
      <p className={`flex items-start gap-2 ${box} py-2.5 text-[11px] leading-snug text-muted-foreground`}>
        <BellRing className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          To get notifications on iPhone, tap <strong>Share</strong> then <strong>Add to Home Screen</strong>, and open TAMS
          from your home screen.
        </span>
      </p>
    );
  }

  if (support === "unsupported") return null;

  if (state === "denied") {
    return (
      <p className={`flex items-start gap-2 ${box} py-2.5 text-[11px] leading-snug text-muted-foreground`}>
        <BellOff className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Notifications are blocked for TAMS in this browser. You can allow them from the site settings.</span>
      </p>
    );
  }

  async function toggle() {
    setBusy(true);
    try {
      if (state === "on") {
        await turnOffPush();
        setState("off");
        toast.success("Notifications turned off on this device.");
      } else {
        const result = await turnOnPush();
        if (result === "denied") {
          setState(Notification.permission === "denied" ? "denied" : "off");
          toast.error("Notifications weren't allowed.");
        } else {
          setState("on");
          toast.success("Notifications are on for this device.");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const on = state === "on";
  return (
    <div className={`flex items-center justify-between gap-3 ${box} py-2`}>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        {on ? (
          <BellRing className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        ) : (
          <BellOff className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        Notifications on this device
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Notifications on this device"
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
  );
}
