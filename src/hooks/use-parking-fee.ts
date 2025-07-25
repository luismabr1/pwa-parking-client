// hooks/useParkingFee.ts
import { useMemo } from "react";
import { calculateParkingFee, isNightTime } from "@/lib/utils";

interface ParkingFeeResult {
  montoCalculado: number; // Fee in primary currency (e.g., USD)
  montoBs: number; // Fee in secondary currency (e.g., Bolivars)
  hours: number; // Hours calculated (only relevant for variable rate)
  isNightTariff: boolean; // Indicates if nocturnal tariff was applied
}

interface ParkingFeeParams {
  horaEntrada: string | Date; // Entry time (ISO string or Date)
  precioHora: number; // Day fixed/hourly rate (e.g., 3.0)
  precioHoraNoche?: number; // Night fixed/hourly rate (e.g., 4.0)
  tasaCambio: number; // Conversion rate (e.g., 35.0)
  nightStart?: string; // Night period start (e.g., "00:00")
  nightEnd?: string; // Night period end (e.g., "06:00")
}

/**
 * Hook to calculate parking fee based on entry time and pricing model from environment variable.
 * @param params - Object containing horaEntrada, precioHora, tasaCambio, etc.
 * @returns Object with montoCalculado, montoBs, hours, and isNightTariff
 */
export function useParkingFee({
  horaEntrada,
  precioHora,
  precioHoraNoche = precioHora + 1.0,
  tasaCambio,
  nightStart = "00:00",
  nightEnd = "06:00",
}: ParkingFeeParams): ParkingFeeResult {
  const pricingModel = process.env.NEXT_PUBLIC_PRICING_MODEL as "variable" | "fija" || "variable";

  const result = useMemo(() => {
    let montoCalculado = 0;
    let hours = 0;
    let isNightTariff = false;

    // Validate horaEntrada
    const entryTime = typeof horaEntrada === "string" ? new Date(horaEntrada) : horaEntrada;
    if (isNaN(entryTime.getTime())) {
      return { montoCalculado: 0, montoBs: 0, hours: 0, isNightTariff: false };
    }

    if (pricingModel === "variable") {
      // Hourly-based calculation using calculateParkingFee
      const endTime = new Date();
      hours = (endTime.getTime() - entryTime.getTime()) / (1000 * 60 * 60);
      montoCalculado = calculateParkingFee(
        entryTime.toISOString(),
        endTime.toISOString(),
        precioHora,
        precioHoraNoche,
        nightStart,
        nightEnd
      );
      isNightTariff = isNightTime(entryTime, nightStart, nightEnd); // For display purposes
    } else {
      // Fixed-rate calculation
      isNightTariff = isNightTime(entryTime, nightStart, nightEnd);
      montoCalculado = isNightTariff ? precioHoraNoche : precioHora;
    }

    // Round to 2 decimal places
    montoCalculado = Number.parseFloat(montoCalculado.toFixed(2));
    const montoBs = Number.parseFloat((montoCalculado * tasaCambio).toFixed(2));

    return { montoCalculado, montoBs, hours, isNightTariff };
  }, [horaEntrada, precioHora, precioHoraNoche, tasaCambio, nightStart, nightEnd]);

  return result;
}