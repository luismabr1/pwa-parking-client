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

    console.log("🔔 [USE-TICKET-NOTIFICATIONS] ===== INICIALIZANDO =====")
    console.log("   Ticket:", ticketCode)
    console.log("   Soporte push:", supported)
    console.log("   Timestamp:", new Date().toISOString())

    if (supported && ticketCode) {
      checkTicketSubscriptionStatus()
    }
  }, [ticketCode])

  const checkTicketSubscriptionStatus = async () => {
    try {
      console.log("🔍 [USE-TICKET-NOTIFICATIONS] ===== VERIFICANDO ESTADO =====")
      console.log("   Ticket:", ticketCode)
      console.log("   Timestamp:", new Date().toISOString())

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      console.log("📱 [USE-TICKET-NOTIFICATIONS] Estado del navegador:")
      console.log("   Tiene suscripción:", !!subscription)
      if (subscription) {
        console.log("   Endpoint:", subscription.endpoint.substring(0, 50) + "...")
      }

      setIsSubscribed(!!subscription)

      // Check if this specific ticket is registered for notifications in our backend
      if (subscription && ticketCode) {
        console.log("🔍 [USE-TICKET-NOTIFICATIONS] Verificando registro específico del ticket...")
        console.log("   URL:", `/api/ticket-subscriptions/${ticketCode}`)

        try {
          const response = await fetch(`/api/ticket-subscriptions/${ticketCode}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          })

          console.log("📡 [USE-TICKET-NOTIFICATIONS] Respuesta del servidor:")
          console.log("   Status:", response.status)
          console.log("   OK:", response.ok)

          if (response.ok) {
            const data = await response.json()
            console.log("✅ [USE-TICKET-NOTIFICATIONS] Datos recibidos:", data)
            setIsRegistered(data.isRegistered || false)

            if (data.isRegistered) {
              console.log("🎯 [USE-TICKET-NOTIFICATIONS] Ticket YA REGISTRADO:")
              console.log("   ID Asociación:", data.associationId)
              console.log("   Creado:", data.createdAt)
              console.log("   Notificaciones enviadas:", data.notificationsSent)
            }
          } else {
            console.log("❌ [USE-TICKET-NOTIFICATIONS] Error del servidor:", response.status)
            const errorText = await response.text()
            console.log("   Error:", errorText)
            setIsRegistered(false)
          }
        } catch (error) {
          console.error("❌ [USE-TICKET-NOTIFICATIONS] Error en fetch:", error)
          setIsRegistered(false)
        }
      } else {
        console.log("❌ [USE-TICKET-NOTIFICATIONS] Condiciones no cumplidas:")
        console.log("   Tiene suscripción:", !!subscription)
        console.log("   Tiene ticketCode:", !!ticketCode)
        setIsRegistered(false)
      }
    } catch (error) {
      console.error("❌ [USE-TICKET-NOTIFICATIONS] Error general:", error)
    }
  }

  const requestPermission = async (): Promise<NotificationPermission> => {
    if (!("Notification" in window)) {
      throw new Error("Este navegador no soporta notificaciones")
    }

    let permission = Notification.permission

    console.log("🔐 [USE-TICKET-NOTIFICATIONS] ===== SOLICITANDO PERMISOS =====")
    console.log("   Permiso actual:", permission)
    console.log("   Timestamp:", new Date().toISOString())

    if (permission === "default") {
      console.log("🔐 [USE-TICKET-NOTIFICATIONS] Mostrando diálogo de permisos...")
      permission = await Notification.requestPermission()
      console.log("🔐 [USE-TICKET-NOTIFICATIONS] Resultado:", permission)
    }

    return permission
  }

  const enableNotificationsForTicket = async (): Promise<boolean> => {
    setIsLoading(true)

    try {
      console.log("🔔 [USE-TICKET-NOTIFICATIONS] ===== HABILITANDO NOTIFICACIONES =====")
      console.log("   Ticket:", ticketCode)
      console.log("   Timestamp:", new Date().toISOString())

      if (!ticketCode) {
        console.error("❌ [USE-TICKET-NOTIFICATIONS] No hay código de ticket")
        return false
      }

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

      // Get or create push subscription
      console.log("📱 [USE-TICKET-NOTIFICATIONS] Gestionando suscripción push...")
      let subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        console.log("📱 [USE-TICKET-NOTIFICATIONS] Creando NUEVA suscripción push...")
        console.log("   VAPID Key:", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.substring(0, 20) + "...")

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        })

        console.log("✅ [USE-TICKET-NOTIFICATIONS] Nueva suscripción creada")
      } else {
        console.log("✅ [USE-TICKET-NOTIFICATIONS] Usando suscripción EXISTENTE")
      }

      console.log("📱 [USE-TICKET-NOTIFICATIONS] Detalles de la suscripción:")
      console.log("   Endpoint:", subscription.endpoint.substring(0, 80) + "...")
      console.log("   Keys p256dh:", subscription.toJSON().keys?.p256dh?.substring(0, 20) + "...")
      console.log("   Keys auth:", subscription.toJSON().keys?.auth?.substring(0, 10) + "...")

      // PASO 1: Registrar/actualizar la suscripción push general
      console.log("💾 [USE-TICKET-NOTIFICATIONS] ===== PASO 1: REGISTRANDO PUSH SUBSCRIPTION =====")

      const subscriptionData = {
        ticketCode,
        subscription: subscription.toJSON(),
        userType: "user",
      }

      console.log("📦 [USE-TICKET-NOTIFICATIONS] Datos para push-subscriptions:")
      console.log("   TicketCode:", subscriptionData.ticketCode)
      console.log("   UserType:", subscriptionData.userType)
      console.log("   Endpoint:", subscriptionData.subscription.endpoint?.substring(0, 50) + "...")

      const pushResponse = await fetch("/api/push-subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscriptionData),
      })

      console.log("📡 [USE-TICKET-NOTIFICATIONS] Respuesta push-subscriptions:")
      console.log("   Status:", pushResponse.status)
      console.log("   OK:", pushResponse.ok)
      console.log("   Headers:", Object.fromEntries(pushResponse.headers.entries()))

      if (!pushResponse.ok) {
        const errorText = await pushResponse.text()
        console.error("❌ [USE-TICKET-NOTIFICATIONS] Error registrando push subscription:")
        console.error("   Status:", pushResponse.status)
        console.error("   Error:", errorText)
        return false
      }

      const pushData = await pushResponse.json()
      console.log("✅ [USE-TICKET-NOTIFICATIONS] Push subscription registrada:")
      console.log("   Respuesta completa:", pushData)

      // PASO 2: Crear la asociación ticket-suscripción
      console.log("🔗 [USE-TICKET-NOTIFICATIONS] ===== PASO 2: CREANDO ASOCIACIÓN TICKET =====")

      const ticketSubData = {
        ticketCode,
        subscriptionId: pushData.subscriptionId || pushData._id,
        endpoint: subscription.endpoint,
      }

      console.log("📦 [USE-TICKET-NOTIFICATIONS] Datos para ticket-subscriptions:")
      console.log("   TicketCode:", ticketSubData.ticketCode)
      console.log("   SubscriptionId:", ticketSubData.subscriptionId)
      console.log("   Endpoint:", ticketSubData.endpoint?.substring(0, 50) + "...")

      const ticketSubResponse = await fetch("/api/ticket-subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ticketSubData),
      })

      console.log("📡 [USE-TICKET-NOTIFICATIONS] Respuesta ticket-subscriptions:")
      console.log("   Status:", ticketSubResponse.status)
      console.log("   OK:", ticketSubResponse.ok)
      console.log("   Headers:", Object.fromEntries(ticketSubResponse.headers.entries()))

      if (ticketSubResponse.ok) {
        const ticketSubResponseData = await ticketSubResponse.json()
        console.log("✅ [USE-TICKET-NOTIFICATIONS] Asociación ticket-suscripción:")
        console.log("   Respuesta completa:", ticketSubResponseData)

        setIsSubscribed(true)
        setIsRegistered(true)

        console.log("🎉 [USE-TICKET-NOTIFICATIONS] ===== PROCESO COMPLETADO EXITOSAMENTE =====")
        console.log("   Ticket:", ticketCode)
        console.log("   Timestamp final:", new Date().toISOString())
        return true
      } else {
        const errorText = await ticketSubResponse.text()
        console.error("❌ [USE-TICKET-NOTIFICATIONS] Error creando asociación:")
        console.error("   Status:", ticketSubResponse.status)
        console.error("   Error:", errorText)
        return false
      }
    } catch (error) {
      console.error("❌ [USE-TICKET-NOTIFICATIONS] Error general:", error)
      console.error("   Stack:", error.stack)
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
