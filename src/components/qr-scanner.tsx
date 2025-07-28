"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Camera, X, Scan } from "lucide-react"
// Eliminamos la importación dinámica de next/dynamic para QrScanner aquí
// import dynamic from "next/dynamic"

// Eliminamos la declaración de QrScanner como componente dinámico aquí
// const QrScanner = dynamic(() => import("qr-scanner"), { ssr: false })

interface QRScannerProps {
  onScanSuccess: (ticketCode: string) => void
  onClose: () => void
}

export default function QRScannerComponent({ onScanSuccess, onClose }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState("")
  // QrScannerClass ahora almacenará directamente el constructor de la clase QrScanner
  const [QrScannerClass, setQrScannerClass] = useState<any>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const qrScannerRef = useRef<any>(null)

  useEffect(() => {
    // Cargar QrScanner dinámicamente solo cuando el componente se monta en el cliente
    const loadQrScanner = async () => {
      try {
        // Importamos el módulo directamente para obtener el constructor de la clase
        const QrScannerModule = await import("qr-scanner")
        setQrScannerClass(QrScannerModule.default)
      } catch (err) {
        console.error("Error loading QR Scanner:", err)
        setError("Error cargando el escáner QR")
      }
    }

    loadQrScanner()

    return () => {
      // Limpiar el escáner cuando el componente se desmonta
      if (qrScannerRef.current) {
        qrScannerRef.current.stop()
        qrScannerRef.current.destroy()
        qrScannerRef.current = null
      }
    }
  }, [])

  const startScanning = async () => {
    // Asegurarse de que QrScannerClass esté cargado y el elemento de video esté disponible
    if (!videoRef.current || !QrScannerClass) {
      setError("Escáner QR no cargado o cámara no disponible.")
      return
    }

    try {
      setIsScanning(true)
      setError("")

      // Verificar si hay cámara disponible usando el método de la clase QrScanner
      if (!QrScannerClass.hasCamera()) {
        throw new Error("No se encontró cámara disponible")
      }

      // Crear instancia del escáner QR usando el constructor de la clase
      qrScannerRef.current = new QrScannerClass(
        videoRef.current,
        (result: any) => {
          console.log("QR Code detected:", result.data)

          let ticketCode = result.data

          // Si es una URL, extraer el código del ticket de la ruta
          if (result.data.includes("/ticket/")) {
            const urlParts = result.data.split("/ticket/")
            if (urlParts.length > 1) {
              ticketCode = urlParts[1].split("?")[0] // Eliminar parámetros de consulta si los hay
            }
          }

          // Detener el escaneo y llamar al callback de éxito
          stopScanning()
          onScanSuccess(ticketCode)
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
        },
      )

      await qrScannerRef.current.start()
    } catch (err) {
      console.error("Error starting QR scanner:", err)
      setError(err instanceof Error ? err.message : "Error al iniciar el escáner")
      setIsScanning(false)
    }
  }

  const stopScanning = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop()
      qrScannerRef.current.destroy()
      qrScannerRef.current = null
    }
    setIsScanning(false)
  }

  const handleClose = () => {
    stopScanning()
    onClose()
  }

  // Mostrar un estado de carga mientras el escáner QR se está cargando
  if (!QrScannerClass) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Cargando escáner QR...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center">
          <Scan className="h-5 w-5 mr-2" />
          Escanear Código QR
        </CardTitle>
        <Button onClick={handleClose} variant="ghost" size="sm">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <video ref={videoRef} className="w-full h-64 bg-black rounded-lg object-cover" playsInline muted />
          {!isScanning && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
              <div className="text-center">
                <Camera className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">Presiona &quot;Iniciar Escáner&quot; para comenzar</p>
              </div>
            </div>
          )}
        </div>

        {error && <div className="text-red-600 text-sm text-center p-2 bg-red-50 rounded">{error}</div>}

        <div className="space-y-2">
          {!isScanning ? (
            <Button onClick={startScanning} className="w-full">
              <Camera className="h-4 w-4 mr-2" />
              Iniciar Escáner
            </Button>
          ) : (
            <Button onClick={stopScanning} variant="destructive" className="w-full">
              <X className="h-4 w-4 mr-2" />
              Detener Escáner
            </Button>
          )}
        </div>

        <div className="text-xs text-gray-500 text-center">
          <p>Apunte la cámara hacia el código QR del ticket</p>
          <p>El código se detectará automáticamente</p>
        </div>
      </CardContent>
    </Card>
  )
}
