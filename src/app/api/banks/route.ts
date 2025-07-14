import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("parking")

    const banks = await db.collection("banks").find({}).sort({ name: 1 }).toArray()

    return NextResponse.json(banks)
  } catch (error) {
    console.error("Error fetching banks:", error)
    return NextResponse.json({ message: "Error al obtener la lista de bancos" }, { status: 500 })
  }
}
