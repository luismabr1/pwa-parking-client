import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from 'next/font/google'
import "./globals.css"
import { ThemeProvider } from "@/components/theme/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { APP_CONFIG, getLogoSrc } from "@/config/app-config"
import { Analytics } from "@vercel/analytics/next"
import UpdatePrompt from "@/components/notifications/update-prompt"

const inter = Inter({ subsets: ["latin"] })

const logoSrc = getLogoSrc()
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

export const metadata: Metadata = {
  title: APP_CONFIG.app.name,
  description: APP_CONFIG.app.description,
  keywords: ["estacionamiento", "parking", "pwa", "gestión", "pagos", "móvil", "app"],
  authors: [{ name: APP_CONFIG.company.name }],
  creator: APP_CONFIG.company.name,
  publisher: APP_CONFIG.company.name,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(baseUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: APP_CONFIG.app.name,
    description: APP_CONFIG.app.description,
    url: baseUrl,
    siteName: APP_CONFIG.app.shortName,
    locale: "es_ES",
    type: "website",
    images: [
      {
        url: logoSrc,
        width: 512,
        height: 512,
        alt: APP_CONFIG.logo.alt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_CONFIG.app.name,
    description: APP_CONFIG.app.description,
    images: [logoSrc],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_CONFIG.app.shortName,
    startupImage: [
      {
        url: logoSrc,
        media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
    ],
  },
  applicationName: APP_CONFIG.app.shortName,
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
        url: logoSrc,
        sizes: "any",
        type: logoSrc.startsWith("data:") ? "image/svg+xml" : "image/png",
      },
    ],
    apple: [
      {
        url: logoSrc,
        sizes: "180x180",
        type: logoSrc.startsWith("data:") ? "image/svg+xml" : "image/png",
      },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: APP_CONFIG.app.themeColor },
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
        <meta name="application-name" content={APP_CONFIG.app.shortName} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={APP_CONFIG.app.shortName} />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content={APP_CONFIG.app.themeColor} />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* Favicon y Apple Touch Icon */}
        <link rel="apple-touch-icon" href={logoSrc} />
        <link rel="icon" type={logoSrc.startsWith("data:") ? "image/svg+xml" : "image/png"} href={logoSrc} />

        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('✅ SW registrado:', registration.scope);
                      
                      // Verificar actualizaciones cada 30 segundos
                      setInterval(() => {
                        registration.update().catch(err => {
                          console.log('Error verificando actualizaciones:', err);
                        });
                      }, 30000);
                    })
                    .catch(function(error) {
                      console.log('❌ SW falló:', error);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <UpdatePrompt />
          {children}
          <Toaster />
          <Sonner />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
