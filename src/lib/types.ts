export interface CompanySettings {
  _id?: string
  pagoMovil: {
    banco: string
    cedula: string
    telefono: string
  }
  transferencia: {
    banco: string
    cedula: string
    telefono: string
    numeroCuenta: string
  }
  tarifas: {
    precioHoraDiurno: number
    precioHoraNocturno: number
    tasaCambio: number
    horaInicioNocturno: string // formato HH:mm
    horaFinNocturno: string // formato HH:mm
  }
  fechaCreacion?: Date
  fechaActualizacion?: Date
}

export interface PaymentFormData {
  referenciaTransferencia: string
  banco: string
  telefono: string
  numeroIdentidad: string
  montoPagado: number
}

export interface Ticket {
  _id?: string
  codigoTicket: string
  estado: "disponible" | "ocupado" | "estacionado_pendiente" | "estacionado_confirmado" | "pagado" | "finalizado"
  fechaCreacion: Date
  horaEntrada?: string | null
  horaOcupacion?: string | null
  horaSalida?: string | null
  montoCalculado: number
  carInfo?: CarInfo | null
  ultimoPagoId?: string | null
}

export interface CarInfo {
  placa: string
  marca: string
  modelo: string
  color: string
  nombreDueño: string
  telefono: string
}

export interface Car {
  _id?: string
  placa: string
  marca: string
  modelo: string
  color: string
  nombreDueño: string
  telefono: string
  ticketAsociado: string
  horaIngreso: string
  estado: string
  fechaRegistro: string
  imagenUrl?: string
}

export interface Payment {
  _id?: string
  ticketId: string
  codigoTicket: string
  metodoPago: "pago_movil" | "transferencia" | "efectivo"
  monto: number
  montoBolivares: number
  tasaCambio: number
  estado: "pendiente" | "validado" | "rechazado"
  fechaPago: Date
  fechaValidacion?: Date
  detallesPago: {
    numeroReferencia?: string
    banco?: string
    fechaTransaccion?: string
    cedulaPagador?: string
    telefonoPagador?: string
  }
  urlImagenComprobante?: string
  observaciones?: string
  validadoPor?: string
}

export interface Staff {
  _id?: string
  nombre: string
  apellido: string
  email: string
  password: string
  rol: "administrador" | "operador"
  fechaCreacion: Date
  activo: boolean
}

export interface Bank {
  _id?: string
  code: string
  name: string
}

export interface CarHistory {
  _id?: string
  placa: string
  ticketId: string
  codigoTicket: string
  evento: "ingreso" | "confirmacion" | "pago_validado" | "salida"
  fecha: Date
  detalles: {
    usuario?: string
    monto?: number
    metodoPago?: string
    numeroReferencia?: string
    observaciones?: string
  }
}

// Nuevas interfaces para el sistema de logging de seguridad
export interface SecurityLog {
  _id?: string
  timestamp: Date
  level: "INFO" | "WARNING" | "CRITICAL" | "BLOCKED"
  type: "RATE_LIMIT" | "SUSPICIOUS_ACTIVITY" | "INVALID_ORIGIN" | "MALICIOUS_REQUEST" | "SYSTEM_ERROR" | "ACCESS_DENIED"
  clientIP: string
  endpoint: string
  method: string
  userAgent?: string
  origin?: string
  referer?: string

  // Detalles específicos del evento
  details: {
    message: string
    rateLimitInfo?: {
      maxRequests: number
      currentCount: number
      windowMs: number
      blocked: boolean
      blockDuration?: number
    }
    suspiciousReasons?: string[]
    requestData?: any
    errorDetails?: string
    geoLocation?: {
      country?: string
      city?: string
      region?: string
    }
  }

  // Información adicional para análisis
  metadata: {
    processingTime?: number
    responseStatus?: number
    sessionId?: string
    fingerprint?: string
  }

  // Estado del log
  status: "ACTIVE" | "RESOLVED" | "IGNORED"
  resolvedBy?: string
  resolvedAt?: Date
  notes?: string
}

export interface SecurityStats {
  _id?: string
  date: string // YYYY-MM-DD
  totalRequests: number
  blockedRequests: number
  suspiciousActivity: number
  uniqueIPs: number
  blockedIPs: string[]
  topEndpoints: Array<{
    endpoint: string
    count: number
    blocked: number
  }>
  topUserAgents: Array<{
    userAgent: string
    count: number
    suspicious: boolean
  }>
  createdAt: Date
  updatedAt: Date
}
