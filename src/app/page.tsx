import TicketSearch from "@/components/ticket-search"
import PWAInstallPrompt from "@/components/pwa-install-prompt"
import NotificationSettings from "@/components/notification-settings"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center py-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Sistema de Estacionamiento</h1>
          <p className="text-gray-600">Busca tu ticket y gestiona tu pago</p>
        </div>

        <TicketSearch />

        <NotificationSettings userType="user" />

        <PWAInstallPrompt />
      </div>
    </main>
  )
}
