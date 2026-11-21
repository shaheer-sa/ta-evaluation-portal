"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";

// full-size image viewer on the same page: close with ×, Esc or a click on
// the dark background; arrows (or ← →) move between images
export function ImageViewer({
  images,
  index,
  onIndexChange,
  onClose,
  label = "Screenshot",
}: {
  images: string[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  label?: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const many = images.length > 1;
  const prev = () => onIndexChange((index - 1 + images.length) % images.length);
  const next = () => onIndexChange((index + 1) % images.length);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (many && e.key === "ArrowLeft") prev();
      if (many && e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    // stop the page behind from scrolling while open
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, many]);

  const btn =
    "flex items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 sm:p-10"
      role="dialog"
      aria-modal="true"
      aria-label={`${label} ${index + 1} of ${images.length}`}
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[index]}
        alt={`${label} ${index + 1}`}
        onClick={(e) => e.stopPropagation()}
        className="rounded-md bg-white shadow-2xl"
        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
      />

      <div className="absolute right-3 top-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {many && (
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-white">
            {index + 1} / {images.length}
          </span>
        )}
        <a
          href={images[index]}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btn} h-10 w-10`}
          aria-label="Open in a new tab"
          title="Open in a new tab"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        <button ref={closeRef} type="button" onClick={onClose} className={`${btn} h-10 w-10`} aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>

      {many && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className={`${btn} absolute left-3 top-1/2 h-11 w-11 -translate-y-1/2`}
            aria-label="Previous screenshot"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className={`${btn} absolute right-3 top-1/2 h-11 w-11 -translate-y-1/2`}
            aria-label="Next screenshot"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
    </div>,
    document.body
  );
}
