// "Install TAMS app": remembers the browser's install prompt so a button can
// show it later, and works out which kind of help this device needs.

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallMode =
  | "prompt" // the browser can install it with one tap (Chrome, Edge, Samsung)
  | "ios" // iPhone/iPad: Share → Add to Home Screen
  | "android-menu" // Android browser without a prompt: install from its menu
  | "none"; // already installed, or this browser can't install it

let deferred: InstallPromptEvent | null = null;
let installed = false;
let prompting = false;

// remembered in this browser once TAMS is installed or opened as an app, so the
// "install from the menu" help isn't offered again in a normal tab
const FLAG = "tams-app-installed";
function remember(on: boolean) {
  try {
    if (on) localStorage.setItem(FLAG, "1");
    else localStorage.removeItem(FLAG);
  } catch {
    // ignore
  }
}
function remembered() {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

// started from the root layout, so the prompt isn't missed on the login page
let started = false;
export function startInstallWatch() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button instead of the browser's banner
    // the browser only offers this when TAMS is NOT installed (e.g. it was removed)
    deferred = e as InstallPromptEvent;
    installed = false;
    remember(false);
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    remember(true);
    notify();
  });
  if (isStandalone()) remember(true);

  // Chrome can tell us if TAMS is already installed on this device
  const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
  nav
    .getInstalledRelatedApps?.()
    .then((apps) => {
      if (apps.length > 0 && !deferred) {
        installed = true;
        remember(true);
        notify();
      }
    })
    .catch(() => {});
}

export function onInstallChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

export function installMode(): InstallMode {
  if (typeof window === "undefined" || isStandalone()) return "none"; // running as the app
  if (deferred) return "prompt";
  if (installed) return "none";
  if (isIos()) return "ios"; // Safari can't tell if it's on the home screen already
  if (/Android/i.test(navigator.userAgent) && !remembered()) return "android-menu";
  return "none";
}

/** shows the browser's install popup; true if the user installed it */
export async function promptInstall() {
  if (!deferred || prompting) return false; // double tap: only one popup
  const event = deferred;
  prompting = true;
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    deferred = null; // a prompt can only be used once
    if (outcome === "accepted") {
      installed = true;
      remember(true);
    }
    return outcome === "accepted";
  } catch {
    deferred = null;
    return false;
  } finally {
    prompting = false;
    notify();
  }
}
