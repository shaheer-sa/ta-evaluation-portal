"use client";

import { useEffect } from "react";

export default function CardEdgeTracker() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hover = window.matchMedia("(hover: hover)").matches;
    if (reduce || !hover) return;

    // A stylesheet we own, so React never sees these mutations.
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-tams-edge", "");
    document.head.appendChild(styleEl);

    let frame = 0;
    let latest: PointerEvent | null = null;

    const apply = () => {
      frame = 0;
      const e = latest;
      if (!e) return;

      const target =
        (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-edge]") ?? null;
      if (!target) return;

      const r = target.getBoundingClientRect();
      const x = Math.round(e.clientX - r.left);
      const y = Math.round(e.clientY - r.top);

      // :hover matches only the card under the cursor, so one rule is enough.
      styleEl.textContent =
        `.tams-card:hover,.tams-stat:hover{--mx:${x}px;--my:${y}px;}`;
    };

    const onMove = (e: PointerEvent) => {
      latest = e;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    document.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      document.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
      styleEl.remove();
    };
  }, []);

  return null;
}
