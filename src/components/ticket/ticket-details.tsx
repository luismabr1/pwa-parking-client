"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Clock, Car, DollarSign, Calendar, Bell } from "lucide-react"
import PaymentForm from "../payment-form"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface TicketDetailsProps {
  ticket: {
    _id: string
    codigoTicket: string
    horaEntrada: string
    horaSalida?: string
    estado: string
    montoCalculado: number
    montoBs: number
    tasaCambio: number
    carInfo?: {
      placa: string
      marca: string
      modelo: string
      color: string
      nombreDueño: string
      telefono: string
    }
  }
}

export default function TicketDetails({ ticket }: TicketDetailsProps) {
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [timeElapsed, setTimeElapsed] = useState("")
  const { isSupported, isSubscribed, subscribe } = usePushNotifications()
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)

  // Auto-enable notifications when ticket is loaded
  useEffect(() => {
    const enableNotifications = async () => {
      if (isSupported && !isSubscribed && ticket.codigoTicket !== "TEST-001") {
        console.log("🔔 [TICKET-DETAILS] Auto-enabling notifications for ticket:", ticket.codigoTicket)

        // Wait a bit to ensure the ticket is fully loaded
        setTimeout(async () => {
          try {
            const success = await subscribe("user", ticket.codigoTicket)
            if (success) {
              setNotificationsEnabled(true)
              console.log("✅ [TICKET-DETAILS] Notifications auto-enabled for:", ticket.codigoTicket)
            }
          } catch (error) {
            console.error("❌ [TICKET-DETAILS] Error auto-enabling notifications:", error)
          }
        }, 2000)
      }
    }

    enableNotifications()
  }, [ticket.codigoTicket, isSupported, isSubscribed, subscribe])

  useEffect(() => {
    const updateTimeElapsed = () => {
      if (ticket.horaEntrada) {
        const entryTime = new Date(ticket.horaEntrada)
        const now = new Date()
        const diffMs = now.getTime() - entryTime.getTime()
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
        setTimeElapsed(`${diffHours}h ${diffMinutes}m`)
      }
    }

    updateTimeElapsed()
    const interval = setInterval(updateTimeElapsed, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [ticket.horaEntrada])

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case "disponible":
        return "bg-gray-500"
      case "ocupado":
      case "activo":
        return "bg-blue-500"
      case "estacionado":
      case "estacionado_confirmado":
        return "bg-green-500"
      case "pagado_pendiente_validacion":
      case "pagado_pendiente_taquilla":
        return "bg-yellow-500"
      case "pagado_validado":
        return "bg-emerald-500"
      case "salido":
        return "bg-gray-400"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusText = (estado: string) => {
    switch (estado) {
      case "disponible":
        return "Disponible"
      case "ocupado":
        return "Ocupado"
      case "activo":
        return "Activo"
      case "estacionado":
        return "Estacionado"
      case "estacionado_confirmado":
        return "Estacionado Confirmado"
      case "pagado_pendiente_validacion":
        return "Pago Pendiente Validación"
      case "pagado_pendiente_taquilla":
        return "Pago Pendiente Taquilla"
      case "pagado_validado":
        return "Pago Validado"
      case "salido":
        return "Salido"
      default:
        return estado
    }
  }

  const canPay = ["estacionado", "estacionado_confirmado", "activo", "ocupado"].includes(ticket.estado)
  const isPaid = ["pagado_pendiente_validacion", "pagado_pendiente_taquilla", "pagado_validado"].includes(ticket.estado)
  const canExit = ticket.estado === "pagado_validado"

  return (
    <div className="space-y-6">
      {/* Notification Status */}
      {isSupported && (
        <Alert
          className={
            notificationsEnabled || isSubscribed ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"
          }
        >
          <Bell className="h-4 w-4" />
          <AlertDescription>
            {notificationsEnabled || isSubscribed ? (
              <span className="text-green-800">
                ✅ Notificaciones activadas - Recibirás actualizaciones sobre tu vehículo
              </span>
            ) : (
              <span className="text-yellow-800">🔔 Las notificaciones se están configurando automáticamente...</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Ticket Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">Ticket {ticket.codigoTicket}</CardTitle>
            <Badge className={`${getStatusColor(ticket.estado)} text-white`}>{getStatusText(ticket.estado)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Time Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">Hora de Entrada</p>
                <p className="font-medium">
                  {ticket.horaEntrada ? new Date(ticket.horaEntrada).toLocaleString("es-ES") : "No registrada"}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">Tiempo Transcurrido</p>
                <p className="font-medium">{timeElapsed || "Calculando..."}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Vehicle Information */}
          {ticket.carInfo && (
            <>
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center">
                  <Car className="h-5 w-5 mr-2" />
                  Información del Vehículo
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Placa</p>
                    <p className="font-medium">{ticket.carInfo.placa || "No registrada"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Marca y Modelo</p>
                    <p className="font-medium">
                      {`${ticket.carInfo.marca} ${ticket.carInfo.modelo}`.trim() || "No registrado"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Color</p>
                    <p className="font-medium">{ticket.carInfo.color || "No registrado"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Propietario</p>
                    <p className="font-medium">{ticket.carInfo.nombreDueño || "No registrado"}</p>
                  </div>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Payment Information */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center">
              <DollarSign className="h-5 w-5 mr-2" />
              Información de Pago
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Monto (USD)</p>
                <p className="font-medium text-lg">${ticket.montoCalculado?.toFixed(2) || "0.00"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Monto (Bs)</p>
                <p className="font-medium text-lg">Bs. {ticket.montoBs?.toFixed(2) || "0.00"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tasa de Cambio</p>
                <p className="font-medium">Bs. {ticket.tasaCambio || "0"} / USD</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="space-y-3">
            {canPay && !showPaymentForm && (
              <Button onClick={() => setShowPaymentForm(true)} className="w-full" size="lg">
                Procesar Pago
              </Button>
            )}

            {isPaid && (
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-yellow-800 font-medium">
                  {ticket.estado === "pagado_pendiente_validacion" && "Pago registrado - Esperando validación"}
                  {ticket.estado === "pagado_pendiente_taquilla" &&
                    "Pago registrado - Esperando validación en taquilla"}
                  {ticket.estado === "pagado_validado" && "Pago validado - Puedes solicitar la salida"}
                </p>
              </div>
            )}

            {canExit && (
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-green-800 font-medium mb-2">
                  ✅ Tu pago ha sido validado. Dirígete a la salida del estacionamiento.
                </p>
                <p className="text-sm text-green-600">El personal te ayudará con el proceso de salida.</p>
              </div>
            )}

            {ticket.estado === "salido" && (
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-600 font-medium">
                  Este ticket ya ha sido utilizado para salir del estacionamiento.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment Form */}
      {showPaymentForm && canPay && (
        <PaymentForm
          ticketCode={ticket.codigoTicket}
          amount={ticket.montoCalculado}
          amountBs={ticket.montoBs}
          onSuccess={() => {
            setShowPaymentForm(false)
            // Refresh the page to show updated status
            window.location.reload()
          }}
          onCancel={() => setShowPaymentForm(false)}
        />
      )}
    </div>
  )
}
