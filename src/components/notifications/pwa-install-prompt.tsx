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
    // Detectar iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(isIOSDevice)

    // Check if app is already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
      return
    }

    // Check if user has already dismissed the install prompt permanently
    const hasBeenDismissed = localStorage.getItem("pwa-install-dismissed")
    if (hasBeenDismissed) {
      return
    }

    // Para iOS, mostrar banner después de un delay
    if (isIOSDevice) {
      const timer = setTimeout(() => {
        setShowBanner(true)
      }, 8000) // Mostrar después de 8 segundos
      return () => clearTimeout(timer)
    }

    // Listen for the beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)

      // Mostrar banner después de un delay
      setTimeout(() => {
        setShowBanner(true)
      }, 5000)
    }

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowBanner(false)
      setDeferredPrompt(null)
      localStorage.removeItem("pwa-install-dismissed")
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt && !isIOS) {
      return
    }

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice

        if (outcome === "accepted") {
          console.log("User accepted the install prompt")
          setShowBanner(false)
        } else {
          console.log("User dismissed the install prompt")
        }

        setDeferredPrompt(null)
      } catch (error) {
        console.error("Error during installation:", error)
      }
    }
  }

  const handleDismiss = () => {
    setShowBanner(false)
  }

  const handleDismissPermanently = () => {
    localStorage.setItem("pwa-install-dismissed", "true")
    setShowBanner(false)
  }

  // Don't show if already installed or not ready
  if (isInstalled || !showBanner) {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border shadow-lg">
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
            {!isIOS && deferredPrompt && (
              <Button onClick={handleInstallClick} size="sm" className="text-xs px-3">
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
