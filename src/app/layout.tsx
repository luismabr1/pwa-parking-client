import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as Sonner } from "@/components/ui/sonner"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Parking PWA - Sistema de Estacionamiento",
  description:
    "Sistema completo de gestión de estacionamiento con tarifas inteligentes, pagos móviles y panel de administración. Instala la app para acceso rápido y notificaciones.",
  keywords: ["estacionamiento", "parking", "pwa", "gestión", "pagos", "móvil", "app"],
  authors: [{ name: "Parking PWA Team" }],
  creator: "Parking PWA",
  publisher: "Parking PWA",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Parking PWA - Sistema de Estacionamiento",
    description: "Sistema completo de gestión de estacionamiento. ¡Instala la app para acceso rápido!",
    url: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
    siteName: "Parking PWA",
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Parking PWA - Sistema de Estacionamiento",
    description: "Sistema completo de gestión de estacionamiento. ¡Instala la app para acceso rápido!",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Parking PWA",
    startupImage: [
      {
        url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 390 844'%3E%3Crect width='390' height='844' fill='%233b82f6'/%3E%3Ctext x='195' y='422' fontFamily='Arial' fontSize='48' fill='white' textAnchor='middle'%3EParking PWA%3C/text%3E%3C/svg%3E",
        media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
    ],
  },
  applicationName: "Parking PWA",
  referrer: "origin-when-cross-origin",
  category: "business",
  classification: "Business Application",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%233b82f6'/%3E%3Ctext x='50' y='55' fontFamily='Arial' fontSize='40' fill='white' textAnchor='middle'%3EP%3C/text%3E%3C/svg%3E",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
    apple: [
      {
        url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%233b82f6'/%3E%3Ctext x='50' y='55' fontFamily='Arial' fontSize='40' fill='white' textAnchor='middle'%3EP%3C/text%3E%3C/svg%3E",
        sizes: "180x180",
        type: "image/svg+xml",
      },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3b82f6" },
    { media: "(prefers-color-scheme: dark)", color: "#1e40af" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* PWA Meta Tags */}
        <meta name="application-name" content="Parking PWA" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Parking PWA" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* Apple Touch Icon usando SVG inline */}
        <link
          rel="apple-touch-icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%233b82f6'/%3E%3Ctext x='50' y='55' fontFamily='Arial' fontSize='40' fill='white' textAnchor='middle'%3EP%3C/text%3E%3C/svg%3E"
        />

        {/* Favicon usando SVG inline */}
        <link
          rel="icon"
          type="image/svg+xml"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%233b82f6'/%3E%3Ctext x='50' y='55' fontFamily='Arial' fontSize='40' fill='white' textAnchor='middle'%3EP%3C/text%3E%3C/svg%3E"
        />

        {/* Service Worker Registration */}
        <script
            dangerouslySetInnerHTML={{
              __html: `
                window.addEventListener('load', () => {
                  if ('serviceWorker' in navigator) {
                    const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
                    if (isProduction) {
                      navigator.serviceWorker.register('/sw.js')
                        .then((registration) => console.log('✅ SW registrado:', registration.scope))
                        .catch((error) => console.log('❌ SW falló:', error));
                    } else {
                      console.log('⚠️ Service Worker desactivado en desarrollo');
                    }
                  }
                });
              `,
            }}
          />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
          <Sonner />
        </ThemeProvider>
      </body>
    </html>
  )
}
