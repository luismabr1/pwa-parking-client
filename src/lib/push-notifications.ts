import clientPromise from "@/lib/mongodb"

interface DeviceSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

interface PaymentContext {
  paymentId: string
  paymentType: string
  amount: number
  plate?: string | null
  clientIP: string
  userAgent: string
}

/**
 * Guarda una suscripción de dispositivo asociada a un ticket y pago específico
 * para enviar notificaciones push relacionadas con el estado del pago
 */
export async function saveDeviceSubscription(
  deviceSubscription: DeviceSubscriptionData,
  ticketCode: string,
  context: PaymentContext,
): Promise<void> {
  try {
    console.log("📱 [PUSH-NOTIFICATIONS] ===== GUARDANDO SUSCRIPCIÓN DE DISPOSITIVO =====")
    console.log("   Ticket Code:", ticketCode)
    console.log("   Payment ID:", context.paymentId)
    console.log("   Payment Type:", context.paymentType)
    console.log("   Amount:", context.amount)
    console.log("   Plate:", context.plate || "N/A")

    if (!deviceSubscription || !deviceSubscription.endpoint || !deviceSubscription.keys) {
      console.error("❌ [PUSH-NOTIFICATIONS] Datos de suscripción inválidos")
      throw new Error("Datos de suscripción de dispositivo inválidos")
    }

    const client = await clientPromise
    const db = client.db("parking")

    // Verificar si ya existe una suscripción con este endpoint
    console.log("🔍 [PUSH-NOTIFICATIONS] Verificando suscripción existente...")
    const existingSubscription = await db.collection("push_subscriptions").findOne({
      endpoint: deviceSubscription.endpoint,
    })

    const subscriptionDoc = {
      endpoint: deviceSubscription.endpoint,
      keys: {
        p256dh: deviceSubscription.keys.p256dh,
        auth: deviceSubscription.keys.auth,
      },
      userType: "user", // Usuario que realizó el pago
      ticketCode: ticketCode,
      paymentId: context.paymentId,
      paymentType: context.paymentType,
      amount: context.amount,
      plate: context.plate,
      clientIP: context.clientIP,
      userAgent: context.userAgent,
      createdAt: new Date(),
      isActive: true,
      context: "payment_notification", // Contexto específico para notificaciones de pago
    }

    if (existingSubscription) {
      console.log("🔄 [PUSH-NOTIFICATIONS] Actualizando suscripción existente...")

      // Actualizar con nueva información del pago
      const ticketCodes = existingSubscription.ticketCodes || []
      if (ticketCode && !ticketCodes.includes(ticketCode)) {
        ticketCodes.push(ticketCode)
      }

      const paymentIds = existingSubscription.paymentIds || []
      if (context.paymentId && !paymentIds.includes(context.paymentId)) {
        paymentIds.push(context.paymentId)
      }

      const updateDoc = {
        ...subscriptionDoc,
        ticketCodes,
        paymentIds,
        updatedAt: new Date(),
        lastUsed: new Date(),
      }

      const result = await db
        .collection("push_subscriptions")
        .updateOne({ endpoint: deviceSubscription.endpoint }, { $set: updateDoc })

      console.log("✅ [PUSH-NOTIFICATIONS] Suscripción actualizada:")
      console.log("   Matched:", result.matchedCount)
      console.log("   Modified:", result.modifiedCount)
      console.log("   Ticket Codes:", updateDoc.ticketCodes)
      console.log("   Payment IDs:", updateDoc.paymentIds)
    } else {
      console.log("➕ [PUSH-NOTIFICATIONS] Creando nueva suscripción...")

      // Para nueva suscripción, inicializar arrays
      subscriptionDoc.ticketCodes = [ticketCode]
      subscriptionDoc.paymentIds = [context.paymentId]

      const result = await db.collection("push_subscriptions").insertOne(subscriptionDoc)

      console.log("✅ [PUSH-NOTIFICATIONS] Nueva suscripción creada:")
      console.log("   ID:", result.insertedId)
      console.log("   Acknowledged:", result.acknowledged)
      console.log("   Ticket Codes:", subscriptionDoc.ticketCodes)
      console.log("   Payment IDs:", subscriptionDoc.paymentIds)
    }

    console.log("🎉 [PUSH-NOTIFICATIONS] Suscripción de dispositivo guardada exitosamente")
  } catch (error) {
    console.error("❌ [PUSH-NOTIFICATIONS] Error guardando suscripción de dispositivo:", error)
    console.error("   Stack:", error.stack)
    throw new Error(`Error al guardar suscripción de dispositivo: ${error.message}`)
  }
}

/**
 * Obtiene todas las suscripciones activas para un ticket específico
 */
export async function getSubscriptionsForTicket(ticketCode: string): Promise<any[]> {
  try {
    const client = await clientPromise
    const db = client.db("parking")

    const subscriptions = await db
      .collection("push_subscriptions")
      .find({
        $or: [{ ticketCode: ticketCode }, { ticketCodes: { $in: [ticketCode] } }],
        isActive: true,
      })
      .toArray()

    return subscriptions
  } catch (error) {
    console.error("❌ [PUSH-NOTIFICATIONS] Error obteniendo suscripciones para ticket:", error)
    return []
  }
}

/**
 * Desactiva todas las suscripciones asociadas a un ticket
 */
export async function deactivateSubscriptionsForTicket(ticketCode: string): Promise<void> {
  try {
    const client = await clientPromise
    const db = client.db("parking")

    const result = await db.collection("push_subscriptions").updateMany(
      {
        $or: [{ ticketCode: ticketCode }, { ticketCodes: { $in: [ticketCode] } }],
      },
      {
        $set: {
          isActive: false,
          deactivatedAt: new Date(),
          deactivationReason: "ticket_completed",
        },
      },
    )

    console.log(`🗑️ [PUSH-NOTIFICATIONS] Desactivadas ${result.modifiedCount} suscripciones para ticket ${ticketCode}`)
  } catch (error) {
    console.error("❌ [PUSH-NOTIFICATIONS] Error desactivando suscripciones:", error)
  }
}
