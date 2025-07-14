const CACHE_NAME = "parking-pwa-client-v1";
const urlsToCache = [
  "/",
  "/manifest.json",
  "/_next/static/css/*.css", // Cachear CSS estático (ajusta según tus rutas)
  "/icons/*.svg", // Añade rutas de íconos si las tienes
];

// Install event
self.addEventListener("install", (event) => {
  console.log("🔧 Service Worker instalando...")
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("📦 Cache abierto")
      return cache.addAll(urlsToCache).catch((error) => {
        console.error("❌ Error agregando al cache:", error)
        return Promise.resolve()
      })
    }),
  )
  self.skipWaiting()
})

// Activate event
self.addEventListener("activate", (event) => {
  console.log("✅ Service Worker activando...")
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("🗑️ Eliminando cache antiguo:", cacheName)
            return caches.delete(cacheName)
          }
        }),
      )
    }),
  )
  self.clients.claim()
})

// Fetch event
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  // Excluir rutas de _next y _next/data
  if (event.request.url.includes("_next/static") || event.request.url.includes("_next/data")) {
    return;
  }

  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(event.request).catch((error) => {
        console.log("🌐 Fetch falló para:", event.request.url);
        if (event.request.destination === "document") {
          return new Response(
            `
            <!DOCTYPE html>
            <html>
            <head>
              <title>Parking PWA - Offline</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8fafc; }
                .container { max-width: 400px; margin: 0 auto; }
                .icon { font-size: 64px; margin-bottom: 20px; }
                h1 { color: #3b82f6; margin-bottom: 10px; }
                p { color: #64748b; margin-bottom: 30px; }
                button { background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; }
                button:hover { background: #2563eb; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="icon">🚗</div>
                <h1>Parking PWA</h1>
                <p>No hay conexión a internet. Algunas funciones pueden no estar disponibles.</p>
                <button onclick="window.location.reload()">Reintentar</button>
              </div>
            </body>
            </html>
          `,
            {
              status: 200,
              statusText: "OK",
              headers: { "Content-Type": "text/html" },
            },
          );
        }
        return new Response("", { status: 404, statusText: "Not Found" });
      });
    }),
  );
});

// Push event for notifications
self.addEventListener("push", (event) => {
  console.log("🔔 Push recibido:", event)

  let notificationData = {
    title: "Parking PWA",
    body: "Nueva notificación",
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%233b82f6'/%3E%3Ctext x='50' y='55' font-family='Arial' font-size='40' fill='white' text-anchor='middle'%3EP%3C/text%3E%3C/svg%3E",
    badge:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%233b82f6'/%3E%3Ctext x='50' y='55' font-family='Arial' font-size='40' fill='white' text-anchor='middle'%3EP%3C/text%3E%3C/svg%3E",
    tag: "parking-notification",
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
    actions: [
      {
        action: "view",
        title: "Ver",
        icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3C/svg%3E",
      },
    ],
  }

  if (event.data) {
    try {
      const data = event.data.json()
      notificationData = { ...notificationData, ...data }
    } catch (e) {
      console.error("❌ Error parseando push data:", e)
      notificationData.body = event.data.text() || "Nueva notificación"
    }
  }

  event.waitUntil(self.registration.showNotification(notificationData.title, notificationData))
})

// Notification click event
self.addEventListener("notificationclick", (event) => {
  console.log("👆 Notificación clickeada:", event)
  event.notification.close()

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/")
      }
    }),
  )
})
