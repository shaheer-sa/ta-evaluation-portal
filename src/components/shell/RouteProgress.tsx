"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export default function RouteProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const startedAt = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start on click, before Next begins navigating.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/")) return;          // internal links only
      if (anchor.target === "_blank") return;
      if (href === window.location.pathname) return;        // same page

      startedAt.current = Date.now();
      setActive(true);
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  // Stop when the new route has actually rendered.
  useEffect(() => {
    if (!active) return;

    // Keep it visible at least 400ms so fast navigations do not flash.
    const elapsed = Date.now() - startedAt.current;
    const remaining = Math.max(0, 400 - elapsed);

    hideTimer.current = setTimeout(() => setActive(false), remaining);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Safety net: never leave the bar stuck if a navigation is cancelled.
  useEffect(() => {
    if (!active) return;
    const failsafe = setTimeout(() => setActive(false), 10000);
    return () => clearTimeout(failsafe);
  }, [active]);

  if (!active) return null;
  return <div className="tams-progress" aria-hidden="true" />;
}
