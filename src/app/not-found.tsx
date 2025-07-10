import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md mx-auto text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-6">Página no encontrada</h2>
        <p className="text-lg text-gray-600 mb-8">Lo sentimos, no pudimos encontrar la página que estás buscando.</p>
        <Button asChild className="h-12 text-lg">
          <Link href="/">Volver al Inicio</Link>
        </Button>
      </div>
    </div>
  )
}
