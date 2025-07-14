"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Download, Smartphone, Plus } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallButton, setShowInstallButton] = useState(false)
  const [showInstallDialog, setShowInstallDialog] = useState(false)
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

    // Para iOS, mostrar botón después de un delay
    if (isIOSDevice) {
      const timer = setTimeout(() => {
        setShowInstallButton(true)
      }, 5000) // Mostrar después de 5 segundos
      return () => clearTimeout(timer)
    }

    // Listen for the beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowInstallButton(true)
    }

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowInstallButton(false)
      setShowInstallDialog(false)
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
    if (!deferredPrompt) {
      // Para iOS o si no hay prompt, mostrar instrucciones
      setShowInstallDialog(true)
      return
    }

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === "accepted") {
        console.log("User accepted the install prompt")
        setShowInstallButton(false)
        setShowInstallDialog(false)
      } else {
        console.log("User dismissed the install prompt")
        setShowInstallDialog(false)
      }

      setDeferredPrompt(null)
    } catch (error) {
      console.error("Error during installation:", error)
      setShowInstallDialog(false)
    }
  }

  const handleDismissPermanently = () => {
    localStorage.setItem("pwa-install-dismissed", "true")
    setShowInstallButton(false)
    setShowInstallDialog(false)
  }

  // Don't show if already installed
  if (isInstalled || !showInstallButton) {
    return null
  }

  return (
    <>
      {/* Botón discreto para instalar */}
      <div className="flex justify-center">
        <Button
          onClick={handleInstallClick}
          variant="outline"
          size="sm"
          className="bg-background border-border hover:bg-accent hover:text-accent-foreground"
        >
          <Download className="h-4 w-4 mr-2" />
          Instalar App
        </Button>
      </div>

      {/* Dialog con información de instalación */}
      <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Smartphone className="h-5 w-5" />
              {isIOS ? "Agregar a Inicio" : "Instalar Aplicación"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {isIOS ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Para instalar esta app en tu iPhone/iPad:</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                    <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                      1
                    </span>
                    <span className="text-sm text-foreground">
                      Toca el botón <strong>Compartir</strong> en Safari
                    </span>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                    <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                      2
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground">
                        Selecciona <strong>"Agregar a pantalla de inicio"</strong>
                      </span>
                      <Plus className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                    <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                      3
                    </span>
                    <span className="text-sm text-foreground">
                      Toca <strong>"Agregar"</strong> para confirmar
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Instala la app para acceso rápido y recibir notificaciones de tus pagos y vehículo.
                </p>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground">Beneficios:</strong> Acceso offline, notificaciones push, inicio
                    rápido desde tu pantalla de inicio
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {!isIOS && deferredPrompt && (
                <Button onClick={handleInstallClick} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Instalar Ahora
                </Button>
              )}

              <Button
                variant="outline"
                onClick={() => setShowInstallDialog(false)}
                className={isIOS || !deferredPrompt ? "flex-1" : ""}
              >
                {isIOS ? "Entendido" : "Después"}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismissPermanently}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                No mostrar más
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
