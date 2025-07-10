"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Camera, X, Scan } from "lucide-react"
import QrScanner from "./qr-scanner"

interface QRScannerProps {
  onScanSuccess: (ticketCode: string) => void
  onClose: () => void
}

export default function QRScannerComponent({ onScanSuccess, onClose }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)
  const qrScannerRef = useRef<QrScanner | null>(null)

  useEffect(() => {
    return () => {
      // Cleanup scanner when component unmounts
      if (qrScannerRef.current) {
        qrScannerRef.current.stop()
        qrScannerRef.current.destroy()
      }
    }
  }, [])

  const startScanning = async () => {
    if (!videoRef.current) return

    try {
      setIsScanning(true)
      setError("")

      // Check if QrScanner is supported
      if (!QrScanner.hasCamera()) {
        throw new Error("No se encontró cámara disponible")
      }

      // Create QR scanner instance
      qrScannerRef.current = new QrScanner(
        videoRef.current,
        (result) => {
          console.log("QR Code detected:", result.data)

          // Extract ticket code from URL or use direct code
          let ticketCode = result.data

          // If it's a URL, extract the ticket code from the path
          if (result.data.includes("/ticket/")) {
            const urlParts = result.data.split("/ticket/")
            if (urlParts.length > 1) {
              ticketCode = urlParts[1].split("?")[0] // Remove query parameters if any
            }
          }

          // Stop scanning and call success callback
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
