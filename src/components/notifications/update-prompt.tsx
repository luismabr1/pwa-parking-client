"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, X } from 'lucide-react'

export default function UpdatePrompt() {
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    console.log("UpdatePrompt: Inicializando...")

    // Función para verificar actualizaciones
    const checkForUpdates = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg) {
          setRegistration(reg)
          
          // Verificar si hay un SW esperando
          if (reg.waiting) {
            console.log("UpdatePrompt: SW esperando encontrado")
            setShowUpdateBanner(true)
          }
          
          // Verificar actualizaciones manualmente
          await reg.update()
        }
      } catch (error) {
        console.error("UpdatePrompt: Error verificando actualizaciones:", error)
      }
    }

    // Escuchar mensajes del service worker
    const handleMessage = (event: MessageEvent) => {
      console.log("UpdatePrompt: Mensaje recibido:", event.data)
      
      if (event.data && event.data.type === 'SW_UPDATED') {
        console.log("UpdatePrompt: Nueva versión disponible:", event.data.version)
        setShowUpdateBanner(true)
      }
    }

    // Escuchar cambios en el service worker
    const handleControllerChange = () => {
      console.log("UpdatePrompt: Controller cambió - recargando página")
      window.location.reload()
    }

    // Escuchar cuando un nuevo SW está instalado
    const handleUpdateFound = (reg: ServiceWorkerRegistration) => {
      const newWorker = reg.installing
      if (newWorker) {
        console.log("UpdatePrompt: Nuevo SW instalándose")
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log("UpdatePrompt: Nuevo SW instalado y listo")
            setShowUpdateBanner(true)
          }
        })
      }
    }

    // Configurar listeners
    navigator.serviceWorker.addEventListener('message', handleMessage)
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    // Verificar registro existente
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) {
        setRegistration(reg)
        
        // Verificar si ya hay un SW esperando
        if (reg.waiting) {
          setShowUpdateBanner(true)
        }
        
        // Escuchar por nuevas actualizaciones
        reg.addEventListener('updatefound', () => handleUpdateFound(reg))
      }
    })

    // Verificar actualizaciones cada 30 segundos
    const updateInterval = setInterval(checkForUpdates, 30000)
    
    // Verificación inicial
    checkForUpdates()

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage)
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      clearInterval(updateInterval)
    }
  }, [])

  const handleUpdate = async () => {
    if (!registration) {
      console.log("UpdatePrompt: No hay registro de SW")
      return
    }

    setIsUpdating(true)
    console.log("UpdatePrompt: Iniciando actualización...")

    try {
      // Si hay un SW esperando, activarlo
      if (registration.waiting) {
        console.log("UpdatePrompt: Activando SW esperando")
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      } else {
        // Si no hay SW esperando, limpiar cache y recargar
        console.log("UpdatePrompt: Limpiando cache y recargando")
        await clearCacheAndReload()
      }
    } catch (error) {
      console.error("UpdatePrompt: Error durante actualización:", error)
      setIsUpdating(false)
    }
  }

  const clearCacheAndReload = async () => {
    try {
      // Limpiar cache usando el service worker
      if (registration && registration.active) {
        const messageChannel = new MessageChannel()
        
        return new Promise<void>((resolve, reject) => {
          messageChannel.port1.onmessage = (event) => {
            if (event.data.success) {
              console.log("UpdatePrompt: Cache limpiado exitosamente")
              // Recargar la página después de limpiar el cache
              setTimeout(() => {
                window.location.reload()
              }, 500)
              resolve()
            } else {
              reject(new Error("Error limpiando cache"))
            }
          }
          
          registration.active?.postMessage(
            { type: 'CLEAR_CACHE' }, 
            [messageChannel.port2]
          )
          
          // Timeout de seguridad
          setTimeout(() => {
            reject(new Error("Timeout limpiando cache"))
          }, 5000)
        })
      } else {
        // Fallback: limpiar cache manualmente y recargar
        if ('caches' in window) {
          const cacheNames = await caches.keys()
          await Promise.all(
            cacheNames.map(cacheName => {
              console.log("UpdatePrompt: Eliminando cache:", cacheName)
              return caches.delete(cacheName)
            })
          )
        }
        window.location.reload()
      }
    } catch (error) {
      console.error("UpdatePrompt: Error limpiando cache:", error)
      // Como último recurso, solo recargar
      window.location.reload()
    }
  }

  const handleDismiss = () => {
    console.log("UpdatePrompt: Banner descartado")
    setShowUpdateBanner(false)
  }

  if (!showUpdateBanner) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border shadow-lg">
      <div className="max-w-md mx-auto p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Nueva versión disponible</p>
            <p className="text-xs text-muted-foreground truncate">
              Actualiza para obtener las últimas mejoras
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleUpdate}
              disabled={isUpdating}
              size="sm"
              className="text-xs px-3 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Actualizando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Actualizar
                </>
              )}
            </Button>

            <Button onClick={handleDismiss} variant="ghost" size="sm" className="p-1 h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isUpdating && (
          <div className="mt-2">
            <div className="w-full bg-muted rounded-full h-1">
              <div className="bg-primary h-1 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-center">
              Limpiando cache y aplicando actualizaciones...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
