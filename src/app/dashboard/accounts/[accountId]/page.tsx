import { auth } from "@/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import SeverityHelpPopover from "@/components/SeverityHelpPopover";
import { getAlertSensitivityConfig } from "@/lib/alert-sensitivity";
import { formatMoneyAmount, normalizeCurrencyCode } from "@/lib/currency";
import { getDemoAccountById, getDemoAlertHistory, getDemoSeverity } from "@/lib/demoData";
import { prisma } from "@/lib/prisma";
import RenameAccountControl from "./RenameAccountControl";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type AlertLike = {
  id?: string;
  type: string;
  severity?: string;
  status?: string;
  message?: string;
  context?: string | null;
  createdAt?: Date;
  windowEnd?: Date;
  stripeAccountId?: string | null;
  accountName?: string | null;
  detectedLabel?: string;
  displayTimestamp?: string;
};

type RevenueContext = {
  parsed: Record<string, unknown>;
  baselineAmount: number;
  currentAmount: number;
  dropRatio: number;
  threshold: number;
  alertThresholdAmount: number;
  baselineLabel: string;
  windowLabel: string;
  currency: string;
};

type PaymentFailureContext = {
  failures: number;
  normalFailures: number | null;
  threshold: number;
  criticalThreshold: number | null;
  windowLabel: string;
};

type ChartPoint = {
  index: number;
  label: string;
  expected: number;
  actual: number;
};

type RevenueChartModel = {
  points: ChartPoint[];
  expectedValue: number;
  actualValue: number;
  reviewThresholdValue: number;
  highSeverityThresholdValue: number;
  peakValue: number;
  lowValue: number;
  activeIndex: number;
  windowLabel: string;
  isAlerting: boolean;
  currency: string;
};

type FailureChartPoint = {
  index: number;
  label: string;
  failures: number;
};

type FailureChartModel = {
  points: FailureChartPoint[];
  failures: number;
  normalFailures: number | null;
  threshold: number;
  criticalThreshold: number | null;
  windowLabel: string;
  peakFailures: number;
  activeIndex: number;
};

type RevenueBaselineLevel =
  | "same_day_and_hour"
  | "same_day_type_and_hour"
  | "same_hour";

type FailureBaselineLevel =
  | "same_day_and_hour"
  | "same_day_type_and_hour"
  | "same_hour";

type RevenueMetricSample = {
  amount: number;
  periodEnd: Date;
};

type HealthyRevenueMonitoringState = {
  model: RevenueChartModel | null;
  currentAmount: number;
  baselineAmount: number | null;
  thresholdValue: number | null;
  currency: string;
  baselineLabel: string;
  windowLabel: string;
  hasEnoughHistory: boolean;
  placeholderLabels: string[];
};

type HealthyPaymentMonitoringState = {
  model: FailureChartModel;
  failures: number;
  normalFailures: number | null;
  threshold: number;
  criticalThreshold: number | null;
  windowLabel: string;
  hasEnoughHistory: boolean;
};

type ThresholdDisplayMode = "review-only" | "both" | "critical-only";

function safeParseContext(input?: string | null) {
  if (!input) return null;

  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtDate(d?: Date | null) {
  if (!d) return "No activity yet";
  return new Date(d).toLocaleString();
}

function fmtDetectedDate(d?: Date | null) {
  if (!d) return null;

  const target = new Date(d);
  const monthDay = target.toLocaleDateString([], {
    month: "long",
    day: "numeric",
  });
  const time = target.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${monthDay} at ${time}`;
}

function buildApproxDateFromRelativeLabel(label?: string, now: Date = new Date()) {
  if (!label) return undefined;

  const match = label.match(/(\d+)\s+(minute|hour|day)s?\s+ago/i);
  if (!match) return undefined;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const date = new Date(now);

  if (unit === "minute") {
    date.setMinutes(date.getMinutes() - amount);
  } else if (unit === "hour") {
    date.setHours(date.getHours() - amount);
  } else if (unit === "day") {
    date.setDate(date.getDate() - amount);
  }

  return date;
}

function fmtUtcHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function buildRecentHourLabels(now: Date, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const relativeHour = count - 1 - index;
    const hour = (now.getUTCHours() - relativeHour + 24) % 24;
    return fmtUtcHour(hour);
  });
}

function nextHourLabel(label: string) {
  const match = label.match(/^(\d{2}):(\d{2})$/);
  if (!match) return label;

  const hour = Number(match[1]);
  return `${String((hour + 1) % 24).padStart(2, "0")}:${match[2]}`;
}

function dayTypeDays(dayOfWeek: number) {
  return dayOfWeek === 0 || dayOfWeek === 6 ? [0, 6] : [1, 2, 3, 4, 5];
}

function revenueBaselineLabel(level: RevenueBaselineLevel) {
  if (level === "same_day_and_hour") return "same day and same hour";
  if (level === "same_day_type_and_hour") return "same weekday/weekend type and same hour";
  return "same hour";
}

function buildTickIndexes(length: number) {
  if (length <= 1) return [0];

  if (length <= 8) {
    return Array.from({ length }, (_, index) => index);
  }

  const candidates = [
    0,
    Math.floor((length - 1) / 3),
    Math.floor(((length - 1) * 2) / 3),
    length - 1,
  ];
  return [...new Set(candidates)];
}

function summarizeRevenueWindows(samples: RevenueMetricSample[]) {
  const totalsByWindow = new Map<string, number>();

  for (const sample of samples) {
    const d = new Date(sample.periodEnd);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}`;
    totalsByWindow.set(key, (totalsByWindow.get(key) ?? 0) + sample.amount);
  }

  const totals = Array.from(totalsByWindow.values());
  const total = totals.reduce((sum, amount) => sum + amount, 0);

  return {
    average: totals.length > 0 ? total / totals.length : 0,
    sampleCount: totals.length,
  };
}

function median(values: number[]) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function shiftDateByDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function countEventsInWindow(eventDates: Date[], start: Date, end: Date) {
  return eventDates.filter((date) => date >= start && date < end).length;
}

function summarizeFailureWindows(counts: number[]) {
  return {
    median: median(counts),
    sampleCount: counts.length,
  };
}

function buildFailureSeries(eventDates: Date[], now: Date, bucketCount = 6) {
  const currentBucketStart = new Date(now);
  currentBucketStart.setUTCMinutes(0, 0, 0);

  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(currentBucketStart);
    bucketStart.setUTCHours(currentBucketStart.getUTCHours() - (bucketCount - 1 - index));

    const bucketEnd = new Date(bucketStart);
    bucketEnd.setUTCHours(bucketStart.getUTCHours() + 1);

    return {
      time: `${String(bucketStart.getUTCHours()).padStart(2, "0")}:00`,
      failures: countEventsInWindow(eventDates, bucketStart, bucketEnd),
    };
  });
}

function buildRevenueSeriesFromSnapshot({
  recentMetrics,
  baselineAmount,
  currentAmount,
  now,
  bucketCount = 6,
}: {
  recentMetrics: Array<{ amount: number; periodEnd: Date }>;
  baselineAmount: number;
  currentAmount: number;
  now: Date;
  bucketCount?: number;
}) {
  const anchorHourStart = new Date(now);
  anchorHourStart.setUTCMinutes(0, 0, 0);

  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(anchorHourStart);
    bucketStart.setUTCHours(anchorHourStart.getUTCHours() - (bucketCount - 1 - index));

    const bucketEnd = new Date(bucketStart);
    bucketEnd.setUTCHours(bucketStart.getUTCHours() + 1);

    const observedRevenue = recentMetrics
      .filter((metric) => metric.periodEnd >= bucketStart && metric.periodEnd < bucketEnd)
      .reduce((sum, metric) => sum + metric.amount, 0);

    const fallbackRevenue =
      index === bucketCount - 1
        ? currentAmount
        : Math.round(baselineAmount * (0.97 + ((index % 3) - 1) * 0.02));

    return {
      time: `${String(bucketStart.getUTCHours()).padStart(2, "0")}:00`,
      revenue: observedRevenue > 0 ? observedRevenue : fallbackRevenue,
    };
  });
}

function alertLabel(type: string) {
  if (type === "revenue_drop") return "Revenue drop detected";
  if (type === "payment_failed") return "Payment failure spike";
  return type.replace(/_/g, " ");
}

function getSeverityLabel(severity?: string) {
  if (severity === "critical") return "High severity";
  if (severity === "warning") return "Review needed";
  return "Monitoring active";
}

function getSeverityPresentation(severity?: string) {
  if (severity === "critical") {
    return {
      label: "High severity",
      accentColor: "#ba1a1a",
      accentSoft: "#ffdad6",
      accentTint: "rgba(186, 26, 26, 0.025)",
      accentZone: "rgba(186, 26, 26, 0.03)",
      accentShadow: "rgba(186, 26, 26, 0.09)",
      accentLine: "rgba(186, 26, 26, 0.34)",
      barSoft: "rgba(255, 188, 188, 0.62)",
      barStrong: "rgba(186, 26, 26, 0.82)",
      barActive: "#ba1a1a",
      barShadow: "rgba(186, 26, 26, 0.14)",
      legendClass: styles.legendRed,
      dashClass: styles.legendDashRed,
      iconClass: styles.alertIconCritical,
      panelClass: styles.monitorPanelIssueCritical,
      statusClass: styles.statusCritical,
    };
  }

  return {
    label: "Review needed",
    accentColor: "#9a6700",
    accentSoft: "#fff1c2",
    accentTint: "rgba(154, 103, 0, 0.03)",
    accentZone: "rgba(154, 103, 0, 0.045)",
    accentShadow: "rgba(154, 103, 0, 0.1)",
    accentLine: "rgba(154, 103, 0, 0.34)",
    barSoft: "rgba(255, 218, 133, 0.5)",
    barStrong: "rgba(183, 121, 31, 0.76)",
    barActive: "#b7791f",
    barShadow: "rgba(183, 121, 31, 0.16)",
    legendClass: styles.legendAmber,
    dashClass: styles.legendDashAmber,
    iconClass: styles.alertIconWarning,
    panelClass: styles.monitorPanelIssueWarning,
    statusClass: styles.statusWarning,
  };
}

function getRevenueContext(alert?: AlertLike | null): RevenueContext | null {
  if (!alert || alert.type !== "revenue_drop") return null;

  const parsed = safeParseContext(alert.context);
  if (!parsed) return null;

  const baselineAmount =
    typeof parsed.baselineAmount === "number"
      ? parsed.baselineAmount
      : typeof parsed.expectedRevenue === "number"
        ? parsed.expectedRevenue
        : null;
  const currentAmount =
    typeof parsed.currentAmount === "number"
      ? parsed.currentAmount
      : typeof parsed.currentRevenue === "number"
        ? parsed.currentRevenue
        : null;

  if (baselineAmount === null || currentAmount === null || baselineAmount <= 0) {
    return null;
  }

  return {
    parsed,
    baselineAmount,
    currentAmount,
    dropRatio:
      typeof parsed.dropRatio === "number"
        ? parsed.dropRatio
        : (baselineAmount - currentAmount) / baselineAmount,
    threshold:
      typeof parsed.threshold === "number"
        ? parsed.threshold
        : typeof parsed.alertThresholdAmount === "number"
          ? 1 - parsed.alertThresholdAmount / baselineAmount
          : 0.5,
    alertThresholdAmount:
      typeof parsed.alertThresholdAmount === "number"
        ? parsed.alertThresholdAmount
        : Math.round(baselineAmount * 0.7),
    baselineLabel:
      typeof parsed.baselineLabel === "string" ? parsed.baselineLabel : "recent performance",
    windowLabel:
      typeof parsed.window === "string" ? parsed.window : "current monitoring window",
    currency:
      typeof parsed.currency === "string"
        ? normalizeCurrencyCode(parsed.currency)
        : "EUR",
  };
}

function getMonitoringPresentation() {
  return {
    label: "Normal",
    accentColor: "#0058bc",
    accentSoft: "#e7f1ff",
    accentTint: "rgba(0, 88, 188, 0.025)",
    accentZone: "rgba(0, 88, 188, 0.035)",
    accentShadow: "rgba(0, 88, 188, 0.1)",
    accentLine: "rgba(0, 88, 188, 0.28)",
    barSoft: "rgba(0, 88, 188, 0.22)",
    barStrong: "rgba(0, 88, 188, 0.44)",
    barActive: "#0058bc",
    barShadow: "rgba(0, 88, 188, 0.14)",
    legendClass: styles.legendBlue,
    dashClass: styles.legendDashBlue,
    iconClass: styles.alertIconWarning,
    panelClass: styles.monitorPanelNormal,
    statusClass: styles.statusHealthy,
  };
}

function getThresholdDisplayMode(severity?: string | null): ThresholdDisplayMode {
  if (severity === "critical" || severity === "warning") return "both";
  return "review-only";
}

function getPaymentFailureContext(
  alert?: AlertLike | null,
  alertSensitivity?: string | null
): PaymentFailureContext | null {
  if (!alert || alert.type !== "payment_failed") return null;

  const parsed = safeParseContext(alert.context);
  if (!parsed) return null;
  const config = getAlertSensitivityConfig(alertSensitivity);

  const failures =
    typeof parsed.failuresCounted === "number"
      ? parsed.failuresCounted
      : typeof parsed.failedPayments === "number"
        ? parsed.failedPayments
        : null;

  if (failures === null) return null;

  const normalFailures =
    typeof parsed.normalFailures === "number"
      ? parsed.normalFailures
      : typeof parsed.baseline === "number"
        ? parsed.baseline
        : null;
  const threshold =
    typeof parsed.failureThreshold === "number" ? parsed.failureThreshold : 5;
  const baselineFloor =
    typeof parsed.baselineFloor === "number"
      ? parsed.baselineFloor
      : config.failureBaselineFloor;
  const criticalMultiplier = config.failureCriticalMultiplier;
  const reviewMultiplier =
    typeof parsed.failureSpikeMultiplier === "number" && parsed.failureSpikeMultiplier > 0
      ? parsed.failureSpikeMultiplier
      : config.failureSpikeMultiplier;
  const criticalThreshold =
    normalFailures !== null
      ? Math.round(Math.max(normalFailures, baselineFloor) * criticalMultiplier)
      : typeof parsed.failureSpikeMultiplier === "number" && parsed.failureSpikeMultiplier > 0
        ? Math.round(threshold * (criticalMultiplier / reviewMultiplier))
        : null;

  return {
    failures,
    normalFailures,
    threshold,
    criticalThreshold,
    windowLabel:
      typeof parsed.window === "string" ? parsed.window : "current monitoring window",
  };
}

function buildReadableAlertMessage(alert: AlertLike) {
  const parsed = safeParseContext(alert.context);
  if (parsed && typeof parsed.displayMessage === "string") {
    return parsed.displayMessage;
  }

  const revenueContext = getRevenueContext(alert);
  if (revenueContext) {
    const dropPercent = Math.round(revenueContext.dropRatio * 100);
    return `Sales are ${dropPercent}% lower than usual for this time period.`;
  }

  const paymentContext = getPaymentFailureContext(alert);
  if (paymentContext) {
    return alert.message ?? "Payment failures are significantly higher than usual compared to recent activity.";
  }

  return alert.message ?? "Alert details unavailable.";
}

function buildHistoryAlertMessage(alert: AlertLike) {
  const revenueContext = getRevenueContext(alert);
  if (revenueContext) {
    const dropPercent = Math.round(revenueContext.dropRatio * 100);
    if (Number.isFinite(dropPercent)) {
      return `Sales were ${dropPercent}% lower than usual for this window.`;
    }

    return "Sales were much lower than usual for this window.";
  }

  const paymentContext = getPaymentFailureContext(alert);
  if (paymentContext) {
    const parsed = safeParseContext(alert.context);
    const spikeMultiple =
      parsed && typeof parsed.spikeMultiple === "number" ? parsed.spikeMultiple : null;

    if (spikeMultiple !== null && Number.isFinite(spikeMultiple)) {
      return `Failed payments were ${Math.round(spikeMultiple)}x higher than usual.`;
    }

    return "Failed payments were higher than usual compared to recent activity.";
  }

  return alert.message ?? "Alert details unavailable.";
}

function buildRevenueChartModel(accountId: string, topAlert: AlertLike | null, now: Date): RevenueChartModel {
  const parsed = safeParseContext(topAlert?.context);
  const revenueContext = getRevenueContext(topAlert);
  const defaultExpected = 2400;
  const expectedValue = revenueContext?.baselineAmount ?? defaultExpected;
  const actualValue = revenueContext?.currentAmount ?? Math.round(defaultExpected * 0.94);
  const reviewThresholdValue =
    revenueContext?.alertThresholdAmount ?? Math.round(expectedValue * 0.7);
  const highSeverityThresholdValue = Math.round(expectedValue * 0.5);
  const focusedBucketCount = 5;
  const revenueSeries = Array.isArray(parsed?.revenueSeries)
    ? parsed.revenueSeries
        .filter(
          (point): point is { time: string; revenue: number } =>
            typeof point === "object" &&
            point !== null &&
            typeof (point as { time?: unknown }).time === "string" &&
            typeof (point as { revenue?: unknown }).revenue === "number"
        )
    : null;

  if (revenueSeries && revenueSeries.length > 0) {
    const triggerIndex = revenueSeries.findIndex((point) => point.revenue <= reviewThresholdValue);
    const anchorIndex = triggerIndex >= 0 ? triggerIndex : revenueSeries.length - 1;
    const windowStart = Math.max(0, anchorIndex - (focusedBucketCount - 1));
    const visibleSeries = revenueSeries.slice(windowStart, anchorIndex + 1);
    const points = visibleSeries.map((point, index) => ({
      index,
      label: point.time,
      expected: expectedValue,
      actual: point.revenue,
    }));
    const actualValues = points.map((point) => point.actual);
    const latestValue = actualValues[actualValues.length - 1] ?? actualValue;

    return {
      points,
      expectedValue,
      actualValue: latestValue,
      reviewThresholdValue,
      highSeverityThresholdValue,
      peakValue: Math.max(...actualValues),
      lowValue: Math.min(...actualValues),
      activeIndex: points.length - 1,
      windowLabel: revenueContext?.windowLabel ?? "current monitoring window",
      isAlerting: latestValue < reviewThresholdValue,
      currency: revenueContext?.currency ?? "EUR",
    };
  }

  const anchorHour = topAlert?.createdAt?.getUTCHours() ?? now.getUTCHours();
  const points = Array.from({ length: focusedBucketCount }, (_, index) => {
    const relativeHour = focusedBucketCount - 1 - index;
    const hour = (anchorHour - relativeHour + 24) % 24;
    const bucketProgress = index / Math.max(1, focusedBucketCount - 1);
    const dayCurve = 0.9 + Math.sin((hour / 24) * Math.PI * 2 - 0.5) * 0.08;
    const workdayLift = hour >= 8 && hour <= 21 ? 1.05 : 0.88;
    const expected = Math.round(expectedValue * dayCurve * workdayLift);
    const drift = 0.95 + ((index % 3) - 1) * 0.015;
    const actual =
      index === focusedBucketCount - 1
        ? actualValue
        : Math.round(expected * Math.min(1.02, drift + bucketProgress * 0.02));

    return {
      index,
      label: fmtUtcHour(hour),
      expected,
      actual,
    };
  });

  return {
    points,
    expectedValue,
    actualValue,
    reviewThresholdValue,
    highSeverityThresholdValue,
    peakValue: Math.max(...points.map((point) => point.actual)),
    lowValue: Math.min(...points.map((point) => point.actual)),
    activeIndex: points.length - 1,
    windowLabel: revenueContext?.windowLabel ?? "current monitoring window",
    isAlerting: actualValue < reviewThresholdValue,
    currency: revenueContext?.currency ?? "EUR",
  };
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    }

    const previous = points[index - 1];
    const controlX = (previous.x + point.x) / 2;

    return `${path} C${controlX.toFixed(1)},${previous.y.toFixed(1)} ${controlX.toFixed(1)},${point.y.toFixed(1)} ${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }, "");
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
}

function buildMoneyTicks(maxValue: number) {
  const rawTicks = [0, maxValue * 0.33, maxValue * 0.66, maxValue];

  return rawTicks.map((value) => {
    if (value === 0) return 0;
    const rounded = Math.ceil(value / 500) * 500;
    return Math.max(500, rounded);
  });
}

function getNiceChartMax(value: number) {
  const padded = Math.max(2, value * 1.2);
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const normalized = padded / magnitude;
  const niceFactors = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const factor = niceFactors.find((candidate) => candidate >= normalized) ?? 10;

  return factor * magnitude;
}

function chooseFailureAxisStep(targetMax: number, highlightedValues: number[]) {
  const niceSteps = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 100];
  const candidates = niceSteps.filter((step) => step * 5 >= targetMax);

  const scored = candidates.map((step) => {
    const penalty = highlightedValues.reduce((score, value) => {
      if (!Number.isFinite(value) || value <= 0) return score;
      const remainder = value % step;
      const distance = Math.min(remainder, step - remainder);
      return score + distance;
    }, 0);

    return {
      step,
      maxValue: step * 5,
      penalty,
    };
  });

  scored.sort((a, b) => a.penalty - b.penalty || a.maxValue - b.maxValue);
  return scored[0]?.step ?? 1;
}

function buildFailureAxis(model: FailureChartModel, highlightedValues: number[]) {
  const relevantValues = [
    model.failures,
    model.normalFailures ?? 0,
    model.threshold,
    model.criticalThreshold ?? 0,
    model.peakFailures,
    ...model.points.map((point) => point.failures),
  ].filter((value) => Number.isFinite(value) && value >= 0);
  const relevantMax = Math.max(0, ...relevantValues);
  const targetMax = getNiceChartMax(relevantMax);
  const step = chooseFailureAxisStep(targetMax, highlightedValues);
  const top = step * 5;
  const ticks = Array.from({ length: 6 }, (_, index) => index * step);

  return {
    maxValue: top,
    ticks,
  };
}

function buildFailureChartModel(topAlert: AlertLike | null, paymentContext: PaymentFailureContext | null): FailureChartModel {
  const parsed = safeParseContext(topAlert?.context);
  const failures = paymentContext?.failures ?? 0;
  const threshold = paymentContext?.threshold ?? 5;
  const failureSeries = Array.isArray(parsed?.failureSeries)
    ? parsed.failureSeries
        .filter(
          (point): point is { time: string; failures: number } =>
            typeof point === "object" &&
            point !== null &&
            typeof (point as { time?: unknown }).time === "string" &&
            typeof (point as { failures?: unknown }).failures === "number"
        )
    : null;

  if (failureSeries && failureSeries.length > 0) {
    const visibleSeries = failureSeries.slice(-6);
    const points = visibleSeries.map((point, index) => ({
      index,
      label: point.time,
      failures: point.failures,
    }));

    return {
      points,
      failures,
      normalFailures: paymentContext?.normalFailures ?? null,
      threshold,
      criticalThreshold: paymentContext?.criticalThreshold ?? null,
      windowLabel: paymentContext?.windowLabel ?? "current monitoring window",
      peakFailures: Math.max(...points.map((point) => point.failures)),
      activeIndex: points.length - 1,
    };
  }

  const points = Array.from({ length: 12 }, (_, index) => ({
    index,
    label: index === 0 ? "Start" : index === 11 ? "Now" : "",
    failures: index === 11 ? failures : Math.max(0, Math.round(failures * (index / 16))),
  }));

  return {
    points,
    failures,
    normalFailures: paymentContext?.normalFailures ?? null,
    threshold,
    criticalThreshold: paymentContext?.criticalThreshold ?? null,
    windowLabel: paymentContext?.windowLabel ?? "current monitoring window",
    peakFailures: Math.max(...points.map((point) => point.failures)),
    activeIndex: points.length - 1,
  };
}

async function getHealthyRevenueMonitoringState({
  stripeAccountId,
  alertSensitivity,
  now,
}: {
  stripeAccountId: string;
  alertSensitivity?: string | null;
  now: Date;
}): Promise<HealthyRevenueMonitoringState> {
  const config = getAlertSensitivityConfig(alertSensitivity);
  const currentWindowStart = new Date(now.getTime() - config.revenueWindowMinutes * 60 * 1000);
  const revenueSnapshotStart = new Date(
    currentWindowStart.getTime() - (6 - 1) * 60 * 60 * 1000
  );
  const baselineStart = new Date(now.getTime() - config.baselineHours * 60 * 60 * 1000);

  const latestMetric = await prisma.revenueMetric.findFirst({
    where: { stripeAccountId },
    orderBy: { periodEnd: "desc" },
    select: { currency: true },
  });
  const metricCurrency = normalizeCurrencyCode(latestMetric?.currency);

  const [currentRevenue, recentRevenueMetrics] = await Promise.all([
    prisma.revenueMetric.aggregate({
      _sum: { amount: true },
      where: {
        stripeAccountId,
        periodEnd: { gte: currentWindowStart },
        OR: [{ currency: metricCurrency }, { currency: null }],
      },
    }),
    prisma.revenueMetric.findMany({
      where: {
        stripeAccountId,
        periodEnd: { gte: revenueSnapshotStart, lte: now },
        OR: [{ currency: metricCurrency }, { currency: null }],
      },
      select: {
        amount: true,
        periodEnd: true,
      },
      orderBy: {
        periodEnd: "asc",
      },
    }),
  ]);

  const currentAmount = currentRevenue._sum.amount ?? 0;
  const nowHour = now.getUTCHours();
  const nowDay = now.getUTCDay();
  const baselineCandidates: Array<{
    level: RevenueBaselineLevel;
    dayFilter?: { equals?: number; in?: number[] };
  }> = [
    { level: "same_day_and_hour", dayFilter: { equals: nowDay } },
    { level: "same_day_type_and_hour", dayFilter: { in: dayTypeDays(nowDay) } },
    { level: "same_hour" },
  ];

  let selectedBaseline:
    | {
        level: RevenueBaselineLevel;
        amount: number;
        sampleCount: number;
      }
    | null = null;

  for (const candidate of baselineCandidates) {
    const baselineMetrics = await prisma.revenueMetric.findMany({
      where: {
        stripeAccountId,
        periodEnd: { gte: baselineStart, lt: currentWindowStart },
        hourOfDay: nowHour,
        OR: [{ currency: metricCurrency }, { currency: null }],
        ...(candidate.dayFilter
          ? candidate.dayFilter.equals !== undefined
            ? { dayOfWeek: candidate.dayFilter.equals }
            : { dayOfWeek: { in: candidate.dayFilter.in } }
          : {}),
      },
      select: {
        amount: true,
        periodEnd: true,
      },
    });

    const summary = summarizeRevenueWindows(baselineMetrics);

    if (summary.sampleCount >= config.minSamples) {
      selectedBaseline = {
        level: candidate.level,
        amount: summary.average,
        sampleCount: summary.sampleCount,
      };
      break;
    }
  }

  if (!selectedBaseline || selectedBaseline.amount < config.minBaselineRevenue) {
    return {
      model: null,
      currentAmount,
      baselineAmount: null,
      thresholdValue: null,
      currency: metricCurrency,
      baselineLabel: "similar recent time periods",
      windowLabel: "current monitoring window",
      hasEnoughHistory: false,
      placeholderLabels: buildRecentHourLabels(now, 5),
    };
  }

  const thresholdValue = Math.round(selectedBaseline.amount * (1 - config.dropThreshold));
  const revenueSeries = buildRevenueSeriesFromSnapshot({
    recentMetrics: recentRevenueMetrics,
    baselineAmount: selectedBaseline.amount,
    currentAmount,
    now,
  });
  const syntheticAlert: AlertLike = {
    type: "revenue_drop",
    createdAt: now,
    context: JSON.stringify({
      baselineAmount: selectedBaseline.amount,
      currentAmount,
      alertThresholdAmount: thresholdValue,
      baselineLabel: revenueBaselineLabel(selectedBaseline.level),
      window: "current monitoring window",
      currency: metricCurrency,
      revenueSeries,
      threshold: config.dropThreshold,
    }),
  };

  return {
    model: buildRevenueChartModel(stripeAccountId, syntheticAlert, now),
    currentAmount,
    baselineAmount: selectedBaseline.amount,
    thresholdValue,
    currency: metricCurrency,
    baselineLabel: revenueBaselineLabel(selectedBaseline.level),
    windowLabel: "current monitoring window",
    hasEnoughHistory: true,
    placeholderLabels: buildRecentHourLabels(now, 5),
  };
}

async function getHealthyPaymentMonitoringState({
  stripeAccountId,
  alertSensitivity,
  now,
}: {
  stripeAccountId: string;
  alertSensitivity?: string | null;
  now: Date;
}): Promise<HealthyPaymentMonitoringState> {
  const config = getAlertSensitivityConfig(alertSensitivity);
  const currentWindowStart = new Date(now.getTime() - config.failureWindowMinutes * 60 * 1000);
  const historyStart = new Date(
    currentWindowStart.getTime() - config.failureLookbackDays * 24 * 60 * 60 * 1000
  );

  const failureEvents = await prisma.stripeEvent.findMany({
    where: {
      stripeAccountId,
      type: "payment_intent.payment_failed",
      createdAt: { gte: historyStart, lte: now },
    },
    select: {
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const failureDates = failureEvents.map((failureEvent) => new Date(failureEvent.createdAt));
  const recentFailureSeries = buildFailureSeries(failureDates, now);
  const failures = countEventsInWindow(failureDates, currentWindowStart, now);
  const currentDay = currentWindowStart.getUTCDay();

  const comparisonWindows = Array.from({ length: config.failureLookbackDays }, (_, index) => {
    const daysAgo = index + 1;
    const comparisonStart = shiftDateByDays(currentWindowStart, -daysAgo);
    const comparisonEnd = shiftDateByDays(now, -daysAgo);

    return {
      dayOfWeek: comparisonStart.getUTCDay(),
      count: countEventsInWindow(failureDates, comparisonStart, comparisonEnd),
    };
  });

  const comparisonCandidates: Array<{
    level: FailureBaselineLevel;
    windows: typeof comparisonWindows;
  }> = [
    {
      level: "same_day_and_hour",
      windows: comparisonWindows.filter((window) => window.dayOfWeek === currentDay),
    },
    {
      level: "same_day_type_and_hour",
      windows: comparisonWindows.filter((window) =>
        dayTypeDays(currentDay).includes(window.dayOfWeek)
      ),
    },
    {
      level: "same_hour",
      windows: comparisonWindows,
    },
  ];

  let selectedBaseline:
    | {
        level: FailureBaselineLevel;
        usualFailures: number;
        sampleCount: number;
      }
    | null = null;

  for (const candidate of comparisonCandidates) {
    const summary = summarizeFailureWindows(candidate.windows.map((window) => window.count));

    if (summary.sampleCount >= config.failureMinSamples) {
      selectedBaseline = {
        level: candidate.level,
        usualFailures: summary.median,
        sampleCount: summary.sampleCount,
      };
      break;
    }
  }

  const normalFailures = selectedBaseline?.usualFailures ?? null;
  const threshold = selectedBaseline
    ? Math.max(normalFailures ?? 0, config.failureBaselineFloor) * config.failureSpikeMultiplier
    : config.failureFallbackMinCurrent;
  const criticalThreshold = selectedBaseline
    ? Math.max(normalFailures ?? 0, config.failureBaselineFloor) * config.failureCriticalMultiplier
    : null;
  const syntheticAlert: AlertLike = {
    type: "payment_failed",
    createdAt: now,
    context: JSON.stringify({
      failureSeries: recentFailureSeries,
      failureThreshold: threshold,
      normalFailures,
      baseline: normalFailures,
      window: "current monitoring window",
    }),
  };
  const paymentContext: PaymentFailureContext = {
    failures,
    normalFailures,
    threshold,
    criticalThreshold,
    windowLabel: "current monitoring window",
  };

  return {
    model: buildFailureChartModel(syntheticAlert, paymentContext),
    failures,
    normalFailures,
    threshold,
    criticalThreshold,
    windowLabel: "current monitoring window",
    hasEnoughHistory: Boolean(selectedBaseline),
  };
}

function FailureChart({
  model,
  severity,
  thresholdDisplayMode,
}: {
  model: FailureChartModel;
  severity: ReturnType<typeof getSeverityPresentation>;
  thresholdDisplayMode: ThresholdDisplayMode;
}) {
  const showReviewThreshold = thresholdDisplayMode !== "critical-only";
  const showCriticalThreshold =
    thresholdDisplayMode !== "review-only" && model.criticalThreshold !== null;
  const highlightedValues = [
    ...(showReviewThreshold ? [model.threshold] : []),
    ...(showCriticalThreshold && model.criticalThreshold !== null
      ? [model.criticalThreshold]
      : []),
  ];
  const axis = buildFailureAxis(model, highlightedValues);
  const countTicks = axis.ticks;
  const maxValue = axis.maxValue;
  const plotInsetTop = 22;
  const plotInsetBottom = 48;
  const plotInsetTotal = plotInsetTop + plotInsetBottom;
  const thresholdRatio = Math.min(1, Math.max(0, model.threshold / maxValue));
  const criticalThresholdRatio =
    showCriticalThreshold && model.criticalThreshold !== null
      ? Math.min(1, Math.max(0, model.criticalThreshold / maxValue))
      : null;
  const plotPositionCss = (ratio: number, offsetPx = 0) =>
    `calc(${plotInsetBottom}px + (100% - ${plotInsetTotal}px) * ${ratio}${offsetPx === 0 ? "" : ` ${offsetPx < 0 ? "-" : "+"} ${Math.abs(offsetPx)}px`})`;
  const bucketCount = model.points.length;
  const timeBoundaryLabels = [
    ...model.points.map((point) => point.label),
    nextHourLabel(model.points[model.points.length - 1]?.label ?? "00:00"),
  ];
  const barLayouts = model.points.map((point, index) => {
    const startPercent = (index / Math.max(1, bucketCount)) * 100;
    const endPercent = ((index + 1) / Math.max(1, bucketCount)) * 100;
    const bucketWidthPercent = endPercent - startPercent;
    const barWidthPercent = bucketWidthPercent * 0.56;
    const leftPercent = startPercent + (bucketWidthPercent - barWidthPercent) / 2;

    return {
      point,
      leftPercent,
      widthPercent: barWidthPercent,
    };
  });

  const thresholdChipWidthPercent = 16;
  const thresholdChipHalfWidth = thresholdChipWidthPercent / 2;
  const thresholdChipCenter = Math.min(
    100 - thresholdChipHalfWidth - 2,
    Math.max(thresholdChipHalfWidth + 2, 50)
  );

  return (
    <>
      <div className={styles.failureChartWrap}>
        {countTicks.map((tick) => (
          <div
            key={`grid-${tick}`}
            className={styles.failureGridLine}
            style={{
              bottom: plotPositionCss(Math.min(1, Math.max(0, tick / maxValue))),
            }}
          />
        ))}
        <div className={styles.failureYAxis}>
          {countTicks.map((tick) => (
            <span
              key={tick}
              style={{
                top: `${100 - Math.min(100, Math.max(0, (tick / maxValue) * 100))}%`,
              }}
            >
              {formatCount(tick)}
            </span>
          ))}
        </div>
        {showReviewThreshold ? (
          <>
            <div
              className={styles.failureThresholdLine}
              style={{
                bottom: plotPositionCss(thresholdRatio),
                borderTopColor: "#b7791f",
              }}
            />
            <div
              className={styles.failureThreshold}
              style={{
                left: `${thresholdChipCenter}%`,
                bottom: plotPositionCss(thresholdRatio, -10),
                background: "#fff1c2",
                color: "#9a6700",
              }}
            >
              Review threshold: {formatCount(model.threshold)}
            </div>
          </>
        ) : null}
        {criticalThresholdRatio !== null ? (
          <>
            <div
              className={styles.failureThresholdLine}
              style={{
                bottom: plotPositionCss(criticalThresholdRatio),
                borderTopColor: "#ba1a1a",
              }}
            />
            <div
              className={styles.failureThreshold}
              style={{
                left: `${thresholdChipCenter}%`,
                bottom: plotPositionCss(criticalThresholdRatio, -10),
                background: "#ffdad6",
                color: "#ba1a1a",
              }}
            >
              Critical threshold: {formatCount(model.criticalThreshold ?? 0)}
            </div>
          </>
        ) : null}

        <div className={styles.failureBars} aria-label="Failed payments over the current period">
          {barLayouts.map(({ point, leftPercent, widthPercent }) => {
            const isActive = point.index === model.activeIndex;
            const height = Math.max(8, (point.failures / maxValue) * 100);
            const isAboveThreshold = point.failures >= model.threshold;
            const barClassName =
              isActive && isAboveThreshold
                ? styles.failureBarActive
                : isAboveThreshold
                  ? styles.failureBarThreshold
                  : styles.failureBar;

            return (
              <span
                key={`${point.index}-${point.label}`}
                className={barClassName}
                style={{
                  height: `${height}%`,
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                  background: isActive
                    ? severity.barActive
                    : isAboveThreshold
                      ? severity.barStrong
                      : severity.barSoft,
                  boxShadow: isActive ? `0 8px 16px ${severity.barShadow}` : undefined,
                }}
                title={`${point.label}–${nextHourLabel(point.label)}: ${formatCount(point.failures)} failed payment${point.failures === 1 ? "" : "s"}`}
              />
            );
          })}
        </div>

        <div className={styles.failureTimeAxis}>
          {timeBoundaryLabels.map((label, index) => (
            <span
              key={`${index}-${label}`}
              style={{
                left: `${(index / Math.max(1, timeBoundaryLabels.length - 1)) * 100}%`,
                transform:
                  index === 0
                    ? "translateX(0)"
                    : index === timeBoundaryLabels.length - 1
                      ? "translateX(-100%)"
                      : "translateX(-50%)",
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.chartFooter}>
        <div className={styles.legend}>
          <span>
            <i className={severity.legendClass} /> Failed payments
          </span>
          {showReviewThreshold ? (
            <span>
              <i className={styles.legendDashAmber} /> Review threshold
            </span>
          ) : null}
          {showCriticalThreshold ? (
            <span>
              <i className={styles.legendDashRed} /> Critical threshold
            </span>
          ) : null}
        </div>
      </div>
    </>
  );
}

function MonitorInsightPanel({
  model,
  topAlert,
  paymentContext,
  lastEventAt,
  severity,
}: {
  model?: RevenueChartModel | null;
  topAlert: AlertLike | null;
  paymentContext: PaymentFailureContext | null;
  lastEventAt?: Date | null;
  severity?: ReturnType<typeof getSeverityPresentation>;
}) {
  const isPaymentFailure = topAlert?.type === "payment_failed" && paymentContext;
  const isRevenueDrop = topAlert?.type === "revenue_drop" && model;
  const thresholdDisplayMode = getThresholdDisplayMode(topAlert?.severity);

  const panelClassName = `${styles.monitorPanel} ${
    topAlert ? severity?.panelClass ?? styles.monitorPanelIssueCritical : styles.monitorPanelNormal
  }`;

  return (
    <aside className={panelClassName}>
      <div>
        <div className={styles.panelEyebrowRow}>
          <span className={styles.panelEyebrow}>
            <span
              className={styles.panelStatusDot}
              aria-hidden="true"
              style={topAlert ? { background: severity?.accentColor } : undefined}
            />
            {topAlert ? "Current issue" : "Current state"}
          </span>
          {topAlert && (topAlert.type === "payment_failed" || topAlert.type === "revenue_drop") ? (
            <SeverityHelpPopover alertType={topAlert.type} />
          ) : null}
        </div>
        <h3>{topAlert ? alertLabel(topAlert.type) : "Monitoring active"}</h3>
        <p>
          {topAlert
            ? buildReadableAlertMessage(topAlert)
            : "No issues detected. RevenueWatch is checking this account in read-only mode."}
        </p>
        {topAlert ? (
          <div className={styles.detectedAt}>
            Detected: {fmtDetectedDate(topAlert.createdAt) ?? "Recently"}
          </div>
        ) : null}
      </div>

      <div className={styles.panelGrid}>
        {isPaymentFailure ? (
          <>
            <div className={styles.panelMetric}>
              <span>Current failed payments</span>
              <strong style={{ color: severity?.accentColor }}>{formatCount(paymentContext.failures)}</strong>
            </div>
            <div className={styles.panelMetric}>
              <span>Usual failed payments</span>
              <strong>
                {paymentContext.normalFailures !== null
                  ? formatCount(paymentContext.normalFailures)
                  : "Not enough history yet"}
              </strong>
            </div>
            {thresholdDisplayMode !== "critical-only" ? (
              <div className={styles.panelMetric}>
                <span>Review threshold</span>
                <strong>{formatCount(paymentContext.threshold)}</strong>
              </div>
            ) : null}
            {thresholdDisplayMode !== "review-only" && paymentContext.criticalThreshold !== null ? (
              <div className={styles.panelMetric}>
                <span>Critical threshold</span>
                <strong>{formatCount(paymentContext.criticalThreshold)}</strong>
              </div>
            ) : null}
          </>
        ) : isRevenueDrop && model ? (
          <>
            <div className={styles.panelMetric}>
              <span>Current revenue</span>
              <strong style={model.isAlerting ? { color: severity?.accentColor } : undefined}>
                {formatMoneyAmount(model.actualValue, model.currency)}
              </strong>
            </div>
            <div className={styles.panelMetric}>
              <span>Usual revenue</span>
              <strong>{formatMoneyAmount(model.expectedValue, model.currency)}</strong>
            </div>
            {thresholdDisplayMode !== "critical-only" ? (
              <div className={styles.panelMetric}>
                <span>Review threshold</span>
                <strong>{formatMoneyAmount(model.reviewThresholdValue, model.currency)}</strong>
              </div>
            ) : null}
            {thresholdDisplayMode !== "review-only" ? (
              <div className={styles.panelMetric}>
                <span>Critical threshold</span>
                <strong>{formatMoneyAmount(model.highSeverityThresholdValue, model.currency)}</strong>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className={styles.panelMetric}>
              <span>Status</span>
              <strong>Monitoring active</strong>
            </div>
            <div className={styles.panelMetric}>
              <span>Last activity</span>
              <strong>{fmtDate(lastEventAt)}</strong>
            </div>
          </>
        )}
      </div>

      {isRevenueDrop ? (
        <div className={styles.panelContext}>
          <div>
            <span>Comparison basis</span>
            <strong>Usual revenue is based on similar recent time periods.</strong>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function HealthyMonitoringPanel({
  title,
  description,
  metrics,
  contextLabel,
  contextText,
  helpAlertType,
}: {
  title: string;
  description: string;
  metrics: Array<{ label: string; value: string }>;
  contextLabel?: string;
  contextText?: string;
  helpAlertType: "revenue_drop" | "payment_failed";
}) {
  return (
    <aside className={`${styles.monitorPanel} ${styles.monitorPanelNormal}`}>
      <div>
        <div className={styles.panelEyebrowRow}>
          <span className={styles.panelEyebrow}>
            <span className={styles.panelStatusDot} aria-hidden="true" />
            Monitoring status
          </span>
          <SeverityHelpPopover alertType={helpAlertType} />
        </div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <div className={styles.panelGrid}>
        {metrics.map((metric) => (
          <div key={metric.label} className={styles.panelMetric}>
            <span>{metric.label}</span>
            <strong
              className={
                ["Building baseline", "Collecting history", "Available after enough history"].includes(
                  metric.value
                )
                  ? styles.metricFallbackValue
                  : undefined
              }
            >
              {metric.value}
            </strong>
          </div>
        ))}
      </div>

      {contextLabel && contextText ? (
        <div className={styles.panelContext}>
          <div>
            <span>{contextLabel}</span>
            <strong>{contextText}</strong>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function MonitoringPlaceholderChart({
  labels,
}: {
  labels: string[];
}) {
  const width = 1000;
  const height = 300;
  const plot = {
    left: 74,
    right: 980,
    top: 18,
    bottom: 246,
  };
  const xIndexes = buildTickIndexes(labels.length);
  const x = (index: number) =>
    plot.left + (index / Math.max(1, labels.length - 1)) * (plot.right - plot.left);
  const yGuideFractions = [0, 0.33, 0.66, 1];

  return (
    <>
      <div className={styles.chartWrap}>
        <div className={styles.monitoringChartEmptyState}>
          <strong>Building baseline</strong>
          <p>
            RevenueWatch is collecting activity for this account. Revenue history will
            appear here after enough similar periods are available.
          </p>
        </div>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className={styles.chartSvg}
          role="img"
          aria-label="Monitoring chart placeholder while RevenueWatch builds history"
        >
          {yGuideFractions.map((fraction, index) => {
            const y = plot.bottom - (plot.bottom - plot.top) * fraction;
            return (
              <line
                key={index}
                x1={plot.left}
                x2={plot.right}
                y1={y}
                y2={y}
                className={styles.gridLine}
              />
            );
          })}
          {xIndexes.map((index) => (
            <text
              key={index}
              x={x(index)}
              y={height - 12}
              textAnchor={
                index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle"
              }
              className={styles.axisLabel}
            >
              {labels[index]}
            </text>
          ))}
        </svg>
      </div>
      <div className={`${styles.chartFooter} ${styles.chartFooterCompact}`}>
        <div className={styles.legend}>
          <span>
            <i className={styles.legendBlue} /> Monitoring history will appear here
          </span>
        </div>
      </div>
    </>
  );
}

function HealthyRevenueMonitor({
  state,
}: {
  state: HealthyRevenueMonitoringState;
}) {
  const monitoring = getMonitoringPresentation();

  return (
    <section className={`${styles.chartCard} ${styles.healthyChartCard}`}>
      <div className={styles.chartLayout}>
        <div className={styles.chartMain}>
          <div className={styles.chartHeader}>
            <div>
              <h2>Revenue monitoring</h2>
              <p>
                Track recent revenue against the normal threshold RevenueWatch uses for this
                account.
              </p>
              <div className={styles.chartMeta}>Current monitoring window</div>
            </div>
            <span className={styles.liveBadge} style={{ color: monitoring.accentColor }}>
              <span
                style={{
                  background: monitoring.accentColor,
                  boxShadow: `0 0 0 6px ${monitoring.accentShadow}`,
                }}
              />
              {monitoring.label}
            </span>
          </div>

          {state.model ? (
            <RevenueChartFigure
              model={state.model}
              severity={monitoring}
              thresholdDisplayMode="review-only"
            />
          ) : (
            <MonitoringPlaceholderChart labels={state.placeholderLabels} />
          )}
        </div>

        <HealthyMonitoringPanel
          title="Revenue monitoring"
          description={
            state.hasEnoughHistory
              ? "RevenueWatch compares this account against similar recent time periods and confirms revenue is safely above the alert threshold."
              : "RevenueWatch is collecting activity for this account. Revenue-drop monitoring becomes more reliable after enough similar periods are available."
          }
          metrics={[
            {
              label: "Current revenue",
              value: formatMoneyAmount(state.currentAmount, state.currency),
            },
            {
              label: "Usual revenue",
              value:
                state.baselineAmount !== null
                  ? formatMoneyAmount(state.baselineAmount, state.currency)
                  : "Building baseline",
            },
            {
              label: "Review threshold",
              value:
                state.thresholdValue !== null
                  ? formatMoneyAmount(state.thresholdValue, state.currency)
                  : "Available after enough history",
            },
            {
              label: "Status",
              value: "Normal",
            },
          ]}
          contextLabel={state.hasEnoughHistory ? "Comparison basis" : undefined}
          contextText={
            state.hasEnoughHistory
              ? `Usual revenue is based on ${state.baselineLabel}.`
              : undefined
          }
          helpAlertType="revenue_drop"
        />
      </div>
    </section>
  );
}

function HealthyPaymentMonitor({
  state,
}: {
  state: HealthyPaymentMonitoringState;
}) {
  const monitoring = getMonitoringPresentation();

  return (
    <section className={`${styles.chartCard} ${styles.healthyChartCard}`}>
      <div className={styles.chartLayout}>
        <div className={styles.chartMain}>
          <div className={styles.chartHeader}>
            <div>
              <h2>Payment failure monitoring</h2>
              <p>
                Review recent failed payments against the alert threshold RevenueWatch checks for
                this account.
              </p>
              <div className={styles.chartMeta}>Current monitoring window</div>
            </div>
            <span className={styles.liveBadge} style={{ color: monitoring.accentColor }}>
              <span
                style={{
                  background: monitoring.accentColor,
                  boxShadow: `0 0 0 6px ${monitoring.accentShadow}`,
                }}
              />
              {monitoring.label}
            </span>
          </div>

          <div className={styles.failureMiniChart}>
            {!state.hasEnoughHistory ? (
              <div className={styles.monitoringChartNote}>{`Collecting monitoring history`}</div>
            ) : null}
            <FailureChart
              model={state.model}
              severity={monitoring}
              thresholdDisplayMode="review-only"
            />
          </div>
        </div>

        <HealthyMonitoringPanel
          title="Payment failure monitoring"
          description={
            state.hasEnoughHistory
              ? "RevenueWatch compares recent failed payments to similar recent windows and confirms they remain below the alert threshold."
              : "RevenueWatch is collecting activity for this account. Comparison history will become more useful after enough similar windows are available."
          }
          metrics={[
            {
              label: "Current failed payments",
              value: formatCount(state.failures),
            },
            {
              label: "Usual failed payments",
              value:
                state.normalFailures !== null
                  ? formatCount(state.normalFailures)
                  : "Collecting history",
            },
            {
              label: "Review threshold",
              value: formatCount(state.threshold),
            },
            {
              label: "Status",
              value: "Normal",
            },
          ]}
          contextLabel={state.hasEnoughHistory ? "Comparison basis" : undefined}
          contextText={
            state.hasEnoughHistory
              ? "Usual failed payments are based on similar recent time periods."
              : undefined
          }
          helpAlertType="payment_failed"
        />
      </div>
    </section>
  );
}

function HealthyMonitorCard({
  revenueState,
  paymentState,
}: {
  revenueState: HealthyRevenueMonitoringState;
  paymentState: HealthyPaymentMonitoringState;
}) {
  return (
    <div className={styles.healthyMonitorStack}>
      <HealthyRevenueMonitor state={revenueState} />
      <HealthyPaymentMonitor state={paymentState} />
    </div>
  );
}

function PaymentFailureMonitor({
  topAlert,
  paymentContext,
  lastEventAt,
  severity,
}: {
  topAlert: AlertLike;
  paymentContext: PaymentFailureContext;
  lastEventAt?: Date | null;
  severity: ReturnType<typeof getSeverityPresentation>;
}) {
  const failureModel = buildFailureChartModel(topAlert, paymentContext);

  return (
    <section className={styles.chartCard}>
      <div className={styles.chartLayout}>
        <div className={styles.chartMain}>
          <div className={styles.chartHeader}>
            <div>
              <h2>Failed payments during this period</h2>
              <p>Each bar shows how many failed payments happened during that time period.</p>
              <div className={styles.chartMeta}>Current period</div>
            </div>
            <span className={styles.liveBadge} style={{ color: severity.accentColor }}>
              <span
                style={{
                  background: severity.accentColor,
                  boxShadow: `0 0 0 6px ${severity.accentShadow}`,
                }}
              />
              {severity.label}
            </span>
          </div>

          <div className={styles.failureMiniChart}>
            <FailureChart
              model={failureModel}
              severity={severity}
              thresholdDisplayMode={getThresholdDisplayMode(topAlert.severity)}
            />
          </div>
        </div>

        <MonitorInsightPanel
          topAlert={topAlert}
          paymentContext={paymentContext}
          lastEventAt={lastEventAt}
          severity={severity}
        />
      </div>
    </section>
  );
}

function RevenueChartFigure({
  model,
  severity,
  thresholdDisplayMode,
  expandedHeight = false,
}: {
  model: RevenueChartModel;
  severity: ReturnType<typeof getSeverityPresentation>;
  thresholdDisplayMode: ThresholdDisplayMode;
  expandedHeight?: boolean;
}) {
  const width = 1000;
  const height = 300;
  const plot = {
    left: 74,
    right: 980,
    top: 18,
    bottom: 246,
  };
  const plotWidth = plot.right - plot.left;
  const plotHeight = plot.bottom - plot.top;
  const maxValue =
    Math.max(
      ...model.points.flatMap((point) => [point.expected, point.actual]),
      model.reviewThresholdValue,
      model.highSeverityThresholdValue
    ) * 1.18;

  const domain = Math.max(1, model.points.length - 1);
  const x = (index: number) => plot.left + (index / domain) * plotWidth;
  const y = (value: number) => plot.bottom - (value / maxValue) * plotHeight;
  const actualCoordinates = model.points.map((point) => ({
    x: x(point.index),
    y: y(point.actual),
  }));
  const actualPath = buildLinePath(actualCoordinates);
  const activePoint = model.points[model.activeIndex];
  const triggerPoint =
    model.points.find((point) => point.actual <= model.reviewThresholdValue) ?? activePoint;
  const reviewThresholdY = y(model.reviewThresholdValue);
  const highSeverityThresholdY = y(model.highSeverityThresholdValue);
  const showReviewThreshold = thresholdDisplayMode !== "critical-only";
  const showCriticalThreshold = thresholdDisplayMode !== "review-only";
  const showWarningZone = showReviewThreshold && showCriticalThreshold && severity.accentColor !== "#ba1a1a";
  const showCriticalZone = showCriticalThreshold && severity.accentColor === "#ba1a1a";
  const yTicks = buildMoneyTicks(maxValue);
  const xTickIndexes = buildTickIndexes(model.points.length);
  const triggerX = x(triggerPoint.index);
  const triggerY = y(triggerPoint.actual);
  const thresholdLabelX = plot.left + plotWidth / 2;
  const reviewThresholdColor = "#b7791f";
  const reviewThresholdSoft = "#fff1c2";
  const reviewThresholdShadow = "rgba(154, 103, 0, 0.12)";
  const highSeverityThresholdColor = "#ba1a1a";
  const highSeverityThresholdSoft = "#ffdad6";
  const highSeverityThresholdShadow = "rgba(186, 26, 26, 0.1)";

  return (
    <>
      <div
        className={`${styles.chartWrap} ${expandedHeight ? styles.chartWrapExpanded : ""}`.trim()}
      >
        {showReviewThreshold ? (
          <div
            className={styles.thresholdPill}
            style={{
              top: `${(reviewThresholdY / height) * 100}%`,
              left: `${(thresholdLabelX / width) * 100}%`,
              background: reviewThresholdSoft,
              color: reviewThresholdColor,
              boxShadow: `0 1px 2px ${reviewThresholdShadow}`,
            }}
          >
            Review threshold ({formatMoneyAmount(model.reviewThresholdValue, model.currency)})
          </div>
        ) : null}
        {showCriticalThreshold ? (
          <div
            className={styles.thresholdPill}
            style={{
              top: `${(highSeverityThresholdY / height) * 100}%`,
              left: `${(thresholdLabelX / width) * 100}%`,
              background: highSeverityThresholdSoft,
              color: highSeverityThresholdColor,
              boxShadow: `0 1px 2px ${highSeverityThresholdShadow}`,
            }}
          >
            Critical threshold ({formatMoneyAmount(model.highSeverityThresholdValue, model.currency)})
          </div>
        ) : null}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className={styles.chartSvg}
          role="img"
          aria-label="Revenue chart showing current revenue and the alert threshold"
        >
          <defs>
            <linearGradient id="accountChartFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0058bc" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#0058bc" stopOpacity="0" />
            </linearGradient>
          </defs>
          {yTicks.map((tick, index) => {
            const tickY = y(tick);

            return (
              <g key={`${tick}-${index}`}>
                <line x1={plot.left} x2={plot.right} y1={tickY} y2={tickY} className={styles.gridLine} />
                <text x={plot.left - 14} y={tickY + 4} textAnchor="end" className={styles.axisLabel}>
                  {formatMoneyAmount(tick, model.currency)}
                </text>
              </g>
            );
          })}
          {xTickIndexes.map((tickIndex) => (
            <text
              key={tickIndex}
              x={x(tickIndex)}
              y={height - 12}
              textAnchor={
                tickIndex === 0 ? "start" : tickIndex === model.points.length - 1 ? "end" : "middle"
              }
              className={styles.axisLabel}
            >
              {model.points[tickIndex]?.label}
            </text>
          ))}
          {showWarningZone ? (
            <rect
              x={plot.left}
              y={reviewThresholdY}
              width={plot.right - plot.left}
              height={Math.max(0, highSeverityThresholdY - reviewThresholdY)}
              style={{ fill: "rgba(154, 103, 0, 0.035)" }}
            />
          ) : null}
          {showCriticalZone ? (
            <rect
              x={plot.left}
              y={highSeverityThresholdY}
              width={plot.right - plot.left}
              height={plot.bottom - highSeverityThresholdY}
              style={{ fill: "rgba(186, 26, 26, 0.04)" }}
            />
          ) : null}
          {model.isAlerting ? (
            <line
              x1={x(triggerPoint.index)}
              x2={x(triggerPoint.index)}
              y1={plot.top}
              y2={plot.bottom}
              style={{ stroke: severity.accentLine, strokeWidth: 1, strokeDasharray: "4 7" }}
            />
          ) : null}
          <path
            d={`${actualPath} L${plot.right},${plot.bottom} L${plot.left},${plot.bottom} Z`}
            fill="url(#accountChartFill)"
          />
          {showReviewThreshold ? (
            <line
              x1={plot.left}
              x2={plot.right}
              y1={reviewThresholdY}
              y2={reviewThresholdY}
              style={{
                fill: "none",
                stroke: reviewThresholdColor,
                strokeWidth: 1.5,
                strokeDasharray: "9 6",
                strokeLinecap: "round",
                strokeLinejoin: "round",
              }}
            />
          ) : null}
          {showCriticalThreshold ? (
            <line
              x1={plot.left}
              x2={plot.right}
              y1={highSeverityThresholdY}
              y2={highSeverityThresholdY}
              style={{
                fill: "none",
                stroke: highSeverityThresholdColor,
                strokeWidth: 1.5,
                strokeDasharray: "9 6",
                strokeLinecap: "round",
                strokeLinejoin: "round",
              }}
            />
          ) : null}
          <path d={actualPath} className={styles.actualPath} />
          {model.isAlerting ? (
            <circle
              cx={triggerX}
              cy={triggerY}
              r="4"
              style={{ fill: severity.accentColor, stroke: "#ffffff", strokeWidth: 2 }}
            />
          ) : (
            <circle
              cx={x(activePoint.index)}
              cy={y(activePoint.actual)}
              r="4"
              className={styles.activePoint}
            />
          )}
        </svg>
      </div>

      <div className={`${styles.chartFooter} ${styles.chartFooterCompact}`}>
        <div className={styles.legend}>
          <span>
            <i className={styles.legendBlue} /> Current revenue
          </span>
          {showReviewThreshold ? (
            <span>
              <i className={styles.legendDashAmber} /> Review threshold ({formatMoneyAmount(model.reviewThresholdValue, model.currency)})
            </span>
          ) : null}
          {showCriticalThreshold ? (
            <span>
              <i className={styles.legendDashRed} /> Critical threshold ({formatMoneyAmount(model.highSeverityThresholdValue, model.currency)})
            </span>
          ) : null}
        </div>
      </div>
    </>
  );
}

function RevenueAlertMonitor({
  model,
  topAlert,
  paymentContext,
  lastEventAt,
  severity,
}: {
  model: RevenueChartModel;
  topAlert: AlertLike;
  paymentContext: PaymentFailureContext | null;
  lastEventAt?: Date | null;
  severity: ReturnType<typeof getSeverityPresentation>;
}) {
  return (
    <section className={styles.chartCard}>
      <div className={styles.chartLayout}>
        <div className={styles.chartMain}>
          <div className={styles.chartHeader}>
            <div>
              <h2>Revenue during this period</h2>
              <p>Each point shows how much revenue came in during that time period.</p>
              <div className={styles.chartMeta}>Current period</div>
            </div>
            <span className={styles.liveBadge} style={{ color: severity.accentColor }}>
              <span
                style={{
                  background: severity.accentColor,
                  boxShadow: `0 0 0 6px ${severity.accentShadow}`,
                }}
              />
              {severity.label}
            </span>
          </div>
          <RevenueChartFigure
            model={model}
            severity={severity}
            thresholdDisplayMode={getThresholdDisplayMode(topAlert.severity)}
            expandedHeight
          />
        </div>

        <MonitorInsightPanel
          model={model}
          topAlert={topAlert}
          paymentContext={paymentContext}
          lastEventAt={lastEventAt}
          severity={severity}
        />
      </div>
    </section>
  );
}

function AccountMonitor({
  model,
  topAlert,
  paymentContext,
  healthyRevenueState,
  healthyPaymentState,
}: {
  model: RevenueChartModel;
  topAlert: AlertLike | null;
  paymentContext: PaymentFailureContext | null;
  healthyRevenueState: HealthyRevenueMonitoringState;
  healthyPaymentState: HealthyPaymentMonitoringState;
}) {
  if (!topAlert) {
    return <HealthyMonitorCard revenueState={healthyRevenueState} paymentState={healthyPaymentState} />;
  }

  const severity = getSeverityPresentation(topAlert.severity);

  if (topAlert.type === "payment_failed" && paymentContext) {
    return (
      <PaymentFailureMonitor
        topAlert={topAlert}
        paymentContext={paymentContext}
        lastEventAt={undefined}
        severity={severity}
      />
    );
  }

  return (
    <RevenueAlertMonitor
      model={model}
      topAlert={topAlert}
      paymentContext={paymentContext}
      lastEventAt={undefined}
      severity={severity}
    />
  );
}

function ActiveAlertRow({ alert }: { alert: AlertLike }) {
  const severity = getSeverityPresentation(alert.severity);
  const detectedAt = fmtDetectedDate(alert.createdAt);

  return (
    <article className={styles.alertRow}>
      <div className={severity.iconClass}>!</div>
      <div>
        <h3>{alertLabel(alert.type)}</h3>
        <p>{buildReadableAlertMessage(alert)}</p>
        <span>
          {getSeverityLabel(alert.severity)} · {detectedAt ? `Detected ${detectedAt}` : alert.detectedLabel ? `Detected ${alert.detectedLabel}` : `Triggered ${fmtDate(alert.createdAt)}`}
          </span>
      </div>
    </article>
  );
}

function HistoryRow({ alert }: { alert: AlertLike }) {
  const detectedAt = fmtDetectedDate(alert.createdAt) ?? fmtDate(alert.createdAt);

  return (
    <article className={styles.resolvedRow}>
      <div>
        <h3>{alertLabel(alert.type)}</h3>
        <p>{buildHistoryAlertMessage(alert)}</p>
        <span className={styles.historyDetected}>Detected {detectedAt}</span>
      </div>
    </article>
  );
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  const { accountId } = await params;
  const [account, alerts, lastEvent] = await Promise.all([
    prisma.stripeAccount.findFirst({
      where: { stripeAccountId: accountId },
    }),
    prisma.alert.findMany({
      where: { stripeAccountId: accountId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.stripeEvent.findFirst({
      where: { stripeAccountId: accountId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const demoAccount = getDemoAccountById(accountId);

  if (!account && !demoAccount) {
    notFound();
  }

  const now = new Date();
  const demoSeverity = demoAccount ? getDemoSeverity(demoAccount) : null;
  const activeAlerts =
    demoAccount && demoAccount.status === "active_issue"
      ? [
          {
            id: `demo-alert-${demoAccount.id}`,
            type: demoAccount.alertType,
            severity: demoSeverity === "high" ? "critical" : "warning",
            message: demoAccount.message,
            stripeAccountId: demoAccount.id,
            accountName: demoAccount.name,
            detectedLabel: demoAccount.detectedAt,
            createdAt: buildApproxDateFromRelativeLabel(demoAccount.detectedAt, now),
            context: JSON.stringify(
              demoAccount.alertType === "revenue_drop"
                ? {
                    baselineAmount: demoAccount.usualRevenue,
                    expectedRevenue: demoAccount.usualRevenue,
                    currentAmount: demoAccount.currentRevenue,
                    currentRevenue: demoAccount.currentRevenue,
                    alertThresholdAmount: demoAccount.alertThreshold,
                    threshold:
                      typeof demoAccount.alertThreshold === "number" &&
                      typeof demoAccount.usualRevenue === "number"
                        ? 1 - demoAccount.alertThreshold / demoAccount.usualRevenue
                        : 0.5,
                    baselineLabel: "recent performance",
                    window: "current monitoring window",
                    currency: demoAccount.currency ?? "EUR",
                    revenueSeries: demoAccount.revenueSeries,
                    displayMessage: demoAccount.message,
                  }
                : {
                    failedPayments: demoAccount.currentFailures,
                    failuresCounted: demoAccount.currentFailures,
                    baseline: demoAccount.normalFailures,
                    normalFailures: demoAccount.normalFailures,
                    failureThreshold:
                      typeof demoAccount.normalFailures === "number" ? demoAccount.normalFailures * 2 : 5,
                    window: "current monitoring window",
                    failureSeries: demoAccount.failureSeries,
                    displayMessage: demoAccount.message,
                  }
            ),
          } satisfies AlertLike,
        ]
      : alerts.filter((alert) => alert.status === "active");

  const historicalAlerts =
    demoAccount
      ? getDemoAlertHistory()
          .filter((entry) => entry.accountName === demoAccount.name)
          .map(
            (entry, index) =>
              ({
                id: `demo-history-${index}`,
                type: entry.type,
                severity: "warning",
                message: entry.message,
                stripeAccountId: demoAccount.id,
                accountName: demoAccount.name,
                displayTimestamp: entry.timestamp,
              }) satisfies AlertLike
          )
      : alerts.filter((alert) => alert.status !== "active");

  const topAlert = activeAlerts[0] ?? null;
  const chartModel = buildRevenueChartModel(accountId, topAlert, now);
  const paymentContext = getPaymentFailureContext(
    topAlert,
    account?.alertSensitivity ?? "conservative"
  );
  const accountName = account?.name ?? demoAccount?.name ?? accountId;
  const detailSeverity = topAlert ? getSeverityPresentation(topAlert.severity) : null;
  const headerStatus = detailSeverity
    ? { label: detailSeverity.label, className: detailSeverity.statusClass }
    : { label: "Monitoring active", className: styles.statusHealthy };
  const healthyRevenueState =
    !topAlert && account
      ? await getHealthyRevenueMonitoringState({
          stripeAccountId: account.stripeAccountId,
          alertSensitivity: account.alertSensitivity,
          now,
        })
      : !topAlert && demoAccount
        ? {
            model:
              typeof demoAccount.usualRevenue === "number" &&
              typeof demoAccount.currentRevenue === "number"
                ? buildRevenueChartModel(
                    demoAccount.id,
                    {
                      type: "revenue_drop",
                      createdAt: now,
                      context: JSON.stringify({
                        baselineAmount: demoAccount.usualRevenue,
                        currentAmount: demoAccount.currentRevenue,
                        alertThresholdAmount: Math.round(demoAccount.usualRevenue * 0.7),
                        baselineLabel: "recent performance",
                        window: "current monitoring window",
                        currency: demoAccount.currency ?? "EUR",
                        revenueSeries: demoAccount.revenueSeries,
                        threshold: 0.5,
                      }),
                    },
                    now
                  )
                : null,
            currentAmount: demoAccount.currentRevenue ?? 0,
            baselineAmount: demoAccount.usualRevenue ?? null,
            thresholdValue:
              typeof demoAccount.usualRevenue === "number"
                ? Math.round(demoAccount.usualRevenue * 0.7)
                : null,
            currency: demoAccount.currency ?? "EUR",
            baselineLabel: "recent performance",
            windowLabel: "current monitoring window",
            hasEnoughHistory:
              typeof demoAccount.usualRevenue === "number" &&
              typeof demoAccount.currentRevenue === "number",
            placeholderLabels: buildRecentHourLabels(now, 5),
          }
        : null;
  const healthyPaymentState =
    !topAlert && account
      ? await getHealthyPaymentMonitoringState({
          stripeAccountId: account.stripeAccountId,
          alertSensitivity: account.alertSensitivity,
          now,
        })
      : !topAlert
        ? {
            model: buildFailureChartModel(
              {
                type: "payment_failed",
                createdAt: now,
                context: JSON.stringify({
                  failureSeries: demoAccount?.failureSeries ?? [],
                  failureThreshold: getAlertSensitivityConfig().failureFallbackMinCurrent,
                  normalFailures: null,
                  baseline: null,
                  window: "current monitoring window",
                }),
              },
              {
                failures: demoAccount?.currentFailures ?? 0,
                normalFailures: null,
                threshold: getAlertSensitivityConfig().failureFallbackMinCurrent,
                criticalThreshold: null,
                windowLabel: "current monitoring window",
              }
            ),
            failures: demoAccount?.currentFailures ?? 0,
            normalFailures: null,
            threshold: getAlertSensitivityConfig().failureFallbackMinCurrent,
            criticalThreshold: null,
            windowLabel: "current monitoring window",
            hasEnoughHistory: false,
          }
        : null;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <div className={styles.titleRow}>
              <div className={styles.titlePrimary}>
                <h1>{accountName}</h1>
                {account ? (
                  <RenameAccountControl
                    accountId={account.stripeAccountId}
                    currentName={account.name?.trim() || accountName}
                  />
                ) : null}
              </div>
              <span className={headerStatus.className}>{headerStatus.label}</span>
            </div>
            <p className={styles.headerSubtitle}>
              Review this account&apos;s current monitoring status and alert activity.
            </p>
          </div>

          <div className={styles.actions}>
            <Link href="/dashboard" className={styles.secondaryAction}>
              Back to dashboard
            </Link>
          </div>
        </header>

        <AccountMonitor
          model={chartModel}
          topAlert={topAlert}
          paymentContext={paymentContext}
          healthyRevenueState={
            healthyRevenueState ?? {
              model: null,
              currentAmount: 0,
              baselineAmount: null,
              thresholdValue: null,
              currency: "EUR",
              baselineLabel: "similar recent time periods",
              windowLabel: "current monitoring window",
              hasEnoughHistory: false,
              placeholderLabels: buildRecentHourLabels(now, 5),
            }
          }
          healthyPaymentState={
            healthyPaymentState ?? {
              model: buildFailureChartModel(
                {
                  type: "payment_failed",
                  createdAt: now,
                  context: JSON.stringify({
                    failureSeries: [],
                    failureThreshold: getAlertSensitivityConfig().failureFallbackMinCurrent,
                    normalFailures: null,
                    baseline: null,
                    window: "current monitoring window",
                  }),
                },
                {
                  failures: 0,
                  normalFailures: null,
                  threshold: getAlertSensitivityConfig().failureFallbackMinCurrent,
                  criticalThreshold: null,
                  windowLabel: "current monitoring window",
                }
              ),
              failures: 0,
              normalFailures: null,
              threshold: getAlertSensitivityConfig().failureFallbackMinCurrent,
              criticalThreshold: null,
              windowLabel: "current monitoring window",
              hasEnoughHistory: false,
            }
          }
        />

        <section className={styles.lowerGrid}>
          <div>
            <div className={styles.sectionHeading}>
              <h2>Current Issue</h2>
            </div>

            <div className={styles.alertStack} id="current-alert">
              {activeAlerts.length > 0 ? (
                activeAlerts.map((alert) => <ActiveAlertRow key={alert.id ?? alert.type} alert={alert} />)
              ) : (
                <div className={styles.emptyState}>No active alerts for this account right now.</div>
              )}
            </div>
          </div>

          <div>
            <div className={styles.sectionHeading}>
              <h2>Alert History</h2>
            </div>

            <div className={styles.resolvedStack}>
              {historicalAlerts.length > 0 ? (
                historicalAlerts.map((alert) => <HistoryRow key={alert.id} alert={alert} />)
              ) : (
                <div className={styles.emptyState}>No alert history yet.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
