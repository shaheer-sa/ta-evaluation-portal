"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export default function AmbientField() {
  const fineRef = useRef<HTMLDivElement>(null);
  const coarseRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const hasHover = window.matchMedia("(hover: hover)").matches;

    // Static render for reduced-motion users and touch devices (no cursor to track).
    if (prefersReduced || !hasHover) return;

    const glow = glowRef.current;
    const fine = fineRef.current;
    const coarse = coarseRef.current;
    if (!glow || !fine || !coarse) return;

    gsap.set(glow, { x: window.innerWidth / 2, y: window.innerHeight / 2 });

    // quickTo is ticker-driven and far cheaper than calling gsap.to per event.
    const glowX = gsap.quickTo(glow, "x", { duration: 0.9, ease: "power3.out" });
    const glowY = gsap.quickTo(glow, "y", { duration: 0.9, ease: "power3.out" });
    const fineX = gsap.quickTo(fine, "x", { duration: 1.4, ease: "power3.out" });
    const fineY = gsap.quickTo(fine, "y", { duration: 1.4, ease: "power3.out" });
    const coarseX = gsap.quickTo(coarse, "x", { duration: 1.9, ease: "power3.out" });
    const coarseY = gsap.quickTo(coarse, "y", { duration: 1.9, ease: "power3.out" });

    const onPointerMove = (e: PointerEvent) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;

      glowX(e.clientX);
      glowY(e.clientY);

      // Grids drift AGAINST the cursor at different rates — that difference is
      // what creates the depth. Keep the two rates distinct.
      fineX(-nx * 14);
      fineY(-ny * 14);
      coarseX(-nx * 32);
      coarseY(-ny * 32);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      gsap.killTweensOf([glow, fine, coarse]);
    };
  }, []);

  return (
    <div className="tams-field" aria-hidden="true">
      <div className="tams-field__glow" ref={glowRef} />
      <div className="tams-field__grid tams-field__grid--coarse" ref={coarseRef} />
      <div className="tams-field__grid tams-field__grid--fine" ref={fineRef} />
      <div className="tams-field__vignette" />
    </div>
  );
}
