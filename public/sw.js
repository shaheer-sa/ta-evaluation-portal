// TAMS service worker: shows push notifications and opens the right page
// when one is tapped. It does not cache pages.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "TAMS", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "TAMS";
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        tag: data.tag || undefined,
        data: { url: data.url || "/" },
      }),
      // tell any open TAMS tab to refresh its bell now
      self.clients
        .matchAll({ type: "window" })
        .then((tabs) => tabs.forEach((t) => t.postMessage({ type: "tams-push" }))),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // reuse an open TAMS tab if there is one
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) {
        return open
          .focus()
          .then((w) => (w || open).navigate(url))
          .catch(() => self.clients.openWindow(url));
      }
      return self.clients.openWindow(url);
    })
  );
});
