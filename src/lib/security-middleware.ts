import { type NextRequest, NextResponse } from "next/server"
import { logSecurityEvent } from "./security-logger"

// Rate limiting storage
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

// Suspicious patterns
const SUSPICIOUS_PATTERNS = [
  /(<script|javascript:|data:text\/html)/i,
  /(union\s+select|drop\s+table|delete\s+from)/i,
  /(\.\.\/)|(\.\.\\)/,
  /(eval\(|setTimeout\(|setInterval\()/i,
  /(document\.|window\.|location\.)/i,
]

// Verificar si estamos en desarrollo
function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development" || process.env.NODE_ENV !== "production"
}

// Get client IP
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const realIP = request.headers.get("x-real-ip")
  const remoteAddr = request.headers.get("remote-addr")

  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  if (realIP) {
    return realIP
  }
  if (remoteAddr) {
    return remoteAddr
  }

  // Fallback para desarrollo local
  return request.ip || "127.0.0.1"
}

// Generate request fingerprint
function generateFingerprint(request: NextRequest): string {
  const userAgent = request.headers.get("user-agent") || ""
  const acceptLanguage = request.headers.get("accept-language") || ""
  const acceptEncoding = request.headers.get("accept-encoding") || ""

  const combined = userAgent + acceptLanguage + acceptEncoding
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).substring(0, 8)
}

// Rate limiting
function checkRateLimit(clientIP: string, endpoint: string, type: "NORMAL" | "CRITICAL"): boolean {
  const key = `${clientIP}:${endpoint}`
  const now = Date.now()
  const windowMs = 60000 // 1 minute
  const maxRequests = type === "CRITICAL" ? 10 : 100

  const current = rateLimitMap.get(key)

  if (!current || now > current.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (current.count >= maxRequests) {
    return false
  }

  current.count++
  return true
}

// Sanitize request body with special handling for images
function sanitizeBody(body: any): any {
  if (!body || typeof body !== "object") {
    return body
  }

  const sanitized: any = {}

  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string") {
      // Special handling for base64 images (both comprobante and tickets)
      if ((key === "imagenComprobante" || key === "imagenTickets") && value.startsWith("data:image/")) {
        // Don't truncate or sanitize base64 images, just validate format
        if (value.length > 100 && value.includes(",")) {
          sanitized[key] = value // Keep full image
        } else {
          console.warn(`⚠️ [SECURITY] Imagen base64 inválida o muy pequeña: ${value.length} chars para ${key}`)
          sanitized[key] = null
        }
      } else {
        // Regular string sanitization with increased limit for payment data
        const maxLength = key.includes("referencia") || key.includes("banco") || key.includes("telefono") ? 50 : 1000
        sanitized[key] = value.length > maxLength ? value.substring(0, maxLength) : value
      }
    } else if (typeof value === "number") {
      sanitized[key] = value
    } else if (typeof value === "boolean") {
      sanitized[key] = value
    } else if (value === null || value === undefined) {
      sanitized[key] = value
    } else {
      // For objects/arrays, recursively sanitize
      sanitized[key] = sanitizeBody(value)
    }
  }

  return sanitized
}

// Check for suspicious content with image awareness
function checkSuspiciousContent(data: any): { suspicious: boolean; reasons: string[] } {
  const reasons: string[] = []

  function checkValue(value: any, path = ""): void {
    if (typeof value === "string") {
      // Skip suspicious pattern checks for base64 images
      if (path === "imagenComprobante" && value.startsWith("data:image/")) {
        return // Base64 images can contain patterns that look suspicious
      }

      for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(value)) {
          reasons.push(`Suspicious pattern in ${path || "data"}: ${pattern.source}`)
        }
      }

      // Check for excessively long strings (except images)
      if (value.length > 10000 && !path.includes("imagen")) {
        reasons.push(`Excessively long string in ${path || "data"}: ${value.length} characters`)
      }
    } else if (typeof value === "object" && value !== null) {
      for (const [key, val] of Object.entries(value)) {
        checkValue(val, path ? `${path}.${key}` : key)
      }
    }
  }

  checkValue(data)
  return { suspicious: reasons.length > 0, reasons }
}

// Security middleware options
interface SecurityOptions {
  rateLimitType?: "NORMAL" | "CRITICAL"
  requireValidOrigin?: boolean
  sanitizeBody?: boolean
  logRequests?: boolean
  maxBodySize?: number // New option for body size limit
}

// Main security middleware
export async function withSecurity(
  request: NextRequest,
  handler: (request: NextRequest, sanitizedData?: any) => Promise<NextResponse>,
  options: SecurityOptions = {},
) {
  const startTime = Date.now()
  const clientIP = getClientIP(request)
  const endpoint = new URL(request.url).pathname
  const method = request.method
  const userAgent = request.headers.get("user-agent") || ""
  const fingerprint = generateFingerprint(request)

  // Detectar si estamos en desarrollo local
  const isDevMode = isDevelopment()
  const isLocalIP = clientIP === "::1" || clientIP === "127.0.0.1" || clientIP === "localhost"

  console.log(`🔍 [SECURITY-DEBUG] NODE_ENV: ${process.env.NODE_ENV}`)
  console.log(`🔍 [SECURITY-DEBUG] isDevMode: ${isDevMode}`)
  console.log(`🔍 [SECURITY-DEBUG] clientIP: ${clientIP}`)
  console.log(`🔍 [SECURITY-DEBUG] isLocalIP: ${isLocalIP}`)
  console.log(`🔍 [SECURITY-DEBUG] endpoint: ${endpoint}`)
  console.log(`🔍 [SECURITY-DEBUG] method: ${method}`)

  try {
    // Rate limiting (skip in development for local IPs)
    if (options.rateLimitType && !(isDevMode && isLocalIP)) {
      if (!checkRateLimit(clientIP, endpoint, options.rateLimitType)) {
        await logSecurityEvent.rateLimitExceeded(clientIP, endpoint, method, userAgent)
        return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
      }
    } else if (isDevMode && isLocalIP) {
      console.log(`🔧 [SECURITY] Desarrollo local detectado, omitiendo rate limiting para ${clientIP}`)
    }

    // Parse and sanitize request body
    let rawData: any = null
    let sanitizedData: any = null

    if (method === "POST" || method === "PUT" || method === "PATCH") {
      try {
        const contentType = request.headers.get("content-type") || ""

        if (contentType.includes("application/json")) {
          // Get raw text first to check size
          const rawText = await request.text()

          // Check body size with higher limit for images
          const maxSize = options.maxBodySize || (endpoint.includes("payment") ? 10 * 1024 * 1024 : 1024 * 1024) // 10MB for payments, 1MB for others

          if (rawText.length > maxSize) {
            console.error(`❌ [SECURITY] Request body too large: ${rawText.length} bytes (max: ${maxSize})`)
            return NextResponse.json({ error: "Request body too large" }, { status: 413 })
          }

          rawData = JSON.parse(rawText)

          if (isDevMode) {
            // In development, show truncated version for logging
            const logData = { ...rawData }
            if (logData.imagenComprobante && logData.imagenComprobante.length > 200) {
              logData.imagenComprobante = logData.imagenComprobante.substring(0, 200) + "... achico el texto"
            }
            console.log(`🔍 [SECURITY-DEBUG] rawData:`, JSON.stringify(logData, null, 2))
          }

          if (options.sanitizeBody) {
            sanitizedData = sanitizeBody(rawData)

            if (isDevMode) {
              // In development, show truncated version for logging
              const logSanitized = { ...sanitizedData }
              if (logSanitized.imagenComprobante && logSanitized.imagenComprobante.length > 200) {
                logSanitized.imagenComprobante =
                  logSanitized.imagenComprobante.substring(0, 200) + "... achico el texto"
              }
              console.log(`🔍 [SECURITY-DEBUG] sanitizedData:`, JSON.stringify(logSanitized, null, 2))
            }
          }
        }
      } catch (error) {
        console.error(`❌ [SECURITY] Error parsing request body:`, error)
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
      }
    }

    // En desarrollo local, relajar las validaciones de seguridad
    if (isDevMode && isLocalIP) {
      console.log(`🔧 [SECURITY] Modo desarrollo detectado, relajando validaciones para IP local: ${clientIP}`)
    }

    // Check for suspicious content (skip for local development)
    if (sanitizedData && !(isDevMode && isLocalIP)) {
      const suspiciousCheck = checkSuspiciousContent(sanitizedData)

      if (isDevMode) {
        console.log(`🔍 [SECURITY-DEBUG] suspiciousCheck.suspicious: ${suspiciousCheck.suspicious}`)
        console.log(`🔍 [SECURITY-DEBUG] suspiciousCheck.reasons:`, suspiciousCheck.reasons)
      }

      if (suspiciousCheck.suspicious) {
        await logSecurityEvent.maliciousRequest(
          clientIP,
          endpoint,
          method,
          `Suspicious content detected: ${suspiciousCheck.reasons.join(", ")}`,
          sanitizedData,
          userAgent,
        )
        return NextResponse.json({ error: "Suspicious content detected" }, { status: 400 })
      } else if (isDevMode) {
        console.log(`🔍 [SECURITY-DEBUG] NO se detectó actividad sospechosa`)
      }
    } else if (isDevMode && isLocalIP) {
      const suspiciousCheck = checkSuspiciousContent(sanitizedData || {})
      console.log(`🔍 [SECURITY-DEBUG] suspiciousCheck.suspicious: ${suspiciousCheck.suspicious}`)
      console.log(`🔍 [SECURITY-DEBUG] suspiciousCheck.reasons:`, suspiciousCheck.reasons)
      if (!suspiciousCheck.suspicious) {
        console.log(`🔍 [SECURITY-DEBUG] NO se detectó actividad sospechosa`)
      }
    }

    // Log request if enabled
    if (options.logRequests) {
      console.log(`📝 [SECURITY] ${method} ${endpoint} from ${clientIP} - Fingerprint: ${fingerprint}`)
    }

    // Call the actual handler
    const response = await handler(request, sanitizedData || rawData)

    // Log response
    const processingTime = Date.now() - startTime
    console.log(`✅ [SECURITY] Response ${response.status} in ${processingTime}ms`)

    return response
  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error(`❌ [SECURITY] Error in security middleware:`, error)

    await logSecurityEvent.systemError(
      clientIP,
      endpoint,
      method,
      `Security middleware error: ${error}`,
      processingTime,
    )

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
