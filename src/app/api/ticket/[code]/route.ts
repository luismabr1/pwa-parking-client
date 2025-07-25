// api/ticket/[code]/route.ts
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { calculateParkingFee, isNightTime } from "@/lib/utils";

export async function GET(request: Request, { params }: { params: { code: string } }) {
  try {
    const client = await clientPromise;
    const db = client.db("parking");
    const { code } = params;
    const ticketCode = code;

    // Use NEXT_PUBLIC_PRICING_MODEL consistently
    const pricingModel = process.env.NEXT_PUBLIC_PRICING_MODEL as "variable" | "fija" || "variable";

    console.log(`🔍 API ticket/[code]: Buscando ticket: ${ticketCode}, pricingModel: ${pricingModel}`);

    // Buscar el ticket
    const ticket = await db.collection("tickets").findOne({ codigoTicket: ticketCode });

    if (!ticket) {
      console.log(`❌ Ticket no encontrado: ${ticketCode}`);
      return NextResponse.json({ message: "Ticket no encontrado" }, { status: 404 });
    }

    console.log(`✅ Ticket encontrado: ${ticketCode}, estado: ${ticket.estado}`);

    // Verificar si el ticket ya fue pagado y validado
    if (ticket.estado === "pagado_validado" || ticket.estado === "salido") {
      console.log(`⚠️ Ticket ya procesado: ${ticketCode}`);
      return NextResponse.json({ message: "Este ticket ya ha sido pagado y procesado" }, { status: 404 });
    }

    let montoCalculado = 0;
    let horaEntrada = null;
    let canProceed = false;
    let isNightTariff = false;

    // Buscar información del carro asociado
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

    // Obtener la configuración de tarifas
    const settings = await db.collection("company_settings").findOne({});
    const precioHora = settings?.tarifas?.precioHoraDiurno || 3.0;
    const precioHoraNoche = settings?.tarifas?.precioHoraNocturno || 4.0;
    const tasaCambio = settings?.tarifas?.tasaCambio || 35.0;
    const nightStart = settings?.tarifas?.horaInicioNocturno || "00:00";
    const nightEnd = settings?.tarifas?.horaFinNocturno || "06:00";

    // Determinar la hora de entrada y calcular el monto
    if (ticket.estado === "validado" && ticket.horaOcupacion) {
      horaEntrada = new Date(ticket.horaOcupacion);
      canProceed = true;
    } else if (ticket.estado === "activo" && ticket.horaEntrada) {
      horaEntrada = new Date(ticket.horaEntrada);
      canProceed = true;
    } else if (ticket.estado === "ocupado" || ticket.estado === "disponible") {
      console.log(`⚠️ Ticket no confirmado: ${ticketCode}, estado: ${ticket.estado}`);
      return NextResponse.json(
        {
          message: "Este vehículo está registrado pero aún no ha sido confirmado como estacionado por el personal.",
        },
        { status: 404 }
      );
    } else if (ticket.estado === "pago_rechazado") {
      horaEntrada = ticket.horaOcupacion ? new Date(ticket.horaOcupacion) : ticket.horaEntrada ? new Date(ticket.horaEntrada) : null;
      canProceed = !!horaEntrada;
    } else if (ticket.estado === "pagado_pendiente") {
      console.log(`⏳ Ticket con pago pendiente: ${ticketCode}`);
      return NextResponse.json(
        {
          message: "Este ticket ya tiene un pago pendiente de validación. Espere la confirmación del personal.",
        },
        { status: 404 }
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
          nightEnd
        );
      } else {
        montoCalculado = isNightTariff ? precioHoraNoche : precioHora;
      }
      montoCalculado = Number.parseFloat(montoCalculado.toFixed(2));
      console.log(`💰 Ticket calculado - ${pricingModel} ${isNightTariff ? "(nocturna)" : "(diurna)"}: $${montoCalculado}`);
    } else {
      console.log(`❌ No se puede proceder con ticket: ${ticketCode}, estado: ${ticket.estado}`);
      return NextResponse.json(
        {
          message: `Este ticket no está en un estado válido para realizar pagos. Estado actual: ${ticket.estado}`,
        },
        { status: 404 }
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

    const response = {
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

    console.log(`✅ API ticket/[code] - Respuesta enviada para ${ticketCode}:`, JSON.stringify(response, null, 2));
    return NextResponse.json(response);
  } catch (error) {
    console.error("❌ Error en API ticket/[code]:", error);
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}