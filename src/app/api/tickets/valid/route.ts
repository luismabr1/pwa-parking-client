import { type NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withSecurity } from "@/lib/security-middleware";
import { validateTicketCode } from "@/lib/security-utils";
import { logSecurityEvent } from "@/lib/security-logger";

async function handleGetValidTickets(request: NextRequest) {
  const clientIP = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  const url = new URL(request.url);
  const ticketCode = url.searchParams.get("ticketCode");

  if (!ticketCode || !validateTicketCode(ticketCode)) {
    await logSecurityEvent.maliciousRequest(
      clientIP,
      `/api/tickets/valid?ticketCode=${ticketCode}`,
      "GET",
      "Formato de código de ticket inválido",
      { ticketCode },
      userAgent,
    );
    return NextResponse.json({ message: "Código de ticket inválido" }, { status: 400 });
  }

  console.log(`🔍 API tickets/valid: Buscando tickets válidos para ticketCode: ${ticketCode}, IP: ${clientIP}`);

  const client = await clientPromise;
  const db = client.db("parking");

  // Find the car associated with the provided ticketCode
  const car = await db.collection("cars").findOne({
    ticketAsociado: ticketCode,
    estado: "estacionado_confirmado",
  });

  if (!car) {
    console.log(`❌ No se encontró carro asociado a ticket: ${ticketCode}`);
    await logSecurityEvent.maliciousRequest(
      clientIP,
      `/api/tickets/valid?ticketCode=${ticketCode}`,
      "GET",
      "No se encontró carro asociado",
      { ticketCode },
      userAgent,
    );
    return NextResponse.json({ message: "No se encontró vehículo asociado al ticket" }, { status: 404 });
  }

  // Count all cars with estado "estacionado_confirmado" for the same telefono or numeroIdentidad
  const validCars = await db.collection("cars").countDocuments({
    $or: [
      { telefono: car.telefono },
      { numeroIdentidad: car.numeroIdentidad },
    ],
    estado: "estacionado_confirmado",
  });

  const validTicketCodes = (await db.collection("cars").find({
    $or: [
      { telefono: car.telefono },
      { numeroIdentidad: car.numeroIdentidad },
    ],
    estado: "estacionado_confirmado",
  }).toArray()).map(c => c.ticketAsociado);

  console.log(`✅ Encontrados ${validCars} tickets válidos (estacionado_confirmado) para ticketCode: ${ticketCode}`);

  const responseData = {
    validTicketCount: validCars,
    validTicketCodes: validTicketCodes,
  };

  const nextResponse = NextResponse.json(responseData);
  nextResponse.headers.set("Cache-Control", "private, max-age=60");

  return nextResponse;
}

export async function GET(request: NextRequest) {
  return withSecurity(request, handleGetValidTickets, {
    rateLimitType: "QUERY",
    requireValidOrigin: false,
    sanitizeBody: false,
    logRequests: true,
  });
}