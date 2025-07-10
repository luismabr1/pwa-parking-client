"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bell, BellOff, Settings, CheckCircle2, AlertCircle, Download, RefreshCw } from "lucide-react"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
  const { isSupported, isSubscribed, isLoading, error, subscribe, unsubscribe } = usePushNotifications()
  const [testNotificationSent, setTestNotificationSent] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<(() => void) | null>(null)
  const [isTestingNotification, setIsTestingNotification] = useState(false)

  const handleToggleNotifications = async () => {
    if (isSubscribed) {
      await unsubscribe()
    } else {
      // Para tests, siempre usar TEST-001
      await subscribe(userType, "TEST-001")
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
          ticketCode: "TEST-001", // Siempre usar TEST-001 para pruebas
          data: {
            message: "Notificación de prueba",
            timestamp: new Date().toISOString(),
            testMode: true,
          },
        }),
      })

      console.log("🧪 [NOTIFICATION-SETTINGS] Respuesta del servidor:", response.status)

      if (response.ok) {
        const result = await response.json()
        console.log("🧪 [NOTIFICATION-SETTINGS] Resultado:", result)

        if (result.sent > 0) {
          setTestNotificationSent(true)
          setTimeout(() => setTestNotificationSent(false), 5000)
        } else {
          console.warn("⚠️ [NOTIFICATION-SETTINGS] No se enviaron notificaciones:", result.message)
        }
      } else {
        const errorText = await response.text()
        console.error("🧪 [NOTIFICATION-SETTINGS] Error en prueba:", errorText)
      }
    } catch (error) {
      console.error("🧪 [NOTIFICATION-SETTINGS] Error enviando notificación de prueba:", error)
    } finally {
      setIsTestingNotification(false)
    }
  }

  const handleResetSubscription = async () => {
    if (isSubscribed) {
      await unsubscribe()
      // Wait a bit before resubscribing
      setTimeout(async () => {
        await subscribe(userType, "TEST-001")
      }, 1000)
    }
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
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              {error.includes("VAPID") && (
                <div className="mt-2">
                  <Button onClick={handleResetSubscription} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reiniciar Suscripción
                  </Button>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {testNotificationSent && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>¡Notificación de prueba enviada! Deberías verla en unos segundos.</AlertDescription>
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
              <p className="text-xs text-gray-400 mt-1">Ticket de prueba: TEST-001</p>
            </div>
            <Button
              onClick={handleToggleNotifications}
              disabled={isLoading}
              variant={isSubscribed ? "destructive" : "default"}
            >
              {isLoading ? (
                "Procesando..."
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
              <Button
                onClick={handleTestNotification}
                variant="outline"
                size="sm"
                disabled={testNotificationSent || isTestingNotification}
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

              {error && error.includes("VAPID") && (
                <Button onClick={handleResetSubscription} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reiniciar Suscripción
                </Button>
              )}
            </div>
          )}

          {installPrompt && (
            <div className="pt-2 border-t">
              <Button onClick={installPrompt} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Instalar Aplicación
              </Button>
            </div>
          )}
        </div>

        {userType === "user" && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <h5 className="font-medium text-blue-900 mb-1">Recibirás notificaciones para:</h5>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Confirmación de pago validado</li>
              <li>• Notificación de pago rechazado</li>
              <li>• Confirmación de vehículo estacionado</li>
              <li>• Proceso de salida del vehículo</li>
            </ul>
          </div>
        )}

        {userType === "admin" && (
          <div className="bg-green-50 p-3 rounded-lg">
            <h5 className="font-medium text-green-900 mb-1">Recibirás notificaciones para:</h5>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• Nuevos pagos pendientes de validación</li>
              <li>• Solicitudes de salida de vehículos</li>
              <li>• Confirmaciones de estacionamiento</li>
              <li>• Alertas del sistema</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface BeforeInstallPromptEvent extends Event {
  preventDefault: () => void
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}
