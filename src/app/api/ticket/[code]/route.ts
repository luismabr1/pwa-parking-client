import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { calculateParkingFee } from "@/lib/utils"

export async function GET(request: Request, { params }: { params: { code: string } }) {
  try {
    const client = await clientPromise;
    const db = client.db("parking");
    const { code } = await params;
    const ticketCode = code;

    console.log(`🔍 API ticket/[code]: Buscando ticket: ${ticketCode}`);

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
    const precioHora = settings?.tarifas?.precioHora || 3.0;
    const tasaCambio = settings?.tarifas?.tasaCambio || 35.0;

    // Determinar la hora de entrada y calcular el monto
    if (ticket.estado === "estacionado_confirmado" && ticket.horaOcupacion) {
      horaEntrada = new Date(ticket.horaOcupacion);
      const now = new Date();
      const diffInMs = now.getTime() - horaEntrada.getTime();
      const diffInHours = diffInMs / (1000 * 60 * 60);

      montoCalculado = Math.max(diffInHours * precioHora, precioHora / 2);
      montoCalculado = Number.parseFloat(montoCalculado.toFixed(2));
      const montoBs = Number.parseFloat((montoCalculado * tasaCambio).toFixed(2));

      canProceed = true;
      console.log(`💰 Ticket estacionado confirmado - Calculado: $${montoCalculado} / Bs. ${montoBs}`);
    } else if (ticket.estado === "ocupado") {
      console.log(`⚠️ Ticket ocupado pero no confirmado: ${ticketCode}`);
      return NextResponse.json(
        {
          message:
            "Este vehículo está registrado pero aún no ha sido confirmado como estacionado por el personal. Por favor espere la confirmación.",
        },
        { status: 404 },
      );
    } else if (ticket.estado === "activo" && ticket.horaEntrada) {
      horaEntrada = new Date(ticket.horaEntrada);
      const now = new Date();
      const diffInMs = now.getTime() - horaEntrada.getTime();
      const diffInHours = diffInMs / (1000 * 60 * 60);

      montoCalculado = Math.max(diffInHours * precioHora, precioHora / 2);
      montoCalculado = Number.parseFloat(montoCalculado.toFixed(2));
      const montoBs = Number.parseFloat((montoCalculado * tasaCambio).toFixed(2));

      canProceed = true;
      console.log(`💰 Ticket activo legacy - Calculado: $${montoCalculado} / Bs. ${montoBs}`);
    } else if (ticket.estado === "disponible") {
      if (car) {
        console.log(`⚠️ Ticket disponible pero con carro asignado - requiere confirmación`);
        return NextResponse.json(
          {
            message:
              "Este vehículo está registrado pero aún no ha sido confirmado como estacionado por el personal. Por favor espere la confirmación.",
          },
          { status: 404 },
        );
      } else {
        console.log(`⚠️ Ticket disponible sin carro: ${ticketCode}`);
        return NextResponse.json(
          {
            message:
              "Este ticket no tiene un vehículo asignado. Debe registrar un carro primero en el panel de administración.",
          },
          { status: 404 },
        );
      }
    } else if (ticket.estado === "pago_rechazado") {
      if (ticket.horaOcupacion) {
        horaEntrada = new Date(ticket.horaOcupacion);
      } else if (ticket.horaEntrada) {
        horaEntrada = new Date(ticket.horaEntrada);
      }
      if (horaEntrada) {
        montoCalculado = calculateParkingFee(horaEntrada);
        canProceed = true;
        console.log(`🔄 Ticket con pago rechazado - Calculado: $${montoCalculado}`);
      }
    } else if (ticket.estado === "pagado_pendiente") {
      console.log(`⏳ Ticket con pago pendiente: ${ticketCode}`);
      return NextResponse.json(
        {
          message: "Este ticket ya tiene un pago pendiente de validación. Espere la confirmación del personal.",
        },
        { status: 404 },
      );
    }

    if (!canProceed) {
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

    const response = {
      _id: ticket._id,
      codigoTicket: ticket.codigoTicket,
      horaEntrada: horaEntrada?.toISOString() || ticket.horaEntrada,
      horaSalida: ticket.horaSalida,
      estado: ticket.estado,
      montoCalculado,
      montoBs,
      tasaCambio,
      ultimoPagoId: ticket.ultimoPagoId,
      carInfo,
    };

    console.log(`✅ API ticket/[code] - Respuesta enviada para ${ticketCode}:`, JSON.stringify(response, null, 2));
    return NextResponse.json(response);
  } catch (error) {
    console.error("❌ Error en API ticket/[code]:", error);
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}