import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { withSecurity } from "@/lib/security-middleware"

async function createPushSubscriptionHandler(request: NextRequest, sanitizedData: any) {
  try {
    console.log("📱 [PUSH-SUBSCRIPTIONS] ===== INICIANDO REGISTRO =====")
    console.log("   Timestamp:", new Date().toISOString())
    console.log("   IP:", request.headers.get("x-forwarded-for") || "unknown")

    const { subscription, userType, ticketCode } = sanitizedData

    console.log("📦 [PUSH-SUBSCRIPTIONS] Datos recibidos:")
    console.log("   UserType:", userType)
    console.log("   TicketCode:", ticketCode)
    console.log("   Subscription endpoint:", subscription?.endpoint?.substring(0, 80) + "...")
    console.log("   Subscription keys:", {
      hasP256dh: !!subscription?.keys?.p256dh,
      hasAuth: !!subscription?.keys?.auth,
      p256dhLength: subscription?.keys?.p256dh?.length,
      authLength: subscription?.keys?.auth?.length,
    })

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      console.error("❌ [PUSH-SUBSCRIPTIONS] Datos de suscripción inválidos")
      return NextResponse.json(
        {
          message: "Datos de suscripción inválidos",
        },
        { status: 400 },
      )
    }

    const client = await clientPromise
    const db = client.db("parking")

    console.log("🔍 [PUSH-SUBSCRIPTIONS] Conectado a MongoDB")

    // Verificar si ya existe una suscripción con este endpoint
    console.log("🔍 [PUSH-SUBSCRIPTIONS] Buscando suscripción existente...")
    const existingSubscription = await db.collection("push_subscriptions").findOne({
      endpoint: subscription.endpoint,
    })

    console.log("🔍 [PUSH-SUBSCRIPTIONS] Resultado búsqueda:")
    console.log("   Encontrada:", !!existingSubscription)
    if (existingSubscription) {
      console.log("   ID existente:", existingSubscription._id)
      console.log("   Creada:", existingSubscription.createdAt)
      console.log("   TicketCodes actuales:", existingSubscription.ticketCodes || [])
    }

    const subscriptionDoc = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      userType: userType || "user",
      ticketCode: ticketCode || null,
      createdAt: new Date(),
      isActive: true,
    }

    console.log("📄 [PUSH-SUBSCRIPTIONS] Documento a guardar:")
    console.log("   Endpoint:", subscriptionDoc.endpoint.substring(0, 50) + "...")
    console.log("   UserType:", subscriptionDoc.userType)
    console.log("   TicketCode:", subscriptionDoc.ticketCode)
    console.log("   CreatedAt:", subscriptionDoc.createdAt)

    if (existingSubscription) {
      console.log("🔄 [PUSH-SUBSCRIPTIONS] Actualizando suscripción existente...")

      // Actualizar ticketCodes si es necesario
      const ticketCodes = existingSubscription.ticketCodes || []
      if (ticketCode && !ticketCodes.includes(ticketCode)) {
        ticketCodes.push(ticketCode)
        console.log("➕ [PUSH-SUBSCRIPTIONS] Agregando nuevo ticketCode:", ticketCode)
      }

      const updateDoc = {
        ...subscriptionDoc,
        ticketCodes,
        updatedAt: new Date(),
        lastUsed: new Date(),
      }

      console.log("📝 [PUSH-SUBSCRIPTIONS] Datos de actualización:")
      console.log("   TicketCodes finales:", updateDoc.ticketCodes)

      const result = await db
        .collection("push_subscriptions")
        .updateOne({ endpoint: subscription.endpoint }, { $set: updateDoc })

      console.log("✅ [PUSH-SUBSCRIPTIONS] Resultado actualización:")
      console.log("   Matched:", result.matchedCount)
      console.log("   Modified:", result.modifiedCount)

      return NextResponse.json({
        message: "Suscripción actualizada exitosamente",
        subscriptionId: existingSubscription._id,
        updated: true,
        ticketCodes: updateDoc.ticketCodes,
      })
    } else {
      console.log("➕ [PUSH-SUBSCRIPTIONS] Creando nueva suscripción...")

      // Para nueva suscripción, inicializar ticketCodes
      if (ticketCode) {
        subscriptionDoc.ticketCodes = [ticketCode]
        console.log("📝 [PUSH-SUBSCRIPTIONS] TicketCodes iniciales:", subscriptionDoc.ticketCodes)
      }

      const result = await db.collection("push_subscriptions").insertOne(subscriptionDoc)

      console.log("✅ [PUSH-SUBSCRIPTIONS] Nueva suscripción creada:")
      console.log("   ID:", result.insertedId)
      console.log("   Acknowledged:", result.acknowledged)

      return NextResponse.json({
        message: "Suscripción creada exitosamente",
        subscriptionId: result.insertedId,
        created: true,
        ticketCodes: subscriptionDoc.ticketCodes || [],
      })
    }
  } catch (error) {
    console.error("❌ [PUSH-SUBSCRIPTIONS] Error:", error)
    console.error("   Stack:", error.stack)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return withSecurity(request, createPushSubscriptionHandler, {
    rateLimitType: "NOTIFICATION",
    requireValidOrigin: true,
    sanitizeBody: true,
    logRequests: true,
  })
}
