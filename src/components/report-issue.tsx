"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bug, Camera, CheckCircle2, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { fetchJson } from "@/lib/fetch-json";
import { CaptureOverlay, type CaptureRect } from "@/components/capture-overlay";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CATEGORIES = [
  { value: "bug", label: "Something isn't working" },
  { value: "display", label: "Something looks wrong" },
  { value: "login", label: "Login or password" },
  { value: "suggestion", label: "Suggestion" },
  { value: "other", label: "Other" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

const MIN = 10;
const MAX = 2000;
const MAX_SHOTS = 3;

type Shot = { blob: Blob; url: string };

// shrink a screenshot/photo to at most 1600px and save it as jpeg, so even a
// big phone photo uploads quickly on slow data
async function shrinkImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#ffffff"; // transparent png areas become white, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("could not encode");
  return blob;
}

// "Report an issue" for students: a button (top bar or side menu) that opens a
// short form. the ta gets an email + bell notification, the student gets a
// thank-you email.
export function ReportIssueButton({ variant = "topbar" }: { variant?: "topbar" | "rail" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [message, setMessage] = useState("");
  const [page, setPage] = useState("");
  const [sending, setSending] = useState(false);
  const [sentRef, setSentRef] = useState<string | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [adding, setAdding] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const shotsRef = useRef<Shot[]>([]);
  shotsRef.current = shots;

  // free the preview images when the component goes away
  useEffect(() => () => shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

  function clearShots() {
    shots.forEach((s) => URL.revokeObjectURL(s.url));
    setShots([]);
  }

  async function addFiles(files: Blob[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      if (files.length) toast.error("Please choose an image (a screenshot or photo).");
      return;
    }
    const room = MAX_SHOTS - shots.length;
    if (room <= 0) {
      toast.error(`You can attach up to ${MAX_SHOTS} screenshots.`);
      return;
    }
    if (images.length > room) toast.info(`Only the first ${room} will be attached (max ${MAX_SHOTS}).`);
    setAdding(true);
    const added: Shot[] = [];
    for (const img of images.slice(0, room)) {
      try {
        const blob = await shrinkImage(img);
        added.push({ blob, url: URL.createObjectURL(blob) });
      } catch {
        toast.error("Couldn't read that image. Try a PNG or JPG screenshot.");
      }
    }
    setShots((prev) => [...prev, ...added].slice(0, MAX_SHOTS));
    setAdding(false);
  }

  // "Capture this page": hide the form and let the student pick the area.
  // nothing is captured until they press Capture in the picker.
  const [selecting, setSelecting] = useState(false);

  async function capturePage() {
    if (shots.length >= MAX_SHOTS) {
      toast.error(`You can attach up to ${MAX_SHOTS} screenshots.`);
      return;
    }
    setCapturing(true);
    setOpen(false);
    // let the form finish closing so the student sees the page
    await new Promise((r) => setTimeout(r, 300));
    setSelecting(true);
  }

  function cancelCapture() {
    setSelecting(false);
    setCapturing(false);
    setOpen(true);
  }

  async function confirmCapture(area: CaptureRect) {
    setSelecting(false);
    // one frame so the picker is gone before the picture is taken
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    try {
      const { domToCanvas } = await import("modern-screenshot");
      const sx = window.scrollX;
      const sy = window.scrollY;
      const scale = Math.min(window.devicePixelRatio || 1, 1.5);
      const full = await domToCanvas(document.body, {
        scale,
        backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
        // leave out the picker, pop-up messages and the click sparks
        filter: (node) =>
          !(
            node instanceof Element &&
            (node.hasAttribute("data-capture-ignore") ||
              node.hasAttribute("data-sonner-toaster") ||
              node.classList.contains("rb-spark__canvas"))
          ),
        timeout: 8000,
      });
      // cut out just the box the student chose
      const crop = document.createElement("canvas");
      crop.width = Math.max(1, Math.round(area.w * scale));
      crop.height = Math.max(1, Math.round(area.h * scale));
      const ctx = crop.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      ctx.drawImage(
        full,
        (sx + area.x) * scale,
        (sy + area.y) * scale,
        area.w * scale,
        area.h * scale,
        0,
        0,
        crop.width,
        crop.height
      );
      const blob = await new Promise<Blob | null>((resolve) => crop.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("could not encode");
      setOpen(true);
      await addFiles([blob]);
    } catch (err) {
      console.error("page capture failed:", err);
      setOpen(true);
      toast.error("Couldn't capture this page. Take a screenshot yourself and use Add screenshot instead.");
    } finally {
      setCapturing(false);
    }
  }

  function removeShot(i: number) {
    setShots((prev) => {
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, j) => j !== i);
    });
  }

  // ctrl+v a screenshot straight into the form
  function onPaste(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData.files || []);
    if (files.some((f) => f.type.startsWith("image/"))) {
      e.preventDefault();
      addFiles(files);
    }
  }

  const trimmed = message.trim();
  const canSend =
    category !== null && trimmed.length >= MIN && trimmed.length <= MAX && !sending && !adding && !capturing;

  function openForm() {
    // remember the page they were on when they opened it
    setPage(pathname);
    setSentRef(null);
    setOpen(true);
  }

  function onOpenChange(next: boolean) {
    if (sending || capturing) return;
    setOpen(next);
    if (!next && sentRef) {
      // start fresh next time after a successful report
      setCategory(null);
      setMessage("");
      setSentRef(null);
      clearShots();
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend || !category) return;
    setSending(true);
    try {
      const form = new FormData();
      form.append("category", category);
      form.append("message", trimmed);
      form.append("pageUrl", page);
      shots.forEach((shot, i) => form.append("screenshots", shot.blob, `screenshot-${i + 1}.jpg`));
      const res = (await fetchJson("/api/issues", { method: "POST", body: form })) as {
        success: boolean;
        reference: string;
      };
      setSentRef(res.reference);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send your report. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const trigger =
    variant === "topbar" ? (
      <button
        type="button"
        onClick={openForm}
        className="tams-report-btn"
        aria-label="Report an issue"
        data-tip="Found a problem with TAMS? Tell us"
        data-tip-pos="bottom-end"
      >
        <Bug size={16} aria-hidden="true" />
        <span className="tams-report-btn__text">Report an issue</span>
      </button>
    ) : (
      <button type="button" onClick={openForm} className="tams-iconbtn tams-rail-report">
        <Bug size={16} aria-hidden="true" /> Report an issue
      </button>
    );

  return (
    <>
      {trigger}
      {selecting && <CaptureOverlay onConfirm={confirmCapture} onCancel={cancelCapture} />}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg" style={{ maxHeight: "92dvh", overflowY: "auto" }}>
          {sentRef ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" aria-hidden="true" />
              <DialogTitle>Thanks for reporting!</DialogTitle>
              <DialogDescription className="max-w-sm">
                Your report was sent and will be reviewed. We&apos;ve emailed you a confirmation.
                Reference <span className="font-mono font-semibold text-foreground">#{sentRef}</span>.
              </DialogDescription>
              <Button className="mt-2" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={send} onPaste={onPaste} className="space-y-5">
              <DialogHeader>
                <DialogTitle>Report an issue</DialogTitle>
                <DialogDescription>
                  Tell us what went wrong with the website. Your report goes straight to the TA.
                </DialogDescription>
              </DialogHeader>

              <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                Question about your marks? Use{" "}
                <Link
                  href="/student/queries"
                  onClick={() => setOpen(false)}
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  My Queries
                </Link>{" "}
                instead, so it reaches your TA as a query.
              </p>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">What kind of issue?</legend>
                <div className="flex flex-wrap gap-2" role="radiogroup">
                  {CATEGORIES.map((c) => {
                    const selected = category === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setCategory(c.value)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background hover:bg-muted"
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="issue-message">What happened?</Label>
                <textarea
                  id="issue-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={MAX}
                  rows={5}
                  required
                  placeholder="e.g. My course page stays blank when I open it on my phone."
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                  <span>
                    {trimmed.length > 0 && trimmed.length < MIN
                      ? `A little more detail please (at least ${MIN} characters).`
                      : page
                        ? `We'll include the page you were on: ${page}`
                        : ""}
                  </span>
                  <span className="shrink-0">
                    {message.length} / {MAX}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">
                    Screenshots <span className="font-normal text-muted-foreground">(optional)</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {shots.length} / {MAX_SHOTS}
                  </span>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => {
                    addFiles(Array.from(e.target.files || []));
                    e.target.value = "";
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  {shots.map((shot, i) => (
                    <div key={shot.url} className="relative h-16 w-16 overflow-hidden rounded-md border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={shot.url} alt={`Screenshot ${i + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeShot(i)}
                        aria-label={`Remove screenshot ${i + 1}`}
                        className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 text-foreground shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {shots.length < MAX_SHOTS && (
                    <button
                      type="button"
                      onClick={capturePage}
                      disabled={adding || capturing}
                      className="flex h-16 items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 text-sm font-medium text-foreground transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait"
                    >
                      {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      {capturing ? "Capturing…" : "Capture this page"}
                    </button>
                  )}
                  {shots.length < MAX_SHOTS && (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={adding || capturing}
                      className="flex h-16 items-center gap-2 rounded-md border border-dashed px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait"
                    >
                      {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      {adding ? "Adding…" : "Add screenshot"}
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  &ldquo;Capture this page&rdquo; lets you pick part of the screen behind this form, no
                  need to take a screenshot first. You can also add your own, or paste one with Ctrl+V
                  on a computer.
                </p>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSend}>
                  {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send report
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
