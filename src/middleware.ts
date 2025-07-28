import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  // Este middleware es intencionalmente minimalista para evitar interferir con los activos estáticos.
  // Toda la lógica de seguridad específica (rate limiting, validación de entrada) se maneja
  // dentro de los Route Handlers de API utilizando el wrapper `withSecurity`.

  // Permitir que la solicitud continúe al siguiente middleware o Route Handler
  return NextResponse.next()
}

// Configura el matcher para excluir archivos estáticos y rutas internas de Next.js,
// y solo aplicar el middleware a las rutas de API.
export const config = {
  matcher: [
    "/api/:path*", // Aplica a todas las rutas de API
    // Excluye archivos estáticos y rutas internas de Next.js
    // Esto asegura que archivos como manifest.json, favicon.ico, y los assets de _next/static
    // no sean procesados por este middleware y se sirvan directamente.
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|logo.svg|screenshot-desktop.svg|screenshot-mobile.svg|.*\\.(?:png|jpg|jpeg|gif|webp|svg|css|js)$).*)",
  ],
}
