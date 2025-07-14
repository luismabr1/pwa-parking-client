"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, X, Smartphone, Plus } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
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

    // Para iOS, mostrar instrucciones después de un delay
    if (isIOSDevice) {
      const timer = setTimeout(() => {
        if (!sessionStorage.getItem("pwa-install-dismissed-ios")) {
          setShowInstallPrompt(true)
        }
      }, 3000)
      return () => clearTimeout(timer)
    }

    // Listen for the beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowInstallPrompt(true)
    }

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowInstallPrompt(false)
      setDeferredPrompt(null)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === "accepted") {
        console.log("User accepted the install prompt")
      } else {
        console.log("User dismissed the install prompt")
      }

      setDeferredPrompt(null)
      setShowInstallPrompt(false)
    } catch (error) {
      console.error("Error during installation:", error)
    }
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    // Hide for this session
    if (isIOS) {
      sessionStorage.setItem("pwa-install-dismissed-ios", "true")
    } else {
      sessionStorage.setItem("pwa-install-dismissed", "true")
    }
  }

  // Don't show if already installed or dismissed this session
  if (isInstalled || !showInstallPrompt) {
    return null
  }

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 shadow-2xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 md:left-auto md:right-4 md:w-96 animate-in slide-in-from-bottom-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 text-blue-900">
            <Smartphone className="h-6 w-6 text-blue-600" />
            {isIOS ? "Agregar a Inicio" : "Instalar App"}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={handleDismiss} className="h-8 w-8 p-0 hover:bg-blue-100">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isIOS ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 font-medium">Para instalar esta app en tu iPhone/iPad:</p>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <span>
                  Toca el botón <strong>Compartir</strong> en Safari
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <span>
                  Selecciona <strong>"Agregar a pantalla de inicio"</strong>
                </span>
                <Plus className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <span>
                  Toca <strong>"Agregar"</strong> para confirmar
                </span>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={handleDismiss} size="sm" className="flex-1 bg-transparent">
                Entendido
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 font-medium">
              Instala la app para acceso rápido y recibir notificaciones de tus pagos y vehículo.
            </p>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-xs text-blue-800">
                ✨ <strong>Beneficios:</strong> Acceso offline, notificaciones push, inicio rápido desde tu pantalla de
                inicio
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleInstallClick} className="flex-1 bg-blue-600 hover:bg-blue-700" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Instalar Ahora
              </Button>
              <Button variant="outline" onClick={handleDismiss} size="sm" className="hover:bg-blue-50 bg-transparent">
                Después
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
