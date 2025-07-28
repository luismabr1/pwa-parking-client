import clientPromise from "./mongodb"
import type { SecurityLog, SecurityStats } from "./types"

class SecurityLogger {
  private dbName = "parking"
  private logsCollection = "security_logs"
  private statsCollection = "security_stats"

  // Guardar log de seguridad
  async logSecurityEvent(logData: Omit<SecurityLog, "_id" | "timestamp" | "status">) {
    try {
      const client = await clientPromise
      const db = client.db(this.dbName)

      const securityLog: SecurityLog = {
        ...logData,
        timestamp: new Date(),
        status: "ACTIVE",
      }

      // Solo guardar logs de nivel WARNING, CRITICAL y BLOCKED
      if (["WARNING", "CRITICAL", "BLOCKED"].includes(logData.level)) {
        await db.collection(this.logsCollection).insertOne(securityLog)

        // Actualizar estadísticas diarias
        await this.updateDailyStats(securityLog)

        console.log(`🔒 [SECURITY-LOG] ${logData.level} event logged: ${logData.type} from ${logData.clientIP}`)
      }

      return securityLog
    } catch (error) {
      console.error("❌ [SECURITY-LOG] Error saving security log:", error)
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  // Actualizar estadísticas diarias
  private async updateDailyStats(log: SecurityLog) {
    try {
      const client = await clientPromise
      const db = client.db(this.dbName)
      const today = new Date().toISOString().split("T")[0] // YYYY-MM-DD

      const updateData: Partial<SecurityStats> = {
        date: today,
        updatedAt: new Date(),
      }

      // Incrementar contadores según el tipo de log
      const incrementData: any = {
        totalRequests: 1,
      }

      if (log.level === "BLOCKED") {
        incrementData.blockedRequests = 1
      }

      if (log.type === "SUSPICIOUS_ACTIVITY") {
        incrementData.suspiciousActivity = 1
      }

      await db.collection(this.statsCollection).updateOne(
        { date: today },
        {
          $inc: incrementData,
          $addToSet: {
            uniqueIPs: log.clientIP,
            ...(log.level === "BLOCKED" && { blockedIPs: log.clientIP }),
          },
          $set: updateData,
          $setOnInsert: {
            createdAt: new Date(),
            topEndpoints: [],
            topUserAgents: [],
          },
        },
        { upsert: true },
      )

      // Actualizar top endpoints
      await this.updateTopEndpoints(today, log.endpoint, log.level === "BLOCKED")

      // Actualizar top user agents
      if (log.userAgent) {
        await this.updateTopUserAgents(today, log.userAgent, log.type === "SUSPICIOUS_ACTIVITY")
      }
    } catch (error) {
      console.error("❌ [SECURITY-LOG] Error updating daily stats:", error)
    }
  }

  // Actualizar endpoints más solicitados
  private async updateTopEndpoints(date: string, endpoint: string, blocked: boolean) {
    try {
      const client = await clientPromise
      const db = client.db(this.dbName)

      await db.collection(this.statsCollection).updateOne(
        {
          date,
          "topEndpoints.endpoint": endpoint,
        },
        {
          $inc: {
            "topEndpoints.$.count": 1,
            ...(blocked && { "topEndpoints.$.blocked": 1 }),
          },
        },
      )

      // Si no existe, agregarlo
      const result = await db.collection(this.statsCollection).findOne({
        date,
        "topEndpoints.endpoint": endpoint,
      })

      if (!result) {
        await db.collection(this.statsCollection).updateOne(
          { date },
          {
            $push: {
              topEndpoints: {
                endpoint,
                count: 1,
                blocked: blocked ? 1 : 0,
              },
            },
          },
        )
      }
    } catch (error) {
      console.error("❌ [SECURITY-LOG] Error updating top endpoints:", error)
    }
  }

  // Actualizar user agents más frecuentes
  private async updateTopUserAgents(date: string, userAgent: string, suspicious: boolean) {
    try {
      const client = await clientPromise
      const db = client.db(this.dbName)

      await db.collection(this.statsCollection).updateOne(
        {
          date,
          "topUserAgents.userAgent": userAgent,
        },
        {
          $inc: { "topUserAgents.$.count": 1 },
          $set: { "topUserAgents.$.suspicious": suspicious },
        },
      )

      // Si no existe, agregarlo
      const result = await db.collection(this.statsCollection).findOne({
        date,
        "topUserAgents.userAgent": userAgent,
      })

      if (!result) {
        await db.collection(this.statsCollection).updateOne(
          { date },
          {
            $push: {
              topUserAgents: {
                userAgent,
                count: 1,
                suspicious,
              },
            },
          },
        )
      }
    } catch (error) {
      console.error("❌ [SECURITY-LOG] Error updating top user agents:", error)
    }
  }

  // Obtener logs de seguridad con filtros
  async getSecurityLogs(
    filters: {
      level?: SecurityLog["level"]
      type?: SecurityLog["type"]
      clientIP?: string
      startDate?: Date
      endDate?: Date
      status?: SecurityLog["status"]
      limit?: number
      skip?: number
    } = {},
  ) {
    try {
      const client = await clientPromise
      const db = client.db(this.dbName)

      const query: any = {}

      if (filters.level) query.level = filters.level
      if (filters.type) query.type = filters.type
      if (filters.clientIP) query.clientIP = filters.clientIP
      if (filters.status) query.status = filters.status

      if (filters.startDate || filters.endDate) {
        query.timestamp = {}
        if (filters.startDate) query.timestamp.$gte = filters.startDate
        if (filters.endDate) query.timestamp.$lte = filters.endDate
      }

      const logs = await db
        .collection(this.logsCollection)
        .find(query)
        .sort({ timestamp: -1 })
        .limit(filters.limit || 100)
        .skip(filters.skip || 0)
        .toArray()

      return logs as SecurityLog[]
    } catch (error) {
      console.error("❌ [SECURITY-LOG] Error fetching security logs:", error)
      return []
    }
  }

  // Obtener estadísticas de seguridad
  async getSecurityStats(days = 7) {
    try {
      const client = await clientPromise
      const db = client.db(this.dbName)

      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const stats = await db
        .collection(this.statsCollection)
        .find({
          date: {
            $gte: startDate.toISOString().split("T")[0],
            $lte: endDate.toISOString().split("T")[0],
          },
        })
        .sort({ date: -1 })
        .toArray()

      return stats as SecurityStats[]
    } catch (error) {
      console.error("❌ [SECURITY-LOG] Error fetching security stats:", error)
      return []
    }
  }

  // Marcar log como resuelto
  async resolveSecurityLog(logId: string, resolvedBy: string, notes?: string) {
    try {
      const client = await clientPromise
      const db = client.db(this.dbName)

      await db.collection(this.logsCollection).updateOne(
        { _id: logId },
        {
          $set: {
            status: "RESOLVED",
            resolvedBy,
            resolvedAt: new Date(),
            ...(notes && { notes }),
          },
        },
      )

      console.log(`✅ [SECURITY-LOG] Log ${logId} marked as resolved by ${resolvedBy}`)
    } catch (error) {
      console.error("❌ [SECURITY-LOG] Error resolving security log:", error)
    }
  }

  // Obtener resumen de alertas críticas activas
  async getCriticalAlerts() {
    try {
      const client = await clientPromise
      const db = client.db(this.dbName)

      const criticalLogs = await db
        .collection(this.logsCollection)
        .find({
          level: { $in: ["CRITICAL", "BLOCKED"] },
          status: "ACTIVE",
          timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Últimas 24 horas
        })
        .sort({ timestamp: -1 })
        .limit(50)
        .toArray()

      return criticalLogs as SecurityLog[]
    } catch (error) {
      console.error("❌ [SECURITY-LOG] Error fetching critical alerts:", error)
      return []
    }
  }

  // Limpiar logs antiguos (ejecutar periódicamente)
  async cleanupOldLogs(daysToKeep = 30) {
    try {
      const client = await clientPromise
      const db = client.db(this.dbName)

      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

      const result = await db.collection(this.logsCollection).deleteMany({
        timestamp: { $lt: cutoffDate },
        level: { $nin: ["CRITICAL"] }, // Mantener logs críticos por más tiempo
      })

      console.log(`🧹 [SECURITY-LOG] Cleaned up ${result.deletedCount} old security logs`)
      return result.deletedCount
    } catch (error) {
      console.error("❌ [SECURITY-LOG] Error cleaning up old logs:", error)
      return 0
    }
  }
}

// Instancia singleton
export const securityLogger = new SecurityLogger()

// Funciones de utilidad para logging rápido
export const logSecurityEvent = {
  rateLimitExceeded: (clientIP: string, endpoint: string, method: string, rateLimitInfo: any, userAgent?: string) =>
    securityLogger.logSecurityEvent({
      level: "BLOCKED",
      type: "RATE_LIMIT",
      clientIP,
      endpoint,
      method,
      userAgent,
      details: {
        message: `Rate limit exceeded: ${rateLimitInfo.currentCount}/${rateLimitInfo.maxRequests} requests`,
        rateLimitInfo,
      },
      metadata: {},
    }),

  suspiciousActivity: (
    clientIP: string,
    endpoint: string,
    method: string,
    reasons: string[],
    requestData?: any,
    userAgent?: string,
  ) =>
    securityLogger.logSecurityEvent({
      level: "CRITICAL",
      type: "SUSPICIOUS_ACTIVITY",
      clientIP,
      endpoint,
      method,
      userAgent,
      details: {
        message: `Suspicious activity detected: ${reasons.join(", ")}`,
        suspiciousReasons: reasons,
        requestData,
      },
      metadata: {},
    }),

  invalidOrigin: (clientIP: string, endpoint: string, method: string, origin?: string, userAgent?: string) =>
    securityLogger.logSecurityEvent({
      level: "WARNING",
      type: "INVALID_ORIGIN",
      clientIP,
      endpoint,
      method,
      origin,
      userAgent,
      details: {
        message: `Invalid origin detected: ${origin}`,
      },
      metadata: {},
    }),

  maliciousRequest: (
    clientIP: string,
    endpoint: string,
    method: string,
    reason: string,
    requestData?: any,
    userAgent?: string,
  ) =>
    securityLogger.logSecurityEvent({
      level: "CRITICAL",
      type: "MALICIOUS_REQUEST",
      clientIP,
      endpoint,
      method,
      userAgent,
      details: {
        message: `Malicious request blocked: ${reason}`,
        requestData,
      },
      metadata: {},
    }),

  systemError: (clientIP: string, endpoint: string, method: string, error: string, processingTime?: number) =>
    securityLogger.logSecurityEvent({
      level: "WARNING",
      type: "SYSTEM_ERROR",
      clientIP,
      endpoint,
      method,
      details: {
        message: `System error occurred: ${error}`,
        errorDetails: error,
      },
      metadata: {
        processingTime,
      },
    }),
}
