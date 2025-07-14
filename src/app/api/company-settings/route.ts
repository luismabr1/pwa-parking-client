import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("parking")

    // Obtener la configuración de la empresa
    const settings = await db.collection("company_settings").findOne({})

    // Si no hay configuración, devolver valores por defecto
    if (!settings) {
      return NextResponse.json({
        pagoMovil: {
          banco: "",
          cedula: "",
          telefono: "",
        },
        transferencia: {
          banco: "",
          cedula: "",
          telefono: "",
          numeroCuenta: "",
        },
        tarifas: {
          precioHora: 3.0,
          tasaCambio: 35.0,
        },
      })
    }

    // Asegurarse de que exista la sección de tarifas
    if (!settings.tarifas) {
      settings.tarifas = {
        precioHora: 3.0,
        tasaCambio: 35.0,
      }
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error("Error fetching company settings:", error)
    return NextResponse.json({ message: "Error al obtener la configuración" }, { status: 500 })
  }
}
