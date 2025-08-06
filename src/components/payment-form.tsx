"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Clock,
  Eye,
  Upload,
  X,
  ImageIcon,
  Bell,
  Check,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatCurrency } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import type { Ticket, PaymentFormData, CompanySettings } from "@/lib/types"
import { useTicketNotifications } from "@/hooks/use-ticket-notification"
import NotificationPrompt from "@/components/notifications/notification-prompt"

// Updated interface to include montoBs and tasaCambio
interface TicketWithBs extends Ticket {
  montoBs?: number
  tasaCambio?: number
}

interface Bank {
  _id: string
  code: string
  name: string
}

interface PaymentFormProps {
  ticket: TicketWithBs
}

// Opciones de tiempo de salida
const exitTimeOptions = [
  { value: "now", label: "Ahora", minutes: 0 },
  { value: "5min", label: "En 5 minutos", minutes: 5 },
  { value: "10min", label: "En 10 minutos", minutes: 10 },
  { value: "15min", label: "En 15 minutos", minutes: 15 },
  { value: "20min", label: "En 20 minutos", minutes: 20 },
  { value: "30min", label: "En 30 minutos", minutes: 30 },
  { value: "45min", label: "En 45 minutos", minutes: 45 },
  { value: "60min", label: "En 1 hora", minutes: 60 },
]

// Opciones de tipo de identidad
const identityTypeOptions = [
  { value: "V", label: "Natural" },
  { value: "J", label: "Jurídico" },
  { value: "E", label: "Extranjero" },
]

// Función para validar teléfono en tiempo real
const validatePhoneNumber = (phone: string): { isValid: boolean; message: string } => {
  if (!phone) {
    return { isValid: false, message: "El teléfono es requerido" }
  }

  const cleanPhone = phone.replace(/[-\s]/g, "") // Remover guiones y espacios

  if (cleanPhone.length < 11) {
    return { isValid: false, message: `Faltan ${11 - cleanPhone.length} dígitos (formato: 04XX-XXXXXXX)` }
  }

  if (cleanPhone.length > 11) {
    return { isValid: false, message: `Sobran ${cleanPhone.length - 11} dígitos (formato: 04XX-XXXXXXX)` }
  }

  if (!cleanPhone.startsWith("04")) {
    return { isValid: false, message: "Debe comenzar con 04" }
  }

  if (!/^04\d{9}$/.test(cleanPhone)) {
    return { isValid: false, message: "Solo se permiten números (formato: 04XX-XXXXXXX)" }
  }

  return { isValid: true, message: "Número válido" }
}

// Función para validar número de identidad
const validateIdentityNumber = (
  identityType: string,
  identityNumber: string,
): { isValid: boolean; message: string } => {
  if (!identityType) {
    return { isValid: false, message: "Seleccione el tipo de identidad" }
  }

  if (!identityNumber) {
    return { isValid: false, message: "El número de identidad es requerido" }
  }

  // Remover espacios y guiones
  const cleanNumber = identityNumber.replace(/[-\s]/g, "")

  // Validar que solo contenga números
  if (!/^\d+$/.test(cleanNumber)) {
    return { isValid: false, message: "Solo se permiten números" }
  }

  // Validar longitud según el tipo
  let minLength = 7
  let maxLength = 10

  if (identityType === "E") {
    minLength = 8
    maxLength = 12
  }

  if (cleanNumber.length < minLength) {
    return { isValid: false, message: `Mínimo ${minLength} dígitos` }
  }

  if (cleanNumber.length > maxLength) {
    return { isValid: false, message: `Máximo ${maxLength} dígitos` }
  }

  return { isValid: true, message: "Número válido" }
}

// Función para formatear el número de identidad completo
const formatFullIdentityNumber = (identityType: string, identityNumber: string): string => {
  if (!identityType || !identityNumber) return ""

  const cleanNumber = identityNumber.replace(/[-\s]/g, "")
  return `${identityType}-${cleanNumber}`
}

export default function PaymentForm({ ticket }: PaymentFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [paymentType, setPaymentType] = useState<
    "pago_movil" | "transferencia" | "efectivo_bs" | "efectivo_usd" | null
  >(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [banks, setBanks] = useState<Bank[]>([])
  const [loadingBanks, setLoadingBanks] = useState(true)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false)

  // Estado para validación de teléfono en tiempo real
  const [phoneValidation, setPhoneValidation] = useState<{ isValid: boolean; message: string }>({
    isValid: false,
    message: "",
  })

  // Estado para validación de identidad en tiempo real
  const [identityValidation, setIdentityValidation] = useState<{ isValid: boolean; message: string }>({
    isValid: false,
    message: "",
  })

  // Hook para notificaciones del ticket
  const {
    isSupported: notificationsSupported,
    isSubscribed: notificationsEnabled,
    isRegistered: ticketNotificationsRegistered,
    enableNotificationsForTicket,
  } = useTicketNotifications(ticket.codigoTicket)

  // Calculate montoBs using ticket.tasaCambio, fallback to companySettings if unavailable
  const tasaCambio = ticket.tasaCambio || companySettings?.tarifas?.tasaCambio || 1
  const montoBs = ticket.montoBs || ticket.montoCalculado * tasaCambio

  // Initialize formData with a neutral value, updated by paymentType selection
  const [formData, setFormData] = useState<PaymentFormData & { tiempoSalida?: string; tipoIdentidad?: string }>({
    referenciaTransferencia: "",
    banco: "",
    telefono: "",
    numeroIdentidad: "",
    tipoIdentidad: "V", // Valor por defecto
    montoPagado: ticket.montoCalculado, // Default to USD value
    tiempoSalida: "now",
  })

  useEffect(() => {
    Promise.all([fetchCompanySettings(), fetchBanks()])
      .then(() => {
        setLoadingSettings(false)
        setLoadingBanks(false)
      })
      .catch((error) => {
        console.error("Error initializing:", error)
        setLoadingSettings(false)
        setLoadingBanks(false)
      })
  }, [])

  const fetchCompanySettings = async () => {
    try {
      const response = await fetch("/api/company-settings")
      if (response.ok) {
        const data = await response.json()
        setCompanySettings(data)
      } else {
        console.error("Error fetching company settings")
      }
    } catch (error) {
      console.error("Error:", error)
    }
  }

  const fetchBanks = async () => {
    try {
      const response = await fetch("/api/banks")
      if (response.ok) {
        const data = await response.json()
        setBanks(data)
      } else {
        console.error("Error fetching banks")
      }
    } catch (error) {
      console.error("Error:", error)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

    // Validación en tiempo real para el teléfono
    if (name === "telefono") {
      const validation = validatePhoneNumber(value)
      setPhoneValidation(validation)
    }

    // Validación en tiempo real para el número de identidad
    if (name === "numeroIdentidad") {
      const validation = validateIdentityNumber(formData.tipoIdentidad || "V", value)
      setIdentityValidation(validation)
    }
  }

  const handleBankChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      banco: value,
    }))
  }

  const handleExitTimeChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      tiempoSalida: value,
    }))
  }

  const handleIdentityTypeChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      tipoIdentidad: value,
    }))

    // Revalidar el número de identidad con el nuevo tipo
    if (formData.numeroIdentidad) {
      const validation = validateIdentityNumber(value, formData.numeroIdentidad)
      setIdentityValidation(validation)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Por favor seleccione un archivo de imagen válido")
        return
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("La imagen debe ser menor a 5MB")
        return
      }

      setSelectedImage(file)

      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
      setError("")
    }
  }

  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        console.log(`🖼️ [FRONTEND] Imagen convertida - Archivo: ${file.name}`)
        console.log(`🖼️ [FRONTEND] Tamaño original: ${file.size} bytes`)
        console.log(`🖼️ [FRONTEND] Base64 longitud: ${result.length} caracteres`)
        console.log(`🖼️ [FRONTEND] Primeros 100 chars: ${result.substring(0, 100)}`)
        resolve(result)
      }
      reader.onerror = (error) => {
        console.error("❌ [FRONTEND] Error convirtiendo imagen:", error)
        reject(error)
      }
      reader.readAsDataURL(file)
    })
  }

  const getExitTimeLabel = (value: string) => {
    const option = exitTimeOptions.find((opt) => opt.value === value)
    return option ? option.label : "Ahora"
  }

  const getExitDateTime = (value: string) => {
    const option = exitTimeOptions.find((opt) => opt.value === value)
    if (!option) return new Date()

    const exitTime = new Date()
    exitTime.setMinutes(exitTime.getMinutes() + option.minutes)
    return exitTime
  }

  // Función para mostrar prompt de notificaciones antes del pago
  const checkNotificationsBeforePayment = () => {
    // Solo mostrar si las notificaciones son soportadas y no están activadas para este ticket
    if (notificationsSupported && !ticketNotificationsRegistered && !notificationsEnabled) {
      setShowNotificationPrompt(true)
      return
    }

    // Si ya están activadas, proceder directamente
    handleSubmit()
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    setError("")

    try {
      let imagenComprobante = null
      if (selectedImage) {
        imagenComprobante = await convertImageToBase64(selectedImage)
      }

      // Formatear el número de identidad completo
      const numeroIdentidadCompleto = formatFullIdentityNumber(formData.tipoIdentidad || "V", formData.numeroIdentidad)

      const paymentData = {
        codigoTicket: ticket.codigoTicket,
        tipoPago: paymentType,
        montoPagado: formData.montoPagado,
        tiempoSalida: formData.tiempoSalida || "now",
        referenciaTransferencia: formData.referenciaTransferencia || undefined,
        banco: formData.banco || undefined,
        telefono: formData.telefono || undefined,
        numeroIdentidad: numeroIdentidadCompleto || undefined,
        imagenComprobante: imagenComprobante || undefined,
      }

      // Limpiar campos vacíos para pagos en efectivo
      if (paymentType?.startsWith("efectivo")) {
        delete paymentData.referenciaTransferencia
        delete paymentData.banco
        delete paymentData.telefono
        delete paymentData.numeroIdentidad
      }

      console.log("Enviando datos de pago:", paymentData)

      const response = await fetch("/api/process-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paymentData),
      })

      const responseData = await response.json()

      if (!response.ok) {
        console.error("Error response:", responseData)
        throw new Error(responseData.message || "Error al procesar el pago")
      }

      setSuccess(true)
    } catch (err) {
      console.error("Error en handleSubmit:", err)
      setError(err instanceof Error ? err.message : "Error al procesar el pago")
    } finally {
      setIsLoading(false)
    }
  }

  const nextStep = () => setCurrentStep((prev) => prev + 1)
  const prevStep = () => setCurrentStep((prev) => prev - 1)

  const isFormValid = () => {
    if (currentStep === 3 && (paymentType === "pago_movil" || paymentType === "transferencia")) {
      return (
        formData.referenciaTransferencia.trim() !== "" &&
        formData.banco.trim() !== "" &&
        phoneValidation.isValid &&
        identityValidation.isValid &&
        formData.montoPagado > 0 &&
        formData.tiempoSalida
      )
    }
    return true
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">¡Pago Registrado!</h2>
            <p className="text-lg text-muted-foreground mb-4">
              {paymentType?.startsWith("efectivo")
                ? "Su solicitud de pago en efectivo ha sido registrada. Diríjase a la taquilla para completar el pago."
                : "El pago ha sido registrado y está Pendiente de Validación por el personal del estacionamiento."}
            </p>

            {/* Mostrar estado de notificaciones */}
            {ticketNotificationsRegistered && (
              <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg mb-4 border border-green-200 dark:border-green-800/30">
                <div className="flex items-center justify-center space-x-2 text-green-800 dark:text-green-200">
                  <Bell className="h-5 w-5" />
                  <span className="font-medium">Notificaciones activadas para este ticket</span>
                </div>
                <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                  Te notificaremos cuando tu pago sea validado
                </p>
              </div>
            )}

            {formData.tiempoSalida && formData.tiempoSalida !== "now" && (
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg mb-4 border border-blue-200 dark:border-blue-800/30">
                <div className="flex items-center justify-center space-x-2 text-blue-800 dark:text-blue-200">
                  <Clock className="h-5 w-5" />
                  <span className="font-medium">
                    Tiempo de salida programado: {getExitTimeLabel(formData.tiempoSalida)}
                  </span>
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                  Salida estimada:{" "}
                  {getExitDateTime(formData.tiempoSalida).toLocaleTimeString("es-VE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            )}
            <Button onClick={() => router.push("/")} className="w-full h-12 text-lg">
              Volver al Inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isLoaded = !loadingSettings && !loadingBanks

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="mb-6">
            <div className="flex justify-between mb-2">
              <div className={`h-2 flex-1 rounded-l-full ${currentStep >= 1 ? "bg-primary" : "bg-muted"}`}></div>
              <div className={`h-2 flex-1 ${currentStep >= 2 ? "bg-primary" : "bg-muted"}`}></div>
              <div className={`h-2 flex-1 ${currentStep >= 3 ? "bg-primary" : "bg-muted"}`}></div>
              <div className={`h-2 flex-1 rounded-r-full ${currentStep >= 4 ? "bg-primary" : "bg-muted"}`}></div>
            </div>
            <p className="text-center text-sm text-muted-foreground">Paso {currentStep} de 4</p>
          </div>

          {error && (
            <Alert className="mb-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* PASO 1: Selección de método de pago */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold mb-4">Seleccione Método de Pago</h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Código de Ticket</p>
                    <p className="text-lg font-medium">{ticket.codigoTicket}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Monto a Pagar</p>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(ticket.montoCalculado)}</p>
                    {ticket.montoBs && (
                      <p className="text-lg text-muted-foreground">{formatCurrency(ticket.montoBs, "VES")}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-center mb-4">Métodos de Pago Disponibles</h3>

                {/* Pago Móvil */}
                {companySettings?.pagoMovil?.banco && (
                  <Button
                    onClick={() => {
                      setPaymentType("pago_movil")
                      setFormData((prev) => ({ ...prev, montoPagado: montoBs }))
                      nextStep()
                    }}
                    variant={paymentType === "pago_movil" ? "default" : "outline"}
                    className="w-full h-16 text-left justify-between"
                  >
                    <div>
                      <div className="font-medium">Pago Móvil</div>
                      <div className="text-sm opacity-75">Transferencia instantánea</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">
                        {ticket.montoBs
                          ? formatCurrency(ticket.montoBs, "VES")
                          : formatCurrency(ticket.montoCalculado * tasaCambio, "VES")}
                      </div>
                    </div>
                  </Button>
                )}

                {/* Transferencia Bancaria */}
                {companySettings?.transferencia?.banco && (
                  <Button
                    onClick={() => {
                      setPaymentType("transferencia")
                      setFormData((prev) => ({ ...prev, montoPagado: montoBs }))
                      nextStep()
                    }}
                    variant={paymentType === "transferencia" ? "default" : "outline"}
                    className="w-full h-16 text-left justify-between"
                  >
                    <div>
                      <div className="font-medium">Transferencia Bancaria</div>
                      <div className="text-sm opacity-75">Transferencia tradicional</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">
                        {ticket.montoBs
                          ? formatCurrency(ticket.montoBs, "VES")
                          : formatCurrency(ticket.montoCalculado * tasaCambio, "VES")}
                      </div>
                    </div>
                  </Button>
                )}

                {/* Efectivo Bolívares */}
                <Button
                  onClick={() => {
                    setPaymentType("efectivo_bs")
                    setFormData((prev) => ({ ...prev, montoPagado: montoBs }))
                    setCurrentStep(4)
                  }}
                  variant={paymentType === "efectivo_bs" ? "default" : "outline"}
                  className="w-full h-16 text-left justify-between"
                >
                  <div>
                    <div className="font-medium">Efectivo (Bolívares)</div>
                    <div className="text-sm opacity-75">Pago en taquilla</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCurrency(montoBs, "VES")}</div>
                    <div className="text-sm opacity-75">{formatCurrency(ticket.montoCalculado)}</div>
                  </div>
                </Button>

                {/* Efectivo USD */}
                {companySettings?.tarifas?.tasaCambio && (
                  <Button
                    onClick={() => {
                      setPaymentType("efectivo_usd")
                      setFormData((prev) => ({ ...prev, montoPagado: ticket.montoCalculado }))
                      setCurrentStep(4)
                    }}
                    variant={paymentType === "efectivo_usd" ? "default" : "outline"}
                    className="w-full h-16 text-left justify-between"
                  >
                    <div>
                      <div className="font-medium">Efectivo (USD)</div>
                      <div className="text-sm opacity-75">Pago en taquilla</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatCurrency(ticket.montoCalculado)}</div>
                      {ticket.montoBs && (
                        <div className="text-sm opacity-75">{formatCurrency(ticket.montoBs, "VES")}</div>
                      )}
                    </div>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* PASO 2: Información bancaria de la empresa (solo para pagos electrónicos) */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold mb-4">Información de Pago</h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Código de Ticket</p>
                    <p className="text-lg font-medium">{ticket.codigoTicket}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Monto a Pagar</p>
                    <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800/30">
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(montoBs, "VES")}
                      </p>
                      <p className="text-lg font-medium text-green-500 dark:text-green-300">
                        {formatCurrency(ticket.montoCalculado)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {!isLoaded ? (
                <div className="flex justify-center py-4">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4 bg-muted/50 p-4 rounded-lg border">
                  <h3 className="font-semibold text-center">Datos para realizar el pago</h3>

                  {companySettings && paymentType && (
                    <>
                      {/* Sección de Pago Móvil */}
                      {paymentType === "pago_movil" &&
                        (companySettings.pagoMovil.banco ||
                          companySettings.pagoMovil.cedula ||
                          companySettings.pagoMovil.telefono) && (
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm text-foreground">Pago Móvil</h4>
                            {companySettings.pagoMovil.banco && (
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Banco:</span>
                                <span className="text-sm font-medium">{companySettings.pagoMovil.banco}</span>
                              </div>
                            )}
                            {companySettings.pagoMovil.cedula && (
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Cédula/RIF:</span>
                                <span className="text-sm font-medium">{companySettings.pagoMovil.cedula}</span>
                              </div>
                            )}
                            {companySettings.pagoMovil.telefono && (
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Teléfono:</span>
                                <span className="text-sm font-medium">{companySettings.pagoMovil.telefono}</span>
                              </div>
                            )}
                          </div>
                        )}

                      {/* Sección de Transferencia */}
                      {paymentType === "transferencia" &&
                        (companySettings.transferencia.banco ||
                          companySettings.transferencia.cedula ||
                          companySettings.transferencia.telefono ||
                          companySettings.transferencia.numeroCuenta) && (
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm text-foreground">Transferencia Bancaria</h4>
                            {companySettings.transferencia.banco && (
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Banco:</span>
                                <span className="text-sm font-medium">{companySettings.transferencia.banco}</span>
                              </div>
                            )}
                            {companySettings.transferencia.cedula && (
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Cédula/RIF:</span>
                                <span className="text-sm font-medium">{companySettings.transferencia.cedula}</span>
                              </div>
                            )}
                            {companySettings.transferencia.numeroCuenta && (
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Número de Cuenta:</span>
                                <span className="text-sm font-medium">
                                  {companySettings.transferencia.numeroCuenta}
                                </span>
                              </div>
                            )}
                            {companySettings.transferencia.telefono && (
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Teléfono:</span>
                                <span className="text-sm font-medium">{companySettings.transferencia.telefono}</span>
                              </div>
                            )}
                          </div>
                        )}

                      {!companySettings.pagoMovil.banco && !companySettings.transferencia.banco && (
                        <div className="text-center text-muted-foreground py-2">
                          <p>No hay información de pago configurada</p>
                        </div>
                      )}
                    </>
                  )}

                  <div className="text-sm text-muted-foreground text-center pt-2">
                    <p>
                      Realice su pago utilizando los datos bancarios proporcionados y luego registre los detalles de su
                      transferencia.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <Button onClick={prevStep} variant="outline" className="flex-1 h-12 text-lg">
                  <ArrowLeft className="mr-2 h-5 w-5" /> Anterior
                </Button>
                <Button onClick={nextStep} className="flex-1 h-12 text-lg">
                  Continuar <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* PASO 3: Formulario de detalles de transferencia */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-4 text-center">Detalles de Transferencia</h2>

              <div className="space-y-4">
                {/* Selector de tiempo de salida */}
                <div className="space-y-2">
                  <Label htmlFor="tiempoSalida" className="text-sm font-medium flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    ¿Cuándo planea salir?
                  </Label>
                  <Select value={formData.tiempoSalida} onValueChange={handleExitTimeChange}>
                    <SelectTrigger id="tiempoSalida" className="h-12 text-lg">
                      <SelectValue placeholder="Seleccione tiempo de salida" />
                    </SelectTrigger>
                    <SelectContent>
                      {exitTimeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Esta información ayudará al personal a gestionar mejor los espacios
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Monto a Pagar</p>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg mb-4 border border-green-200 dark:border-green-800/30">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(montoBs, "VES")}
                    </p>
                    <p className="text-lg font-medium text-green-500 dark:text-green-300">
                      {formatCurrency(ticket.montoCalculado)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="referenciaTransferencia" className="text-sm font-medium">
                    Referencia de la Transferencia
                  </label>
                  <Input
                    id="referenciaTransferencia"
                    name="referenciaTransferencia"
                    value={formData.referenciaTransferencia}
                    onChange={handleChange}
                    className="h-12 text-lg"
                    placeholder="Ej. 123456789"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="banco" className="text-sm font-medium">
                    Banco
                  </label>
                  <Select value={formData.banco} onValueChange={handleBankChange}>
                    <SelectTrigger id="banco" className="h-12 text-lg">
                      <SelectValue placeholder="Seleccione su banco" />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((bank) => (
                        <SelectItem key={bank.code} value={bank.name}>
                          {bank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="telefono" className="text-sm font-medium">
                    Teléfono
                  </label>
                  <div className="relative">
                    <Input
                      id="telefono"
                      name="telefono"
                      value={formData.telefono}
                      onChange={handleChange}
                      className={`h-12 text-lg pr-10 ${
                        formData.telefono && phoneValidation.isValid
                          ? "border-green-500 focus:border-green-500"
                          : formData.telefono && !phoneValidation.isValid
                            ? "border-red-500 focus:border-red-500"
                            : ""
                      }`}
                      placeholder="Ej. 04141234567"
                      required
                    />
                    {formData.telefono && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        {phoneValidation.isValid ? (
                          <Check className="h-5 w-5 text-green-500" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                  {formData.telefono && (
                    <p className={`text-sm ${phoneValidation.isValid ? "text-green-600" : "text-red-600"}`}>
                      {phoneValidation.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Formato: 04XX-XXXXXXX (11 dígitos total)</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="tipoIdentidad" className="text-sm font-medium">
                    Tipo de Identidad
                  </label>
                  <Select value={formData.tipoIdentidad} onValueChange={handleIdentityTypeChange}>
                    <SelectTrigger id="tipoIdentidad" className="h-12 text-lg">
                      <SelectValue placeholder="Seleccione tipo de identidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {identityTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="numeroIdentidad" className="text-sm font-medium">
                    Número de Identidad
                  </label>
                  <div className="relative">
                    <div className="flex">
                      <div className="flex items-center px-3 bg-muted border border-r-0 rounded-l-md">
                        <span className="text-sm font-medium">{formData.tipoIdentidad || "V"}-</span>
                      </div>
                      <Input
                        id="numeroIdentidad"
                        name="numeroIdentidad"
                        value={formData.numeroIdentidad}
                        onChange={handleChange}
                        className={`h-12 text-lg rounded-l-none pr-10 ${
                          formData.numeroIdentidad && identityValidation.isValid
                            ? "border-green-500 focus:border-green-500"
                            : formData.numeroIdentidad && !identityValidation.isValid
                              ? "border-red-500 focus:border-red-500"
                              : ""
                        }`}
                        placeholder="12345678"
                        required
                      />
                      {formData.numeroIdentidad && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          {identityValidation.isValid ? (
                            <Check className="h-5 w-5 text-green-500" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {formData.numeroIdentidad && (
                    <p className={`text-sm ${identityValidation.isValid ? "text-green-600" : "text-red-600"}`}>
                      {identityValidation.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Solo números, sin guiones ni espacios</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="montoPagado" className="text-sm font-medium">
                    Monto Pagado (Bs.)
                  </label>
                  <Input
                    id="montoPagado"
                    name="montoPagado"
                    type="number"
                    step="0.01"
                    value={formData.montoPagado}
                    onChange={handleChange}
                    className="h-12 text-lg"
                    placeholder={`${formatCurrency(montoBs, "VES")}`}
                    required
                  />
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                    Referencia: {formatCurrency(montoBs, "VES")} ({formatCurrency(ticket.montoCalculado)})
                  </p>
                </div>

                {/* Sección de imagen opcional */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center">
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Comprobante de Pago (Opcional)
                  </label>
                  <div className="space-y-2">
                    {!selectedImage ? (
                      <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">Suba una captura del resumen de su pago</p>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-sm"
                        >
                          Seleccionar Imagen
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="border rounded-lg p-2 bg-muted/50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-green-600 dark:text-green-400">
                              ✓ Imagen seleccionada
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={removeImage}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          {imagePreview && (
                            <img
                              src={imagePreview || "/placeholder.svg"}
                              alt="Vista previa"
                              className="w-full h-32 object-cover rounded"
                            />
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {selectedImage.name} ({(selectedImage.size / 1024 / 1024).toFixed(2)} MB)
                          </p>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Formatos soportados: JPG, PNG, GIF. Tamaño máximo: 5MB
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button onClick={prevStep} variant="outline" className="flex-1 h-12 text-lg">
                  <ArrowLeft className="mr-2 h-5 w-5" /> Anterior
                </Button>
                <Button onClick={nextStep} className="flex-1 h-12 text-lg" disabled={!isFormValid()}>
                  Ver Resumen <Eye className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* PASO 4: Vista previa y confirmación (para pagos electrónicos) o Efectivo */}
          {currentStep === 4 && (
            <div className="space-y-6">
              {paymentType?.startsWith("efectivo") ? (
                // Pantalla de efectivo
                <>
                  <h2 className="text-xl font-bold mb-4 text-center">Pago en Efectivo</h2>
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-6 rounded-lg text-center border border-blue-200 dark:border-blue-800/30">
                    <div className="text-6xl mb-4">💰</div>
                    <h3 className="text-lg font-semibold mb-2">Acérquese a la Taquilla</h3>
                    <p className="text-muted-foreground mb-4">
                      Para completar su pago en efectivo, diríjase a la taquilla del estacionamiento.
                    </p>
                    <div className="bg-card p-4 rounded-lg border">
                      <p className="text-sm text-muted-foreground mb-1">Código de Ticket</p>
                      <p className="text-xl font-bold mb-3">{ticket.codigoTicket}</p>
                      <p className="text-sm text-muted-foreground mb-1">Monto a Pagar</p>
                      {paymentType === "efectivo_bs" ? (
                        <div>
                          <p className="text-2xl font-bold text-primary">
                            {formatCurrency(formData.montoPagado, "VES")}
                          </p>
                          <p className="text-lg text-muted-foreground">{formatCurrency(ticket.montoCalculado)}</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-2xl font-bold text-primary">{formatCurrency(formData.montoPagado)}</p>
                          <p className="text-lg text-muted-foreground">{formatCurrency(montoBs, "VES")}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={checkNotificationsBeforePayment}
                    className="w-full h-12 text-lg"
                    disabled={isLoading}
                  >
                    {isLoading ? "Registrando..." : "Registrar Solicitud de Pago"}
                  </Button>
                </>
              ) : (
                // Vista previa para pagos electrónicos
                <>
                  <h2 className="text-xl font-bold mb-4 text-center">Confirmar Datos del Pago</h2>
                  <div className="bg-muted/50 p-6 rounded-lg space-y-4 border">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Código de Ticket</p>
                      <p className="text-lg font-bold">{ticket.codigoTicket}</p>
                    </div>

                    <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800/30">
                      <p className="text-sm text-muted-foreground mb-1">Monto a Pagar</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(montoBs, "VES")}
                      </p>
                      <p className="text-lg font-medium text-green-500 dark:text-green-300">
                        {formatCurrency(ticket.montoCalculado)}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-semibold text-center">Detalles del Pago</h3>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Tipo de Pago:</p>
                          <p className="font-medium">
                            {paymentType === "pago_movil" ? "Pago Móvil" : "Transferencia Bancaria"}
                          </p>
                        </div>

                        <div>
                          <p className="text-muted-foreground">Tiempo de Salida:</p>
                          <p className="font-medium">{getExitTimeLabel(formData.tiempoSalida || "now")}</p>
                        </div>

                        <div>
                          <p className="text-muted-foreground">Referencia:</p>
                          <p className="font-medium">{formData.referenciaTransferencia}</p>
                        </div>

                        <div>
                          <p className="text-muted-foreground">Banco:</p>
                          <p className="font-medium">{formData.banco}</p>
                        </div>

                        <div>
                          <p className="text-muted-foreground">Teléfono:</p>
                          <p className="font-medium">{formData.telefono}</p>
                        </div>

                        <div>
                          <p className="text-muted-foreground">Identidad:</p>
                          <p className="font-medium">
                            {formatFullIdentityNumber(formData.tipoIdentidad || "V", formData.numeroIdentidad)}
                          </p>
                        </div>
                      </div>

                      {selectedImage && (
                        <div className="mt-4">
                          <p className="text-muted-foreground text-sm mb-2">Comprobante adjunto:</p>
                          <div className="border rounded-lg p-2 bg-card">
                            <img
                              src={imagePreview! || "/placeholder.svg"}
                              alt="Comprobante de pago"
                              className="w-full h-32 object-cover rounded"
                            />
                            <p className="text-xs text-muted-foreground mt-1 text-center">{selectedImage.name}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="text-center text-sm text-muted-foreground pt-2">
                      <p>Verifique que todos los datos sean correctos antes de confirmar el pago.</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Button onClick={prevStep} variant="outline" className="flex-1 h-12 text-lg">
                      <ArrowLeft className="mr-2 h-5 w-5" /> Corregir Datos
                    </Button>
                    <Button
                      onClick={checkNotificationsBeforePayment}
                      className="flex-1 h-12 text-lg"
                      disabled={isLoading}
                    >
                      {isLoading ? "Registrando..." : "Confirmar Pago"} <CheckCircle2 className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para prompt de notificaciones */}
      <Dialog open={showNotificationPrompt} onOpenChange={setShowNotificationPrompt}>
        <DialogContent className="sm:max-w-md bg-background border-border p-4 shadow-2xl">
          <DialogHeader>
            <DialogTitle>Activar Notificaciones</DialogTitle>
            <DialogDescription>
              ¿Te gustaría recibir notificaciones sobre el estado de tu pago para el ticket {ticket.codigoTicket}?
            </DialogDescription>
          </DialogHeader>
          <NotificationPrompt
            ticketCode={ticket.codigoTicket}
            onEnable={enableNotificationsForTicket}
            onSkip={() => {
              setShowNotificationPrompt(false)
              handleSubmit()
            }}
            isLoading={isLoading}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
