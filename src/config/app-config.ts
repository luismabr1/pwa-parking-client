// Configuración centralizada de la aplicación
export const APP_CONFIG = {
  // Logo configuration
  logo: {
    // Puedes cambiar esta ruta por tu logo personalizado
    // Formatos soportados: SVG, PNG, JPG
    // Recomendado: SVG para mejor escalabilidad
    src: "https://res.cloudinary.com/dezs0sktt/image/upload/v1752610317/parking-plates/z9euot4qapf5yi556wka.png", // Cambia esta ruta por tu logo
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
export function generateDefaultLogoSVG(text = "P", size = 100): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${size} ${size}'%3E%3Crect width='${size}' height='${size}' fill='%23000000' rx='${size * 0.2}'/%3E%3Ctext x='50%25' y='55%25' font-family='Arial' font-size='${size * 0.4}' fill='white' text-anchor='middle' dominant-baseline='middle'%3E${text}%3C/text%3E%3C/svg%3E`
}

// Función para obtener el logo con fallback
export function getLogoSrc(): string {
  // Si existe un logo personalizado, usarlo
  if (APP_CONFIG.logo.src !== "/logo.png") {
    return APP_CONFIG.logo.src
  }

  // Si no, generar el logo por defecto
  return generateDefaultLogoSVG(APP_CONFIG.logo.fallbackText)
}
