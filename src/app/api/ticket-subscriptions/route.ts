import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { withSecurity } from "@/lib/security-middleware"

async function createTicketSubscriptionHandler(request: NextRequest, sanitizedData: any) {
  try {
    console.log("🔗 [TICKET-SUBSCRIPTIONS] ===== INICIANDO ASOCIACIÓN =====")
    console.log("   Timestamp:", new Date().toISOString())
    console.log("   IP:", request.headers.get("x-forwarded-for") || "unknown")

    const { ticketCode, subscriptionId, endpoint } = sanitizedData

    console.log("📦 [TICKET-SUBSCRIPTIONS] Datos recibidos:")
    console.log("   TicketCode:", ticketCode)
    console.log("   SubscriptionId:", subscriptionId)
    console.log("   Endpoint:", endpoint?.substring(0, 80) + "...")

    if (!ticketCode || !subscriptionId || !endpoint) {
      console.error("❌ [TICKET-SUBSCRIPTIONS] Datos faltantes:")
      console.error("   TicketCode:", !!ticketCode)
      console.error("   SubscriptionId:", !!subscriptionId)
      console.error("   Endpoint:", !!endpoint)

      return NextResponse.json(
        {
          message: "ticketCode, subscriptionId y endpoint son requeridos",
        },
        { status: 400 },
      )
    }

    const client = await clientPromise
    const db = client.db("parking")

    console.log("🔍 [TICKET-SUBSCRIPTIONS] Conectado a MongoDB")

    // Verificar que el ticket existe
    console.log("🎫 [TICKET-SUBSCRIPTIONS] Verificando ticket...")
    const ticket = await db.collection("tickets").findOne({ codigoTicket: ticketCode })

    console.log("🎫 [TICKET-SUBSCRIPTIONS] Resultado verificación ticket:")
    console.log("   Encontrado:", !!ticket)
    if (ticket) {
      console.log("   ID:", ticket._id)
      console.log("   Estado:", ticket.estado)
      console.log("   Creado:", ticket.fechaCreacion)
    }

    if (!ticket) {
      console.error("❌ [TICKET-SUBSCRIPTIONS] Ticket no encontrado:", ticketCode)
      return NextResponse.json(
        {
          message: "Ticket no encontrado",
        },
        { status: 404 },
      )
    }

    // Verificar que la suscripción existe
    console.log("📱 [TICKET-SUBSCRIPTIONS] Verificando suscripción...")
    const pushSubscription = await db.collection("push_subscriptions").findOne({
      _id: subscriptionId,
    })

    console.log("📱 [TICKET-SUBSCRIPTIONS] Resultado verificación suscripción:")
    console.log("   Encontrada:", !!pushSubscription)
    if (pushSubscription) {
      console.log("   ID:", pushSubscription._id)
      console.log("   Endpoint match:", pushSubscription.endpoint === endpoint)
      console.log("   Activa:", pushSubscription.isActive)
    }

    // Crear documento de asociación ticket-suscripción
    const ticketSubscriptionDoc = {
      ticketCode,
      subscriptionId,
      endpoint,
      createdAt: new Date(),
      isActive: true,
      notificationsSent: 0,
      lastNotificationAt: null,
    }

    console.log("📄 [TICKET-SUBSCRIPTIONS] Documento a crear:")
    console.log("   TicketCode:", ticketSubscriptionDoc.ticketCode)
    console.log("   SubscriptionId:", ticketSubscriptionDoc.subscriptionId)
    console.log("   CreatedAt:", ticketSubscriptionDoc.createdAt)

    // Verificar si ya existe una asociación para este ticket
    console.log("🔍 [TICKET-SUBSCRIPTIONS] Buscando asociación existente...")
    const existingAssociation = await db.collection("ticket_subscriptions").findOne({
      ticketCode: ticketCode,
    })

    console.log("🔍 [TICKET-SUBSCRIPTIONS] Resultado búsqueda asociación:")
    console.log("   Encontrada:", !!existingAssociation)
    if (existingAssociation) {
      console.log("   ID:", existingAssociation._id)
      console.log("   SubscriptionId actual:", existingAssociation.subscriptionId)
      console.log("   Creada:", existingAssociation.createdAt)
      console.log("   Activa:", existingAssociation.isActive)
    }

    if (existingAssociation) {
      console.log("🔄 [TICKET-SUBSCRIPTIONS] Actualizando asociación existente...")

      const updateDoc = {
        ...ticketSubscriptionDoc,
        updatedAt: new Date(),
      }

      const result = await db
        .collection("ticket_subscriptions")
        .updateOne({ ticketCode: ticketCode }, { $set: updateDoc })

      console.log("✅ [TICKET-SUBSCRIPTIONS] Resultado actualización:")
      console.log("   Matched:", result.matchedCount)
      console.log("   Modified:", result.modifiedCount)

      return NextResponse.json({
        message: "Asociación ticket-suscripción actualizada exitosamente",
        associationId: existingAssociation._id,
        updated: true,
        ticketCode,
        subscriptionId,
      })
    } else {
      console.log("➕ [TICKET-SUBSCRIPTIONS] Creando nueva asociación...")

      const result = await db.collection("ticket_subscriptions").insertOne(ticketSubscriptionDoc)

      console.log("✅ [TICKET-SUBSCRIPTIONS] Nueva asociación creada:")
      console.log("   ID:", result.insertedId)
      console.log("   Acknowledged:", result.acknowledged)

      return NextResponse.json({
        message: "Asociación ticket-suscripción creada exitosamente",
        associationId: result.insertedId,
        created: true,
        ticketCode,
        subscriptionId,
      })
    }
  } catch (error) {
    console.error("❌ [TICKET-SUBSCRIPTIONS] Error:", error)
    console.error("   Stack:", error.stack)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return withSecurity(request, createTicketSubscriptionHandler, {
    rateLimitType: "NOTIFICATION",
    requireValidOrigin: true,
    sanitizeBody: true,
    logRequests: true,
  })
}
