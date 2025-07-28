import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { v2 as cloudinary } from "cloudinary"
import { withSecurity } from "@/lib/security-middleware"
import {
  validatePaymentData,
  validatePaymentReference,
  validateAmount,
  validatePhoneNumber,
} from "@/lib/security-utils"
import { logSecurityEvent } from "@/lib/security-logger"

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Opt out of caching for this route
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const revalidate = 0

function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

async function uploadImageToCloudinary(base64Image: string, ticketCode: string): Promise<string> {
  try {
    console.log("📤 [PROCESS-PAYMENT] Subiendo imagen a Cloudinary para ticket:", ticketCode)

    const uploadResponse = await cloudinary.uploader.upload(base64Image, {
      folder: "parking/comprobantes",
      public_id: `comprobante_${ticketCode}_${Date.now()}`,
      resource_type: "image",
      format: "jpg",
      quality: "auto:good",
      transformation: [{ width: 800, height: 600, crop: "limit" }, { quality: "auto:good" }, { fetch_format: "auto" }],
    })

    console.log("✅ [PROCESS-PAYMENT] Imagen subida exitosamente:", uploadResponse.secure_url)
    return uploadResponse.secure_url
  } catch (error) {
    console.error("❌ [PROCESS-PAYMENT] Error subiendo imagen a Cloudinary:", error)
    throw new Error("Error al subir la imagen del comprobante")
  }
}

async function processPaymentHandler(request: NextRequest, sanitizedData: any) {
  const startTime = Date.now()
  const clientIP = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"

  try {
    console.log("💰 [PROCESS-PAYMENT] ===== INICIANDO PROCESO DE PAGO =====")
    console.log("🕐 [PROCESS-PAYMENT] Timestamp:", new Date().toISOString())

    // Validar datos de pago
    const validation = validatePaymentData(sanitizedData)
    if (!validation.valid) {
      console.error("❌ [PROCESS-PAYMENT] Validación fallida:", validation.errors)
      return NextResponse.json(
        {
          message: "Datos de pago inválidos",
          errors: validation.errors,
        },
        { status: 400 },
      )
    }

    // Validaciones de seguridad adicionales
    if (!validatePaymentReference(sanitizedData.numeroReferencia)) {
      await logSecurityEvent.maliciousRequest(
        clientIP,
        "/api/process-payment",
        "POST",
        "Formato de referencia de pago inválido",
        { numeroReferencia: sanitizedData.numeroReferencia },
        request.headers.get("user-agent") || "",
      )
      return NextResponse.json({ message: "Formato de referencia inválido" }, { status: 400 })
    }

    if (!validateAmount(sanitizedData.monto)) {
      await logSecurityEvent.maliciousRequest(
        clientIP,
        "/api/process-payment",
        "POST",
        "Monto de pago inválido o sospechoso",
        { monto: sanitizedData.monto },
        request.headers.get("user-agent") || "",
      )
      return NextResponse.json({ message: "Monto inválido" }, { status: 400 })
    }

    if (sanitizedData.telefono && !validatePhoneNumber(sanitizedData.telefono)) {
      await logSecurityEvent.maliciousRequest(
        clientIP,
        "/api/process-payment",
        "POST",
        "Formato de teléfono inválido",
        { telefono: sanitizedData.telefono },
        request.headers.get("user-agent") || "",
      )
      return NextResponse.json({ message: "Formato de teléfono inválido" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("parking")

    const {
      codigoTicket,
      tipoPago,
      referenciaTransferencia,
      banco,
      telefono,
      numeroIdentidad,
      montoPagado,
      tiempoSalida,
      imagenComprobante,
    } = sanitizedData

    console.log("📥 [PROCESS-PAYMENT] Datos validados:")
    console.log("   Código Ticket:", codigoTicket)
    console.log("   Tipo Pago:", tipoPago)
    console.log("   Monto Pagado:", montoPagado)
    console.log("   Tiempo Salida:", tiempoSalida)
    console.log("   Tiene Imagen:", !!imagenComprobante)

    // Buscar ticket
    console.log("🎫 [PROCESS-PAYMENT] Buscando ticket:", codigoTicket)

    const ticket = await db.collection("tickets").findOne({ codigoTicket })

    if (!ticket) {
      console.error("❌ [PROCESS-PAYMENT] Ticket no encontrado:", codigoTicket)
      return NextResponse.json({ message: "Ticket no encontrado" }, { status: 404 })
    }

    console.log("✅ [PROCESS-PAYMENT] Ticket encontrado:")
    console.log("   Código:", ticket.codigoTicket)
    console.log("   Estado:", ticket.estado)
    console.log("   Monto Calculado:", ticket.montoCalculado)

    // Validar estado del ticket - Estados válidos para pago
    const estadosValidosParaPago = ["activo", "ocupado", "validado", "estacionado", "estacionado_confirmado"]

    if (!estadosValidosParaPago.includes(ticket.estado)) {
      let errorMsg = "Este ticket no está disponible para pago"

      if (ticket.estado === "pagado_pendiente_validacion" || ticket.estado === "pagado_pendiente_taquilla") {
        errorMsg = "Este ticket ya tiene un pago pendiente de validación"
      } else if (ticket.estado === "pagado_validado") {
        errorMsg = "Este ticket ya ha sido pagado y validado"
      } else if (ticket.estado === "salido") {
        errorMsg = "Este ticket ya ha sido utilizado para salir del estacionamiento"
      } else if (ticket.estado === "disponible") {
        errorMsg = "Este ticket no tiene un vehículo asignado"
      }

      console.error("❌ [PROCESS-PAYMENT] Estado de ticket inválido:", errorMsg)
      return NextResponse.json({ message: errorMsg }, { status: 400 })
    }

    const now = new Date()

    // Calcular tiempo de salida estimado
    let tiempoSalidaEstimado = now
    if (tiempoSalida && tiempoSalida !== "now") {
      const minutesToAdd =
        {
          "5min": 5,
          "10min": 10,
          "15min": 15,
          "20min": 20,
          "30min": 30,
          "45min": 45,
          "60min": 60,
        }[tiempoSalida] || 0

      if (minutesToAdd > 0) {
        tiempoSalidaEstimado = new Date(Date.now() + minutesToAdd * 60000)
        console.log("⏰ [PROCESS-PAYMENT] Tiempo de salida estimado:", tiempoSalidaEstimado)
      }
    }

    // Obtener configuración de la empresa
    console.log("⚙️ [PROCESS-PAYMENT] Obteniendo configuración de empresa...")

    const companySettings = await db.collection("company_settings").findOne({})
    const precioHora = companySettings?.tarifas?.precioHora || 3
    const tasaCambio = companySettings?.tarifas?.tasaCambio || 35

    console.log("💱 [PROCESS-PAYMENT] Configuración encontrada:")
    console.log("   Precio por hora:", precioHora, "USD")
    console.log("   Tasa de cambio:", tasaCambio, "Bs/USD")

    let montoEnBs = 0
    let montoEnUsd = 0

    // Calcular montos según tipo de pago
    console.log("💰 [PROCESS-PAYMENT] Calculando montos...")

    if (tipoPago === "efectivo_usd") {
      montoEnUsd = Number(montoPagado)
      montoEnBs = Number((montoEnUsd * tasaCambio).toFixed(2))
      console.log("   Pago en USD:", montoEnUsd, "→", montoEnBs, "Bs")
    } else if (tipoPago === "efectivo_bs") {
      montoEnBs = Number(montoPagado)
      montoEnUsd = Number((montoEnBs / tasaCambio).toFixed(6))
      console.log("   Pago en Bs:", montoEnBs, "→", montoEnUsd, "USD")
    } else if (tipoPago === "pago_movil" || tipoPago === "transferencia") {
      montoEnBs = Number(montoPagado)
      montoEnUsd = Number((montoEnBs / tasaCambio).toFixed(6))
      console.log("   Pago electrónico en Bs:", montoEnBs, "→", montoEnUsd, "USD")
    } else {
      const errorMsg = "Tipo de pago no válido"
      console.error("❌ [PROCESS-PAYMENT] Tipo de pago inválido:", tipoPago)
      return NextResponse.json({ message: errorMsg }, { status: 400 })
    }

    // Validar monto contra el calculado
    const montoCalculadoBs = (ticket.montoCalculado || 0) * tasaCambio
    const tolerance = 0.1

    console.log("🔍 [PROCESS-PAYMENT] Validando montos:")
    console.log("   Monto pagado (Bs):", montoEnBs)
    console.log("   Monto calculado (Bs):", montoCalculadoBs)
    console.log("   Diferencia:", Math.abs(montoEnBs - montoCalculadoBs))

    if (
      Math.abs(montoEnBs - montoCalculadoBs) > tolerance &&
      !(tipoPago.startsWith("efectivo") && montoEnBs >= montoCalculadoBs - tolerance)
    ) {
      const errorMsg = `El monto pagado (${formatCurrency(montoEnBs, "VES")} Bs) no coincide con el monto calculado (${formatCurrency(montoCalculadoBs, "VES")} Bs). Por favor, verifique el monto e intente de nuevo.`
      console.error("❌ [PROCESS-PAYMENT] Monto no coincide:", errorMsg)
      return NextResponse.json({ message: errorMsg }, { status: 400 })
    }

    // Buscar carro asociado
    console.log("🚗 [PROCESS-PAYMENT] Buscando carro asociado al ticket...")

    const car = await db.collection("cars").findOne({
      ticketAsociado: codigoTicket,
      estado: {
        $in: [
          "estacionado",
          "estacionado_confirmado",
          "pago_pendiente",
          "pago_pendiente_taquilla",
          "pago_pendiente_validacion",
        ],
      },
    })

    if (car) {
      console.log("✅ [PROCESS-PAYMENT] Carro encontrado:", car.placa)
    } else {
      console.log("⚠️ [PROCESS-PAYMENT] No se encontró carro asociado al ticket")
    }

    // Subir imagen a Cloudinary si existe
    let urlImagenComprobante = null
    if (imagenComprobante) {
      try {
        console.log("📸 [PROCESS-PAYMENT] Procesando imagen del comprobante...")
        urlImagenComprobante = await uploadImageToCloudinary(imagenComprobante, codigoTicket)
        console.log("✅ [PROCESS-PAYMENT] Imagen subida exitosamente")
      } catch (error) {
        console.error("❌ [PROCESS-PAYMENT] Error subiendo imagen:", error)
        return NextResponse.json(
          {
            message: "Error al subir la imagen del comprobante. Intente nuevamente.",
          },
          { status: 500 },
        )
      }
    }

    const pagoData = {
      ticketId: ticket._id.toString(),
      codigoTicket,
      tipoPago,
      referenciaTransferencia: referenciaTransferencia || null,
      banco: banco || null,
      telefono: telefono || null,
      numeroIdentidad: numeroIdentidad || null,
      montoPagado: montoEnBs,
      montoPagadoUsd: montoEnUsd,
      montoCalculado: ticket.montoCalculado || 0,
      tasaCambioUsada: tasaCambio,
      fechaPago: now,
      estado: "pendiente_validacion",
      estadoValidacion: "pendiente",
      tiempoSalida: tiempoSalida || "now",
      tiempoSalidaEstimado,
      carInfo: car
        ? {
            placa: car.placa,
            marca: car.marca,
            modelo: car.modelo,
            color: car.color,
            nombreDueño: car.nombreDueño,
            telefono: car.telefono,
          }
        : null,
      urlImagenComprobante: urlImagenComprobante,
    }

    console.log("💾 [PROCESS-PAYMENT] Guardando pago en base de datos...")

    const pagoResult = await db.collection("pagos").insertOne(pagoData)

    console.log("✅ [PROCESS-PAYMENT] Pago guardado con ID:", pagoResult.insertedId)

    const nuevoEstadoTicket = tipoPago.startsWith("efectivo")
      ? "pagado_pendiente_taquilla"
      : "pagado_pendiente_validacion"

    // Actualizar ticket
    console.log("🎫 [PROCESS-PAYMENT] Actualizando estado del ticket a:", nuevoEstadoTicket)

    const ticketUpdateResult = await db.collection("tickets").updateOne(
      { codigoTicket },
      {
        $set: {
          estado: nuevoEstadoTicket,
          ultimoPagoId: pagoResult.insertedId.toString(),
          tipoPago,
          tiempoSalida: tiempoSalida || "now",
          tiempoSalidaEstimado,
          horaSalida: tiempoSalida === "now" ? now : undefined,
        },
      },
    )

    console.log("✅ [PROCESS-PAYMENT] Ticket actualizado")

    // Actualizar carro si existe
    if (car) {
      const nuevoEstadoCarro = tipoPago.startsWith("efectivo") ? "pago_pendiente_taquilla" : "pago_pendiente_validacion"

      console.log("🚗 [PROCESS-PAYMENT] Actualizando estado del carro a:", nuevoEstadoCarro)

      await db.collection("cars").updateOne({ _id: car._id }, { $set: { estado: nuevoEstadoCarro } })
    }

    // Actualizar car_history
    const carId = car?._id.toString()
    if (carId) {
      console.log("📚 [PROCESS-PAYMENT] Actualizando historial del carro...")

      await db.collection("car_history").updateOne(
        { carId },
        {
          $push: {
            eventos: {
              tipo: "pago_registrado",
              fecha: now,
              estado: tipoPago.startsWith("efectivo") ? "pago_pendiente_taquilla" : "pago_pendiente_validacion",
              datos: {
                tipoPago,
                montoPagado: montoEnBs,
                montoPagadoUsd: montoEnUsd,
                tasaCambio,
                tiempoSalida,
                tiempoSalidaEstimado,
                pagoId: pagoResult.insertedId.toString(),
                referenciaTransferencia,
                banco,
                telefono,
                numeroIdentidad,
                urlImagenComprobante: urlImagenComprobante,
              },
            },
          },
          $set: {
            estadoActual: tipoPago.startsWith("efectivo") ? "pago_pendiente_taquilla" : "pago_pendiente_validacion",
            fechaUltimaActualizacion: now,
            fechaPago: now,
            pagoData: pagoData,
            horaSalida: tiempoSalida === "now" ? now : undefined,
          },
        },
      )
    }

    // Enviar notificación push a administradores
    try {
      console.log("📱 [PROCESS-PAYMENT] Enviando notificación push a administradores...")

      const notificationPayload = {
        type: "admin_payment",
        ticketCode: codigoTicket,
        userType: "admin",
        data: {
          amount: montoEnBs,
          amountUsd: montoEnUsd,
          paymentType: tipoPago,
          plate: car?.placa || "N/A",
          requiresValidation: !tipoPago.startsWith("efectivo"),
          hasReceipt: !!urlImagenComprobante,
          exitTime: tiempoSalida || "now",
          reference: referenciaTransferencia || null,
          bank: banco || null,
        },
      }

      const notificationResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/send-notification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(notificationPayload),
        },
      )

      if (notificationResponse.ok) {
        const responseData = await notificationResponse.json()
        console.log("✅ [PROCESS-PAYMENT] Notificación admin enviada:", responseData.sent)
      }
    } catch (notificationError) {
      console.error("❌ [PROCESS-PAYMENT] Error enviando notificación push:", notificationError)
      // No fallar el pago si la notificación falla
    }

    const processingTime = Date.now() - startTime

    console.log("🎉 [PROCESS-PAYMENT] ===== PAGO PROCESADO EXITOSAMENTE =====")
    console.log("   Tiempo de procesamiento:", processingTime + "ms")

    const response = NextResponse.json({
      message: "Pago registrado exitosamente",
      pagoId: pagoResult.insertedId,
      tipoPago,
      montoEnBs,
      montoEnUsd,
      requiresValidation: !tipoPago.startsWith("efectivo"),
      tiempoSalida: tiempoSalida || "now",
      processingTime,
      urlImagenComprobante: urlImagenComprobante,
    })

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    response.headers.set("Pragma", "no-cache")
    response.headers.set("Expires", "0")
    response.headers.set("Surrogate-Control", "no-store")

    return response
  } catch (error) {
    const processingTime = Date.now() - startTime

    console.error("❌ [PROCESS-PAYMENT] ===== ERROR CRÍTICO =====")
    console.error("   Tiempo transcurrido:", processingTime + "ms")
    console.error("   Error:", error.message)

    return NextResponse.json(
      {
        message: "Error al procesar el pago",
        error: error.message,
        processingTime,
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  return withSecurity(request, processPaymentHandler, {
    rateLimitType: "CRITICAL",
    requireValidOrigin: true,
    sanitizeBody: true,
    logRequests: true,
  })
}
