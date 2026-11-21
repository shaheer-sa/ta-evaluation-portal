"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { installMode, onInstallChange, promptInstall, startInstallWatch, type InstallMode } from "@/lib/install-client";

function IosSteps() {
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm">
      <li>Open TAMS in Safari.</li>
      <li>
        Tap the <strong>Share</strong> button{" "}
        <Share className="inline h-4 w-4 align-text-bottom" aria-label="(square with an arrow)" />.
      </li>
      <li>
        Scroll down and tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
      </li>
      <li>Open TAMS from your home screen to use it like an app and get notifications.</li>
    </ol>
  );
}

function AlreadyInstalledNote() {
  return (
    <p className="text-xs text-muted-foreground">
      If TAMS is already on your home screen, open it from there instead of adding it again.
    </p>
  );
}

function AndroidSteps() {
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm">
      <li>
        Tap the menu button <strong>⋮</strong> in your browser.
      </li>
      <li>
        Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
      </li>
      <li>
        Tap <strong>Install</strong> to confirm.
      </li>
      <li>Open TAMS from your home screen.</li>
    </ol>
  );
}

/** "Install TAMS app": hidden when it's already installed or can't be */
export function InstallButton({ variant }: { variant: "rail" | "panel" }) {
  const [mode, setMode] = useState<InstallMode>("none");
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    startInstallWatch();
    const update = () => setMode(installMode());
    update();
    return onInstallChange(update);
  }, []);

  if (mode === "none") return null;

  async function install() {
    if (busy) return;
    if (mode !== "prompt") {
      setHelp(true);
      return;
    }
    setBusy(true);
    try {
      await promptInstall();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {variant === "rail" ? (
        <button
          type="button"
          className="tams-iconbtn w-full"
          onClick={install}
          disabled={busy}
          style={{ width: "100%", padding: "0 1rem", display: "flex", gap: "0.5rem" }}
        >
          <Download size={16} /> Install TAMS app
        </button>
      ) : (
        <button
          type="button"
          onClick={install}
          disabled={busy}
          className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Install TAMS app
        </button>
      )}

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Install TAMS app</DialogTitle>
            <DialogDescription>
              {mode === "ios" ? "To install TAMS on your iPhone:" : "To install TAMS on your phone:"}
            </DialogDescription>
          </DialogHeader>
          {mode === "ios" ? <IosSteps /> : <AndroidSteps />}
          <AlreadyInstalledNote />
          <div className="flex justify-end">
            <Button onClick={() => setHelp(false)}>Got it</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
