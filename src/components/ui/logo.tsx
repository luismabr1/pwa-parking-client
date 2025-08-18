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

  // Clases base para el contenedor - AGREGANDO CONTENEDOR REDONDO
  const containerClasses = cn(
    "flex items-center gap-2",
    variant === "favicon" && "w-8 h-8",
    variant === "hero" && "justify-center",
    className,
  )

  // Clases para la imagen/icono - AGREGANDO CONTENEDOR REDONDO
  const imageClasses = cn(
    "object-cover",
    variant === "favicon" && "rounded-full",
    variant === "icon" && "rounded-full shadow-sm",
    variant === "hero" && "rounded-full shadow-lg",
    variant === "full" && "rounded-full shadow-md",
  )

  return (
    <div className={containerClasses}>
      {/* Contenedor redondo para el logo */}
      <div
        className={cn(
          "rounded-full overflow-hidden bg-background border-2 border-border flex items-center justify-center",
          variant === "favicon" && "w-8 h-8",
          variant === "icon" && `w-10 h-10`,
          variant === "hero" && "w-16 h-16",
          variant === "full" && "w-12 h-12",
        )}
        style={variant === "icon" && size !== 40 ? { width: size, height: size } : undefined}
      >
        {!imageError && logoSrc.startsWith("data:") ? (
          // Logo SVG generado
          <div
            className={cn(
              imageClasses,
              "flex items-center justify-center bg-primary text-primary-foreground font-bold w-full h-full",
            )}
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
            className={cn(imageClasses, "w-full h-full")}
            onError={() => setImageError(true)}
            priority={variant === "favicon"}
          />
        ) : (
          // Fallback si hay error
          <div
            className={cn(
              imageClasses,
              "flex items-center justify-center bg-primary text-primary-foreground font-bold w-full h-full",
            )}
            style={{
              fontSize: logoSize * 0.4,
            }}
          >
            {APP_CONFIG.logo.fallbackText}
          </div>
        )}
      </div>

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
