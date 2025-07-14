import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { calculateParkingFee } from "@/lib/utils";

export const dynamic = "force-dynamic"; // Mark as dynamic to handle request.url

export async function GET(request: Request) {
  try {
    console.log("🔍 DEBUG: Handling GET request for /api/ticket-details");
    const { searchParams } = new URL(request.url);
    const ticketCode = searchParams.get("code");

    if (!ticketCode) {
      return NextResponse.json({ message: "Código de ticket requerido" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("parking");

    const ticket = await db.collection("tickets").findOne({ codigoTicket: ticketCode });

    if (!ticket) {
      return NextResponse.json({ message: "Ticket no encontrado" }, { status: 404 });
    }

    if (ticket.estado === "pagado_validado" || ticket.estado === "salido") {
      return NextResponse.json({ message: "Este ticket ya ha sido pagado y procesado" }, { status: 404 });
    }

    let montoCalculado = 0;
    let horaEntrada = null;

    if (ticket.estado === "ocupado" && ticket.horaOcupacion) {
      horaEntrada = new Date(ticket.horaOcupacion);
      montoCalculado = calculateParkingFee(horaEntrada);
    } else if (ticket.horaEntrada) {
      horaEntrada = new Date(ticket.horaEntrada);
      montoCalculado = calculateParkingFee(horaEntrada);
    } else if (ticket.estado === "disponible") {
      return NextResponse.json({ message: "Este ticket no tiene un vehículo asignado" }, { status: 404 });
    }

    let carInfo = null;
    const car = await db.collection("cars").findOne({
      ticketAsociado: ticketCode,
      estado: { $in: ["estacionado", "pago_pendiente", "estacionado_confirmado"] },
    });

    if (car) {
      carInfo = {
        placa: car.placa,
        marca: car.marca,
        modelo: car.modelo,
        color: car.color,
        nombreDueño: car.nombreDueño,
        telefono: car.telefono,
      };
    }

    await db.collection("tickets").updateOne({ codigoTicket: ticketCode }, { $set: { montoCalculado } });

    const response = {
      _id: ticket._id,
      codigoTicket: ticket.codigoTicket,
      horaEntrada: horaEntrada?.toISOString() || ticket.horaEntrada,
      horaSalida: ticket.horaSalida,
      estado: ticket.estado,
      montoCalculado,
      ultimoPagoId: ticket.ultimoPagoId,
      carInfo,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("🔍 DEBUG: Error fetching ticket details:", error);
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}
