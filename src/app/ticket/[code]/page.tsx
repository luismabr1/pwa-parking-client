"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle, Car, Clock, DollarSign, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import PaymentForm from "@/components/payment-form";
import Link from "next/link";
import type { Ticket } from "@/lib/types";

// Updated interface to include montoBs and tasaCambio
interface TicketWithBs extends Ticket {
  montoBs?: number;
  tasaCambio?: number;
}

export default function TicketDetailsPage() {
  const params = useParams();
  const ticketCode = params.code as string;
  // Use the updated interface
  const [ticket, setTicket] = useState<TicketWithBs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  useEffect(() => {
    if (ticketCode) {
      fetchTicketDetails();
    }
  }, [ticketCode]);

  const fetchTicketDetails = async () => {
    try {
      setIsLoading(true);
      setError("");

      console.log(`🔍 Página: Cargando detalles para ticket ${ticketCode}`);

      const response = await fetch(`/api/ticket/${ticketCode}`);

      console.log(`📡 Respuesta del servidor: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const ticketData = await response.json();
        console.log(`✅ Página: Datos recibidos para ${ticketCode}:`, ticketData);
        setTicket(ticketData);
      } else {
        const errorData = await response.json();
        console.log(`❌ Página: Error para ${ticketCode}:`, errorData);
        setError(errorData.message || "Error al cargar los detalles del ticket");
      }
    } catch (err) {
      console.error("❌ Página: Error de conexión:", err);
      setError("Error de conexión. Por favor intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    fetchTicketDetails();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Cargando detalles del ticket {ticketCode}...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error</h2>
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Button onClick={handleRetry} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Reintentar
              </Button>

              <Link href="/">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver al Inicio
                </Button>
              </Link>

              {ticketCode.startsWith("PARK") && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
                  <p className="text-blue-800 font-medium">💡 Sugerencia:</p>
                  <p className="text-blue-700">
                    Si este es un ticket nuevo (PARK001-PARK005), asegúrate de que se haya registrado un carro en el
                    panel de administración primero.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Ticket no encontrado</h2>
            <p className="text-gray-600 mb-4">No se pudo encontrar el ticket solicitado o ya ha sido procesado.</p>
            <Link href="/">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al Inicio
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showPaymentForm) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="mb-4">
            <Button onClick={() => setShowPaymentForm(false)} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Detalles
            </Button>
          </div>
          <PaymentForm ticket={ticket} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Inicio
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Detalles del Ticket</CardTitle>
            <p className="text-gray-600">Información de estacionamiento y pago</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Información del Ticket */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <div className="w-4 h-4 bg-blue-600 rounded"></div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Código de Ticket</p>
                    <p className="text-lg font-semibold font-mono">{ticket.codigoTicket}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Clock className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-500">Hora de Entrada</p>
                    <p className="text-lg font-semibold">{formatDateTime(ticket.horaEntrada)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Información del Vehículo si existe */}
            {ticket.carInfo && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-3">
                  <Car className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-800">Información del Vehículo</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Placa:</span>
                    <span className="font-medium ml-2">{ticket.carInfo.placa}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Vehículo:</span>
                    <span className="font-medium ml-2">
                      {ticket.carInfo.marca} {ticket.carInfo.modelo}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Color:</span>
                    <span className="font-medium ml-2">{ticket.carInfo.color}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Propietario:</span>
                    <span className="font-medium ml-2">{ticket.carInfo.nombreDueño}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Monto a Pagar */}
            <div className="text-center p-6 bg-green-50 rounded-lg">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <DollarSign className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Monto a Pagar</p>
                  <p className="text-3xl font-bold text-green-600">{formatCurrency(ticket.montoCalculado)}</p>
                  {ticket.montoBs && (
                    <p className="text-lg font-medium text-green-500">
                      Bs.{" "}
                      {ticket.montoBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-500">Calculado automáticamente basado en el tiempo de estacionamiento</p>
              {ticket.tasaCambio && (
                <p className="text-xs text-gray-400 mt-1">
                  Tasa de cambio:{" "}
                  {ticket.tasaCambio.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                  Bs/USD
                </p>
              )}
            </div>

            {/* Botón de Pago */}
            <Button onClick={() => setShowPaymentForm(true)} className="w-full h-12 text-lg">
              Proceder al Pago
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
