import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { withSecurity } from "@/lib/security-middleware"
import { validateTicketCode } from "@/lib/security-utils"
import { logSecurityEvent } from "@/lib/security-logger"

async function handleGetTicket(request: NextRequest) {
  const clientIP = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"

  try {
    const url = new URL(request.url)
    const code = url.pathname.split("/").pop()

    if (!code || !validateTicketCode(code)) {
      await logSecurityEvent.maliciousRequest(
        clientIP,
        `/api/ticket/${code}`,
        "GET",
        "Formato de código de ticket inválido",
        { code },
        request.headers.get("user-agent") || "",
      )
      return NextResponse.json({ message: "Código de ticket inválido" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("parking")

    const ticket = await db.collection("tickets").findOne({ codigoTicket: code })

    if (!ticket) {
      return NextResponse.json({ message: "Ticket no encontrado" }, { status: 404 })
    }

    // Obtener información adicional si existe
    let carInfo = null
    let paymentInfo = null

    if (ticket.carInfo) {
      carInfo = ticket.carInfo
    }

    if (ticket.ultimoPagoId) {
      paymentInfo = await db.collection("payments").findOne({
        _id: ticket.ultimoPagoId,
      })
    }

    return NextResponse.json({
      ticket: {
        codigoTicket: ticket.codigoTicket,
        estado: ticket.estado,
        fechaCreacion: ticket.fechaCreacion,
        horaEntrada: ticket.horaEntrada,
        horaOcupacion: ticket.horaOcupacion,
        horaSalida: ticket.horaSalida,
        montoCalculado: ticket.montoCalculado,
        carInfo,
        paymentInfo: paymentInfo
          ? {
              metodoPago: paymentInfo.metodoPago,
              monto: paymentInfo.monto,
              estado: paymentInfo.estado,
              fechaPago: paymentInfo.fechaPago,
            }
          : null,
      },
    })
  } catch (error) {
    console.error("Error fetching ticket:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return withSecurity(request, handleGetTicket, {
    rateLimitType: "QUERY",
    requireValidOrigin: false,
    sanitizeBody: false,
    logRequests: true,
  })
}
