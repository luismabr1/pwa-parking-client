const CACHE_NAME = "parking-pwa-client-v8" // Incrementar versión cuando hay cambios
const urlsToCache = ["/", "/manifest.json", "/offline.html"]

// Install event
self.addEventListener("install", (event) => {
  console.log("🔧 Service Worker instalando versión:", CACHE_NAME)
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("📦 Cache abierto:", CACHE_NAME)
      return cache.addAll(urlsToCache).catch((error) => {
        console.error("❌ Error agregando al cache:", error)
        return Promise.resolve()
      })
    }),
  )
  // No usar skipWaiting() automáticamente - esperar confirmación del usuario
  console.log("⏳ Service Worker instalado, esperando activación manual")
})

// Activate event
self.addEventListener("activate", (event) => {
  console.log("✅ Service Worker activando versión:", CACHE_NAME)
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
  
  // Notificar a todos los clientes que el SW se ha actualizado
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'SW_UPDATED',
        version: CACHE_NAME
      })
    })
  })
})

// Fetch event con estrategia mejorada
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return
  }

  if (!event.request.url.startsWith(self.location.origin)) {
    return
  }

  // Para archivos estáticos de Next.js (_next/static), usar cache first
  if (event.request.url.includes('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          return response
        }
        return fetch(event.request).then((response) => {
          // Solo cachear si la respuesta es válida
          if (response.status === 200) {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })
          }
          return response
        })
      })
    )
    return
  }

  // Para páginas HTML, usar network first con fallback a cache
  if (event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Si la respuesta es válida, actualizar cache
          if (response.status === 200) {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })
          }
          return response
        })
        .catch((error) => {
          console.log("🌐 Fetch falló para:", event.request.url)
          // Intentar servir desde cache
          return caches.match(event.request).then((response) => {
            if (response) {
              return response
            }
            // Si no hay cache, mostrar página offline
            return new Response(
              `
              <!DOCTYPE html>
              <html lang="es">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Sin Conexión - Parking PWA</title>
                <style>
                  /* Reset y variables CSS */
                  * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                  }

                  /* Variables CSS para temas - Mismas que la app */
                  :root {
                    --background: 0 0% 100%;
                    --foreground: 0 0% 9%;
                    --card: 0 0% 100%;
                    --card-foreground: 0 0% 9%;
                    --primary: 0 0% 9%;
                    --primary-foreground: 0 0% 98%;
                    --secondary: 0 0% 96%;
                    --secondary-foreground: 0 0% 9%;
                    --muted: 0 0% 96%;
                    --muted-foreground: 0 0% 45%;
                    --border: 0 0% 90%;
                    --ring: 0 0% 9%;
                    --radius: 0.5rem;
                    --destructive: 0 84% 60%;
                    --destructive-foreground: 0 0% 98%;
                    --warning: 38 92% 50%;
                    --warning-foreground: 48 96% 89%;
                    --success: 142 76% 36%;
                    --success-foreground: 355 100% 97%;
                  }

                  /* Modo oscuro */
                  @media (prefers-color-scheme: dark) {
                    :root {
                      --background: 0 0% 9%;
                      --foreground: 0 0% 98%;
                      --card: 0 0% 9%;
                      --card-foreground: 0 0% 98%;
                      --primary: 0 0% 98%;
                      --primary-foreground: 0 0% 9%;
                      --secondary: 0 0% 14%;
                      --secondary-foreground: 0 0% 98%;
                      --muted: 0 0% 14%;
                      --muted-foreground: 0 0% 64%;
                      --border: 0 0% 14%;
                      --ring: 0 0% 83%;
                      --warning: 48 96% 89%;
                      --warning-foreground: 38 92% 50%;
                      --success: 142 76% 36%;
                      --success-foreground: 355 100% 97%;
                    }
                  }

                  /* Estilos base */
                  body {
                    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    background-color: hsl(var(--background));
                    color: hsl(var(--foreground));
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    transition: background-color 0.2s, color 0.2s;
                  }

                  /* Cintillo de estado de conexión */
                  .connection-banner {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    z-index: 1000;
                    padding: 0.75rem 1rem;
                    text-align: center;
                    font-size: 0.875rem;
                    font-weight: 500;
                    transition: all 0.3s ease;
                    transform: translateY(-100%);
                  }

                  .connection-banner.show {
                    transform: translateY(0);
                  }

                  .connection-banner.offline {
                    background-color: hsl(var(--destructive));
                    color: hsl(var(--destructive-foreground));
                  }

                  .connection-banner.reconnecting {
                    background-color: hsl(var(--warning));
                    color: hsl(var(--warning-foreground));
                  }

                  .connection-banner.online {
                    background-color: hsl(var(--success));
                    color: hsl(var(--success-foreground));
                  }

                  .banner-content {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    max-width: 1200px;
                    margin: 0 auto;
                  }

                  .banner-icon {
                    width: 1rem;
                    height: 1rem;
                    flex-shrink: 0;
                  }

                  .banner-text {
                    flex: 1;
                    min-width: 0;
                  }

                  .countdown {
                    font-weight: 600;
                    font-variant-numeric: tabular-nums;
                  }

                  /* Spinner para reconectando */
                  .spinner {
                    width: 1rem;
                    height: 1rem;
                    border: 2px solid transparent;
                    border-top: 2px solid currentColor;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                  }

                  @keyframes spin {
                    to { transform: rotate(360deg); }
                  }

                  /* Contenedor principal */
                  .main-container {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 1rem;
                    padding-top: calc(1rem + 3rem); /* Espacio para el banner */
                  }

                  .container {
                    width: 100%;
                    max-width: 28rem;
                    margin: 0 auto;
                  }

                  /* Card - Mismos estilos que la app */
                  .card {
                    background-color: hsl(var(--card));
                    color: hsl(var(--card-foreground));
                    border: 1px solid hsl(var(--border));
                    border-radius: calc(var(--radius) + 2px);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    overflow: hidden;
                    transition: all 0.2s;
                  }

                  @media (prefers-color-scheme: dark) {
                    .card {
                      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
                    }
                  }

                  .card-header {
                    padding: 1.5rem;
                    text-align: center;
                    border-bottom: 1px solid hsl(var(--border));
                  }

                  .card-content {
                    padding: 1.5rem;
                    text-align: center;
                    space-y: 1rem;
                  }

                  /* Logo */
                  .logo {
                    width: 4rem;
                    height: 4rem;
                    background-color: hsl(var(--primary));
                    color: hsl(var(--primary-foreground));
                    border-radius: calc(var(--radius) + 2px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    font-weight: bold;
                    margin: 0 auto 1rem auto;
                    box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
                    transition: all 0.2s;
                  }

                  /* Títulos */
                  .title {
                    font-size: 1.875rem;
                    font-weight: bold;
                    margin-bottom: 0.5rem;
                    color: hsl(var(--foreground));
                  }

                  .subtitle {
                    color: hsl(var(--muted-foreground));
                    margin-bottom: 1.5rem;
                    font-size: 0.875rem;
                  }

                  /* Badge de estado */
                  .status-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 0.25rem 0.75rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    background-color: hsl(var(--destructive));
                    color: hsl(var(--destructive-foreground));
                    margin-bottom: 1rem;
                  }

                  .status-dot {
                    width: 0.5rem;
                    height: 0.5rem;
                    border-radius: 50%;
                    background-color: currentColor;
                    margin-right: 0.5rem;
                    animation: pulse 2s infinite;
                  }

                  @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                  }

                  /* Icono offline */
                  .offline-icon {
                    width: 4rem;
                    height: 4rem;
                    margin: 0 auto 1.5rem auto;
                    opacity: 0.6;
                    color: hsl(var(--muted-foreground));
                  }

                  .offline-icon svg {
                    width: 100%;
                    height: 100%;
                    stroke: currentColor;
                    fill: none;
                    stroke-width: 1.5;
                  }

                  /* Mensaje */
                  .message {
                    color: hsl(var(--muted-foreground));
                    margin-bottom: 2rem;
                    font-size: 1rem;
                  }

                  /* Botón */
                  .button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    white-space: nowrap;
                    border-radius: var(--radius);
                    font-size: 0.875rem;
                    font-weight: 500;
                    transition: all 0.2s;
                    background-color: hsl(var(--primary));
                    color: hsl(var(--primary-foreground));
                    border: none;
                    padding: 0.75rem 1.5rem;
                    cursor: pointer;
                    min-width: 8rem;
                    text-decoration: none;
                    font-family: inherit;
                  }

                  .button:hover {
                    background-color: hsl(var(--primary) / 0.9);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px -2px rgba(0, 0, 0, 0.1);
                  }

                  .button:active {
                    transform: translateY(0);
                  }

                  .button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                  }

                  .button-icon {
                    width: 1rem;
                    height: 1rem;
                    margin-right: 0.5rem;
                  }

                  /* Lista de funciones */
                  .features-list {
                    background-color: hsl(var(--muted));
                    border-radius: var(--radius);
                    padding: 1rem;
                    margin-top: 1.5rem;
                    text-align: left;
                    border: 1px solid hsl(var(--border));
                  }

                  .features-title {
                    font-weight: 600;
                    margin-bottom: 0.5rem;
                    color: hsl(var(--foreground));
                    font-size: 0.875rem;
                  }

                  .features-list ul {
                    list-style: none;
                    font-size: 0.875rem;
                    color: hsl(var(--muted-foreground));
                    margin: 0;
                    padding: 0;
                  }

                  .features-list li {
                    margin-bottom: 0.25rem;
                    display: flex;
                    align-items: center;
                  }

                  .features-list li::before {
                    content: "•";
                    color: hsl(var(--primary));
                    font-weight: bold;
                    margin-right: 0.5rem;
                    flex-shrink: 0;
                  }

                  /* Responsive */
                  @media (max-width: 640px) {
                    .main-container {
                      padding: 0.5rem;
                      padding-top: calc(0.5rem + 3rem);
                    }
                    
                    .card-header,
                    .card-content {
                      padding: 1rem;
                    }
                    
                    .title {
                      font-size: 1.5rem;
                    }
                    
                    .logo {
                      width: 3rem;
                      height: 3rem;
                      font-size: 1.25rem;
                    }

                    .banner-content {
                      padding: 0 0.5rem;
                    }

                    .banner-text {
                      font-size: 0.8rem;
                    }
                  }

                  /* Animaciones */
                  .card {
                    animation: slideIn 0.3s ease-out;
                  }

                  @keyframes slideIn {
                    from {
                      opacity: 0;
                      transform: translateY(1rem);
                    }
                    to {
                      opacity: 1;
                      transform: translateY(0);
                    }
                  }

                  /* PWA específico */
                  @media (display-mode: standalone) {
                    body {
                      padding-top: env(safe-area-inset-top);
                    }
                    
                    .main-container {
                      padding-top: calc(1rem + 3rem + env(safe-area-inset-top));
                    }
                  }

                  /* Mejoras para accesibilidad */
                  @media (prefers-reduced-motion: reduce) {
                    * {
                      animation-duration: 0.01ms !important;
                      animation-iteration-count: 1 !important;
                      transition-duration: 0.01ms !important;
                    }
                  }

                  .button:focus-visible {
                    outline: 2px solid hsl(var(--ring));
                    outline-offset: 2px;
                  }
                </style>
              </head>
              <body>
                <!-- Cintillo de estado de conexión -->
                <div id="connectionBanner" class="connection-banner offline">
                  <div class="banner-content">
                    <div id="bannerIcon" class="banner-icon">
                      <svg viewBox="0 0 24 24" stroke="currentColor" fill="none">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 5.636l-12.728 12.728"/>
                        <circle cx="12" cy="12" r="10"/>
                      </svg>
                    </div>
                    <div id="bannerText" class="banner-text">
                      Sin conexión a internet
                    </div>
                  </div>
                </div>

                <div class="main-container">
                  <div class="container">
                    <div class="card">
                      <div class="card-header">
                        <div class="logo">P</div>
                        <h1 class="title">Sistema de Estacionamiento</h1>
                        <p class="subtitle">Parking PWA</p>
                      </div>
                      
                      <div class="card-content">
                        <!-- Badge de estado -->
                        <div class="status-badge">
                          <div class="status-dot"></div>
                          Sin Conexión
                        </div>

                        <!-- Icono de offline -->
                        <div class="offline-icon">
                          <svg viewBox="0 0 24 24" stroke="currentColor" fill="none">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 5.636l-12.728 12.728m0 0L12 12m-6.364 6.364L12 12m6.364-6.364L12 12"/>
                            <circle cx="12" cy="12" r="10"/>
                          </svg>
                        </div>

                        <!-- Mensaje principal -->
                        <p class="message">
                          No hay conexión a internet en este momento. Algunas funciones pueden no estar disponibles.
                        </p>

                        <!-- Botón de reintentar -->
                        <button id="retryButton" class="button" onclick="manualRetry()">
                          <svg class="button-icon" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                          </svg>
                          Reintentar
                        </button>

                        <!-- Información de funciones disponibles offline -->
                        <div class="features-list">
                          <div class="features-title">Funciones disponibles sin conexión:</div>
                          <ul>
                            <li>Visualizar información guardada</li>
                            <li>Acceder a tickets recientes</li>
                            <li>Consultar historial local</li>
                            <li>Configuración básica</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <script>
                  // Variables globales para el manejo de conexión
                  let retryCount = 0;
                  let retryInterval = null;
                  let countdownInterval = null;
                  const maxRetries = 20;
                  const retryDelayMs = 30000; // 30 segundos
                  
                  // Referencias a elementos DOM
                  const banner = document.getElementById('connectionBanner');
                  const bannerIcon = document.getElementById('bannerIcon');
                  const bannerText = document.getElementById('bannerText');
                  const retryButton = document.getElementById('retryButton');

                  // Iconos SVG
                  const icons = {
                    offline: '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 5.636l-12.728 12.728"/><circle cx="12" cy="12" r="10"/></svg>',
                    reconnecting: '<div class="spinner"></div>',
                    online: '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
                  };

                  // Función para actualizar el banner
                  function updateBanner(status, message, showCountdown = false, seconds = 0) {
                    banner.className = \`connection-banner show \${status}\`;
                    bannerIcon.innerHTML = icons[status];
                    
                    if (showCountdown && seconds > 0) {
                      bannerText.innerHTML = \`\${message} <span class="countdown">(\${seconds}s)</span>\`;
                    } else {
                      bannerText.textContent = message;
                    }
                  }

                  // Función para mostrar countdown
                  function startCountdown(seconds, baseMessage) {
                    let remainingSeconds = seconds;
                    
                    countdownInterval = setInterval(() => {
                      remainingSeconds--;
                      updateBanner('reconnecting', baseMessage, true, remainingSeconds);
                      
                      if (remainingSeconds <= 0) {
                        clearInterval(countdownInterval);
                      }
                    }, 1000);
                  }

                  // Función para verificar conexión
                  function checkConnection() {
                    console.log(\`🔄 Intento de reconexión \${retryCount + 1}/\${maxRetries}\`);
                    
                    if (navigator.onLine) {
                      // Intentar hacer una petición real para verificar conectividad
                      fetch(window.location.href, { 
                        method: 'HEAD',
                        cache: 'no-cache',
                        mode: 'no-cors'
                      })
                      .then(() => {
                        console.log('🌐 Conexión restaurada, recargando...');
                        updateBanner('online', '¡Conexión restaurada! Recargando...');
                        setTimeout(() => {
                          window.location.reload();
                        }, 1500);
                      })
                      .catch(() => {
                        scheduleNextRetry();
                      });
                    } else {
                      scheduleNextRetry();
                    }
                  }

                  // Función para programar el siguiente intento
                  function scheduleNextRetry() {
                    retryCount++;
                    
                    if (retryCount >= maxRetries) {
                      updateBanner('offline', 'Sin conexión - Intentos agotados. Usa el botón para reintentar.');
                      retryButton.disabled = false;
                      return;
                    }

                    const nextRetryIn = retryDelayMs / 1000;
                    updateBanner('reconnecting', \`Reintentando conexión en\`, true, nextRetryIn);
                    
                    startCountdown(nextRetryIn, 'Reintentando conexión en');
                    
                    retryInterval = setTimeout(() => {
                      checkConnection();
                    }, retryDelayMs);
                  }

                  // Función para reintentar manualmente
                  function manualRetry() {
                    console.log('🔄 Reintento manual iniciado');
                    retryButton.disabled = true;
                    
                    // Limpiar intervalos existentes
                    if (retryInterval) clearTimeout(retryInterval);
                    if (countdownInterval) clearInterval(countdownInterval);
                    
                    // Resetear contador
                    retryCount = 0;
                    
                    updateBanner('reconnecting', 'Verificando conexión...');
                    
                    setTimeout(() => {
                      checkConnection();
                    }, 1000);
                  }

                  // Event listeners para cambios de conexión
                  window.addEventListener('online', function() {
                    console.log('🌐 Evento online detectado');
                    updateBanner('online', '¡Conexión detectada! Verificando...');
                    
                    setTimeout(() => {
                      window.location.reload();
                    }, 1000);
                  });

                  window.addEventListener('offline', function() {
                    console.log('📵 Evento offline detectado');
                    updateBanner('offline', 'Conexión perdida');
                  });

                  // Inicialización
                  document.addEventListener('DOMContentLoaded', function() {
                    console.log('📱 Parking PWA - Modo Offline Iniciado');
                    console.log('🔄 Verificación automática cada 30 segundos');
                    console.log('📶 Estado inicial:', navigator.onLine ? 'Online' : 'Offline');
                    
                    // Mostrar banner inicial
                    updateBanner('offline', 'Sin conexión a internet');
                    
                    // Iniciar verificación automática después de 5 segundos
                    setTimeout(() => {
                      scheduleNextRetry();
                    }, 5000);
                    
                    // Detectar tema del sistema
                    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                      console.log('🌙 Modo oscuro detectado');
                    } else {
                      console.log('☀️ Modo claro detectado');
                    }
                  });

                  // Limpiar intervalos al cerrar la página
                  window.addEventListener('beforeunload', function() {
                    if (retryInterval) clearTimeout(retryInterval);
                    if (countdownInterval) clearInterval(countdownInterval);
                  });
                </script>
              </body>
              </html>
            `,
              {
                status: 200,
                statusText: "OK",
                headers: { "Content-Type": "text/html; charset=utf-8" },
              },
            )
          })
        })
    )
    return
  }

  // Para otros recursos, usar network first con fallback a cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })
        }
        return response
      })
      .catch((error) => {
        return caches.match(event.request).then((response) => {
          if (response) {
            return response
          }
          return new Response("", { status: 404, statusText: "Not Found" })
        })
      })
  )
})

// Mensaje para comunicación con el cliente
self.addEventListener("message", (event) => {
  console.log("📨 Mensaje recibido en SW:", event.data)
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log("⏭️ Activando nueva versión del SW")
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log("🗑️ Limpiando todos los caches")
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log("🗑️ Eliminando cache:", cacheName)
            return caches.delete(cacheName)
          })
        )
      }).then(() => {
        console.log("✅ Todos los caches eliminados")
        // Notificar al cliente que el cache se limpió
        event.ports[0].postMessage({ success: true })
      })
    )
  }
})

// Push event for notifications
self.addEventListener("push", (event) => {
  console.log("🔔 Push recibido:", event)

  let notificationData = {
    title: "Parking PWA",
    body: "Nueva notificación",
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23000000' rx='20'/%3E%3Ctext x='50' y='55' font-family='Arial' font-size='40' fill='white' text-anchor='middle' dominant-baseline='middle'%3EP%3C/text%3E%3C/svg%3E",
    badge:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23000000' rx='20'/%3E%3Ctext x='50' y='55' font-family='Arial' font-size='40' fill='white' text-anchor='middle' dominant-baseline='middle'%3EP%3C/text%3E%3C/svg%3E",
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
