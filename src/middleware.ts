import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
// No necesitamos importar withSecurity aquí, ya que se usa en los Route Handlers directamente.

export async function middleware(request: NextRequest) {
  // Si la ruta es para un archivo estático o una página, simplemente dejamos que Next.js la maneje.
  // Esto incluye /manifest.json, /_next/static, /favicon.ico, etc.
  // El matcher de abajo ya se encarga de esto, pero es bueno tenerlo claro.
  if (
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/static") ||
    request.nextUrl.pathname.endsWith(".ico") ||
    request.nextUrl.pathname.endsWith(".png") ||
    request.nextUrl.pathname.endsWith(".jpg") ||
    request.nextUrl.pathname.endsWith(".jpeg") ||
    request.nextUrl.pathname.endsWith(".gif") ||
    request.nextUrl.pathname.endsWith(".svg") ||
    request.nextUrl.pathname.endsWith(".css") ||
    request.nextUrl.pathname.endsWith(".js") ||
    request.nextUrl.pathname.endsWith(".json") // Esto incluye manifest.json
  ) {
    return NextResponse.next()
  }

  // Aquí puedes añadir lógica de middleware global si la necesitas,
  // por ejemplo, para autenticación a nivel de todas las páginas o un rate limit muy general.
  // Por ahora, simplemente permitimos que la solicitud continúe.
  return NextResponse.next()
}

// El matcher define qué rutas *no* deben ser ignoradas por el middleware.
// En este caso, queremos que el middleware se ejecute para todas las rutas,
// pero la lógica interna del middleware es la que decide qué hacer.
// Para el problema del manifest.json, lo importante es que el middleware no lo bloquee.
// La lógica de seguridad detallada (con withSecurity) se aplica *dentro* de los Route Handlers de API.
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (e.g., /manifest.json, /sw.js, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:png|jpg|jpeg|gif|svg|css|js)$).*)",
  ],
}
