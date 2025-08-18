"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X, Download, Smartphone } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    console.log("PWAInstallPrompt: useEffect running")

    // Detectar iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(isIOSDevice)
    console.log("PWAInstallPrompt: isIOSDevice =", isIOSDevice)

    // Check if app is already installed
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsInstalled(true)
      console.log("PWAInstallPrompt: App is already installed.")
      return
    }

    // Check if user has already dismissed the install prompt permanently
    const hasBeenDismissed = localStorage.getItem("pwa-install-dismissed")
    if (hasBeenDismissed) {
      console.log("PWAInstallPrompt: Install prompt has been permanently dismissed.")
      return
    }

    // Listen for the beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      console.log("PWAInstallPrompt: beforeinstallprompt event fired.")
      // Show banner after a short delay for Android
      setTimeout(() => {
        setShowBanner(true)
        console.log("PWAInstallPrompt: Android banner shown.")
      }, 3000)
    }

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowBanner(false)
      setDeferredPrompt(null)
      localStorage.removeItem("pwa-install-dismissed")
      console.log("PWAInstallPrompt: App installed event fired.")
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    // For iOS, show banner after a delay
    if (isIOSDevice) {
      console.log("PWAInstallPrompt: iOS device detected. Scheduling banner show.")
      const timer = setTimeout(() => {
        setShowBanner(true)
        console.log("PWAInstallPrompt: iOS banner shown after delay.")
      }, 8000) // Show after 8 seconds
      return () => clearTimeout(timer)
    }

    // For Android devices, if no beforeinstallprompt event after 10 seconds,
    // check if it's a compatible browser and show manual instructions
    if (!isIOSDevice) {
      const fallbackTimer = setTimeout(() => {
        if (!deferredPrompt && "serviceWorker" in navigator) {
          console.log("PWAInstallPrompt: No beforeinstallprompt event, showing fallback for Android.")
          setShowBanner(true)
        }
      }, 10000)

      return () => {
        clearTimeout(fallbackTimer)
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
        window.removeEventListener("appinstalled", handleAppInstalled)
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [deferredPrompt])

  const handleInstallClick = async () => {
    console.log("PWAInstallPrompt: Install button clicked.")
    if (!deferredPrompt && !isIOS) {
      console.log("PWAInstallPrompt: No deferredPrompt and not iOS. Cannot install.")
      return
    }

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice

        if (outcome === "accepted") {
          console.log("PWAInstallPrompt: User accepted the install prompt.")
          setShowBanner(false)
        } else {
          console.log("PWAInstallPrompt: User dismissed the install prompt.")
        }

        setDeferredPrompt(null)
      } catch (error) {
        console.error("PWAInstallPrompt: Error during installation:", error)
      }
    }
  }

  const handleDismiss = () => {
    console.log("PWAInstallPrompt: Dismiss button clicked.")
    setShowBanner(false)
  }

  const handleDismissPermanently = () => {
    console.log("PWAInstallPrompt: Dismiss permanently button clicked.")
    localStorage.setItem("pwa-install-dismissed", "true")
    setShowBanner(false)
  }

  // Don't show if already installed or not ready
  if (isInstalled || !showBanner) {
    console.log("PWAInstallPrompt: Not showing banner. isInstalled:", isInstalled, "showBanner:", showBanner)
    return null
  }

  console.log("PWAInstallPrompt: Rendering banner. isIOS:", isIOS, "deferredPrompt:", !!deferredPrompt)
  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 border-t border-border shadow-lg ${
        isIOS ? "backdrop-blur-md bg-background/80" : "bg-background"
      }`}
    >
      <div className="max-w-md mx-auto p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{isIOS ? "Agregar a Inicio" : "Instalar App"}</p>
            <p className="text-xs text-muted-foreground truncate">
              {isIOS ? "Toca Compartir → Agregar a pantalla de inicio" : "Acceso rápido y notificaciones"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Mostrar botón de instalar SOLO en Android */}
            {!isIOS && (
              <Button
                onClick={handleInstallClick}
                size="sm"
                className="text-xs px-3 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Download className="h-3 w-3 mr-1" />
                Instalar
              </Button>
            )}

            <Button onClick={handleDismiss} variant="ghost" size="sm" className="p-1 h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Botón discreto para no mostrar más */}
        <div className="mt-2 text-center">
          <button
            onClick={handleDismissPermanently}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            No mostrar más
          </button>
        </div>
      </div>
    </div>
  )
}
