import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export async function POST(request: Request) {
  try {
    console.log("📱 [PUSH-SUBSCRIPTIONS] ===== REGISTRANDO SUSCRIPCIÓN =====")

    const { subscription, userType, ticketCode } = await request.json()

    console.log("📦 [PUSH-SUBSCRIPTIONS] Datos recibidos:")
    console.log("   UserType:", userType)
    console.log("   TicketCode:", ticketCode)
    console.log("   Subscription endpoint:", subscription?.endpoint?.substring(0, 50) + "...")

    if (!subscription || !userType) {
      return NextResponse.json({ message: "Suscripción y tipo de usuario son requeridos" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("parking")

    // Crear documento de suscripción
    const subscriptionDoc = {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userType,
      ticketCode: ticketCode || null,
      createdAt: new Date(),
      isActive: true,
    }

    console.log("💾 [PUSH-SUBSCRIPTIONS] Guardando en base de datos...")

    // Verificar si ya existe una suscripción con el mismo endpoint
    const existingSubscription = await db.collection("push_subscriptions").findOne({
      endpoint: subscription.endpoint,
    })

    if (existingSubscription) {
      console.log("🔄 [PUSH-SUBSCRIPTIONS] Actualizando suscripción existente")

      const result = await db.collection("push_subscriptions").updateOne(
        { endpoint: subscription.endpoint },
        {
          $set: {
            ...subscriptionDoc,
            updatedAt: new Date(),
          },
        },
      )

      console.log("✅ [PUSH-SUBSCRIPTIONS] Suscripción actualizada:", result.modifiedCount)

      return NextResponse.json({
        message: "Suscripción actualizada exitosamente",
        subscriptionId: existingSubscription._id,
        updated: true,
      })
    } else {
      console.log("➕ [PUSH-SUBSCRIPTIONS] Creando nueva suscripción")

      const result = await db.collection("push_subscriptions").insertOne(subscriptionDoc)

      console.log("✅ [PUSH-SUBSCRIPTIONS] Nueva suscripción creada:", result.insertedId)

      return NextResponse.json({
        message: "Suscripción registrada exitosamente",
        subscriptionId: result.insertedId,
        created: true,
      })
    }
  } catch (error) {
    console.error("❌ [PUSH-SUBSCRIPTIONS] Error:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    console.log("🗑️ [PUSH-SUBSCRIPTIONS] ===== ELIMINANDO SUSCRIPCIÓN =====")

    const { endpoint } = await request.json()

    if (!endpoint) {
      return NextResponse.json({ message: "Endpoint es requerido" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("parking")

    const result = await db.collection("push_subscriptions").deleteOne({ endpoint })

    console.log("✅ [PUSH-SUBSCRIPTIONS] Suscripción eliminada:", result.deletedCount)

    return NextResponse.json({
      message: "Suscripción eliminada exitosamente",
      deleted: result.deletedCount > 0,
    })
  } catch (error) {
    console.error("❌ [PUSH-SUBSCRIPTIONS] Error eliminando:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
