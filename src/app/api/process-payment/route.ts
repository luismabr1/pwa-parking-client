import { type NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { v2 as cloudinary } from "cloudinary";
import { withSecurity } from "@/lib/security-middleware";
import {
  validatePaymentData,
  validatePaymentReference,
  validateAmount,
  validatePhoneNumber,
  getClientIP,
} from "@/lib/security-utils";
import { logSecurityEvent } from "@/lib/security-logger";
import { saveDeviceSubscription } from "@/lib/push-notifications";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Opt out of caching for this route
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

// Verificar si estamos en desarrollo
function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development" || process.env.NODE_ENV !== "production";
}

async function uploadImageToCloudinary(base64Image: string, ticketCode: string, imageType: "comprobante" | "tickets"): Promise<string> {
  const isDevMode = isDevelopment();

  try {
    console.log(`📤 [PROCESS-PAYMENT] Subiendo imagen ${imageType} a Cloudinary para ticket:`, ticketCode);
    console.log("📤 [PROCESS-PAYMENT] Modo desarrollo:", isDevMode);

    let cleanBase64 = base64Image;
    console.log(`📤 [PROCESS-PAYMENT] Imagen ${imageType} original - longitud:`, base64Image.length);
    console.log(`📤 [PROCESS-PAYMENT] Imagen ${imageType} original - primeros 100 chars:`, base64Image.substring(0, 100));

    if (base64Image.startsWith("data:image/")) {
      const base64Index = base64Image.indexOf(",");
      if (base64Index !== -1) {
        cleanBase64 = base64Image.substring(base64Index + 1);
        console.log(`📤 [PROCESS-PAYMENT] Prefijo data: removido, nueva longitud:`, cleanBase64.length);
      } else {
        console.error(`❌ [PROCESS-PAYMENT] No se encontró separador de base64 en imagen ${imageType}`);
        throw new Error(`Formato base64 inválido para ${imageType}`);
      }
    } else {
      console.error(`❌ [PROCESS-PAYMENT] Imagen ${imageType} no comienza con data:image/`);
      throw new Error(`Formato base64 inválido para ${imageType}`);
    }

    const minLength = isDevMode ? 500 : 5000;
    if (!cleanBase64 || cleanBase64.length < minLength) {
      const errorMsg = `Imagen ${imageType} base64 muy pequeña o inválida (${cleanBase64.length} chars, mínimo ${minLength}). Esto indica que la imagen está truncada o corrupta.`;
      console.error("❌ [PROCESS-PAYMENT]", errorMsg);
      if (isDevMode) {
        console.log(`⚠️ [PROCESS-PAYMENT] En desarrollo: continuando sin imagen ${imageType} debido a tamaño insuficiente`);
        return null;
      }
      throw new Error(errorMsg);
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(cleanBase64, "base64");
      console.log(`📤 [PROCESS-PAYMENT] Base64 ${imageType} decodificado exitosamente, tamaño buffer:`, buffer.length);

      // Standardize minimum buffer size to 512 bytes for both
      const minBufferSize = 512;
      if (buffer.length < minBufferSize) {
        const errorMsg = `Buffer de imagen ${imageType} muy pequeño (${buffer.length} bytes, mínimo ${minBufferSize} bytes). La imagen está incompleta.`;
        console.error("❌ [PROCESS-PAYMENT]", errorMsg);
        if (isDevMode) {
          console.log(`⚠️ [PROCESS-PAYMENT] En desarrollo: continuando sin imagen ${imageType} debido a buffer pequeño`);
          return null;
        }
        throw new Error(errorMsg);
      }

      const isJPEG = buffer[0] === 0xff && buffer[1] === 0xd8;
      const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
      console.log(`📤 [PROCESS-PAYMENT] Tipo de imagen ${imageType} - JPEG:`, isJPEG, "PNG:", isPNG);

      if (!isJPEG && !isPNG) {
        const errorMsg = `La imagen ${imageType} no es un formato válido (JPEG/PNG) o está corrupta`;
        console.error("❌ [PROCESS-PAYMENT]", errorMsg);
        if (isDevMode) {
          console.log(`⚠️ [PROCESS-PAYMENT] En desarrollo: continuando sin imagen ${imageType} debido a formato inválido`);
          return null;
        }
        throw new Error(errorMsg);
      }

      if (isJPEG) {
        const hasEndMarker = buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9;
        if (!hasEndMarker) {
          const errorMsg = `La imagen ${imageType} JPEG está incompleta (falta marcador de fin)`;
          console.error("❌ [PROCESS-PAYMENT]", errorMsg, "Buffer length:", buffer.length, "Last 2 bytes:", buffer[buffer.length - 2], buffer[buffer.length - 1]);
          if (isDevMode) {
            console.log(`⚠️ [PROCESS-PAYMENT] En desarrollo: continuando sin imagen ${imageType} debido a JPEG incompleto`);
            return null;
          }
          throw new Error(errorMsg);
        }
      }
    } catch (decodeError) {
      console.error(`❌ [PROCESS-PAYMENT] Error decodificando base64 ${imageType}:`, decodeError.message, "Stack:", decodeError.stack);
      if (isDevMode) {
        console.log(`⚠️ [PROCESS-PAYMENT] En desarrollo: continuando sin imagen ${imageType} debido a error de decodificación`);
        return null;
      }
      throw new Error("Formato base64 inválido");
    }

    const dataUri = `data:image/jpeg;base64,${cleanBase64}`;
    const uploadOptions = {
      folder: `parking/${imageType}`,
      public_id: `${imageType}_${ticketCode}_${Date.now()}`,
      resource_type: "image" as const,
      format: "jpg",
      quality: "auto:good",
    };
    console.log(`📤 [PROCESS-PAYMENT] Opciones de subida ${imageType}:`, uploadOptions);
    const uploadResponse = await cloudinary.uploader.upload(dataUri, uploadOptions);
    console.log(`✅ [PROCESS-PAYMENT] Imagen ${imageType} subida exitosamente:`, uploadResponse.secure_url);
    return uploadResponse.secure_url;
  } catch (error) {
    console.error(`❌ [PROCESS-PAYMENT] Error subiendo imagen ${imageType} a Cloudinary:`, error.message, "Stack:", error.stack);
    if (isDevMode) {
      console.log(`⚠️ [PROCESS-PAYMENT] En desarrollo: continuando sin imagen ${imageType} debido al error`);
      return null;
    }
    throw new Error(`Error al subir la imagen ${imageType}`);
  }
}

async function processPaymentHandler(request: NextRequest, sanitizedData: any) {
  const startTime = Date.now();
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get("user-agent") || "";

  // Detectar si estamos en desarrollo local
  const isDevMode = isDevelopment();
  const isLocalIP = clientIP === "::1" || clientIP === "127.0.0.1" || clientIP === "localhost";

  console.log("💰 [PROCESS-PAYMENT] ===== INICIANDO PROCESO DE PAGO =====");
  console.log("🕐 [PROCESS-PAYMENT] Timestamp:", new Date().toISOString());

  if (isDevMode) {
    console.log(`🔍 [PROCESS-PAYMENT-DEBUG] isDevMode: ${isDevMode}`);
    console.log(`🔍 [PROCESS-PAYMENT-DEBUG] isLocalIP: ${isLocalIP}`);
    console.log(`🔍 [PROCESS-PAYMENT-DEBUG] clientIP: ${clientIP}`);
  }

  try {
    // Validar datos de pago
    const validation = validatePaymentData(sanitizedData);

    if (isDevMode) {
      console.log(`🔍 [PROCESS-PAYMENT-DEBUG] validation.valid: ${validation.valid}`);
      console.log(`🔍 [PROCESS-PAYMENT-DEBUG] validation.errors:`, validation.errors);
    }

    if (!validation.valid) {
      if (isDevMode && isLocalIP) {
        console.log(
          `⚠️ [PROCESS-PAYMENT] Datos inválidos en desarrollo (NO se registrará como malicioso):`,
          validation.errors,
        );
      } else {
        await logSecurityEvent.maliciousRequest(
          clientIP,
          "/api/process-payment",
          "POST",
          `Invalid payment data: ${validation.errors.join(", ")}`,
          sanitizedData,
          userAgent,
        );
      }

      return NextResponse.json(
        {
          success: false,
          message: "Datos de pago inválidos",
          errors: validation.errors,
        },
        { status: 400 },
      );
    }

    // Validaciones de seguridad adicionales SOLO para pagos electrónicos
    const {
      tipoPago,
      referenciaTransferencia,
      montoPagado,
      telefono,
      deviceSubscription,
      isMultiplePayment,
      ticketQuantity,
    } = sanitizedData;

    if (isDevMode) {
      console.log(`🔍 [PROCESS-PAYMENT-DEBUG] tipoPago: "${tipoPago}"`);
      console.log(`🔍 [PROCESS-PAYMENT-DEBUG] referenciaTransferencia: "${referenciaTransferencia}"`);
      console.log(`🔍 [PROCESS-PAYMENT-DEBUG] montoPagado: "${montoPagado}"`);
      console.log(`🔍 [PROCESS-PAYMENT-DEBUG] telefono: "${telefono}"`);
      console.log(`🔍 [PROCESS-PAYMENT-DEBUG] deviceSubscription: "${deviceSubscription ? "present" : "absent"}"`);
      console.log(`🔍 [PROCESS-PAYMENT-DEBUG] isMultiplePayment: ${isMultiplePayment}`);
      console.log(`🔍 [PROCESS-PAYMENT-DEBUG] ticketQuantity: ${ticketQuantity}`);
    }

    // Solo validar referencia para pagos electrónicos
    if (
      (tipoPago === "pago_movil" || tipoPago === "transferencia") &&
      !validatePaymentReference(referenciaTransferencia)
    ) {
      if (isDevMode && isLocalIP) {
        console.log(
          `⚠️ [PROCESS-PAYMENT] Referencia inválida en desarrollo (NO se registrará como malicioso): ${referenciaTransferencia}`,
        );
      } else {
        await logSecurityEvent.maliciousRequest(
          clientIP,
          "/api/process-payment",
          "POST",
          "Formato de referencia de pago inválido",
          { numeroReferencia: referenciaTransferencia },
          request.headers.get("user-agent") || "",
        );
      }
      return NextResponse.json({ success: false, message: "Formato de referencia inválido" }, { status: 400 });
    }

    // Validar monto pagado (usar montoPagado, no monto)
    if (!validateAmount(Number(montoPagado))) {
      if (isDevMode && isLocalIP) {
        console.log(
          `⚠️ [PROCESS-PAYMENT] Monto inválido en desarrollo (NO se registrará como malicioso): ${montoPagado}`,
        );
      } else {
        await logSecurityEvent.maliciousRequest(
          clientIP,
          "/api/process-payment",
          "POST",
          "Monto de pago inválido o sospechoso",
          { monto: montoPagado },
          request.headers.get("user-agent") || "",
        );
      }
      return NextResponse.json({ success: false, message: "Monto inválido" }, { status: 400 });
    }

    // Solo validar teléfono para pagos electrónicos y si no está vacío
    if ((tipoPago === "pago_movil" || tipoPago === "transferencia") && telefono && !validatePhoneNumber(telefono)) {
      if (isDevMode && isLocalIP) {
        console.log(
          `⚠️ [PROCESS-PAYMENT] Teléfono inválido en desarrollo (NO se registrará como malicioso): ${telefono}`,
        );
      } else {
        await logSecurityEvent.maliciousRequest(
          clientIP,
          "/api/process-payment",
          "POST",
          "Formato de teléfono inválido",
          { telefono: telefono },
          request.headers.get("user-agent") || "",
        );
      }
      return NextResponse.json({ success: false, message: "Formato de teléfono inválido" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("parking");

    const { codigoTicket, banco, numeroIdentidad, tiempoSalida, imagenComprobante, imagenTickets } = sanitizedData;

    console.log("📥 [PROCESS-PAYMENT] Datos validados:");
    console.log("   Código Ticket:", codigoTicket);
    console.log("   Tipo Pago:", tipoPago);
    console.log("   Monto Pagado:", montoPagado);
    console.log("   Tiempo Salida:", tiempoSalida);
    console.log("   Tiene Imagen Comprobante:", !!imagenComprobante);
    console.log("   Tiene Imagen Tickets:", !!imagenTickets);
    console.log("   Es Pago Múltiple:", isMultiplePayment);
    console.log("   Cantidad Tickets:", ticketQuantity);

    // Buscar ticket
    console.log("🎫 [PROCESS-PAYMENT] Buscando ticket:", codigoTicket);

    const ticket = await db.collection("tickets").findOne({ codigoTicket });

    if (!ticket) {
      console.error("❌ [PROCESS-PAYMENT] Ticket no encontrado:", codigoTicket);
      return NextResponse.json({ success: false, message: "Ticket no encontrado" }, { status: 404 });
    }

    console.log("✅ [PROCESS-PAYMENT] Ticket encontrado:");
    console.log("   Código:", ticket.codigoTicket);
    console.log("   Estado:", ticket.estado);
    console.log("   Monto Calculado:", ticket.montoCalculado);

    const now = new Date();

    // Calcular tiempo de salida estimado
    let tiempoSalidaEstimado = now;
    if (tiempoSalida && tiempoSalida !== "now") {
      const minutesToAdd =
        {
          "5min": 5,
          "10min": 10,
          "15min": 15,
          "20min": 20,
          "30min": 30,
          "45min": 45,
          "60min": 60,
        }[tiempoSalida] || 0;

      if (minutesToAdd > 0) {
        tiempoSalidaEstimado = new Date(Date.now() + minutesToAdd * 60000);
        console.log("⏰ [PROCESS-PAYMENT] Tiempo de salida estimado:", tiempoSalidaEstimado);
      }
    }

    // Obtener configuración de la empresa
    console.log("⚙️ [PROCESS-PAYMENT] Obteniendo configuración de empresa...");

    const companySettings = await db.collection("company_settings").findOne({});
    const precioHora = companySettings?.tarifas?.precioHora || 3;
    const tasaCambio = companySettings?.tarifas?.tasaCambio || 35;

    console.log("💱 [PROCESS-PAYMENT] Configuración encontrada:");
    console.log("   Precio por hora:", precioHora, "USD");
    console.log("   Tasa de cambio:", tasaCambio, "Bs/USD");

    let montoEnBs = 0;
    let montoEnUsd = 0;

    // Calcular montos según tipo de pago
    console.log("💰 [PROCESS-PAYMENT] Calculando montos...");

    if (tipoPago === "efectivo_usd") {
      montoEnUsd = Number(montoPagado);
      montoEnBs = Number((montoEnUsd * tasaCambio).toFixed(2));
      console.log("   Pago en USD:", montoEnUsd, "→", montoEnBs, "Bs");
    } else if (tipoPago === "efectivo_bs") {
      montoEnBs = Number(montoPagado);
      montoEnUsd = Number((montoEnBs / tasaCambio).toFixed(6));
      console.log("   Pago en Bs:", montoEnBs, "→", montoEnUsd, "USD");
    } else if (tipoPago === "pago_movil" || tipoPago === "transferencia") {
      montoEnBs = Number(montoPagado);
      montoEnUsd = Number((montoEnBs / tasaCambio).toFixed(6));
      console.log("   Pago electrónico en Bs:", montoEnBs, "→", montoEnUsd, "USD");
    } else {
      const errorMsg = "Tipo de pago no válido";
      console.error("❌ [PROCESS-PAYMENT] Tipo de pago inválido:", tipoPago);
      return NextResponse.json({ success: false, message: errorMsg }, { status: 400 });
    }

    const cantidadTickets = isMultiplePayment ? ticketQuantity || 1 : 1;
    const montoCalculadoBs = (ticket.montoCalculado || 0) * tasaCambio * cantidadTickets;
    const tolerance = 0.1;

    console.log("🔍 [PROCESS-PAYMENT] Validando montos:");
    console.log("   Monto pagado (Bs):", montoEnBs);
    console.log("   Monto calculado por ticket (Bs):", (ticket.montoCalculado || 0) * tasaCambio);
    console.log("   Cantidad de tickets:", cantidadTickets);
    console.log("   Monto calculado total (Bs):", montoCalculadoBs);
    console.log("   Diferencia:", Math.abs(montoEnBs - montoCalculadoBs));

    if (
      Math.abs(montoEnBs - montoCalculadoBs) > tolerance &&
      !(tipoPago.startsWith("efectivo") && montoEnBs >= montoCalculadoBs - tolerance)
    ) {
      const errorMsg = `El monto pagado (${formatCurrency(montoEnBs, "VES")} Bs) no coincide con el monto calculado (${formatCurrency(montoCalculadoBs, "VES")} Bs). Por favor, verifique el monto e intente de nuevo.`;
      console.error("❌ [PROCESS-PAYMENT] Monto no coincide:", errorMsg);
      return NextResponse.json({ success: false, message: errorMsg }, { status: 400 });
    }

    // Buscar carro asociado
    console.log("🚗 [PROCESS-PAYMENT] Buscando carro asociado al ticket...");

    const car = await db.collection("cars").findOne({
      ticketAsociado: codigoTicket,
      estado: {
        $in: [
          "estacionado",
          "estacionado_confirmado",
          "pago_pendiente",
          "pago_pendiente_taquilla",
          "pago_pendiente_validacion",
        ],
      },
    });

    if (car) {
      console.log("✅ [PROCESS-PAYMENT] Carro encontrado:", car.placa);
    } else {
      console.log("⚠️ [PROCESS-PAYMENT] No se encontró carro asociado al ticket");
    }

    // Subir imágenes a Cloudinary si existen
    let urlImagenComprobante = null;
    if (imagenComprobante) {
      console.log("📸 [PROCESS-PAYMENT] Procesando imagen del comprobante...");
      urlImagenComprobante = await uploadImageToCloudinary(imagenComprobante, codigoTicket, "comprobante");

      if (!urlImagenComprobante) {
        console.error("❌ [PROCESS-PAYMENT] Fallo al subir imagen del comprobante");
        return NextResponse.json(
          { success: false, message: "Fallo al subir la imagen del comprobante" },
          { status: 400 },
        );
      }
      console.log("✅ [PROCESS-PAYMENT] Imagen del comprobante subida exitosamente");
    } else if (!isMultiplePayment) {
      console.error("❌ [PROCESS-PAYMENT] Imagen del comprobante es requerida para pago único");
      return NextResponse.json(
        { success: false, message: "La imagen del comprobante es requerida" },
        { status: 400 },
      );
    }

    let urlImagenTickets = null;
    if (imagenTickets) {
      console.log("📸 [PROCESS-PAYMENT] Procesando imagen de los tickets...");
      urlImagenTickets = await uploadImageToCloudinary(imagenTickets, codigoTicket, "tickets");

      if (!urlImagenTickets) {
        console.error("❌ [PROCESS-PAYMENT] Fallo al subir imagen de los tickets");
        return NextResponse.json(
          { success: false, message: "Fallo al subir la imagen de los tickets" },
          { status: 400 },
        );
      }
      console.log("✅ [PROCESS-PAYMENT] Imagen de los tickets subida exitosamente");
    } else if (isMultiplePayment) {
      console.error("❌ [PROCESS-PAYMENT] Imagen de los tickets es requerida para pago múltiple");
      return NextResponse.json(
        { success: false, message: "La imagen de los tickets es requerida para pago múltiple" },
        { status: 400 },
      );
    }

    const pagoData = {
      ticketId: ticket._id.toString(),
      codigoTicket,
      tipoPago,
      referenciaTransferencia: referenciaTransferencia || null,
      banco: banco || null,
      telefono: telefono || null,
      numeroIdentidad: numeroIdentidad || null,
      montoPagado: montoEnBs,
      montoPagadoUsd: montoEnUsd,
      montoCalculado: ticket.montoCalculado || 0,
      isMultiplePayment: isMultiplePayment || false,
      ticketQuantity: cantidadTickets,
      montoCalculadoTotal: (ticket.montoCalculado || 0) * cantidadTickets,
      tasaCambioUsada: tasaCambio,
      fechaPago: now,
      estado: "pendiente_validacion",
      estadoValidacion: "pendiente",
      tiempoSalida: tiempoSalida || "now",
      tiempoSalidaEstimado,
      carInfo: car
        ? {
            placa: car.placa,
            marca: car.marca,
            modelo: car.modelo,
            color: car.color,
            nombreDueño: car.nombreDueño,
            telefono: car.telefono,
          }
        : null,
      urlImagenComprobante: urlImagenComprobante,
      urlImagenTickets: urlImagenTickets, // Added for tickets image
    };

    console.log("💾 [PROCESS-PAYMENT] Guardando pago en base de datos...");

    const pagoResult = await db.collection("pagos").insertOne(pagoData);

    console.log("✅ [PROCESS-PAYMENT] Pago guardado con ID:", pagoResult.insertedId);

    const nuevoEstadoTicket = tipoPago.startsWith("efectivo")
      ? "pagado_pendiente_taquilla"
      : "pagado_pendiente_validacion";

    // Actualizar ticket
    console.log("🎫 [PROCESS-PAYMENT] Actualizando estado del ticket a:", nuevoEstadoTicket);

    const ticketUpdateResult = await db.collection("tickets").updateOne(
      { codigoTicket },
      {
        $set: {
          estado: nuevoEstadoTicket,
          ultimoPagoId: pagoResult.insertedId.toString(),
          tipoPago,
          tiempoSalida: tiempoSalida || "now",
          tiempoSalidaEstimado,
          horaSalida: tiempoSalida === "now" ? now : undefined,
        },
      },
    );

    console.log("✅ [PROCESS-PAYMENT] Ticket actualizado");

    // Actualizar carro si existe
    if (car) {
      const nuevoEstadoCarro = tipoPago.startsWith("efectivo") ? "pago_pendiente_taquilla" : "pago_pendiente_validacion";

      console.log("🚗 [PROCESS-PAYMENT] Actualizando estado del carro a:", nuevoEstadoCarro);

      await db.collection("cars").updateOne({ _id: car._id }, { $set: { estado: nuevoEstadoCarro } });
    }

    // Actualizar car_history
    const carId = car?._id.toString();
    if (carId) {
      console.log("📚 [PROCESS-PAYMENT] Actualizando historial del carro...");

      await db.collection("car_history").updateOne(
        { carId },
        {
          $push: {
            eventos: {
              tipo: "pago_registrado",
              fecha: now,
              estado: tipoPago.startsWith("efectivo") ? "pago_pendiente_taquilla" : "pago_pendiente_validacion",
              datos: {
                tipoPago,
                montoPagado: montoEnBs,
                montoPagadoUsd: montoEnUsd,
                tasaCambio,
                tiempoSalida,
                tiempoSalidaEstimado,
                pagoId: pagoResult.insertedId.toString(),
                referenciaTransferencia,
                banco,
                telefono,
                numeroIdentidad,
                urlImagenComprobante: urlImagenComprobante,
                urlImagenTickets: urlImagenTickets, // Added for tickets image
              },
            },
          },
          $set: {
            estadoActual: tipoPago.startsWith("efectivo") ? "pago_pendiente_taquilla" : "pago_pendiente_validacion",
            fechaUltimaActualizacion: now,
            fechaPago: now,
            pagoData: pagoData,
            horaSalida: tiempoSalida === "now" ? now : undefined,
          },
        },
      );
    }

    // Enviar notificación push a administradores
    try {
      console.log("📱 [PROCESS-PAYMENT] Enviando notificación push a administradores...");
      const notificationPayload = {
        type: "admin_payment",
        ticketCode: codigoTicket,
        userType: "admin",
        data: {
          amount: montoEnBs,
          amountUsd: montoEnUsd,
          paymentType: tipoPago,
          plate: car?.placa || "N/A",
          requiresValidation: !tipoPago.startsWith("efectivo"),
          hasReceipt: !!urlImagenComprobante,
          hasTicketsImage: !!urlImagenTickets, // Added to indicate tickets image
          exitTime: tiempoSalida || "now",
          reference: referenciaTransferencia || null,
          bank: banco || null,
          isMultiplePayment: isMultiplePayment || false,
          ticketQuantity: cantidadTickets,
        },
      };
      const notificationResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/send-notification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(notificationPayload),
        },
      );
      if (notificationResponse.ok) {
        const responseData = await notificationResponse.json();
        console.log("✅ [PROCESS-PAYMENT] Notificación admin enviada:", responseData.sent);
      }
    } catch (notificationError) {
      console.error("❌ [PROCESS-PAYMENT] Error enviando notificación push:", notificationError);
      // No fallar el pago si la notificación falla
    }

    // Procesar suscripción de dispositivo si existe
    try {
      if (deviceSubscription) {
        console.log("📱 [PROCESS-PAYMENT] Creando suscripción de dispositivo para notificaciones...");
        await saveDeviceSubscription(deviceSubscription, codigoTicket, {
          paymentId: pagoResult.insertedId.toString(),
          paymentType: tipoPago,
          amount: montoEnBs,
          plate: car?.placa || null,
          clientIP,
          userAgent,
        });
        console.log("✅ [PROCESS-PAYMENT] Suscripción de dispositivo creada exitosamente");
      } else {
        console.log("⚠️ [PROCESS-PAYMENT] No se proporcionó suscripción de dispositivo");
      }
    } catch (subscriptionError) {
      console.error("❌ [PROCESS-PAYMENT] Error creando suscripción de dispositivo:", subscriptionError);
      // No fallar el pago si la suscripción falla
    }

    const processingTime = Date.now() - startTime;

    console.log("🎉 [PROCESS-PAYMENT] ===== PAGO PROCESADO EXITOSAMENTE =====");
    console.log("   Tiempo de procesamiento:", processingTime + "ms");

    const response = NextResponse.json({
      success: true,
      message: "Pago registrado exitosamente",
      pagoId: pagoResult.insertedId,
      tipoPago,
      montoEnBs,
      montoEnUsd,
      requiresValidation: !tipoPago.startsWith("efectivo"),
      tiempoSalida: tiempoSalida || "now",
      processingTime,
      urlImagenComprobante: urlImagenComprobante,
      urlImagenTickets: urlImagenTickets, // Added for tickets image
      isMultiplePayment: isMultiplePayment || false,
      ticketQuantity: cantidadTickets,
    });

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    response.headers.set("Surrogate-Control", "no-store");

    return response;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error("❌ [PROCESS-PAYMENT] ===== ERROR CRÍTICO =====");
    console.error("   Tiempo transcurrido:", processingTime + "ms");
    console.error("   Error:", error.message);

    // Log de error del sistema
    await logSecurityEvent.systemError(
      clientIP,
      "/api/process-payment",
      "POST",
      `Payment processing error: ${error}`,
      processingTime,
    );

    return NextResponse.json(
      {
        success: false,
        message: "Error al procesar el pago",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  return withSecurity(request, processPaymentHandler, {
    rateLimitType: "CRITICAL",
    requireValidOrigin: false,
    sanitizeBody: true,
    logRequests: true,
  });
}