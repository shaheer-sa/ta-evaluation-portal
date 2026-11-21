"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isRecentRelease, releasesFor, type Audience, type Release } from "@/lib/updates";

type UpdatesContextValue = {
  role: Audience;
  ready: boolean;
  releases: Release[];
  unseenReleases: Release[];
  isSeen: (key: string) => boolean;
  markSeen: (keys: string[]) => void;
};

const UpdatesContext = createContext<UpdatesContextValue | null>(null);

// knows which release notes and feature notes this user has seen
export function UpdatesProvider({ role, children }: { role: Audience; children: ReactNode }) {
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const releases = useMemo(() => releasesFor(role), [role]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/seen")
      .then((r) => (r.ok ? r.json() : { keys: [] }))
      .then((d: { keys?: string[] }) => {
        if (!cancelled) setSeen(new Set(d.keys || []));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isSeen = useCallback((key: string) => seen.has(key), [seen]);

  const markSeen = useCallback((keys: string[]) => {
    const fresh = keys.filter((k) => !seen.has(k));
    if (fresh.length === 0) return;
    setSeen((prev) => new Set([...prev, ...fresh]));
    fetch("/api/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys: fresh }),
    }).catch(() => {});
  }, [seen]);

  const unseenReleases = useMemo(
    () => (ready ? releases.filter((r) => isRecentRelease(r) && !seen.has(`release:${r.id}`)) : []),
    [ready, releases, seen]
  );

  return (
    <UpdatesContext.Provider value={{ role, ready, releases, unseenReleases, isSeen, markSeen }}>
      {children}
    </UpdatesContext.Provider>
  );
}

export function useUpdates() {
  return useContext(UpdatesContext);
}
