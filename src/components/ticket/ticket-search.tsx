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

      const response = await fetch(`/api/ticket/${cleanTicketCode}`)
      console.log(`🔍 Búsqueda: Enviando solicitud a /api/ticket/${cleanTicketCode}`)
      console.log(`🔍 Búsqueda: Respuesta del servidor: ${response.status} ${response.statusText}`)


      if (response.ok) {
        const data = await response.json() // Obtener la respuesta completa
        console.log(`✅ Búsqueda: Ticket encontrado22:`, data)
        const foundTicketCode = data.ticket?.codigoTicket // Acceder a la propiedad anidada
        console.log(`✅ Búsqueda: Código de ticket encontrado: ${foundTicketCode}`)

        if (foundTicketCode) {
          console.log(`✅ Búsqueda: Ticket encontrado, redirigiendo a: /ticket/${foundTicketCode}`)
          router.push(`/ticket/${foundTicketCode}`)
        } else {
          // Esto debería ocurrir si la API devuelve 200 pero sin codigoTicket válido
          setError("Ticket encontrado, pero código no disponible para redirección.")
          console.error("❌ Búsqueda: API devolvió datos inesperados:", data)
        }
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
    searchTicket(scannedCode)
  }

  if (showQRScanner) {
    return <QRScannerComponent onScanSuccess={handleQRScanSuccess} onClose={() => setShowQRScanner(false)} />
  }

  return (
    <Card className="w-full shadow-lg border-0 bg-card">
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-xl font-bold text-foreground">Buscar Ticket</CardTitle>
        <p className="text-muted-foreground text-sm">Ingresa tu código de ticket o escanea el código QR</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="ticketCode" className="text-sm font-medium text-foreground">
              Código de Ticket
            </label>
            <Input
              id="ticketCode"
              type="text"
              placeholder="Ej. PARK001, TEST001"
              value={ticketCode}
              onChange={(e) => setTicketCode(e.target.value)}
              className="text-center text-lg font-mono h-12 shadow-sm"
              disabled={isLoading}
            />
          </div>

          {error && (
            <Alert variant="destructive" className="border-destructive/20 bg-destructive/10">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-destructive">{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <Button
              type="submit"
              className="w-full h-12 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-200"
              disabled={isLoading || !ticketCode.trim()}
            >
              <Search className="mr-2 h-5 w-5" />
              {isLoading ? "Buscando..." : "Buscar Ticket"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground font-medium">O</span>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setShowQRScanner(true)}
              variant="outline"
              className="w-full h-12 text-base font-medium shadow-sm hover:shadow-md transition-all duration-200"
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
