"use client"

import { useState, useEffect, useCallback } from "react"

interface PushNotificationState {
  isSupported: boolean
  isSubscribed: boolean
  isLoading: boolean
  error: string | null
  subscription: PushSubscription | null
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: false,
    error: null,
    subscription: null,
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
            error: null,
          }))
        } else {
          setState((prev) => ({
            ...prev,
            isSupported: true,
            error: null,
          }))
        }

        // Handle PWA install prompt
        const handleBeforeInstallPrompt = (e: Event) => {
          const promptEvent = e as BeforeInstallPromptEvent
          promptEvent.preventDefault()
          const installPrompt = () => {
            promptEvent.prompt()
            promptEvent.userChoice.then((choice) => {
              if (choice.outcome === "accepted") {
                console.log("PWA instalado por el usuario")
              }
            })
          }
          window.addEventListener("appinstalled", () => console.log("PWA instalada"))
          // Example: Trigger via UI button or automatically
          // Add a button in NotificationSettings to call installPrompt()
        }
        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
        return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      } catch (error) {
        console.error("Error checking support:", error)
        setState((prev) => ({
          ...prev,
          isSupported: true,
          error: "Error al verificar el soporte de notificaciones",
        }))
      }
    }

    checkSupport()
  }, [])

const subscribe = useCallback(async (userType: string, ticketCode: string) => {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    setState((prev) => ({ ...prev, isSupported: false }));
    return false;
  }

  setState((prev) => ({ ...prev, isLoading: true, error: null }));

  try {
    console.log("Requesting notification permission...");
    const permission = await Notification.requestPermission();
    console.log("Permission result:", permission);
    if (permission !== "granted") {
      throw new Error("Permiso denegado por el usuario");
    }

    console.log("Getting service worker registration...");
    const registration = await navigator.serviceWorker.ready;
    console.log("Service worker ready:", registration);

    console.log("Checking existing subscription...");
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      console.log("Existing subscription found, unsubscribing...");
      await subscription.unsubscribe();
    }

    console.log("Creating new subscription...");
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      throw new Error("VAPID key not configured");
    }
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    console.log("New subscription created:", subscription);

    console.log("Sending subscription to server...");
    const response = await fetch("/api/push-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription, userType, ticketCode }),
    });
    console.log("Server response status:", response.status);
    const result = await response.json();
    console.log("Server response:", result);

    setState((prev) => ({
      ...prev,
      isSubscribed: true,
      isLoading: false,
      subscription,
      error: null,
    }));
    return true;
  } catch (error) {
    console.error("Error subscribing to push notifications:", error);
    setState((prev) => ({
      ...prev,
      isLoading: false,
      error: error instanceof Error ? error.message : "Error al activar notificaciones",
    }));
    return false;
  }
}, []);

const unsubscribe = useCallback(async () => {
  if (!state.subscription) return false;

  setState((prev) => ({ ...prev, isLoading: true, error: null }));

  try {
    console.log("Unsubscribing from push notifications...");
    console.log("Subscription endpoint:", state.subscription.endpoint);
    await state.subscription.unsubscribe();
    console.log("Subscription unsubscribed from client");

    const response = await fetch("/api/push-subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: state.subscription.endpoint }),
    });
    console.log("Server response status:", response.status);
    const result = await response.json();
    console.log("Server response:", result);

    setState((prev) => ({
      ...prev,
      isSubscribed: false,
      isLoading: false,
      subscription: null,
      error: null,
    }));

    return true;
  } catch (error) {
    console.error("Error unsubscribing from push notifications:", error);
    setState((prev) => ({
      ...prev,
      isLoading: false,
      error: error instanceof Error ? error.message : "Error al desactivar notificaciones",
    }));
    return false;
  }
}, [state.subscription]);

  return {
    ...state,
    subscribe,
    unsubscribe,
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