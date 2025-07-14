"use client"

import { useState, useEffect, useCallback } from "react"

interface PushNotificationState {
  isSupported: boolean
  isSubscribed: boolean
  isLoading: boolean
  error: string | null
  subscription: PushSubscription | null
  permissionState: NotificationPermission
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: false,
    error: null,
    subscription: null,
    permissionState: "default",
  })

  // Check if push notifications are supported and handle PWA install prompt
  useEffect(() => {
    const checkSupport = async () => {
      if (typeof window === "undefined") return

      const isSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window

      if (!isSupported) {
        setState((prev) => ({
          ...prev,
          isSupported: false,
          error: "Las notificaciones push no son compatibles con este navegador",
        }))
        return
      }

      // Get current permission state
      const currentPermission = Notification.permission
      console.log("🔐 [USE-PUSH-NOTIFICATIONS] Estado actual de permisos:", currentPermission)

      try {
        await navigator.serviceWorker.ready

        const registration = await navigator.serviceWorker.getRegistration()
        if (registration) {
          const existingSubscription = await registration.pushManager.getSubscription()
          setState((prev) => ({
            ...prev,
            isSupported: true,
            isSubscribed: !!existingSubscription,
            subscription: existingSubscription,
            permissionState: currentPermission,
            error: null,
          }))
        } else {
          setState((prev) => ({
            ...prev,
            isSupported: true,
            permissionState: currentPermission,
            error: null,
          }))
        }
      } catch (error) {
        console.error("Error checking support:", error)
        setState((prev) => ({
          ...prev,
          isSupported: true,
          permissionState: currentPermission,
          error: "Error al verificar el soporte de notificaciones",
        }))
      }
    }

    checkSupport()
  }, [])

  const subscribe = useCallback(async (userType: string, ticketCode: string) => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState((prev) => ({
        ...prev,
        isSupported: false,
        error: "Tu navegador no soporta notificaciones push",
      }))
      return false
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      console.log("🔐 [USE-PUSH-NOTIFICATIONS] Solicitando permisos de notificación...")
      console.log("   Estado actual:", Notification.permission)

      // Check current permission state
      let permission = Notification.permission

      if (permission === "denied") {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          permissionState: "denied",
          error:
            "Los permisos de notificación están bloqueados. Para activarlos:\n\n1. Haz clic en el ícono de candado/información en la barra de direcciones\n2. Cambia 'Notificaciones' a 'Permitir'\n3. Recarga la página e intenta de nuevo",
        }))
        return false
      }

      if (permission === "default") {
        console.log("🔐 [USE-PUSH-NOTIFICATIONS] Solicitando permiso al usuario...")
        permission = await Notification.requestPermission()
        console.log("🔐 [USE-PUSH-NOTIFICATIONS] Respuesta del usuario:", permission)
      }

      if (permission !== "granted") {
        let errorMessage = "Permisos de notificación denegados."

        if (permission === "denied") {
          errorMessage =
            "Los permisos fueron denegados. Para activar las notificaciones:\n\n1. Haz clic en el ícono de candado en la barra de direcciones\n2. Cambia 'Notificaciones' a 'Permitir'\n3. Recarga la página e intenta de nuevo"
        } else if (permission === "default") {
          errorMessage =
            "No se pudo obtener permiso para notificaciones. Intenta de nuevo o verifica la configuración de tu navegador."
        }

        setState((prev) => ({
          ...prev,
          isLoading: false,
          permissionState: permission,
          error: errorMessage,
        }))
        return false
      }

      console.log("✅ [USE-PUSH-NOTIFICATIONS] Permisos otorgados")

      console.log("🔧 [USE-PUSH-NOTIFICATIONS] Obteniendo service worker...")
      const registration = await navigator.serviceWorker.ready
      console.log("✅ [USE-PUSH-NOTIFICATIONS] Service worker listo")

      // Check for existing subscription and unsubscribe if exists
      console.log("🔍 [USE-PUSH-NOTIFICATIONS] Verificando suscripción existente...")
      let subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        console.log("🗑️ [USE-PUSH-NOTIFICATIONS] Eliminando suscripción existente...")
        await subscription.unsubscribe()
      }

      console.log("📱 [USE-PUSH-NOTIFICATIONS] Creando nueva suscripción...")
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        throw new Error("Clave VAPID no configurada en el servidor")
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      console.log("✅ [USE-PUSH-NOTIFICATIONS] Suscripción creada")

      console.log("💾 [USE-PUSH-NOTIFICATIONS] Enviando suscripción al servidor...")
      const response = await fetch("/api/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription, userType, ticketCode }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Error del servidor al registrar la suscripción")
      }

      const result = await response.json()
      console.log("✅ [USE-PUSH-NOTIFICATIONS] Suscripción registrada:", result)

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
        subscription,
        permissionState: permission,
        error: null,
      }))
      return true
    } catch (error) {
      console.error("❌ [USE-PUSH-NOTIFICATIONS] Error en suscripción:", error)

      let errorMessage = "Error al activar notificaciones"
      if (error instanceof Error) {
        if (error.message.includes("VAPID")) {
          errorMessage = "Error de configuración del servidor. Contacta al administrador."
        } else if (error.message.includes("denied")) {
          errorMessage = "Permisos denegados. Verifica la configuración de notificaciones en tu navegador."
        } else {
          errorMessage = error.message
        }
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }))
      return false
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    if (!state.subscription) return false

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      console.log("🗑️ [USE-PUSH-NOTIFICATIONS] Desuscribiendo...")
      await state.subscription.unsubscribe()

      const response = await fetch("/api/push-subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: state.subscription.endpoint }),
      })

      if (!response.ok) {
        console.warn("⚠️ [USE-PUSH-NOTIFICATIONS] Error eliminando del servidor, pero desuscripción local exitosa")
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
        subscription: null,
        error: null,
      }))

      return true
    } catch (error) {
      console.error("❌ [USE-PUSH-NOTIFICATIONS] Error desuscribiendo:", error)
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Error al desactivar notificaciones",
      }))
      return false
    }
  }, [state.subscription])

  const resetPermissions = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      // Clear any existing subscription
      if (state.subscription) {
        await state.subscription.unsubscribe()
      }

      // Reset state
      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
        subscription: null,
        permissionState: Notification.permission,
        error: null,
      }))

      return true
    } catch (error) {
      console.error("❌ [USE-PUSH-NOTIFICATIONS] Error reseteando:", error)
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Error al resetear permisos",
      }))
      return false
    }
  }, [state.subscription])

  return {
    ...state,
    subscribe,
    unsubscribe,
    resetPermissions,
  }
}

// Utility function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Type definition for BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  preventDefault: () => void
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}
