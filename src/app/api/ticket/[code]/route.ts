import { type NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withSecurity } from "@/lib/security-middleware";
import { validateTicketCode } from "@/lib/security-utils";
import { logSecurityEvent } from "@/lib/security-logger";
import { calculateParkingFee, isNightTime } from "@/lib/utils"; // Asegúrate de que estas utilidades estén importadas

async function handleGetTicket(request: NextRequest) {
  const clientIP = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  const url = new URL(request.url);
  const code = url.pathname.split("/").pop();
  const ticketCode = code;

  if (!ticketCode || !validateTicketCode(ticketCode)) {
    await logSecurityEvent.maliciousRequest(
      clientIP,
      `/api/ticket/${code}`,
      "GET",
      "Formato de código de ticket inválido",
      { code },
      userAgent,
    );
    return NextResponse.json({ message: "Código de ticket inválido" }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db("parking");

  const pricingModel = (process.env.NEXT_PUBLIC_PRICING_MODEL as "variable" | "fija") || "variable";

  console.log(`🔍 API ticket/[code]: Buscando ticket: ${ticketCode}, pricingModel: ${pricingModel}, IP: ${clientIP}`);

  const ticket = await db.collection("tickets").findOne({ codigoTicket: ticketCode });

  if (!ticket) {
    console.log(`❌ Ticket no encontrado: ${ticketCode} desde IP: ${clientIP}`);
    await logSecurityEvent.maliciousRequest(
      clientIP,
      `/api/ticket/${code}`,
      "GET",
      "Ticket no encontrado",
      { code: ticketCode },
      userAgent,
    );
    return NextResponse.json({ message: "Ticket no encontrado" }, { status: 404 });
  }

  console.log(`✅ Ticket encontrado: ${ticketCode}, estado: ${ticket.estado}, IP: ${clientIP}`);

  if (ticket.estado === "pagado_validado" || ticket.estado === "salido") {
    console.log(`⚠️ Ticket ya procesado: ${ticketCode} desde IP: ${clientIP}`);
    return NextResponse.json({ message: "Este ticket ya ha sido pagado y procesado" }, { status: 404 });
  }

  let montoCalculado = 0;
  let horaEntrada: Date | null = null;
  let canProceed = false;
  let isNightTariff = false;

  console.log(`🚗 Buscando carro asociado a ticket: ${ticketCode}`);
  const car = await db.collection("cars").findOne({
    ticketAsociado: ticketCode,
    estado: { $in: ["estacionado", "estacionado_confirmado", "pago_pendiente"] },
  });

  if (car) {
    console.log(`✅ Carro encontrado: ${car.placa} - ${car.marca} ${car.modelo}`);
  } else {
    console.log(`❌ No se encontró carro asociado a ticket: ${ticketCode}`);
  }

  const settings = await db.collection("company_settings").findOne({});
  const precioHora = Number(settings?.tarifas?.precioHoraDiurno || 3.0);
  const precioHoraNoche = Number(settings?.tarifas?.precioHoraNocturno || 4.0);
  const tasaCambio = Number(settings?.tarifas?.tasaCambio || 35.0);
  const nightStart = settings?.tarifas?.horaInicioNocturno || "00:00";
  const nightEnd = settings?.tarifas?.horaFinNocturno || "06:00";

  console.log(
    `⚙️ Tarifas: Diurno=${precioHora}, Nocturno=${precioHoraNoche}, Tasa=${tasaCambio}, Noche=${nightStart}-${nightEnd}`,
  );

  if (ticket.estado === "validado" && ticket.horaOcupacion) {
    horaEntrada = new Date(ticket.horaOcupacion);
    canProceed = true;
  } else if (ticket.estado === "activo" && ticket.horaEntrada) {
    horaEntrada = new Date(ticket.horaEntrada);
    canProceed = true;
  } else if (ticket.estado === "ocupado") {
    console.log(`⚠️ Ticket no confirmado: ${ticketCode}, estado: ${ticket.estado}`);
    return NextResponse.json(
      {
        message: "Este vehículo está registrado pero aún no ha sido confirmado como estacionado por el personal.",
      },
      { status: 404 },
    );
  } else if (ticket.estado === "disponible") {
    const carCheck = await db.collection("cars").findOne({ ticketAsociado: ticketCode });
    if (!carCheck) {
      console.log(`ℹ️ Ticket ${ticketCode} está disponible y no tiene vehículo asignado.`);
      return NextResponse.json(
        {
          message: "Este ticket no tiene un vehículo asignado.",
        },
        { status: 404 },
      );
    } else {
      console.log(`⚠️ Ticket ${ticketCode} está disponible pero tiene un vehículo asignado: ${carCheck.placa}`);
      return NextResponse.json(
        {
          message: "Este ticket está marcado como disponible pero tiene un vehículo asignado. Contacte al personal.",
        },
        { status: 404 },
      );
    }
  } else if (ticket.estado === "pago_rechazado") {
    horaEntrada = ticket.horaOcupacion
      ? new Date(ticket.horaOcupacion)
      : ticket.horaEntrada
        ? new Date(ticket.horaEntrada)
        : null;
    canProceed = !!horaEntrada;
  } else if (ticket.estado === "pagado_pendiente") {
    console.log(`⏳ Ticket con pago pendiente: ${ticketCode}`);
    return NextResponse.json(
      {
        message: "Este ticket ya tiene un pago pendiente de validación. Espere la confirmación del personal.",
      },
      { status: 404 },
    );
  }

  if (canProceed && horaEntrada) {
    isNightTariff = isNightTime(horaEntrada, nightStart, nightEnd);
    if (pricingModel === "variable") {
      montoCalculado = calculateParkingFee(
        horaEntrada.toISOString(),
        new Date().toISOString(),
        precioHora,
        precioHoraNoche,
        nightStart,
        nightEnd,
      );
    } else {
      montoCalculado = isNightTariff ? precioHoraNoche : precioHora;
    }
    montoCalculado = Number.parseFloat(montoCalculado.toFixed(2));
    console.log(
      `💰 Ticket calculado - ${pricingModel} ${isNightTariff ? "(nocturna)" : "(diurna)"}: $${montoCalculado}`,
    );
  } else {
    console.log(`❌ No se puede proceder con ticket: ${ticketCode}, estado: ${ticket.estado}`);
    return NextResponse.json(
      {
        message: `Este ticket no está en un estado válido para realizar pagos. Estado actual: ${ticket.estado}`,
      },
      { status: 404 },
    );
  }

  let carInfo = null;
  if (car) {
    carInfo = {
      placa: car.placa,
      marca: car.marca,
      modelo: car.modelo,
      color: car.color,
      nombreDueño: car.nombreDueño,
      telefono: car.telefono,
    };
    console.log(`🚗 Información del carro incluida en respuesta`);
  }

  await db.collection("tickets").updateOne({ codigoTicket: ticketCode }, { $set: { montoCalculado } });

  const montoBs = Number.parseFloat((montoCalculado * tasaCambio).toFixed(2));

  const responseData = {
    _id: ticket._id,
    codigoTicket: ticket.codigoTicket,
    horaEntrada: horaEntrada?.toISOString() || ticket.horaEntrada,
    horaSalida: ticket.horaSalida,
    estado: ticket.estado,
    montoCalculado,
    montoBs,
    tasaCambio,
    precioHora,
    precioHoraNoche,
    nightStart,
    nightEnd,
    ultimoPagoId: ticket.ultimoPagoId,
    carInfo,
    pricingModel,
    isNightTariff,
  };

  console.log(`✅ API ticket/[code] - Respuesta enviada para ${ticketCode} desde IP ${clientIP}`);

  const nextResponse = NextResponse.json({ ticket: responseData });
  nextResponse.headers.set("Cache-Control", "private, max-age=60");

  return nextResponse;
}

export async function GET(request: NextRequest) {
  return withSecurity(request, handleGetTicket, {
    rateLimitType: "QUERY",
    requireValidOrigin: false,
    sanitizeBody: false,
    logRequests: true,
  });
}