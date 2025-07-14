"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Bell,
  BellOff,
  Settings,
  CheckCircle2,
  AlertCircle,
  Download,
  RefreshCw,
  Info,
  ExternalLink,
} from "lucide-react"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

interface NotificationSettingsProps {
  userType?: "user" | "admin"
  ticketCode?: string
  className?: string
}

export default function NotificationSettings({
  userType = "user",
  ticketCode = "TEST-001",
  className = "",
}: NotificationSettingsProps) {
  const { isSupported, isSubscribed, isLoading, error, permissionState, subscribe, unsubscribe, resetPermissions } =
    usePushNotifications()

  const [testNotificationSent, setTestNotificationSent] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<(() => void) | null>(null)
  const [isTestingNotification, setIsTestingNotification] = useState(false)
  const [showPermissionHelp, setShowPermissionHelp] = useState(false)

  const handleToggleNotifications = async () => {
    if (isSubscribed) {
      await unsubscribe()
    } else {
      const success = await subscribe(userType, "TEST-001")
      if (!success && permissionState === "denied") {
        setShowPermissionHelp(true)
      }
    }
  }

  const handleTestNotification = async () => {
    if (isTestingNotification) return

    setIsTestingNotification(true)
    try {
      console.log("🧪 [NOTIFICATION-SETTINGS] Enviando notificación de prueba:", { userType, ticketCode: "TEST-001" })

      const response = await fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "test",
          userType: userType,
          ticketCode: "TEST-001",
          data: {
            message: "Notificación de prueba",
            timestamp: new Date().toISOString(),
            testMode: true,
          },
        }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.sent > 0) {
          setTestNotificationSent(true)
          setTimeout(() => setTestNotificationSent(false), 5000)
        }
      }
    } catch (error) {
      console.error("🧪 [NOTIFICATION-SETTINGS] Error enviando notificación de prueba:", error)
    } finally {
      setIsTestingNotification(false)
    }
  }

  const handleResetSubscription = async () => {
    await resetPermissions()
  }

  const openBrowserSettings = () => {
    // Instrucciones específicas por navegador
    const userAgent = navigator.userAgent.toLowerCase()
    let instructions = "Configuración del navegador → Privacidad y seguridad → Configuración del sitio → Notificaciones"

    if (userAgent.includes("chrome")) {
      instructions = "Chrome: Configuración → Privacidad y seguridad → Configuración del sitio → Notificaciones"
    } else if (userAgent.includes("firefox")) {
      instructions = "Firefox: Configuración → Privacidad y seguridad → Permisos → Notificaciones"
    } else if (userAgent.includes("safari")) {
      instructions = "Safari: Preferencias → Sitios web → Notificaciones"
    }

    alert(
      `Para habilitar notificaciones manualmente:\n\n${instructions}\n\nBusca este sitio y cambia el permiso a "Permitir"`,
    )
  }

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      const promptEvent = e as BeforeInstallPromptEvent
      promptEvent.preventDefault()
      setInstallPrompt(() => () => {
        promptEvent.prompt()
        promptEvent.userChoice.then((choice) => {
          if (choice.outcome === "accepted") console.log("PWA instalado por el usuario")
        })
      })
      window.addEventListener("appinstalled", () => console.log("PWA instalada"))
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
  }, [])

  if (!isSupported) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Notificaciones No Disponibles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Tu navegador no soporta notificaciones push. Considera usar Chrome, Firefox o Safari.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuración de Notificaciones
              <Badge variant="outline" className="ml-2">
                {userType === "admin" ? "Admin" : "Usuario"}
              </Badge>
            </div>
            <Badge variant={isSubscribed ? "default" : "secondary"}>{isSubscribed ? "Activas" : "Inactivas"}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert
              variant={permissionState === "denied" || error === "INCOGNITO_MODE_ERROR" ? "destructive" : "default"}
            >
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error === "INCOGNITO_MODE_ERROR" ? (
                  <div className="space-y-4">
                    <div>
                      <strong>🕵️ Modo Incógnito Detectado</strong>
                    </div>
                    <p className="text-sm">
                      Las notificaciones push no están disponibles en modo incógnito por limitaciones de seguridad del
                      navegador.
                    </p>
                    <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2">
                        💡 Para usar notificaciones:
                      </p>
                      <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                        <li>• Abre la aplicación en una ventana normal (no incógnito)</li>
                        <li>• O instala la PWA desde el menú del navegador</li>
                        <li>• Las notificaciones funcionarán normalmente</li>
                      </ul>
                    </div>
                    {/* Botones mejorados con mejor layout */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <Button
                        onClick={() => window.open(window.location.href, "_blank")}
                        variant="outline"
                        size="sm"
                        className="flex-1 min-w-0"
                      >
                        <ExternalLink className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span className="truncate">Abrir en Ventana Normal</span>
                      </Button>
                      <Button
                        onClick={handleResetSubscription}
                        variant="outline"
                        size="sm"
                        className="flex-1 min-w-0 bg-transparent"
                      >
                        <RefreshCw className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span className="truncate">Reintentar</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="whitespace-pre-line">{error}</div>
                    {permissionState === "denied" && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          onClick={openBrowserSettings}
                          variant="outline"
                          size="sm"
                          className="flex-1 bg-transparent"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Abrir Configuración
                        </Button>
                        <Button
                          onClick={handleResetSubscription}
                          variant="outline"
                          size="sm"
                          className="flex-1 bg-transparent"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Reintentar
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {!error && typeof window !== "undefined" && (
            <div className="hidden" id="incognito-warning">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">🕵️ Navegación Privada Detectada</p>
                    <p className="text-sm">
                      Las notificaciones push pueden no funcionar correctamente en modo incógnito. Para la mejor
                      experiencia, usa una ventana normal del navegador.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {testNotificationSent && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>¡Notificación de prueba enviada! Deberías verla en unos segundos.</AlertDescription>
            </Alert>
          )}

          {permissionState === "denied" && !error && (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Los permisos de notificación están bloqueados.
                <Button
                  onClick={() => setShowPermissionHelp(true)}
                  variant="link"
                  className="p-0 h-auto font-normal underline ml-1"
                >
                  Ver cómo habilitarlos
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Notificaciones Push</h4>
                <p className="text-sm text-gray-500">
                  {userType === "admin"
                    ? "Recibe alertas de nuevos pagos y solicitudes de salida"
                    : "Recibe actualizaciones sobre tus pagos y vehículo"}
                </p>
                <p className="text-xs text-gray-400 mt-1">Estado: {permissionState} | Ticket de prueba: TEST-001</p>
              </div>
              <Button
                onClick={handleToggleNotifications}
                disabled={isLoading}
                variant={isSubscribed ? "destructive" : "default"}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : isSubscribed ? (
                  <>
                    <BellOff className="h-4 w-4 mr-2" />
                    Desactivar
                  </>
                ) : (
                  <>
                    <Bell className="h-4 w-4 mr-2" />
                    Activar
                  </>
                )}
              </Button>
            </div>

            {isSubscribed && (
              <div className="pt-2 border-t space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={handleTestNotification}
                    variant="outline"
                    size="sm"
                    disabled={testNotificationSent || isTestingNotification}
                    className="flex-1 bg-transparent"
                  >
                    {isTestingNotification ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : testNotificationSent ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Enviada
                      </>
                    ) : (
                      <>
                        <Bell className="h-4 w-4 mr-2" />
                        Probar Notificación
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleResetSubscription}
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-transparent"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reiniciar Suscripción
                  </Button>
                </div>
              </div>
            )}

            {installPrompt && (
              <div className="pt-2 border-t">
                <Button onClick={installPrompt} variant="outline" size="sm" className="w-full bg-transparent">
                  <Download className="h-4 w-4 mr-2" />
                  Instalar Aplicación
                </Button>
              </div>
            )}
          </div>

          {userType === "user" && (
            <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
              <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-1">Recibirás notificaciones para:</h5>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• Confirmación de pago validado</li>
                <li>• Notificación de pago rechazado</li>
                <li>• Confirmación de vehículo estacionado</li>
                <li>• Proceso de salida del vehículo</li>
              </ul>
            </div>
          )}

          {userType === "admin" && (
            <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg border border-green-200 dark:border-green-800">
              <h5 className="font-medium text-green-900 dark:text-green-100 mb-1">Recibirás notificaciones para:</h5>
              <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
                <li>• Nuevos pagos pendientes de validación</li>
                <li>• Solicitudes de salida de vehículos</li>
                <li>• Confirmaciones de estacionamiento</li>
                <li>• Alertas del sistema</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de ayuda para permisos - ESTILOS MEJORADOS */}
      <Dialog open={showPermissionHelp} onOpenChange={setShowPermissionHelp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Cómo Habilitar Notificaciones
            </DialogTitle>
            <DialogDescription>
              Los permisos de notificación están bloqueados. Sigue estos pasos para habilitarlos:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg border">
                <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <span className="text-sm text-foreground">
                  Haz clic en el <strong>ícono de candado</strong> o <strong>información</strong> en la barra de
                  direcciones
                </span>
              </div>
              <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg border">
                <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <span className="text-sm text-foreground">
                  Busca la opción <strong>"Notificaciones"</strong> y cámbiala a <strong>"Permitir"</strong>
                </span>
              </div>
              <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg border">
                <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <span className="text-sm text-foreground">
                  <strong>Recarga la página</strong> y vuelve a intentar activar las notificaciones
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={openBrowserSettings} variant="outline" className="flex-1 bg-transparent">
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir Configuración
              </Button>
              <Button onClick={() => setShowPermissionHelp(false)} className="flex-1">
                Entendido
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface BeforeInstallPromptEvent extends Event {
  preventDefault: () => void
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}
