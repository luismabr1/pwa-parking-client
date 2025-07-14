"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, AlertCircle, QrCode } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import QRScannerComponent from "../qr-scanner"

export default function TicketSearch() {
  const [ticketCode, setTicketCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showQRScanner, setShowQRScanner] = useState(false)
  const router = useRouter()

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    await searchTicket(ticketCode)
  }

  const searchTicket = async (code: string) => {
    if (!code.trim()) {
      setError("Por favor ingresa un código de ticket")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const cleanTicketCode = code.trim().toUpperCase()
      console.log(`🔍 Búsqueda: Verificando ticket ${cleanTicketCode}`)

      // Usar directamente la ruta del ticket para verificar si existe
      const response = await fetch(`/api/ticket/${cleanTicketCode}`)

      if (response.ok) {
        const ticket = await response.json()
        console.log(`✅ Búsqueda: Ticket encontrado, redirigiendo a: /ticket/${ticket.codigoTicket}`)
        // Redirigir a la página de detalles del ticket
        router.push(`/ticket/${ticket.codigoTicket}`)
      } else {
        const errorData = await response.json()
        console.log(`❌ Búsqueda: Error para ${cleanTicketCode}:`, errorData)
        setError(errorData.message || "Error al buscar el ticket")
      }
    } catch (err) {
      console.error("❌ Búsqueda: Error de conexión:", err)
      setError("Error de conexión. Por favor intenta nuevamente.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleQRScanSuccess = (scannedCode: string) => {
    console.log("QR Code scanned:", scannedCode)
    setTicketCode(scannedCode)
    setShowQRScanner(false)
    // Automatically search for the scanned ticket
    searchTicket(scannedCode)
  }

  if (showQRScanner) {
    return <QRScannerComponent onScanSuccess={handleQRScanSuccess} onClose={() => setShowQRScanner(false)} />
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Buscar Ticket</CardTitle>
        <p className="text-gray-600">Ingresa tu código de ticket o escanea el código QR</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="ticketCode" className="text-sm font-medium">
              Código de Ticket
            </label>
            <Input
              id="ticketCode"
              type="text"
              placeholder="Ej. PARK001, TEST001"
              value={ticketCode}
              onChange={(e) => setTicketCode(e.target.value)}
              className="text-center text-lg font-mono"
              disabled={isLoading}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Button type="submit" className="w-full h-12 text-lg" disabled={isLoading || !ticketCode.trim()}>
              <Search className="mr-2 h-5 w-5" />
              {isLoading ? "Buscando..." : "Buscar Ticket"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">O</span>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setShowQRScanner(true)}
              variant="outline"
              className="w-full h-12 text-lg"
              disabled={isLoading}
            >
              <QrCode className="mr-2 h-5 w-5" />
              Escanear Código QR
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
