// Browser side of push notifications: register the service worker and
// subscribe / unsubscribe this device.

export type PushSupport =
  | "ok"
  | "no-key" // the site doesn't have notifications set up
  | "ios-install" // iPhone/iPad: only works after "Add to Home Screen"
  | "unsupported";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function isIos() {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, the touch check catches it
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function isInstalled() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (!PUBLIC_KEY) return "no-key";
  const hasApi = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (isIos() && !isInstalled()) return "ios-install";
  return hasApi ? "ok" : "unsupported";
}

function keyToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "ok") return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) || null;
}

// which account turned notifications on in this browser. Logging out pauses
// them; logging back in as the same account turns them back on by itself.
const OWNER_KEY = "tams-push-owner";
function getOwner() {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}
function setOwner(id: string | null) {
  try {
    if (id) localStorage.setItem(OWNER_KEY, id);
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    // private mode etc.
  }
}

async function save(sub: PushSubscription, mode: "enable" | "sync") {
  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...sub.toJSON(), mode, owner: getOwner() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Couldn't turn on notifications.");
  return data as { on: boolean; userId?: string };
}

/** asks for permission (if needed) and turns notifications on for this device */
export async function turnOnPush(): Promise<"on" | "denied"> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = await registration();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(PUBLIC_KEY) });
  }
  const result = await save(sub, "enable");
  setOwner(result.userId || null);
  syncing = Promise.resolve(true);
  return "on";
}

/** the user switched them off: forget this device completely */
export async function turnOffPush() {
  setOwner(null);
  syncing = Promise.resolve(false);
  const sub = await currentSubscription();
  if (!sub) return;
  await fetch("/api/push", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/** logging out: stop sending to this device, but remember who turned them on */
export async function pausePushForLogout() {
  syncing = null;
  const sub = await currentSubscription();
  if (!sub) return;
  await fetch("/api/push", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
}

let syncing: Promise<boolean> | null = null;

/**
 * On page load: if notifications were turned on in this browser by the account
 * that is signed in now, make sure the server has the device (turns them back
 * on after a log out / log in). Returns whether they're on for this account.
 */
export function syncPush(): Promise<boolean> {
  syncing ??= (async () => {
    const sub = await currentSubscription();
    if (!sub || Notification.permission !== "granted") return false;
    const result = await save(sub, "sync").catch(() => ({ on: false, userId: undefined }));
    if (result.on && result.userId) setOwner(result.userId);
    return !!result.on;
  })();
  return syncing;
}
