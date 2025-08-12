import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { withSecurity } from "@/lib/security-middleware"

async function getTicketSubscriptionHandler(
  request: NextRequest,
  sanitizedData: any,
  { params }: { params: { ticketCode: string } },
) {
  try {
    console.log("🔍 [TICKET-SUBSCRIPTIONS-GET] ===== VERIFICANDO ASOCIACIÓN =====")
    console.log("   Timestamp:", new Date().toISOString())
    console.log("   IP:", request.headers.get("x-forwarded-for") || "unknown")

    const { ticketCode } = params

    console.log("📦 [TICKET-SUBSCRIPTIONS-GET] Parámetros:")
    console.log("   TicketCode:", ticketCode)

    if (!ticketCode) {
      console.error("❌ [TICKET-SUBSCRIPTIONS-GET] Código de ticket faltante")
      return NextResponse.json(
        {
          message: "Código de ticket requerido",
        },
        { status: 400 },
      )
    }

    const client = await clientPromise
    const db = client.db("parking")

    console.log("🔍 [TICKET-SUBSCRIPTIONS-GET] Conectado a MongoDB")

    // Buscar asociación activa para este ticket
    console.log("🔍 [TICKET-SUBSCRIPTIONS-GET] Buscando asociación...")
    const association = await db.collection("ticket_subscriptions").findOne({
      ticketCode: ticketCode,
      isActive: true,
    })

    console.log("🔍 [TICKET-SUBSCRIPTIONS-GET] Resultado búsqueda:")
    console.log("   Encontrada:", !!association)

    if (association) {
      console.log("✅ [TICKET-SUBSCRIPTIONS-GET] Asociación encontrada:")
      console.log("   ID:", association._id)
      console.log("   SubscriptionId:", association.subscriptionId)
      console.log("   Creada:", association.createdAt)
      console.log("   Notificaciones enviadas:", association.notificationsSent)
      console.log("   Última notificación:", association.lastNotificationAt)

      // También buscar la suscripción push relacionada
      console.log("📱 [TICKET-SUBSCRIPTIONS-GET] Buscando suscripción push relacionada...")
      const pushSubscription = await db.collection("push_subscriptions").findOne({
        _id: association.subscriptionId,
      })

      console.log("📱 [TICKET-SUBSCRIPTIONS-GET] Suscripción push:")
      console.log("   Encontrada:", !!pushSubscription)
      if (pushSubscription) {
        console.log("   Endpoint:", pushSubscription.endpoint?.substring(0, 50) + "...")
        console.log("   Activa:", pushSubscription.isActive)
        console.log("   UserType:", pushSubscription.userType)
      }

      return NextResponse.json({
        isRegistered: true,
        associationId: association._id,
        subscriptionId: association.subscriptionId,
        createdAt: association.createdAt,
        updatedAt: association.updatedAt,
        notificationsSent: association.notificationsSent,
        lastNotificationAt: association.lastNotificationAt,
        pushSubscriptionFound: !!pushSubscription,
        pushSubscriptionActive: pushSubscription?.isActive || false,
      })
    } else {
      console.log("❌ [TICKET-SUBSCRIPTIONS-GET] Asociación no encontrada")

      // Buscar si existe alguna asociación inactiva
      const inactiveAssociation = await db.collection("ticket_subscriptions").findOne({
        ticketCode: ticketCode,
        isActive: false,
      })

      console.log("🔍 [TICKET-SUBSCRIPTIONS-GET] Asociación inactiva:")
      console.log("   Encontrada:", !!inactiveAssociation)

      return NextResponse.json({
        isRegistered: false,
        message: "Ticket no registrado para notificaciones",
        hasInactiveAssociation: !!inactiveAssociation,
      })
    }
  } catch (error) {
    console.error("❌ [TICKET-SUBSCRIPTIONS-GET] Error:", error)
    console.error("   Stack:", error.stack)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: { ticketCode: string } }) {
  return withSecurity(request, (req, data) => getTicketSubscriptionHandler(req, data, { params }), {
    rateLimitType: "API",
    requireValidOrigin: true,
    logRequests: true,
  })
}
