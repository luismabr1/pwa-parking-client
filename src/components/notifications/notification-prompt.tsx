"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, BellOff, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface NotificationPromptProps {
  ticketCode: string
  onEnable: () => Promise<boolean>
  onSkip: () => void
  isLoading?: boolean
}

export default function NotificationPrompt({
  ticketCode,
  onEnable,
  onSkip,
  isLoading = false,
}: NotificationPromptProps) {
  const [isEnabling, setIsEnabling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleEnable = async () => {
    setIsEnabling(true)
    setError(null)

    try {
      const result = await onEnable()

      if (result) {
        setSuccess(true)
        setTimeout(() => {
          onSkip() // Cerrar el prompt después del éxito
        }, 2000)
      } else {
        // Verificar si el error es por modo incógnito
        const isIncognito = await detectIncognitoMode()
        if (isIncognito) {
          setError(
            "🕵️ Las notificaciones no están disponibles en modo incógnito. Abre la app en una ventana normal para activarlas.",
          )
        } else {
          setError("No se pudieron activar las notificaciones. Inténtalo de nuevo.")
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message === "INCOGNITO_MODE_ERROR") {
        setError("🕵️ Modo incógnito detectado. Las notificaciones no están disponibles por limitaciones del navegador.")
      } else {
        setError("Error activando las notificaciones")
      }
    } finally {
      setIsEnabling(false)
    }
  }

  async function detectIncognitoMode(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        if ("webkitRequestFileSystem" in window) {
          ;(window as any).webkitRequestFileSystem(
            (window as any).TEMPORARY,
            1,
            () => resolve(false),
            () => resolve(true),
          )
        } else if ("MozAppearance" in document.documentElement.style) {
          const db = indexedDB.open("test")
          db.onerror = () => resolve(true)
          db.onsuccess = () => resolve(false)
        } else {
          if ("storage" in navigator && "estimate" in navigator.storage) {
            navigator.storage
              .estimate()
              .then((estimate) => {
                resolve(estimate.quota && estimate.quota < 120000000)
              })
              .catch(() => resolve(false))
          } else {
            resolve(false)
          }
        }
      } catch (e) {
        resolve(false)
      }
    })
  }

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-xl">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">¡Notificaciones Activadas!</h3>
            <p className="text-gray-600 dark:text-gray-300">Te notificaremos cuando tu pago sea validado</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-xl">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mb-4">
            <Bell className="h-8 w-8 text-blue-600 dark:text-blue-300" />
          </div>
          <CardTitle className="text-xl text-gray-900 dark:text-white">¿Activar Notificaciones?</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="font-medium text-gray-900 dark:text-white">Te notificaremos cuando:</p>
            <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-300">
              <li className="flex items-center justify-center gap-2">
                <span className="text-green-500">✅</span>
                <span>Tu pago sea validado</span>
              </li>
              <li className="flex items-center justify-center gap-2">
                <span className="text-red-500">❌</span>
                <span>Tu pago sea rechazado</span>
              </li>
              <li className="flex items-center justify-center gap-2">
                <span className="text-blue-500">🚗</span>
                <span>Tu vehículo esté listo para salir</span>
              </li>
            </ul>
          </div>

          {error && (
            <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <AlertDescription className="text-red-800 dark:text-red-200 text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Ticket:</strong> {ticketCode}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
              Las notificaciones están vinculadas a este ticket específico
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={onSkip}
              variant="outline"
              className="flex-1 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              disabled={isEnabling}
            >
              <BellOff className="mr-2 h-4 w-4" />
              Omitir
            </Button>

            <Button
              onClick={handleEnable}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isEnabling}
            >
              {isEnabling ? (
                "Activando..."
              ) : (
                <>
                  <Bell className="mr-2 h-4 w-4" />
                  Activar
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
            Puedes desactivar las notificaciones en cualquier momento desde la configuración de tu navegador
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
