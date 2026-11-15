"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Maximize2, X } from "lucide-react";

export type CaptureRect = { x: number; y: number; w: number; h: number };

type Mode = "move" | "draw" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const MIN = 40; // smallest box, in css pixels

const HANDLES: { mode: Mode; style: React.CSSProperties; cursor: string }[] = [
  { mode: "nw", style: { left: 0, top: 0 }, cursor: "nwse-resize" },
  { mode: "n", style: { left: "50%", top: 0 }, cursor: "ns-resize" },
  { mode: "ne", style: { left: "100%", top: 0 }, cursor: "nesw-resize" },
  { mode: "e", style: { left: "100%", top: "50%" }, cursor: "ew-resize" },
  { mode: "se", style: { left: "100%", top: "100%" }, cursor: "nwse-resize" },
  { mode: "s", style: { left: "50%", top: "100%" }, cursor: "ns-resize" },
  { mode: "sw", style: { left: 0, top: "100%" }, cursor: "nesw-resize" },
  { mode: "w", style: { left: 0, top: "50%" }, cursor: "ew-resize" },
];

function fullScreen(): CaptureRect {
  return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
}

/**
 * Snipping-tool style picker shown over the page. Starts with the whole screen
 * selected; the student can resize (edges/corners), move (drag inside) or draw
 * a new box (drag outside). Nothing is captured until they press Capture.
 * The whole overlay is marked data-capture-ignore so it never shows in the picture.
 */
export function CaptureOverlay({
  onConfirm,
  onCancel,
}: {
  onConfirm: (rect: CaptureRect) => void;
  onCancel: () => void;
}) {
  const [rect, setRect] = useState<CaptureRect>(() => fullScreen());
  const drag = useRef<{ mode: Mode; x0: number; y0: number; start: CaptureRect } | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // keyboard: Enter captures, Esc cancels; focus starts on Capture
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function begin(mode: Mode, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const start = mode === "draw" ? { x: e.clientX, y: e.clientY, w: 0, h: 0 } : rect;
    drag.current = { mode, x0: e.clientX, y0: e.clientY, start };
    if (mode === "draw") setRect(start);
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const px = Math.max(0, Math.min(vw, e.clientX));
    const py = Math.max(0, Math.min(vh, e.clientY));
    const dx = px - d.x0;
    const dy = py - d.y0;
    const s = d.start;

    if (d.mode === "move") {
      setRect({
        ...s,
        x: Math.max(0, Math.min(vw - s.w, s.x + dx)),
        y: Math.max(0, Math.min(vh - s.h, s.y + dy)),
      });
      return;
    }
    if (d.mode === "draw") {
      setRect({
        x: Math.min(d.x0, px),
        y: Math.min(d.y0, py),
        w: Math.abs(px - d.x0),
        h: Math.abs(py - d.y0),
      });
      return;
    }

    let { x, y, w, h } = s;
    if (d.mode.includes("e")) w = Math.max(MIN, Math.min(vw - s.x, s.w + dx));
    if (d.mode.includes("s")) h = Math.max(MIN, Math.min(vh - s.y, s.h + dy));
    if (d.mode.includes("w")) {
      const nx = Math.max(0, Math.min(s.x + s.w - MIN, s.x + dx));
      w = s.w + (s.x - nx);
      x = nx;
    }
    if (d.mode.includes("n")) {
      const ny = Math.max(0, Math.min(s.y + s.h - MIN, s.y + dy));
      h = s.h + (s.y - ny);
      y = ny;
    }
    setRect({ x, y, w, h });
  }

  function end() {
    const d = drag.current;
    drag.current = null;
    // a tap outside (no real drag) shouldn't leave a tiny box
    if (d?.mode === "draw") {
      setRect((r) => (r.w < MIN || r.h < MIN ? d.start.w > 0 ? d.start : fullScreen() : r));
    }
  }

  const tooSmall = rect.w < MIN || rect.h < MIN;
  // put the toolbar where it hides less of the box (top or bottom of the screen)
  const spaceAbove = rect.y;
  const spaceBelow = (typeof window !== "undefined" ? window.innerHeight : 0) - (rect.y + rect.h);
  const toolbarOnTop = spaceAbove > spaceBelow;

  return createPortal(
    <div
      data-capture-ignore=""
      className="fixed inset-0 z-[9999] select-none"
      style={{ touchAction: "none", cursor: "crosshair" }}
      onPointerDown={(e) => begin("draw", e)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      role="dialog"
      aria-modal="true"
      aria-label="Choose what to capture"
    >
      {/* the box; the huge shadow dims everything outside it */}
      <div
        className="absolute"
        style={{
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          boxShadow: "0 0 0 9999px rgba(8, 20, 35, 0.55)",
          outline: "2px dashed #F3E4C9",
          outlineOffset: -2,
          cursor: "move",
        }}
        onPointerDown={(e) => begin("move", e)}
      >
        {!tooSmall &&
          HANDLES.map((hd) => (
            <span
              key={hd.mode}
              onPointerDown={(e) => begin(hd.mode, e)}
              className="absolute flex h-8 w-8 items-center justify-center"
              // drawn just inside the box so they stay on screen even when the
              // box is the whole screen
              style={{
                ...hd.style,
                transform: `translate(${hd.mode.includes("w") ? "0" : hd.mode.includes("e") ? "-100%" : "-50%"}, ${
                  hd.mode.includes("n") ? "0" : hd.mode.includes("s") ? "-100%" : "-50%"
                })`,
                cursor: hd.cursor,
              }}
              aria-hidden="true"
            >
              <span className="block h-3.5 w-3.5 rounded-sm border-2 border-[#0A2947] bg-[#F3E4C9] shadow" />
            </span>
          ))}
        {!tooSmall && (
          <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-white">
            {Math.round(rect.w)} × {Math.round(rect.h)}
          </span>
        )}
      </div>

      {/* toolbar */}
      <div
        className={`fixed inset-x-4 ${toolbarOnTop ? "top-4" : "bottom-4"} mx-auto flex max-w-xl flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0A2947] p-3 text-[#F3E4C9] shadow-2xl`}
        style={{ cursor: "default" }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p className="text-xs leading-snug sm:text-sm">
          Drag the corners to choose what to capture, or draw a new box.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRect(fullScreen())}
            aria-label="Select the whole screen"
            className="flex items-center gap-1.5 rounded-lg border border-white/25 px-3 py-2 text-sm hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F3E4C9]"
          >
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Whole screen</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 rounded-lg border border-white/25 px-3 py-2 text-sm hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F3E4C9]"
          >
            <X className="h-4 w-4" aria-hidden="true" /> Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={tooSmall}
            onClick={() => onConfirm(rect)}
            className="flex items-center gap-1.5 rounded-lg bg-[#F3E4C9] px-3.5 py-2 text-sm font-semibold text-[#0A2947] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
          >
            <Camera className="h-4 w-4" aria-hidden="true" /> Capture
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
