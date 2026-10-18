self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/assets/") || url.pathname.endsWith(".js")) {
    event.respondWith(fetch(event.request, { cache: "reload" }));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = "/?notice=1";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        try {
          client.postMessage({ type: "noa-fill-open" });
        } catch {
          /* ignore */
        }
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    }),
  );
});
