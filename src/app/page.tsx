import TicketSearch from "@/components/ticket/ticket-search"
import PWAInstallPrompt from "@/components/notifications/pwa-install-prompt"
import NotificationSettings from "@/components/notifications/notification-settings"

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container max-w-md mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-primary rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-2xl font-bold text-primary-foreground">P</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Sistema de Estacionamiento</h1>
            <p className="text-muted-foreground">Busca tu ticket y gestiona tu pago</p>
          </div>
        </div>

        <TicketSearch />

        <NotificationSettings userType="user" />

        <PWAInstallPrompt />
      </div>
    </main>
  )
}
