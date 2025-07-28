import { type NextRequest, NextResponse } from "next/server"
import { rateLimiter, RATE_LIMIT_CONFIGS } from "./rate-limiter"
import {
  getClientIP,
  detectSuspiciousActivity,
  sanitizeInput,
  getSecurityHeaders,
  generateRequestFingerprint,
} from "./security-utils"
import { logSecurityEvent } from "./security-logger"

export interface SecurityOptions {
  rateLimitType: keyof typeof RATE_LIMIT_CONFIGS
  requireValidOrigin?: boolean
  sanitizeBody?: boolean
  logRequests?: boolean
}

export async function withSecurity(
  request: NextRequest,
  handler: (request: NextRequest, sanitizedData?: any) => Promise<NextResponse>,
  options: SecurityOptions,
) {
  const startTime = Date.now()
  const clientIP = getClientIP(request)
  const endpoint = request.nextUrl.pathname
  const method = request.method
  const userAgent = request.headers.get("user-agent") || ""
  const origin = request.headers.get("origin")
  const referer = request.headers.get("referer")
  const fingerprint = generateRequestFingerprint(request)
  const securityHeaders = getSecurityHeaders()

  try {
    // 1. Rate limiting
    const rateLimitConfig = RATE_LIMIT_CONFIGS[options.rateLimitType]
    const rateLimitResult = rateLimiter.check(clientIP, endpoint, rateLimitConfig)

    if (!rateLimitResult.allowed) {
      // Log del rate limit excedido
      await logSecurityEvent.rateLimitExceeded(
        clientIP,
        endpoint,
        method,
        {
          maxRequests: rateLimitConfig.maxRequests,
          currentCount: rateLimitConfig.maxRequests + 1, // Aproximado
          windowMs: rateLimitConfig.windowMs,
          blocked: rateLimitResult.blocked || false,
          blockDuration: rateLimitConfig.blockDurationMs,
        },
        userAgent,
      )

      const response = NextResponse.json(
        {
          message: rateLimitResult.blocked
            ? "Tu IP ha sido temporalmente bloqueada por exceso de solicitudes. Intenta más tarde."
            : "Demasiadas solicitudes. Intenta más tarde.",
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        },
        { status: 429 },
      )

      // Agregar headers de rate limiting
      response.headers.set("X-RateLimit-Limit", rateLimitConfig.maxRequests.toString())
      response.headers.set("X-RateLimit-Remaining", rateLimitResult.remaining.toString())
      response.headers.set("X-RateLimit-Reset", rateLimitResult.resetTime.toString())
      response.headers.set("Retry-After", Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString())

      // Aplicar headers de seguridad
      Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value)
      })

      return response
    }

    // 2. Validar origen si es requerido
    if (options.requireValidOrigin) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

      if (origin && !origin.includes("localhost") && !origin.includes(baseUrl)) {
        // Log de origen inválido
        await logSecurityEvent.invalidOrigin(clientIP, endpoint, method, origin, userAgent)

        return NextResponse.json({ message: "Origen no autorizado" }, { status: 403 })
      }
    }

    // 3. Parsear y sanitizar datos del body
    let sanitizedData: any = null
    if (method !== "GET" && options.sanitizeBody) {
      try {
        const rawData = await request.json()
        sanitizedData = sanitizeInput(rawData)

        // Detectar actividad sospechosa
        const suspiciousCheck = detectSuspiciousActivity(request, sanitizedData)
        if (suspiciousCheck.suspicious) {
          // Log de actividad sospechosa
          await logSecurityEvent.suspiciousActivity(
            clientIP,
            endpoint,
            method,
            suspiciousCheck.reasons,
            sanitizedData,
            userAgent,
          )

          // Para actividad muy sospechosa, bloquear temporalmente
          if (
            suspiciousCheck.reasons.some(
              (r) => r.includes("malicioso") || r.includes("injection") || r.includes("XSS") || r.includes("SQL"),
            )
          ) {
            // Log de request malicioso
            await logSecurityEvent.maliciousRequest(
              clientIP,
              endpoint,
              method,
              suspiciousCheck.reasons.join(", "),
              sanitizedData,
              userAgent,
            )

            // Bloquear IP temporalmente
            rateLimiter.check(clientIP, endpoint, {
              maxRequests: 1,
              windowMs: 60 * 60 * 1000, // 1 hora
              blockDurationMs: 60 * 60 * 1000, // 1 hora
            })

            return NextResponse.json({ message: "Solicitud bloqueada por seguridad" }, { status: 403 })
          }
        }
      } catch (error) {
        // Log de error del sistema
        await logSecurityEvent.systemError(
          clientIP,
          endpoint,
          method,
          `Error parsing request body: ${error}`,
          Date.now() - startTime,
        )

        return NextResponse.json({ message: "Datos de solicitud inválidos" }, { status: 400 })
      }
    }

    // 4. Log de solicitudes si está habilitado (solo para debugging, no se guarda en DB)
    if (options.logRequests) {
      console.log(
        `📝 [SECURITY] ${method} ${endpoint} from ${clientIP} - Rate limit: ${rateLimitResult.remaining}/${rateLimitConfig.maxRequests} - Fingerprint: ${fingerprint}`,
      )
    }

    // 5. Ejecutar el handler original
    const response = await handler(request, sanitizedData)

    // 6. Agregar headers de seguridad y rate limiting a la respuesta
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    response.headers.set("X-RateLimit-Limit", rateLimitConfig.maxRequests.toString())
    response.headers.set("X-RateLimit-Remaining", rateLimitResult.remaining.toString())
    response.headers.set("X-RateLimit-Reset", rateLimitResult.resetTime.toString())
    response.headers.set("X-Request-ID", fingerprint)

    // 7. Log de respuesta exitosa (solo para debugging)
    const processingTime = Date.now() - startTime
    if (options.logRequests) {
      console.log(`✅ [SECURITY] Response ${response.status} in ${processingTime}ms`)
    }

    return response
  } catch (error) {
    const processingTime = Date.now() - startTime

    // Log de error crítico del sistema
    await logSecurityEvent.systemError(clientIP, endpoint, method, `Critical system error: ${error}`, processingTime)

    const errorResponse = NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })

    // Aplicar headers de seguridad incluso en errores
    Object.entries(securityHeaders).forEach(([key, value]) => {
      errorResponse.headers.set(key, value)
    })

    return errorResponse
  }
}
