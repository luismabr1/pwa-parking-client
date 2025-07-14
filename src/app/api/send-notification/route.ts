import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import webpush from "web-push"

// Configurar web-push con las claves VAPID
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidEmail = process.env.VAPID_EMAIL || "mailto:admin@parking-pwa.com"

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
  console.log("✅ [SEND-NOTIFICATION] VAPID configurado correctamente")
} else {
  console.error("❌ [SEND-NOTIFICATION] Claves VAPID no configuradas")
  console.error("   VAPID_PUBLIC_KEY:", vapidPublicKey ? "✅ Configurada" : "❌ Faltante")
  console.error("   VAPID_PRIVATE_KEY:", vapidPrivateKey ? "✅ Configurada" : "❌ Faltante")
}

export async function POST(request: Request) {
  try {
    console.log("🔔 [SEND-NOTIFICATION] ===== ENVIANDO NOTIFICACIÓN =====")

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("❌ [SEND-NOTIFICATION] Claves VAPID no configuradas")
      return NextResponse.json({ message: "Servicio de notificaciones no configurado" }, { status: 500 })
    }

    const { type, userType, ticketCode, data } = await request.json()

    console.log("📦 [SEND-NOTIFICATION] Datos recibidos:")
    console.log("   Type:", type)
    console.log("   UserType:", userType)
    console.log("   TicketCode:", ticketCode)
    console.log("   Data:", data)

    const client = await clientPromise
    const db = client.db("parking")

    // Buscar suscripciones activas
    const query: any = { isActive: true }

    if (userType) {
      query.userType = userType
    }

    if (ticketCode && ticketCode !== "TEST-001") {
      query.ticketCode = ticketCode
    }

    console.log("🔍 [SEND-NOTIFICATION] Buscando suscripciones con query:", query)

    const subscriptions = await db.collection("push_subscriptions").find(query).toArray()

    console.log("📱 [SEND-NOTIFICATION] Suscripciones encontradas:", subscriptions.length)

    if (subscriptions.length === 0) {
      console.log("⚠️ [SEND-NOTIFICATION] No hay suscripciones para enviar")
      return NextResponse.json({
        message: "No hay suscripciones activas",
        sent: 0,
        total: 0,
      })
    }

    // Preparar el payload de la notificación
    const notificationPayload: any = {
      title: "Parking PWA",
      body: "Nueva notificación",
      icon: "/logo.png",
      badge: "/logo.png",
      tag: "parking-notification",
      requireInteraction: false,
      silent: false,
      vibrate: [200, 100, 200],
      data: {
        type,
        ticketCode,
        timestamp: new Date().toISOString(),
        ...data,
      },
    }

    // Personalizar según el tipo de notificación
    switch (type) {
      case "test":
        notificationPayload.title = "🧪 Notificación de Prueba"
        notificationPayload.body = "Las notificaciones están funcionando correctamente"
        notificationPayload.tag = "test-notification"
        break

      case "admin_payment":
        notificationPayload.title = "💰 Nuevo Pago Registrado"
        notificationPayload.body = `Pago de ${data?.amount || 0} Bs para ticket ${ticketCode}`
        notificationPayload.tag = "admin-payment"
        notificationPayload.requireInteraction = true
        break

      case "payment_validated":
        notificationPayload.title = "✅ Pago Validado"
        notificationPayload.body = `Tu pago para el ticket ${ticketCode} ha sido validado`
        notificationPayload.tag = "payment-validated"
        break

      case "payment_rejected":
        notificationPayload.title = "❌ Pago Rechazado"
        notificationPayload.body = `Tu pago para el ticket ${ticketCode} ha sido rechazado`
        notificationPayload.tag = "payment-rejected"
        notificationPayload.requireInteraction = true
        break

      default:
        notificationPayload.body = data?.message || "Nueva notificación del sistema"
    }

    console.log("📝 [SEND-NOTIFICATION] Payload preparado:", notificationPayload)

    // Enviar notificaciones
    let sentCount = 0
    const failedSubscriptions: string[] = []

    for (const subscription of subscriptions) {
      try {
        console.log(`📤 [SEND-NOTIFICATION] Enviando a: ${subscription.endpoint.substring(0, 50)}...`)

        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: subscription.keys,
          },
          JSON.stringify(notificationPayload),
        )

        sentCount++
        console.log(`✅ [SEND-NOTIFICATION] Enviada exitosamente`)
      } catch (error) {
        console.error(`❌ [SEND-NOTIFICATION] Error enviando a ${subscription.endpoint.substring(0, 50)}:`, error)
        failedSubscriptions.push(subscription.endpoint)

        // Si la suscripción es inválida, marcarla como inactiva
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(
            `🗑️ [SEND-NOTIFICATION] Marcando suscripción como inactiva: ${subscription.endpoint.substring(0, 50)}`,
          )
          await db
            .collection("push_subscriptions")
            .updateOne({ endpoint: subscription.endpoint }, { $set: { isActive: false, deactivatedAt: new Date() } })
        }
      }
    }

    console.log("🎉 [SEND-NOTIFICATION] ===== RESUMEN =====")
    console.log(`   Total suscripciones: ${subscriptions.length}`)
    console.log(`   Enviadas exitosamente: ${sentCount}`)
    console.log(`   Fallidas: ${failedSubscriptions.length}`)

    return NextResponse.json({
      message: `Notificaciones enviadas: ${sentCount}/${subscriptions.length}`,
      sent: sentCount,
      total: subscriptions.length,
      failed: failedSubscriptions.length,
      type,
      userType,
      ticketCode,
    })
  } catch (error) {
    console.error("❌ [SEND-NOTIFICATION] Error general:", error)
    return NextResponse.json({ message: "Error enviando notificaciones" }, { status: 500 })
  }
}
