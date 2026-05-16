export type AlertSensitivity = "conservative" | "balanced" | "sensitive";

export type AlertSensitivityConfig = {
  revenueWindowMinutes: number;
  baselineHours: number;
  dropThreshold: number;
  minBaselineRevenue: number;
  minCurrentRevenue: number;
  minSamples: number;
  failureWindowMinutes: number;
  failureLookbackDays: number;
  failureMinCurrent: number;
  failureBaselineFloor: number;
  failureSpikeMultiplier: number;
  failureCriticalMultiplier: number;
  failureMinSamples: number;
  failureFallbackMinCurrent: number;
};

const ALERT_SENSITIVITY_CONFIG: Record<AlertSensitivity, AlertSensitivityConfig> = {
  conservative: {
    revenueWindowMinutes: 60,
    baselineHours: 6 * 7 * 24,
    dropThreshold: 0.3,
    minBaselineRevenue: 50000,
    minCurrentRevenue: 10000,
    minSamples: 5,
    failureWindowMinutes: 60,
    failureLookbackDays: 14,
    failureMinCurrent: 5,
    failureBaselineFloor: 3,
    failureSpikeMultiplier: 2,
    failureCriticalMultiplier: 4,
    failureMinSamples: 5,
    failureFallbackMinCurrent: 10,
  },
  balanced: {
    revenueWindowMinutes: 45,
    baselineHours: 4 * 7 * 24,
    dropThreshold: 0.3,
    minBaselineRevenue: 40000,
    minCurrentRevenue: 8000,
    minSamples: 5,
    failureWindowMinutes: 45,
    failureLookbackDays: 14,
    failureMinCurrent: 5,
    failureBaselineFloor: 3,
    failureSpikeMultiplier: 1.8,
    failureCriticalMultiplier: 3.5,
    failureMinSamples: 5,
    failureFallbackMinCurrent: 10,
  },
  sensitive: {
    revenueWindowMinutes: 30,
    baselineHours: 3 * 7 * 24,
    dropThreshold: 0.3,
    minBaselineRevenue: 30000,
    minCurrentRevenue: 5000,
    minSamples: 5,
    failureWindowMinutes: 30,
    failureLookbackDays: 10,
    failureMinCurrent: 4,
    failureBaselineFloor: 2,
    failureSpikeMultiplier: 1.6,
    failureCriticalMultiplier: 3,
    failureMinSamples: 5,
    failureFallbackMinCurrent: 10,
  },
};

export function normalizeAlertSensitivity(value?: string | null): AlertSensitivity {
  if (value === "balanced" || value === "sensitive") {
    return value;
  }

  return "conservative";
}

export function getAlertSensitivityConfig(value?: string | null): AlertSensitivityConfig {
  return ALERT_SENSITIVITY_CONFIG[normalizeAlertSensitivity(value)];
}
