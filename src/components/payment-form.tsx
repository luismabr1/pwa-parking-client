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
  Copy,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatCurrency } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import type { Ticket, PaymentFormData, CompanySettings } from "@/lib/types"
import { useTicketNotifications } from "@/hooks/use-ticket-notification"
import NotificationPrompt from "@/components/notifications/notification-prompt"

// Verificar si las notificaciones están habilitadas via variable de entorno
const NOTIFICATIONS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS === "true"

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
  const cleanPhone = phone.replace(/[-\s]/g, "")
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
  const cleanNumber = identityNumber.replace(/[-\s]/g, "")
  if (!/^\d+$/.test(cleanNumber)) {
    return { isValid: false, message: "Solo se permiten números" }
  }
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
  const [currentStep, setCurrentStep] = useState(0)
  const [paymentType, setPaymentType] = useState<
    "pago_movil" | "transferencia" | "efectivo_bs" | "efectivo_usd" | null
  >(null)
  const [isMultiplePayment, setIsMultiplePayment] = useState(false)
  const [ticketQuantity, setTicketQuantity] = useState(1)
  const [validTicketCount, setValidTicketCount] = useState(1) // Default to 1
  const [validTicketCodes, setValidTicketCodes] = useState<string[]>([ticket.codigoTicket])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [banks, setBanks] = useState<Bank[]>([])
  const [loadingBanks, setLoadingBanks] = useState(true)
  const [loadingValidTickets, setLoadingValidTickets] = useState(true)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false)
  const [copySuccess, setCopySuccess] = useState<string | null>(null)
  const [phoneValidation, setPhoneValidation] = useState<{ isValid: boolean; message: string }>({
    isValid: false,
    message: "",
  })
  const [identityValidation, setIdentityValidation] = useState<{ isValid: boolean; message: string }>({
    isValid: false,
    message: "",
  })
  const {
    isSupported: notificationsSupported,
    isSubscribed: notificationsEnabled,
    isRegistered: ticketNotificationsRegistered,
    enableNotificationsForTicket,
  } = useTicketNotifications(ticket.codigoTicket)

  // Calculate montoBs and totals
  const tasaCambio = ticket.tasaCambio || companySettings?.tarifas?.tasaCambio || 1
  const montoBs = ticket.montoBs || ticket.montoCalculado * tasaCambio
  const totalMontoUsd = ticket.montoCalculado * ticketQuantity
  const totalMontoBs = montoBs * ticketQuantity

  const [formData, setFormData] = useState<
    PaymentFormData & {
      tiempoSalida?: string
      tipoIdentidad?: string
      isMultiplePayment?: boolean
      ticketQuantity?: number
      ticketCodes?: string[]
    }
  >({
    referenciaTransferencia: "",
    banco: "",
    telefono: "",
    numeroIdentidad: "",
    tipoIdentidad: "V",
    montoPagado: ticket.montoCalculado,
    tiempoSalida: "now",
    isMultiplePayment: false,
    ticketQuantity: 1,
    ticketCodes: [ticket.codigoTicket],
  })

  useEffect(() => {
    Promise.all([fetchCompanySettings(), fetchBanks(), fetchValidTickets()])
      .then(() => {
        setLoadingSettings(false)
        setLoadingBanks(false)
        setLoadingValidTickets(false)
      })
      .catch((error) => {
        console.error("Error initializing:", error)
        setLoadingSettings(false)
        setLoadingBanks(false)
        setLoadingValidTickets(false)
        setError("Error al cargar datos iniciales")
      })
  }, [])

  useEffect(() => {
    // Enforce minimum of 2 for multiple payment and cap at validTicketCount
    const minQuantity = isMultiplePayment ? 2 : 1
    const newTicketQuantity = Math.max(minQuantity, Math.min(ticketQuantity, validTicketCount))
    setTicketQuantity(newTicketQuantity)
    setFormData((prev) => ({
      ...prev,
      isMultiplePayment,
      ticketQuantity: newTicketQuantity,
      ticketCodes: validTicketCodes.slice(0, newTicketQuantity),
      montoPagado: paymentType?.startsWith("efectivo_usd")
        ? totalMontoUsd
        : paymentType
          ? totalMontoBs
          : paymentType === "pago_movil" || paymentType === "transferencia"
            ? totalMontoBs
            : totalMontoUsd,
    }))
  }, [isMultiplePayment, ticketQuantity, validTicketCount, validTicketCodes, paymentType, totalMontoUsd, totalMontoBs])

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

  const fetchValidTickets = async () => {
    try {
      const response = await fetch(`/api/tickets/valid?ticketCode=${ticket.codigoTicket}`)
      if (response.ok) {
        const data = await response.json()
        setValidTicketCount(data.validTicketCount || 1)
        setValidTicketCodes(data.validTicketCodes || [ticket.codigoTicket])
      } else {
        console.error("Error fetching valid tickets")
        setValidTicketCount(1) // Fallback to 1 if API fails
        setValidTicketCodes([ticket.codigoTicket])
      }
    } catch (error) {
      console.error("Error fetching valid tickets:", error)
      setValidTicketCount(1)
      setValidTicketCodes([ticket.codigoTicket])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    if (name === "telefono") {
      const validation = validatePhoneNumber(value)
      setPhoneValidation(validation)
    }
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
    if (formData.numeroIdentidad) {
      const validation = validateIdentityNumber(value, formData.numeroIdentidad)
      setIdentityValidation(validation)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Por favor seleccione un archivo de imagen válido")
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("La imagen debe ser menor a 5MB")
        return
      }
      setSelectedImage(file)
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

  const checkNotificationsBeforePayment = () => {
    if (!NOTIFICATIONS_ENABLED) {
      console.log("🔕 [NOTIFICATIONS] Notificaciones deshabilitadas por variable de entorno")
      handleSubmit()
      return
    }
    if (notificationsSupported && !ticketNotificationsRegistered && !notificationsEnabled) {
      console.log("🔔 [NOTIFICATIONS] Mostrando prompt de notificaciones")
      setShowNotificationPrompt(true)
      return
    }
    console.log("🔔 [NOTIFICATIONS] Notificaciones ya activadas, procediendo al pago")
    handleSubmit()
  }

  const handleQuantityChange = (increment: boolean) => {
    setTicketQuantity((prev) => {
      const minQuantity = isMultiplePayment ? 2 : 1
      const maxQuantity = validTicketCount
      const newQuantity = increment ? Math.min(prev + 1, maxQuantity) : Math.max(prev - 1, minQuantity)
      // Update formData.ticketCodes to match newQuantity
      setFormData((prevForm) => ({
        ...prevForm,
        ticketQuantity: newQuantity,
        ticketCodes: validTicketCodes.slice(0, newQuantity),
      }))
      return newQuantity
    })
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    setError("")
    try {
      let imagenComprobante = null
      if (selectedImage) {
        imagenComprobante = await convertImageToBase64(selectedImage)
      }
      const numeroIdentidadCompleto = formatFullIdentityNumber(formData.tipoIdentidad || "V", formData.numeroIdentidad)
      const paymentData = {
        codigoTicket: ticket.codigoTicket,
        ticketCodes: formData.ticketCodes, // Send array of ticket codes
        tipoPago: paymentType,
        montoPagado: formData.montoPagado,
        tiempoSalida: formData.tiempoSalida || "now",
        referenciaTransferencia: formData.referenciaTransferencia || undefined,
        banco: formData.banco || undefined,
        telefono: formData.telefono || undefined,
        numeroIdentidad: numeroIdentidadCompleto || undefined,
        imagenComprobante: imagenComprobante || undefined,
        isMultiplePayment: formData.isMultiplePayment,
        ticketQuantity: formData.ticketQuantity,
      }
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

  const getFormValidation = () => {
    if (currentStep === 3 && (paymentType === "pago_movil" || paymentType === "transferencia")) {
      if (!formData.referenciaTransferencia.trim()) {
        return { isValid: false, message: "Debe ingresar la referencia de la transferencia" }
      }
      if (!formData.banco.trim()) {
        return { isValid: false, message: "Debe seleccionar su banco" }
      }
      if (!phoneValidation.isValid) {
        return { isValid: false, message: phoneValidation.message || "Debe ingresar un teléfono válido" }
      }
      if (!identityValidation.isValid) {
        return { isValid: false, message: identityValidation.message || "Debe ingresar una identidad válida" }
      }
      if (!formData.montoPagado || formData.montoPagado <= 0) {
        return { isValid: false, message: "Debe ingresar el monto pagado" }
      }
      if (!selectedImage) {
        return { isValid: false, message: "Debe adjuntar el comprobante de pago" }
      }
      if (!formData.tiempoSalida) {
        return { isValid: false, message: "Debe seleccionar el tiempo de salida estimado" }
      }
      if (formData.ticketQuantity && formData.ticketQuantity > validTicketCount) {
        return { isValid: false, message: `No puede pagar más de ${validTicketCount} tickets válidos` }
      }
    }
    return { isValid: true, message: "" }
  }

  const formValidation = getFormValidation()

  const copyToClipboard = (text: string, isFullCopy = false) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopySuccess(isFullCopy ? "Todos los datos copiados" : "Copiado")
        setTimeout(() => setCopySuccess(null), 2000)
      })
      .catch((err) => {
        console.error("Error al copiar al portapapeles:", err)
        setError("No se pudo copiar. Por favor, intenta manualmente.")
      })
  }

  const copyAllData = () => {
    if (!companySettings || !paymentType) return
    const paymentData = []
    if (paymentType === "pago_movil" && companySettings.pagoMovil) {
      if (companySettings.pagoMovil.banco) paymentData.push(`Banco: ${companySettings.pagoMovil.banco}`)
      if (companySettings.pagoMovil.cedula) paymentData.push(`Cédula/RIF: ${companySettings.pagoMovil.cedula}`)
      if (companySettings.pagoMovil.telefono) paymentData.push(`Teléfono: ${companySettings.pagoMovil.telefono}`)
    } else if (paymentType === "transferencia" && companySettings.transferencia) {
      if (companySettings.transferencia.banco) paymentData.push(`Banco: ${companySettings.transferencia.banco}`)
      if (companySettings.transferencia.cedula) paymentData.push(`Cédula/RIF: ${companySettings.transferencia.cedula}`)
      if (companySettings.transferencia.numeroCuenta)
        paymentData.push(`Número de Cuenta: ${companySettings.transferencia.numeroCuenta}`)
      if (companySettings.transferencia.telefono)
        paymentData.push(`Teléfono: ${companySettings.transferencia.telefono}`)
    }
    paymentData.push(`Monto a Pagar (Bs.): ${totalMontoBs.toFixed(2)}`)
    const textToCopy = paymentData.join("\n")
    copyToClipboard(textToCopy, true)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">¡Pago Registrado!</h2>
            {isMultiplePayment ? (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800/30">
                  <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">📋 Pago Múltiple Registrado</h3>
                  <p className="text-blue-700 dark:text-blue-300 mb-2">
                    Has pagado por <strong>{ticketQuantity} tickets</strong>
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    Tickets: <strong>{formData.ticketCodes?.join(", ")}</strong>
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    Monto total:{" "}
                    <strong>{formatCurrency(formData.montoPagado, paymentType?.includes("bs") ? "VES" : "USD")}</strong>
                  </p>
                </div>
                <Alert className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800/30">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                    <strong>Importante:</strong> Debes llevar contigo <strong>{ticketQuantity} tickets físicos</strong>{" "}
                    que correspondan al monto pagado. El personal de validación verificará que tengas la cantidad
                    correcta de tickets.
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <p className="text-lg text-muted-foreground mb-4">
                {paymentType?.startsWith("efectivo")
                  ? "Su solicitud de pago en efectivo ha sido registrada. Diríjase a la taquilla para completar el pago."
                  : "El pago ha sido registrado y está Pendiente de Validación por el personal del estacionamiento."}
              </p>
            )}
            {NOTIFICATIONS_ENABLED && ticketNotificationsRegistered && (
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

  const isLoaded = !loadingSettings && !loadingBanks && !loadingValidTickets

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="mb-6">
            <div className="flex justify-between mb-2">
              <div className={`h-2 flex-1 rounded-l-full ${currentStep >= 0 ? "bg-primary" : "bg-muted"}`}></div>
              <div className={`h-2 flex-1 ${currentStep >= 1 ? "bg-primary" : "bg-muted"}`}></div>
              <div className={`h-2 flex-1 ${currentStep >= 2 ? "bg-primary" : "bg-muted"}`}></div>
              <div className={`h-2 flex-1 ${currentStep >= 3 ? "bg-primary" : "bg-muted"}`}></div>
              <div className={`h-2 flex-1 rounded-r-full ${currentStep >= 4 ? "bg-primary" : "bg-muted"}`}></div>
            </div>
            <p className="text-center text-sm text-muted-foreground">Paso {currentStep + 1} de 5</p>
          </div>
          {error && (
            <Alert className="mb-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {copySuccess && (
            <Alert className="mb-4" variant="success">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription>{copySuccess}</AlertDescription>
            </Alert>
          )}
          {/* PASO 0: Selección de tipo de pago (único o múltiple) */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold mb-4">¿Cuántos tickets deseas pagar?</h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Código de Ticket Base</p>
                    <p className="text-lg font-medium">{ticket.codigoTicket}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Monto por Ticket</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(ticket.montoCalculado)}</p>
                    <p className="text-lg text-muted-foreground">{formatCurrency(montoBs, "VES")}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <Button
                  onClick={() => {
                    setIsMultiplePayment(false)
                    setTicketQuantity(1)
                    setFormData((prev) => ({ ...prev, ticketCodes: [ticket.codigoTicket], ticketQuantity: 1 }))
                    nextStep()
                  }}
                  variant={!isMultiplePayment ? "default" : "outline"}
                  className="w-full h-16 text-left justify-between"
                >
                  <div>
                    <div className="font-medium">Pagar 1 Ticket</div>
                    <div className="text-sm opacity-75">Pago individual</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCurrency(ticket.montoCalculado)}</div>
                    <div className="text-sm opacity-75">{formatCurrency(montoBs, "VES")}</div>
                  </div>
                </Button>
                <div className="space-y-3">
                  <Button
                    onClick={() => {
                      setIsMultiplePayment(true)
                      setTicketQuantity(Math.min(2, validTicketCount)) // Ensure initial quantity respects validTicketCount
                    }}
                    variant={isMultiplePayment ? "default" : "outline"}
                    className="w-full h-16 text-left justify-between"
                    disabled={validTicketCount < 2} // Disable if less than 2 valid tickets
                  >
                    <div>
                      <div className="font-medium">Pagar Múltiples Tickets</div>
                      <div className="text-sm opacity-75">Mínimo 2, máximo {validTicketCount} tickets</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatCurrency(totalMontoUsd)}</div>
                      <div className="text-sm opacity-75">{formatCurrency(totalMontoBs, "VES")}</div>
                    </div>
                  </Button>
                  {isMultiplePayment && (
                    <div className="bg-muted/50 p-4 rounded-lg border">
                      <div className="flex items-center justify-center space-x-4">
                        <Button
                          onClick={() => handleQuantityChange(false)}
                          variant="outline"
                          size="sm"
                          disabled={ticketQuantity <= 2}
                          className="h-10 w-10 p-0"
                        >
                          -
                        </Button>
                        <div className="text-center">
                          <p className="text-2xl font-bold">{ticketQuantity}</p>
                          <p className="text-sm text-muted-foreground">tickets</p>
                        </div>
                        <Button
                          onClick={() => handleQuantityChange(true)}
                          variant="outline"
                          size="sm"
                          disabled={ticketQuantity >= validTicketCount}
                          className="h-10 w-10 p-0"
                        >
                          +
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground text-center mt-2">
                        Mínimo 2, máximo {validTicketCount} tickets válidos disponibles
                      </p>
                      <p className="text-sm text-muted-foreground text-center">
                        Tickets: {validTicketCodes.slice(0, ticketQuantity).join(", ")}
                      </p>
                      <div className="text-center mt-4 p-3 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800/30">
                        <p className="text-sm text-green-600 dark:text-green-400 mb-1">Monto Total a Pagar</p>
                        <p className="text-xl font-bold text-green-600">{formatCurrency(totalMontoUsd)}</p>
                        <p className="text-lg text-green-500">{formatCurrency(totalMontoBs, "VES")}</p>
                      </div>
                      <Alert className="mt-3 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/30">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-800 dark:text-blue-200">
                          <strong>Importante:</strong> Deberás presentar {ticketQuantity} tickets físicos válidos al momento de la validación.
                        </AlertDescription>
                      </Alert>
                      <Button onClick={nextStep} className="w-full mt-4">
                        Continuar con {ticketQuantity} tickets
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* PASO 1: Selección de método de pago */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold mb-4">Seleccione Método de Pago</h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {isMultiplePayment ? `Pagando ${ticketQuantity} tickets` : "Código de Ticket"}
                    </p>
                    <p className="text-lg font-medium">
                      {isMultiplePayment ? validTicketCodes.slice(0, ticketQuantity).join(", ") : ticket.codigoTicket}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Monto Total a Pagar</p>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(totalMontoUsd)}</p>
                    <p className="text-lg text-muted-foreground">{formatCurrency(totalMontoBs, "VES")}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold text-center mb-4">Métodos de Pago Disponibles</h3>
                {companySettings?.pagoMovil?.banco && (
                  <Button
                    onClick={() => {
                      setPaymentType("pago_movil")
                      setFormData((prev) => ({ ...prev, montoPagado: totalMontoBs }))
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
                      <div className="font-bold">{formatCurrency(totalMontoBs, "VES")}</div>
                    </div>
                  </Button>
                )}
                {companySettings?.transferencia?.banco && (
                  <Button
                    onClick={() => {
                      setPaymentType("transferencia")
                      setFormData((prev) => ({ ...prev, montoPagado: totalMontoBs }))
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
                      <div className="font-bold">{formatCurrency(totalMontoBs, "VES")}</div>
                    </div>
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setPaymentType("efectivo_bs")
                    setFormData((prev) => ({ ...prev, montoPagado: totalMontoBs }))
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
                    <div className="font-bold">{formatCurrency(totalMontoBs, "VES")}</div>
                    <div className="text-sm opacity-75">{formatCurrency(totalMontoUsd)}</div>
                  </div>
                </Button>
                {companySettings?.tarifas?.tasaCambio && (
                  <Button
                    onClick={() => {
                      setPaymentType("efectivo_usd")
                      setFormData((prev) => ({ ...prev, montoPagado: totalMontoUsd }))
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
                      <div className="font-bold">{formatCurrency(totalMontoUsd)}</div>
                      <div className="text-sm opacity-75">{formatCurrency(totalMontoBs, "VES")}</div>
                    </div>
                  </Button>
                )}
              </div>
            </div>
          )}
          {/* PASO 2: Información bancaria de la empresa */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold mb-4">Información de Pago</h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {isMultiplePayment ? `Pagando ${ticketQuantity} tickets` : "Código de Ticket"}
                    </p>
                    <p className="text-lg font-medium">
                      {isMultiplePayment ? validTicketCodes.slice(0, ticketQuantity).join(", ") : ticket.codigoTicket}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Monto Total a Pagar</p>
                    <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800/30">
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(totalMontoBs, "VES")}
                      </p>
                      <p className="text-lg font-medium text-green-500 dark:text-green-300">
                        {formatCurrency(totalMontoUsd)}
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
                  <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-2">
                    <h3 className="font-semibold text-center xs:text-left">Datos para realizar el pago</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyAllData}
                      className="h-8 text-sm self-center xs:self-auto bg-muted/20 text-foreground border-muted-foreground/30 hover:bg-muted/40 hover:text-foreground"
                    >
                      <Copy className="h-4 w-4 mr-1" /> Copiar Todo
                    </Button>
                  </div>
                  {companySettings && paymentType && (
                    <>
                      {paymentType === "pago_movil" &&
                        (companySettings.pagoMovil.banco ||
                          companySettings.pagoMovil.cedula ||
                          companySettings.pagoMovil.telefono) && (
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm text-foreground">Pago Móvil</h4>
                            {companySettings.pagoMovil.banco && (
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-sm text-muted-foreground flex-shrink-0">Banco:</span>
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm font-medium truncate">
                                    {companySettings.pagoMovil.banco}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(companySettings.pagoMovil.banco || "")}
                                    className="p-0 h-6 w-6 border border-border dark:border-border-dark flex-shrink-0"
                                    data-icon="copy"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            {companySettings.pagoMovil.cedula && (
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-sm text-muted-foreground flex-shrink-0">Cédula/RIF:</span>
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm font-medium truncate">
                                    {companySettings.pagoMovil.cedula}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(companySettings.pagoMovil.cedula || "")}
                                    className="p-0 h-6 w-6 border border-border dark:border-border-dark flex-shrink-0"
                                    data-icon="copy"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            {companySettings.pagoMovil.telefono && (
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-sm text-muted-foreground flex-shrink-0">Teléfono:</span>
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm font-medium truncate">
                                    {companySettings.pagoMovil.telefono}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(companySettings.pagoMovil.telefono || "")}
                                    className="p-0 h-6 w-6 border border-border dark:border-border-dark flex-shrink-0"
                                    data-icon="copy"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      {paymentType === "transferencia" &&
                        (companySettings.transferencia.banco ||
                          companySettings.transferencia.cedula ||
                          companySettings.transferencia.telefono ||
                          companySettings.transferencia.numeroCuenta) && (
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm text-foreground">Transferencia Bancaria</h4>
                            {companySettings.transferencia.banco && (
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-sm text-muted-foreground flex-shrink-0">Banco:</span>
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm font-medium truncate">
                                    {companySettings.transferencia.banco}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(companySettings.transferencia.banco || "")}
                                    className="p-0 h-6 w-6 border border-border dark:border-border-dark flex-shrink-0"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            {companySettings.transferencia.cedula && (
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-sm text-muted-foreground flex-shrink-0">Cédula/RIF:</span>
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm font-medium truncate">
                                    {companySettings.transferencia.cedula}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(companySettings.transferencia.cedula || "")}
                                    className="p-0 h-6 w-6 border border-border dark:border-border-dark flex-shrink-0"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            {companySettings.transferencia.numeroCuenta && (
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-sm text-muted-foreground flex-shrink-0">Número de Cuenta:</span>
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm font-medium truncate">
                                    {companySettings.transferencia.numeroCuenta}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(companySettings.transferencia.numeroCuenta || "")}
                                    className="p-0 h-6 w-6 border border-border dark:border-border-dark flex-shrink-0"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            {companySettings.transferencia.telefono && (
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-sm text-muted-foreground flex-shrink-0">Teléfono:</span>
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm font-medium truncate">
                                    {companySettings.transferencia.telefono}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(companySettings.transferencia.telefono || "")}
                                    className="p-0 h-6 w-6 border border-border dark:border-border-dark flex-shrink-0"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm text-foreground">Monto Total a Pagar</h4>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-sm text-muted-foreground flex-shrink-0">Monto (Bs.):</span>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium truncate">{formatCurrency(totalMontoBs, "VES")}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(totalMontoBs.toFixed(2))}
                              className="p-0 h-6 w-6 border border-border dark:border-border-dark flex-shrink-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-sm text-muted-foreground flex-shrink-0">Monto (USD):</span>
                          <span className="text-sm font-medium text-muted-foreground">
                            {formatCurrency(totalMontoUsd)}
                          </span>
                        </div>
                      </div>
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
                <Button
                  onClick={prevStep}
                  variant="outline"
                  className="flex-1 h-12 text-lg bg-muted/20 text-foreground border-muted-foreground/30 hover:bg-muted/40 hover:text-foreground"
                >
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
              {!formValidation.isValid && (
                <Alert className="mb-4" variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{formValidation.message}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isMultiplePayment ? `Monto Total (${ticketQuantity} tickets)` : "Monto a Pagar"}
                  </p>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg mb-4 border border-green-200 dark:border-blue-800/30">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(totalMontoBs, "VES")}
                    </p>
                    <p className="text-lg font-medium text-green-500 dark:text-green-300">
                      {formatCurrency(totalMontoUsd)}
                    </p>
                    {isMultiplePayment && (
                      <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                        ({formatCurrency(ticket.montoCalculado)} × {ticketQuantity} tickets)
                      </p>
                    )}
                    {isMultiplePayment && (
                      <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                        Tickets: {validTicketCodes.slice(0, ticketQuantity).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="referenciaTransferencia" className="text-sm font-medium">
                    Referencia de la Transferencia *
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
                    Banco *
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
                    Teléfono *
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
                    Tipo de Identidad *
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
                    Número de Identidad *
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
                    Monto Pagado (Bs.) *
                  </label>
                  <Input
                    id="montoPagado"
                    name="montoPagado"
                    type="number"
                    step="0.01"
                    value={formData.montoPagado}
                    onChange={handleChange}
                    className="h-12 text-lg"
                    placeholder={`${formatCurrency(totalMontoBs, "VES")}`}
                    required
                  />
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                    Referencia: {formatCurrency(totalMontoBs, "VES")} ({formatCurrency(totalMontoUsd)})
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center">
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Comprobante de Pago *
                  </label>
                  <div className="space-y-2">
                    {!selectedImage ? (
                      <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Obligatorio:</strong> Suba una captura del resumen de su pago
                        </p>
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
                        <div className="border rounded-lg p-2 bg-card">
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
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800/30">
                  <div className="space-y-2">
                    <Label htmlFor="tiempoSalida" className="text-sm font-medium flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      ¿Cuándo planea salir? *
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
                      Esta información ayudará al personal a gestionar mejor los espacios y preparar su vehículo
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <Button
                  onClick={prevStep}
                  variant="outline"
                  className="flex-1 h-12 text-lg bg-muted/20 text-foreground border-muted-foreground/30 hover:bg-muted/40 hover:text-foreground"
                >
                  <ArrowLeft className="mr-2 h-5 w-5" /> Anterior
                </Button>
                <Button onClick={nextStep} className="flex-1 h-12 text-lg" disabled={!formValidation.isValid}>
                  Ver Resumen <Eye className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          )}
          {/* PASO 4: Vista previa y confirmación */}
          {currentStep === 4 && (
            <div className="space-y-6">
              {paymentType?.startsWith("efectivo") ? (
                <>
                  <h2 className="text-xl font-bold mb-4 text-center">Pago en Efectivo</h2>
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-6 rounded-lg text-center border border-blue-200 dark:border-blue-800/30">
                    <div className="text-6xl mb-4">💰</div>
                    <h3 className="text-lg font-semibold mb-2">Acérquese a la Taquilla</h3>
                    <p className="text-muted-foreground mb-4">
                      Para completar su pago en efectivo, diríjase a la taquilla del estacionamiento.
                    </p>
                    <div className="bg-card p-4 rounded-lg border">
                      <p className="text-sm text-muted-foreground mb-1">
                        {isMultiplePayment ? `Pagando ${ticketQuantity} tickets` : "Código de Ticket"}
                      </p>
                      <p className="text-xl font-bold mb-3">
                        {isMultiplePayment ? validTicketCodes.slice(0, ticketQuantity).join(", ") : ticket.codigoTicket}
                      </p>
                      <p className="text-sm text-muted-foreground mb-1">Monto Total a Pagar</p>
                      {paymentType === "efectivo_bs" ? (
                        <div>
                          <p className="text-2xl font-bold text-primary">
                            {formatCurrency(formData.montoPagado, "VES")}
                          </p>
                          <p className="text-lg text-muted-foreground">{formatCurrency(totalMontoUsd)}</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-2xl font-bold text-primary">{formatCurrency(formData.montoPagado)}</p>
                          <p className="text-lg text-muted-foreground">{formatCurrency(totalMontoBs, "VES")}</p>
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
                <>
                  <h2 className="text-xl font-bold mb-4 text-center">Confirmar Datos del Pago</h2>
                  <div className="bg-muted/50 p-6 rounded-lg space-y-4 border">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">
                        {isMultiplePayment ? `Pagando ${ticketQuantity} tickets` : "Código de Ticket"}
                      </p>
                      <p className="text-lg font-bold">
                        {isMultiplePayment ? validTicketCodes.slice(0, ticketQuantity).join(", ") : ticket.codigoTicket}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800/30">
                      <p className="text-sm text-muted-foreground mb-1">Monto Total a Pagar</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(totalMontoBs, "VES")}
                      </p>
                      <p className="text-lg font-medium text-green-500 dark:text-green-300">
                        {formatCurrency(totalMontoUsd)}
                      </p>
                      {isMultiplePayment && (
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                          ({formatCurrency(ticket.montoCalculado)} × {ticketQuantity} tickets)
                        </p>
                      )}
                      {isMultiplePayment && (
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                          Tickets: {validTicketCodes.slice(0, ticketQuantity).join(", ")}
                        </p>
                      )}
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
                  <div className="flex gap-4 pt-4">
                    <Button
                      onClick={prevStep}
                      variant="outline"
                      className="flex-1 h-12 text-lg bg-muted/20 text-foreground border-muted-foreground/30 hover:bg-muted/40 hover:text-foreground"
                    >
                      <ArrowLeft className="mr-2 h-5 w-5" /> Anterior
                    </Button>
                    <Button
                      onClick={checkNotificationsBeforePayment}
                      className="flex-1 h-12 text-lg"
                      disabled={isLoading}
                    >
                      {isLoading ? "Registrando..." : "Confirmar Pago"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
          {/* Notification Prompt Dialog */}
          {showNotificationPrompt && (
            <Dialog open={showNotificationPrompt} onOpenChange={setShowNotificationPrompt}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Activar Notificaciones</DialogTitle>
                  <DialogDescription>
                    ¿Deseas recibir notificaciones sobre el estado de tu pago? Esto te permitirá estar al tanto cuando tu pago sea validado.
                  </DialogDescription>
                </DialogHeader>
                <NotificationPrompt
                  onEnable={() => {
                    enableNotificationsForTicket()
                    setShowNotificationPrompt(false)
                    handleSubmit()
                  }}
                  onSkip={() => {
                    setShowNotificationPrompt(false)
                    handleSubmit()
                  }}
                />
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>
    </div>
  )
}