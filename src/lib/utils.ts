import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("es-VE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return `${formatDate(d)} ${formatTime(d)}`
}

export function calculateHoursDifference(startTime: string, endTime?: string): number {
  const start = new Date(startTime)
  const end = endTime ? new Date(endTime) : new Date()
  const diffMs = end.getTime() - start.getTime()
  return Math.max(0, diffMs / (1000 * 60 * 60)) // Convert to hours
}

export function isNightTime(currentTime: Date, startNight: string, endNight: string): boolean {
  const current = currentTime.getHours() * 60 + currentTime.getMinutes()

  const [startHour, startMin] = startNight.split(":").map(Number)
  const [endHour, endMin] = endNight.split(":").map(Number)

  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin

  // Si el horario nocturno cruza medianoche (ej: 22:00 - 06:00)
  if (startMinutes > endMinutes) {
    return current >= startMinutes || current < endMinutes
  }

  // Si el horario nocturno no cruza medianoche (ej: 00:00 - 06:00)
  return current >= startMinutes && current < endMinutes
}

export function calculateParkingFee(
  startTime: string,
  endTime: string | null = null,
  hourlyRateDay = 3.0,
  hourlyRateNight = 4.0,
  nightStart = "00:00",
  nightEnd = "06:00",
): number {
  const start = new Date(startTime)
  const end = endTime ? new Date(endTime) : new Date()

  let totalFee = 0
  let currentTime = new Date(start)

  while (currentTime < end) {
    const nextHour = new Date(currentTime.getTime() + 60 * 60 * 1000)
    const hourEnd = nextHour > end ? end : nextHour

    const hoursInThisSegment = (hourEnd.getTime() - currentTime.getTime()) / (1000 * 60 * 60)

    const rate = isNightTime(currentTime, nightStart, nightEnd) ? hourlyRateNight : hourlyRateDay
    totalFee += hoursInThisSegment * rate

    currentTime = nextHour
  }

  return Math.max(totalFee, 0)
}
