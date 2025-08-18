// Configuración centralizada de la aplicación
export const APP_CONFIG = {
  // Logo configuration
  logo: {
    // Logo para tema claro
    light:
      "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",

    // Logo para tema oscuro (puedes cambiar por una versión para fondo oscuro)
    dark: "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",

    // Logo para splash screen (pantalla de inicio PWA) - recomendado 512x512
    splash:
      "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",

    // Favicon para pestaña del navegador - recomendado 32x32 o 16x16
    favicon:
      "https://res.cloudinary.com/dezs0sktt/image/upload/v1755478227/Imagen_de_WhatsApp_2025-08-12_a_las_18.20.07_269fbbed_fd0ygy.jpg",

    // Configuración adicional
    alt: "Parking PWA Logo",
    fallbackText: "P", // Texto que se muestra si no hay logo
  },

  // App information
  app: {
    name: "Parking PWA - Sistema de Estacionamiento",
    shortName: "Parking PWA",
    description: "Sistema completo de gestión de estacionamiento con pagos móviles",
    themeColor: "#000000", // Color principal de la app
    backgroundColor: "#ffffff",
  },

  // Company information
  company: {
    name: "Parking PWA",
    website: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
  },
}

// Función helper para generar el logo SVG por defecto
export function generateDefaultLogoSVG(text = "P", size = 100, isDark = false): string {
  const bgColor = isDark ? "%23ffffff" : "%23000000"
  const textColor = isDark ? "black" : "white"

  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${size} ${size}'%3E%3Crect width='${size}' height='${size}' fill='${bgColor}' rx='${size * 0.2}'/%3E%3Ctext x='50%25' y='55%25' font-family='Arial' font-size='${size * 0.4}' fill='${textColor}' text-anchor='middle' dominant-baseline='middle'%3E${text}%3C/text%3E%3C/svg%3E`
}

// Función para obtener el logo según el tema
export function getLogoSrc(theme: "light" | "dark" = "light"): string {
  const logoSrc = theme === "dark" ? APP_CONFIG.logo.dark : APP_CONFIG.logo.light

  // Si existe un logo personalizado, usarlo
  if (logoSrc && logoSrc !== "/logo.png") {
    return logoSrc
  }

  // Si no, generar el logo por defecto
  return generateDefaultLogoSVG(APP_CONFIG.logo.fallbackText, 100, theme === "dark")
}

// Función para obtener el logo de splash screen
export function getSplashLogoSrc(): string {
  if (APP_CONFIG.logo.splash && APP_CONFIG.logo.splash !== "/logo.png") {
    return APP_CONFIG.logo.splash
  }

  return generateDefaultLogoSVG(APP_CONFIG.logo.fallbackText, 512)
}

// Función para obtener el favicon
export function getFaviconSrc(): string {
  if (APP_CONFIG.logo.favicon && APP_CONFIG.logo.favicon !== "/logo.png") {
    return APP_CONFIG.logo.favicon
  }

  return generateDefaultLogoSVG(APP_CONFIG.logo.fallbackText, 32)
}

// Función legacy para compatibilidad (usa tema claro por defecto)
export function getLogoSrcLegacy(): string {
  return getLogoSrc("light")
}
