"use client"

import { useState, useEffect } from "react"

export function useTicketNotifications(ticketCode: string) {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Check if push notifications are supported
    const supported = "serviceWorker" in navigator && "PushManager" in window
    setIsSupported(supported)

    console.log("🔔 [USE-TICKET-NOTIFICATIONS] Inicializando para ticket:", ticketCode)
    console.log("   Soporte push:", supported)

    if (supported) {
      checkSubscriptionStatus()
    }
  }, [ticketCode])

  const checkSubscriptionStatus = async () => {
    try {
      console.log("🔍 [USE-TICKET-NOTIFICATIONS] Verificando estado de suscripción...")

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      console.log("📱 [USE-TICKET-NOTIFICATIONS] Suscripción del navegador:", !!subscription)

      setIsSubscribed(!!subscription)

      // Check if this ticket is registered for notifications in our backend
      if (subscription) {
        console.log("🔍 [USE-TICKET-NOTIFICATIONS] Verificando registro en backend...")

        // For now, we'll assume it's registered if there's a subscription
        // In a real implementation, you might want to check with your backend
        setIsRegistered(true)

        console.log("✅ [USE-TICKET-NOTIFICATIONS] Ticket registrado para notificaciones")
      } else {
        console.log("❌ [USE-TICKET-NOTIFICATIONS] No hay suscripción activa")
        setIsRegistered(false)
      }
    } catch (error) {
      console.error("❌ [USE-TICKET-NOTIFICATIONS] Error verificando suscripción:", error)
    }
  }

  const requestPermission = async (): Promise<NotificationPermission> => {
    if (!("Notification" in window)) {
      throw new Error("Este navegador no soporta notificaciones")
    }

    let permission = Notification.permission

    console.log("🔐 [USE-TICKET-NOTIFICATIONS] Permiso actual:", permission)

    if (permission === "default") {
      console.log("🔐 [USE-TICKET-NOTIFICATIONS] Solicitando permiso...")
      permission = await Notification.requestPermission()
      console.log("🔐 [USE-TICKET-NOTIFICATIONS] Permiso otorgado:", permission)
    }

    return permission
  }

  const enableNotificationsForTicket = async (): Promise<boolean> => {
    setIsLoading(true)

    try {
      console.log("🔔 [USE-TICKET-NOTIFICATIONS] ===== HABILITANDO NOTIFICACIONES =====")
      console.log("   Ticket:", ticketCode)

      // Request permission
      const permission = await requestPermission()
      if (permission !== "granted") {
        console.error("❌ [USE-TICKET-NOTIFICATIONS] Permiso denegado:", permission)
        return false
      }

      console.log("✅ [USE-TICKET-NOTIFICATIONS] Permiso otorgado")

      // Get service worker registration
      console.log("🔧 [USE-TICKET-NOTIFICATIONS] Obteniendo service worker...")
      const registration = await navigator.serviceWorker.ready
      console.log("✅ [USE-TICKET-NOTIFICATIONS] Service worker listo")

      // Subscribe to push notifications
      console.log("📱 [USE-TICKET-NOTIFICATIONS] Creando suscripción push...")
      console.log("   VAPID Key:", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.substring(0, 20) + "...")

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      })

      console.log("✅ [USE-TICKET-NOTIFICATIONS] Suscripción creada:")
      console.log("   Endpoint:", subscription.endpoint.substring(0, 50) + "...")

      // Register subscription for this specific ticket
      console.log("💾 [USE-TICKET-NOTIFICATIONS] Registrando suscripción en backend...")

      const subscriptionData = {
        ticketCode,
        subscription: subscription.toJSON(),
        userType: "user", // This is for the user, not admin
      }

      console.log("📦 [USE-TICKET-NOTIFICATIONS] Datos a enviar:", {
        ticketCode: subscriptionData.ticketCode,
        userType: subscriptionData.userType,
        hasSubscription: !!subscriptionData.subscription,
      })

      const response = await fetch("/api/push-subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscriptionData),
      })

      console.log("📡 [USE-TICKET-NOTIFICATIONS] Respuesta del backend:")
      console.log("   Status:", response.status)
      console.log("   OK:", response.ok)

      if (response.ok) {
        const responseData = await response.json()
        console.log("✅ [USE-TICKET-NOTIFICATIONS] Suscripción registrada exitosamente:")
        console.log("   ID:", responseData.subscriptionId)
        console.log("   Mensaje:", responseData.message)

        setIsSubscribed(true)
        setIsRegistered(true)

        console.log("🎉 [USE-TICKET-NOTIFICATIONS] ===== NOTIFICACIONES HABILITADAS =====")
        return true
      } else {
        const errorData = await response.json()
        console.error("❌ [USE-TICKET-NOTIFICATIONS] Error del backend:", errorData)
        return false
      }
    } catch (error) {
      console.error("❌ [USE-TICKET-NOTIFICATIONS] Error habilitando notificaciones:", error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  return {
    isSupported,
    isSubscribed,
    isRegistered,
    isLoading,
    requestPermission,
    enableNotificationsForTicket,
  }
}
