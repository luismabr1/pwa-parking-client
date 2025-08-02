import type { NextRequest } from "next/server"

// Obtener IP del cliente
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")
  const cfConnectingIp = request.headers.get("cf-connecting-ip") // Cloudflare

  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }

  if (cfConnectingIp) {
    return cfConnectingIp
  }

  if (realIp) {
    return realIp
  }

  return "unknown"
}

// Headers de seguridad
export function getSecurityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  }
}

// Verificar si estamos en desarrollo
function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development" || process.env.NODE_ENV !== "production"
}

// Detectar actividad sospechosa
export function detectSuspiciousActivity(request: NextRequest, data?: any): { suspicious: boolean; reasons: string[] } {
  const reasons: string[] = []
  const userAgent = request.headers.get("user-agent") || ""
  const referer = request.headers.get("referer") || ""
  const clientIP = getClientIP(request)

  // En desarrollo, ser menos estricto con localhost/127.0.0.1/::1
  if (isDevelopment() && (clientIP === "::1" || clientIP === "127.0.0.1" || clientIP === "localhost")) {
    console.log("🔧 [SECURITY] Modo desarrollo detectado, relajando validaciones para IP local:", clientIP)
    // Solo verificar patrones realmente peligrosos en desarrollo
    if (data) {
      const dataString = JSON.stringify(data).toLowerCase()

      // Solo patrones críticos en desarrollo
      const criticalPatterns = ["drop table", "delete from", "'; --", "<script", "javascript:", "eval("]

      criticalPatterns.forEach((pattern) => {
        if (dataString.includes(pattern)) {
          reasons.push(`Patrón crítico detectado: ${pattern}`)
        }
      })
    }

    return {
      suspicious: reasons.length > 0,
      reasons,
    }
  }

  // Validaciones completas para producción
  // 1. User-Agent sospechoso
  const suspiciousUserAgents = ["curl", "wget", "python", "bot", "crawler", "spider", "scraper", "postman", "insomnia"]

  if (suspiciousUserAgents.some((agent) => userAgent.toLowerCase().includes(agent))) {
    reasons.push(`User-Agent sospechoso: ${userAgent}`)
  }

  // 2. User-Agent vacío o muy corto
  if (!userAgent || userAgent.length < 10) {
    reasons.push("User-Agent vacío o muy corto")
  }

  // 3. Múltiples headers de proxy (posible proxy chain)
  const proxyHeaders = ["x-forwarded-for", "x-real-ip", "x-forwarded-proto", "x-forwarded-host"]
  const proxyCount = proxyHeaders.filter((header) => request.headers.get(header)).length
  if (proxyCount > 2) {
    reasons.push(`Múltiples headers de proxy detectados (${proxyCount})`)
  }

  // 4. Análisis del contenido del request
  if (data) {
    const dataString = JSON.stringify(data).toLowerCase()

    // Patrones de inyección SQL
    const sqlPatterns = [
      "union select",
      "drop table",
      "insert into",
      "delete from",
      "update set",
      "exec(",
      "execute(",
      "sp_",
      "xp_",
      "'; --",
      "' or '1'='1",
      "' or 1=1",
      "admin'--",
    ]

    // Patrones XSS
    const xssPatterns = [
      "<script",
      "javascript:",
      "onload=",
      "onerror=",
      "onclick=",
      "onmouseover=",
      "eval(",
      "alert(",
      "document.cookie",
      "window.location",
    ]

    // Patrones de path traversal
    const pathTraversalPatterns = ["../", "..\\", "%2e%2e%2f", "%2e%2e\\", "....//"]

    // Verificar patrones maliciosos
    sqlPatterns.forEach((pattern) => {
      if (dataString.includes(pattern)) {
        reasons.push(`Posible inyección SQL detectada: ${pattern}`)
      }
    })

    xssPatterns.forEach((pattern) => {
      if (dataString.includes(pattern)) {
        reasons.push(`Posible XSS detectado: ${pattern}`)
      }
    })

    pathTraversalPatterns.forEach((pattern) => {
      if (dataString.includes(pattern)) {
        reasons.push(`Posible path traversal detectado: ${pattern}`)
      }
    })

    // Verificar tamaño excesivo del payload
    if (JSON.stringify(data).length > 50000) {
      reasons.push(`Payload excesivamente grande: ${JSON.stringify(data).length} bytes`)
    }

    // Verificar caracteres de control o binarios
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(dataString)) {
      reasons.push("Caracteres de control o binarios detectados")
    }
  }

  // 5. Verificar frecuencia de requests (esto se maneja en el rate limiter)
  // Pero podemos detectar patrones sospechosos en headers

  // 6. Verificar referer sospechoso
  if (referer) {
    const suspiciousDomains = ["malware", "phishing", "spam", "hack", "exploit", "attack"]

    if (suspiciousDomains.some((domain) => referer.toLowerCase().includes(domain))) {
      reasons.push(`Referer sospechoso: ${referer}`)
    }
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
  }
}

// Sanitizar input
export function sanitizeInput(data: any): any {
  if (typeof data === "string") {
    return data
      .replace(/[<>]/g, "") // Remover < y >
      .replace(/javascript:/gi, "") // Remover javascript:
      .replace(/on\w+=/gi, "") // Remover event handlers
      .trim()
      .slice(0, 1000) // Limitar longitud
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeInput)
  }

  if (typeof data === "object" && data !== null) {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(data)) {
      // Sanitizar también las keys
      const cleanKey = key.replace(/[<>]/g, "").slice(0, 100)
      sanitized[cleanKey] = sanitizeInput(value)
    }
    return sanitized
  }

  return data
}

// Validar estructura de datos específicos
export function validateTicketCode(code: string): boolean {
  // Formato esperado: letras y números, 6-20 caracteres
  return /^[A-Za-z0-9]{6,20}$/.test(code)
}

export function validatePaymentReference(reference: string): boolean {
  // Formato esperado: letras y números, 6-30 caracteres (más flexible para referencias reales)
  return /^[A-Za-z0-9]{6,30}$/.test(reference)
}

export function validatePhoneNumber(phone: string): boolean {
  // Formato venezolano: 04 + 9 dígitos (11 dígitos total)
  return /^04\d{9}$/.test(phone)
}

export function validateAmount(amount: number): boolean {
  return amount > 0 && amount <= 1000000 && Number.isFinite(amount)
}

// Validar datos de pago completos
export function validatePaymentData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!data || typeof data !== "object") {
    errors.push("Datos de pago inválidos")
    return { valid: false, errors }
  }

  // Validar código de ticket
  if (!data.codigoTicket || !validateTicketCode(data.codigoTicket)) {
    errors.push("Código de ticket inválido")
  }

  // Validar tipo de pago
  const tiposPagoValidos = ["pago_movil", "transferencia", "efectivo_bs", "efectivo_usd"]
  if (!data.tipoPago || !tiposPagoValidos.includes(data.tipoPago)) {
    errors.push("Tipo de pago inválido")
  }

  // Validar monto
  if (!data.montoPagado || !validateAmount(Number(data.montoPagado))) {
    errors.push("Monto de pago inválido")
  }

  // Validaciones específicas para pagos electrónicos
  if (data.tipoPago === "pago_movil" || data.tipoPago === "transferencia") {
    if (!data.referenciaTransferencia || !validatePaymentReference(data.referenciaTransferencia)) {
      errors.push("Referencia de transferencia inválida")
    }

    if (!data.banco || typeof data.banco !== "string" || data.banco.trim().length === 0) {
      errors.push("Banco requerido")
    }

    if (!data.telefono || !validatePhoneNumber(data.telefono)) {
      errors.push("Número de teléfono inválido")
    }

    if (!data.numeroIdentidad || typeof data.numeroIdentidad !== "string" || data.numeroIdentidad.trim().length === 0) {
      errors.push("Número de identidad requerido")
    }
  }

  // Validar tiempo de salida
  const tiemposSalidaValidos = ["now", "5min", "10min", "15min", "20min", "30min", "45min", "60min"]
  if (data.tiempoSalida && !tiemposSalidaValidos.includes(data.tiempoSalida)) {
    errors.push("Tiempo de salida inválido")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// Generar fingerprint del request para tracking
export function generateRequestFingerprint(request: NextRequest): string {
  const userAgent = request.headers.get("user-agent") || ""
  const acceptLanguage = request.headers.get("accept-language") || ""
  const acceptEncoding = request.headers.get("accept-encoding") || ""

  const fingerprint = `${userAgent}|${acceptLanguage}|${acceptEncoding}`

  // Crear hash simple (en producción usar crypto)
  let hash = 0
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16)
}
