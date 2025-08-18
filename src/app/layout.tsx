import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { APP_CONFIG, getFaviconSrc, getSplashLogoSrc } from "@/config/app-config"
import { Analytics } from "@vercel/analytics/next"
import UpdatePrompt from "@/components/notifications/update-prompt"
import { Suspense } from "react"

const inter = Inter({ subsets: ["latin"] })

const faviconSrc = getFaviconSrc()
const splashLogoSrc = getSplashLogoSrc()
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
        url: splashLogoSrc,
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
    images: [splashLogoSrc],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_CONFIG.app.shortName,
    startupImage: [
      {
        url: "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",
        media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",
        media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        url: "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",
        media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",
        media: "(min-device-width: 768px) and (max-device-width: 1024px)",
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
        url: "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",
        sizes: "180x180",
        type: "image/png",
      },
      {
        url: "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",
        sizes: "152x152",
        type: "image/png",
      },
      {
        url: "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",
        sizes: "144x144",
        type: "image/png",
      },
      {
        url: "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",
        sizes: "120x120",
        type: "image/png",
      },
      {
        url: "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",
        sizes: "114x114",
        type: "image/png",
      },
      {
        url: "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",
        sizes: "76x76",
        type: "image/png",
      },
      {
        url: "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",
        sizes: "72x72",
        type: "image/png",
      },
      {
        url: "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",
        sizes: "60x60",
        type: "image/png",
      },
      {
        url: "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",
        sizes: "57x57",
        type: "image/png",
      },
    ],
    shortcut:
      "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: APP_CONFIG.app.themeColor },
    { media: "(prefers-color-scheme: dark)", color: "#304673" },
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
        <link
          rel="apple-touch-icon"
          href="https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg"
        />
        <link
          rel="apple-touch-icon"
          sizes="57x57"
          href="https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg"
        />
        <link
          rel="apple-touch-icon"
          sizes="60x60"
          href="https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg"
        />
        <link
          rel="apple-touch-icon"
          sizes="72x72"
          href="https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg"
        />
        <link
          rel="apple-touch-icon"
          sizes="76x76"
          href="https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg"
        />
        <link
          rel="apple-touch-icon"
          sizes="114x114"
          href="https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg"
        />
        <link
          rel="apple-touch-icon"
          sizes="120x120"
          href="https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg"
        />
        <link
          rel="apple-touch-icon"
          sizes="144x144"
          href="https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg"
        />
        <link
          rel="apple-touch-icon"
          sizes="152x152"
          href="https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg"
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg"
        />
        <link
          rel="icon"
          type="image/png"
          href="https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg"
        />

        {/* Apple Splash Screens */}
        <link
          rel="apple-touch-startup-image"
          href="https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg"
          media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg"
          media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg"
          media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg"
          media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />

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
          <Suspense fallback={null}>
            <UpdatePrompt />
            {children}
            <Toaster />
            <Sonner />
            <Analytics />
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  )
}
