"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useTheme } from "next-themes"
import { APP_CONFIG, getLogoSrc, getFaviconSrc } from "@/config/app-config"
import { cn } from "@/lib/utils"

interface LogoProps {
  size?: number
  className?: string
  showText?: boolean
  variant?: "icon" | "full" | "favicon" | "hero"
  forceTheme?: "light" | "dark"
}

export default function Logo({ size = 40, className = "", showText = false, variant = "icon", forceTheme }: LogoProps) {
  const [imageError, setImageError] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, systemTheme } = useTheme()

  // Evitar hidration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Determinar el tema actual - usar "light" por defecto hasta que se monte
  const currentTheme = mounted ? forceTheme || (theme === "system" ? systemTheme : theme) || "light" : "light"

  // Obtener el logo según el tema y variante
  const logoSrc = variant === "favicon" ? getFaviconSrc() : getLogoSrc(currentTheme as "light" | "dark")

  // Para diferentes variantes, usar tamaños específicos
  const logoSize = variant === "favicon" ? 32 : variant === "hero" ? 64 : size

  // Clases base para el contenedor
  const containerClasses = cn(
    "flex items-center gap-2",
    variant === "favicon" && "w-8 h-8",
    variant === "hero" && "justify-center",
    className,
  )

  // Clases para la imagen/icono
  const imageClasses = cn(
    "rounded-lg object-cover",
    variant === "favicon" && "rounded-md",
    variant === "icon" && "shadow-sm",
    variant === "hero" && "shadow-lg",
  )

  return (
    <div className={containerClasses}>
      {!imageError && logoSrc.startsWith("data:") ? (
        // Logo SVG generado
        <div
          className={cn(imageClasses, "flex items-center justify-center bg-primary text-primary-foreground font-bold")}
          style={{
            width: logoSize,
            height: logoSize,
            fontSize: logoSize * 0.4,
          }}
          dangerouslySetInnerHTML={{
            __html: logoSrc
              .replace("data:image/svg+xml,", "")
              .replace(/%3C/g, "<")
              .replace(/%3E/g, ">")
              .replace(/%20/g, " ")
              .replace(/%25/g, "%")
              .replace(/%23/g, "#"),
          }}
        />
      ) : !imageError ? (
        // Logo personalizado
        <Image
          src={logoSrc || "/placeholder.svg"}
          alt={APP_CONFIG.logo.alt}
          width={logoSize}
          height={logoSize}
          className={imageClasses}
          onError={() => setImageError(true)}
          priority={variant === "favicon"}
        />
      ) : (
        // Fallback si hay error
        <div
          className={cn(imageClasses, "flex items-center justify-center bg-primary text-primary-foreground font-bold")}
          style={{
            width: logoSize,
            height: logoSize,
            fontSize: logoSize * 0.4,
          }}
        >
          {APP_CONFIG.logo.fallbackText}
        </div>
      )}

      {showText && (
        <div className="flex flex-col">
          <span className="font-bold text-foreground">{APP_CONFIG.app.shortName}</span>
          {variant === "full" && <span className="text-xs text-muted-foreground">Sistema de Estacionamiento</span>}
        </div>
      )}
    </div>
  )
}

// Componente específico para el favicon
export function FaviconLogo() {
  return <Logo variant="favicon" size={32} />
}

// Componente para el header principal - SOLO LOGO, SIN TEXTO
export function HeroLogo() {
  return <Logo variant="hero" size={64} />
}

// Componente para el header con texto (si se necesita en otro lugar)
export function HeaderLogo() {
  return <Logo size={48} showText={true} variant="full" />
}

// Componente para iconos pequeños
export function IconLogo({ size = 24 }: { size?: number }) {
  return <Logo size={size} variant="icon" />
}
