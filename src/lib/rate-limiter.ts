// Rate limiter usando Map en memoria (para producción considera Redis)
interface RateLimitEntry {
  count: number
  resetTime: number
  blocked: boolean
  blockUntil?: number
}

class RateLimiter {
  private requests = new Map<string, RateLimitEntry>()
  private readonly cleanupInterval: NodeJS.Timeout

  constructor() {
    // Limpiar entradas expiradas cada 5 minutos
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup()
      },
      5 * 60 * 1000,
    )
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.requests.entries()) {
      if (entry.resetTime < now && (!entry.blocked || (entry.blockUntil && entry.blockUntil < now))) {
        this.requests.delete(key)
      }
    }
  }

  private getKey(identifier: string, endpoint: string): string {
    return `${identifier}:${endpoint}`
  }

  check(
    identifier: string,
    endpoint: string,
    options: {
      maxRequests: number
      windowMs: number
      blockDurationMs?: number
    },
  ): { allowed: boolean; remaining: number; resetTime: number; blocked?: boolean } {
    const key = this.getKey(identifier, endpoint)
    const now = Date.now()
    const { maxRequests, windowMs, blockDurationMs = 15 * 60 * 1000 } = options

    let entry = this.requests.get(key)

    // Si no existe la entrada, crearla
    if (!entry) {
      entry = {
        count: 1,
        resetTime: now + windowMs,
        blocked: false,
      }
      this.requests.set(key, entry)
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: entry.resetTime,
      }
    }

    // Si está bloqueado, verificar si ya se puede desbloquear
    if (entry.blocked && entry.blockUntil) {
      if (now < entry.blockUntil) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: entry.resetTime,
          blocked: true,
        }
      } else {
        // Desbloquear y resetear
        entry.blocked = false
        entry.blockUntil = undefined
        entry.count = 1
        entry.resetTime = now + windowMs
        this.requests.set(key, entry)
        return {
          allowed: true,
          remaining: maxRequests - 1,
          resetTime: entry.resetTime,
        }
      }
    }

    // Si la ventana de tiempo ha expirado, resetear
    if (now > entry.resetTime) {
      entry.count = 1
      entry.resetTime = now + windowMs
      this.requests.set(key, entry)
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: entry.resetTime,
      }
    }

    // Incrementar contador
    entry.count++

    // Si excede el límite, bloquear
    if (entry.count > maxRequests) {
      entry.blocked = true
      entry.blockUntil = now + blockDurationMs
      this.requests.set(key, entry)

      console.warn(`🚫 [RATE-LIMITER] IP ${identifier} bloqueada en ${endpoint} por ${blockDurationMs / 1000}s`)

      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        blocked: true,
      }
    }

    this.requests.set(key, entry)
    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetTime: entry.resetTime,
    }
  }

  // Método para obtener estadísticas
  getStats(): { totalEntries: number; blockedIPs: number } {
    let blockedIPs = 0
    for (const entry of this.requests.values()) {
      if (entry.blocked) blockedIPs++
    }
    return {
      totalEntries: this.requests.size,
      blockedIPs,
    }
  }

  // Método para limpiar manualmente una IP (para admins)
  clearIP(identifier: string, endpoint?: string) {
    if (endpoint) {
      const key = this.getKey(identifier, endpoint)
      this.requests.delete(key)
    } else {
      // Limpiar todas las entradas de esta IP
      for (const key of this.requests.keys()) {
        if (key.startsWith(`${identifier}:`)) {
          this.requests.delete(key)
        }
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval)
    this.requests.clear()
  }
}

// Instancia singleton
export const rateLimiter = new RateLimiter()

// Configuraciones predefinidas por tipo de endpoint
export const RATE_LIMIT_CONFIGS = {
  // Endpoints críticos (pagos, validaciones)
  CRITICAL: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minuto
    blockDurationMs: 15 * 60 * 1000, // 15 minutos
  },

  // Endpoints de consulta (tickets, configuración)
  QUERY: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minuto
    blockDurationMs: 5 * 60 * 1000, // 5 minutos
  },

  // Endpoints de notificaciones
  NOTIFICATION: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minuto
    blockDurationMs: 10 * 60 * 1000, // 10 minutos
  },

  // Endpoints de subida de archivos
  UPLOAD: {
    maxRequests: 3,
    windowMs: 60 * 1000, // 1 minuto
    blockDurationMs: 30 * 60 * 1000, // 30 minutos
  },
} as const
