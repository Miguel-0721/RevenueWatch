import { auth } from "@/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import SeverityHelpPopover from "@/components/SeverityHelpPopover";
import { getAlertSensitivityConfig } from "@/lib/alert-sensitivity";
import { formatMoneyAmount, normalizeCurrencyCode } from "@/lib/currency";
import { getDemoAccountById, getDemoAlertHistory, getDemoSeverity } from "@/lib/demoData";
import { prisma } from "@/lib/prisma";
import {
  getSubscriptionHealthKpiPeriodMetrics,
  getLatestSubscriptionHealthSummary,
  type SubscriptionHealthSummary,
} from "@/lib/subscription-health-store";
import { previewAccountDetails } from "@/app/dashboard/previewData";
import AccountDetailView, {
  type AccountDetailStatus,
  type AccountDetailViewModel,
} from "./AccountDetailView";
import PreviewAccountDetailClient from "./PreviewAccountDetailClient";
import dashboardStyles from "@/app/dashboard/page.module.css";
import { markAlertReviewedAction } from "./actions";
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

type PreviewAccountStatus = "Review needed" | "Monitoring active" | "Attention needed";

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
  if (type === "revenue_drop") return "Revenue drop";
  if (type === "payment_failed") return "Payment failures";
  if (type === "subscription_canceled") return "Subscription canceled";
  if (type === "failed_renewal") return "Failed renewal";
  if (type === "subscription_drop") return "Subscription drop";
  if (type === "cancellation_spike") return "Cancellation spike";
  if (type === "failed_renewal_spike") return "Failed renewal spike";
  if (type === "past_due_increase") return "Past-due increase";
  if (type === "unpaid_subscription") return "Unpaid subscription";
  if (type === "unpaid_increase") return "Unpaid increase";
  if (type === "negative_net_subscription_movement") return "Negative net movement";
  if (type === "meaningful_mrr_drop") return "Meaningful MRR drop";
  return type.replace(/_/g, " ");
}

function getSeverityLabel(severity?: string) {
  if (severity === "critical") return "High severity";
  if (severity === "warning") return "Review needed";
  return "Monitoring";
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

  if (alert.type === "failed_renewal") {
    const amountDue =
      parsed && typeof parsed.amountDue === "number" ? parsed.amountDue : null;
    const currency =
      parsed && typeof parsed.currency === "string"
        ? normalizeCurrencyCode(parsed.currency)
        : "EUR";

    if (amountDue !== null) {
      return `A subscription renewal payment failed. The subscription is now past due and ${formatMoneyAmount(amountDue, currency)} per month is at risk.`;
    }

    return "A subscription renewal payment failed. The subscription is now past due and the monthly amount is at risk.";
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
            const height =
              point.failures <= 0 ? 0 : Math.max(8, (point.failures / maxValue) * 100);
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
            : "No active alerts. Parveil is monitoring this account in read-only mode."}
        </p>
        <div className={styles.monitoringNote}>
          Parveil only monitors this issue. No Stripe changes are made.
        </div>
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
  title = "Building baseline",
  body = "Parveil is collecting activity for this account. Revenue history will appear here after enough similar periods are available.",
  ariaLabel = "Monitoring chart placeholder while Parveil builds history",
}: {
  labels: string[];
  title?: string;
  body?: string;
  ariaLabel?: string;
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
          <strong>{title}</strong>
          <p>{body}</p>
        </div>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className={styles.chartSvg}
          role="img"
          aria-label={ariaLabel}
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
  isImportingHistory,
}: {
  state: HealthyRevenueMonitoringState;
  isImportingHistory: boolean;
}) {
  const monitoring = getMonitoringPresentation();
  const cardStatusLabel = isImportingHistory ? "Importing" : monitoring.label;

  return (
    <section className={`${styles.chartCard} ${styles.healthyChartCard}`}>
      <div className={styles.chartLayout}>
        <div className={styles.chartMain}>
          <div className={styles.chartHeader}>
            <div>
              <h2>Revenue health</h2>
              <p>
                Track recent revenue changes as a supporting signal for subscription
                health.
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
              {cardStatusLabel}
            </span>
          </div>

          {isImportingHistory ? (
            <MonitoringPlaceholderChart
              labels={state.placeholderLabels}
              title="Importing history"
              body="Revenue history will appear here after recent Stripe activity finishes importing."
              ariaLabel="Monitoring chart placeholder while Parveil imports recent Stripe activity"
            />
          ) : state.model ? (
            <RevenueChartFigure
              model={state.model}
              severity={monitoring}
              thresholdDisplayMode="review-only"
            />
          ) : (
            <MonitoringPlaceholderChart
              labels={state.placeholderLabels}
              title="Building baseline"
              body="Revenue history will appear here after enough similar periods are available."
              ariaLabel="Monitoring chart placeholder while Parveil builds history"
            />
          )}
        </div>

        <HealthyMonitoringPanel
          title="Revenue health"
          description={
            isImportingHistory
              ? "Parveil is importing recent Stripe activity. Revenue health becomes more reliable as history finishes loading."
              : state.hasEnoughHistory
              ? "Parveil compares this account against similar recent time periods and confirms revenue remains a healthy supporting signal."
              : "Parveil is collecting activity for this account. Revenue health becomes more useful after enough similar periods are available."
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
              value: isImportingHistory ? "Importing history" : "Normal",
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
  isImportingHistory,
}: {
  state: HealthyPaymentMonitoringState;
  isImportingHistory: boolean;
}) {
  const monitoring = getMonitoringPresentation();
  const cardStatusLabel = isImportingHistory ? "Importing" : monitoring.label;

  return (
    <section className={`${styles.chartCard} ${styles.healthyChartCard}`}>
      <div className={styles.chartLayout}>
        <div className={styles.chartMain}>
          <div className={styles.chartHeader}>
            <div>
              <h2>Payment failure monitoring</h2>
              <p>
                Review failed payments and failed renewals that may affect subscription
                health.
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
              {cardStatusLabel}
            </span>
          </div>

          <div className={styles.failureMiniChart}>
            {isImportingHistory ? (
              <MonitoringPlaceholderChart
                labels={state.model.points.map((point) => point.label)}
                title="Importing history"
                body="Failed-payment history will appear here after recent Stripe activity finishes importing."
                ariaLabel="Monitoring chart placeholder while Parveil imports recent failed-payment history"
              />
            ) : !state.hasEnoughHistory ? (
              <div className={styles.monitoringChartNote}>{`Collecting monitoring history`}</div>
            ) : null}
            {!isImportingHistory ? (
              <FailureChart
                model={state.model}
                severity={monitoring}
                thresholdDisplayMode="review-only"
              />
            ) : null}
          </div>
        </div>

        <HealthyMonitoringPanel
          title="Payment failure monitoring"
          description={
            isImportingHistory
              ? "Parveil is importing recent Stripe activity. Failed-payment and renewal history may still update while history finishes loading."
              : state.hasEnoughHistory
              ? "Parveil compares recent failed payments to similar recent windows and confirms they remain a stable supporting signal."
              : "Parveil is collecting activity for this account. Failed-payment monitoring becomes more useful after enough similar windows are available."
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
              value: isImportingHistory ? "Importing history" : "Normal",
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
  isImportingHistory,
}: {
  revenueState: HealthyRevenueMonitoringState;
  paymentState: HealthyPaymentMonitoringState;
  isImportingHistory: boolean;
}) {
  return (
    <div className={styles.healthyMonitorStack}>
      <HealthyRevenueMonitor
        state={revenueState}
        isImportingHistory={isImportingHistory}
      />
      <HealthyPaymentMonitor
        state={paymentState}
        isImportingHistory={isImportingHistory}
      />
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
              <h2>Payment failure monitoring</h2>
              <p>Review failed payments and failed renewals that may affect subscription health.</p>
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
              <h2>Revenue health</h2>
              <p>Track recent revenue changes as a supporting signal for subscription health.</p>
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
  isImportingHistory,
}: {
  model: RevenueChartModel;
  topAlert: AlertLike | null;
  paymentContext: PaymentFailureContext | null;
  healthyRevenueState: HealthyRevenueMonitoringState;
  healthyPaymentState: HealthyPaymentMonitoringState;
  isImportingHistory: boolean;
}) {
  if (!topAlert) {
    return (
      <HealthyMonitorCard
        revenueState={healthyRevenueState}
        paymentState={healthyPaymentState}
        isImportingHistory={isImportingHistory}
      />
    );
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
  return <ActiveAlertRowInner alert={alert} previewMode={false} />;
}

function parsePreviewMoneyToCents(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/,/g, "");
  const amount = Number.parseFloat(normalized);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

function previewStatusTone(status: PreviewAccountStatus) {
  if (status === "Attention needed") return styles.previewStatusAttention;
  if (status === "Review needed") return styles.previewStatusReview;
  return styles.previewStatusMonitoring;
}

function previewIssueTone(status: PreviewAccountStatus) {
  if (status === "Attention needed") return styles.previewIssueAttention;
  if (status === "Review needed") return styles.previewIssueReview;
  return styles.previewIssueMonitoring;
}

function previewSecondaryTone(label: string) {
  if (label === "Past-due") return dashboardStyles.secondaryReview;
  if (label === "Unpaid") return dashboardStyles.secondaryAttention;
  if (label === "Net subscriptions") return dashboardStyles.secondaryPositive;
  return dashboardStyles.secondaryNeutral;
}

function formatIssueCountLabel(count: number) {
  if (count === 0) return "No active issues";
  if (count === 1) return "1 issue needs review";
  return `${count} issues need review`;
}

function PreviewMetricSparkline({
  points,
}: {
  points: number[];
}) {
  const width = 216;
  const height = 44;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(1, max - min);
  const step = width / Math.max(1, points.length - 1);

  const coordinates = points.map((point, index) => {
    const x = index * step;
    const y = height - ((point - min) / range) * (height - 8) - 4;
    return { x, y };
  });

  const linePath = coordinates.reduce((accumulator, point, index, array) => {
    if (index === 0) {
      return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }

    const previous = array[index - 1];
    const midpointX = ((previous.x + point.x) / 2).toFixed(2);
    return `${accumulator} Q ${previous.x.toFixed(2)} ${previous.y.toFixed(2)} ${midpointX} ${(
      (previous.y + point.y) /
      2
    ).toFixed(2)} T ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }, "");

  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1]?.x.toFixed(2)} ${height} L ${coordinates[0]?.x.toFixed(2)} ${height} Z`;

  return (
    <svg
      className={styles.previewSparkline}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      <path className={styles.previewSparklineArea} d={areaPath} />
      <path className={styles.previewSparklineLine} d={linePath} />
    </svg>
  );
}

function PreviewLargeMetricCard({
  label,
  value,
  helper,
  badge,
  points,
  tooltip,
}: {
  label: string;
  value: string | number;
  helper: string;
  badge: string;
  points: number[];
  tooltip?: string;
}) {
  return (
    <article className={`${dashboardStyles.metricCard} ${dashboardStyles.metricCardLarge}`}>
      <div className={dashboardStyles.metricCardHeader}>
        <span className={dashboardStyles.metricLabelRow}>
          <span className={dashboardStyles.metricLabel}>{label}</span>
          {tooltip ? <PreviewInfoTooltip text={tooltip} /> : null}
        </span>
        <span className={dashboardStyles.metricTrendPill}>{badge}</span>
      </div>
      <strong className={dashboardStyles.metricValue}>{value}</strong>
      <div className={dashboardStyles.metricSparklineWrap}>
        <PreviewMetricSparkline points={points} />
      </div>
      <small className={dashboardStyles.metricHelper}>{helper}</small>
    </article>
  );
}

function PreviewCompactMetricCard({
  label,
  value,
  helper,
  pill,
  periodLabel,
  tone,
  tooltip,
}: {
  label: string;
  value: string | number;
  helper: string;
  pill: string;
  periodLabel?: string;
  tone: "review" | "risk";
  tooltip?: string;
}) {
  return (
    <article className={`${dashboardStyles.metricCard} ${dashboardStyles.metricCardCompact}`}>
      <div className={dashboardStyles.metricCardHeader}>
        <span className={dashboardStyles.metricLabelRow}>
          <span className={dashboardStyles.metricLabel}>{label}</span>
          {periodLabel ? <span className={dashboardStyles.metricPeriodPill}>{periodLabel}</span> : null}
          {tooltip ? <PreviewInfoTooltip text={tooltip} /> : null}
        </span>
        <span
          className={
            tone === "risk" ? dashboardStyles.metricBadgeRisk : dashboardStyles.metricBadgeReview
          }
        >
          {pill}
        </span>
      </div>
      <strong className={dashboardStyles.metricValueSmall}>{value}</strong>
      <small className={dashboardStyles.metricHelper}>{helper}</small>
    </article>
  );
}

function PreviewSupportingMetricCard({
  label,
  value,
  helper,
  tooltip,
}: {
  label: string;
  value: string | number;
  helper: string;
  tooltip?: string;
}) {
  return (
    <article className={`${dashboardStyles.secondaryCard} ${previewSecondaryTone(label)}`}>
      <span className={dashboardStyles.secondaryLabelRow}>
        <span>{label}</span>
        {tooltip ? <PreviewInfoTooltip text={tooltip} /> : null}
      </span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

function AccountDetailLargeMetricCard({
  label,
  value,
  helper,
  badge,
  tooltip,
}: {
  label: string;
  value: string | number;
  helper: string;
  badge?: string;
  tooltip?: string;
}) {
  return (
    <article className={`${dashboardStyles.metricCard} ${dashboardStyles.metricCardLarge}`}>
      <div className={dashboardStyles.metricCardHeader}>
        <span className={dashboardStyles.metricLabelRow}>
          <span className={dashboardStyles.metricLabel}>{label}</span>
          {tooltip ? <PreviewInfoTooltip text={tooltip} /> : null}
        </span>
        {badge ? <span className={dashboardStyles.metricTrendPill}>{badge}</span> : null}
      </div>
      <strong className={dashboardStyles.metricValue}>{value}</strong>
      <small className={dashboardStyles.metricHelper}>{helper}</small>
    </article>
  );
}

function AccountDetailCompactMetricCard({
  label,
  value,
  helper,
  pill,
  tone,
  periodLabel,
  tooltip,
}: {
  label: string;
  value: string | number;
  helper: string;
  pill?: string;
  tone?: "review" | "risk";
  periodLabel?: string;
  tooltip?: string;
}) {
  return (
    <article className={`${dashboardStyles.metricCard} ${dashboardStyles.metricCardCompact}`}>
      <div className={dashboardStyles.metricCardHeader}>
        <span className={dashboardStyles.metricLabelRow}>
          <span className={dashboardStyles.metricLabel}>{label}</span>
          {periodLabel ? <span className={dashboardStyles.metricPeriodPill}>{periodLabel}</span> : null}
          {tooltip ? <PreviewInfoTooltip text={tooltip} /> : null}
        </span>
        {pill ? (
          <span
            className={
              tone === "risk"
                ? dashboardStyles.metricBadgeRisk
                : dashboardStyles.metricBadgeReview
            }
          >
            {pill}
          </span>
        ) : null}
      </div>
      <strong className={dashboardStyles.metricValueSmall}>{value}</strong>
      <small className={dashboardStyles.metricHelper}>{helper}</small>
    </article>
  );
}

function buildAlertImpactLabel(alert: AlertLike) {
  const parsed = safeParseContext(alert.context);
  if (!parsed) return "—";

  const currency =
    typeof parsed.currency === "string" ? normalizeCurrencyCode(parsed.currency) : "EUR";

  if (alert.type === "failed_renewal") {
    const amountDue = typeof parsed.amountDue === "number" ? parsed.amountDue : null;
    if (amountDue !== null) return `${formatMoneyAmount(amountDue, currency)} at risk`;
  }

  if (alert.type === "subscription_canceled") {
    const mrr =
      typeof parsed.estimatedMonthlyRevenue === "number"
        ? parsed.estimatedMonthlyRevenue
        : typeof parsed.amountDue === "number"
          ? parsed.amountDue
          : null;
    if (mrr !== null) return `${formatMoneyAmount(mrr, currency)} MRR impact`;
  }

  if (alert.type === "subscription_drop") {
    const previous =
      typeof parsed.previousActiveSubscriptions === "number"
        ? parsed.previousActiveSubscriptions
        : typeof parsed.baselineActiveSubscriptions === "number"
          ? parsed.baselineActiveSubscriptions
          : null;
    const current =
      typeof parsed.currentActiveSubscriptions === "number"
        ? parsed.currentActiveSubscriptions
        : typeof parsed.activeSubscriptions === "number"
          ? parsed.activeSubscriptions
          : null;
    if (previous !== null && current !== null) return `${formatCount(previous)} → ${formatCount(current)} active`;
  }

  if (alert.type === "past_due_increase") {
    const previous = typeof parsed.previousPastDue === "number" ? parsed.previousPastDue : null;
    const current = typeof parsed.currentPastDue === "number" ? parsed.currentPastDue : null;
    if (previous !== null && current !== null) return `${formatCount(previous)} → ${formatCount(current)} subscriptions`;
  }

  if (alert.type === "unpaid_subscription" || alert.type === "unpaid_increase") {
    const current =
      typeof parsed.currentUnpaid === "number"
        ? parsed.currentUnpaid
        : typeof parsed.unpaidCount === "number"
          ? parsed.unpaidCount
          : null;
    if (current !== null) return `${formatCount(current)} subscriptions`;
  }

  if (alert.type === "cancellation_spike") {
    const count =
      typeof parsed.cancellationsCounted === "number"
        ? parsed.cancellationsCounted
        : typeof parsed.cancellations === "number"
          ? parsed.cancellations
          : null;
    if (count !== null) return `${formatCount(count)} cancellations`;
  }

  if (alert.type === "failed_renewal_spike") {
    const count =
      typeof parsed.failuresCounted === "number"
        ? parsed.failuresCounted
        : typeof parsed.failedRenewals === "number"
          ? parsed.failedRenewals
          : null;
    if (count !== null) return `${formatCount(count)} failed renewals`;
  }

  if (alert.type === "meaningful_mrr_drop" || alert.type === "revenue_drop") {
    const dropAmount =
      typeof parsed.mrrDropAmount === "number"
        ? parsed.mrrDropAmount
        : typeof parsed.revenueDropAmount === "number"
          ? parsed.revenueDropAmount
          : typeof parsed.baselineAmount === "number" && typeof parsed.currentAmount === "number"
            ? Math.max(0, parsed.baselineAmount - parsed.currentAmount)
            : null;
    if (dropAmount !== null) return `${formatMoneyAmount(dropAmount, currency)} MRR drop`;
  }

  return "—";
}

function AccountCurrentIssueCard({
  alert,
  accountStatus,
}: {
  alert: AlertLike;
  accountStatus: PreviewAccountStatus;
}) {
  const detectedAt = fmtDetectedDate(alert.createdAt);
  const reviewHref = `/dashboard/inbox?alert=${encodeURIComponent(alert.id ?? "")}${
    alert.stripeAccountId ? `&account=${encodeURIComponent(alert.stripeAccountId)}` : ""
  }`;

  return (
    <article className={`${styles.previewIssueCard} ${previewIssueTone(accountStatus)}`}>
      <div className={styles.previewIssueHeader}>
        <div>
          <strong>{alertLabel(alert.type)}</strong>
          <span>
            {detectedAt
              ? `Detected ${detectedAt}`
              : alert.detectedLabel
                ? `Detected ${alert.detectedLabel}`
                : `Triggered ${fmtDate(alert.createdAt)}`}
          </span>
        </div>
      </div>
      <p>{buildReadableAlertMessage(alert)}</p>
      <div className={styles.previewIssuePills}>
        <span className={styles.previewIssueImpact}>{buildAlertImpactLabel(alert)}</span>
        <span className={`${styles.previewStatusPill} ${previewStatusTone(accountStatus)}`}>
          {accountStatus}
        </span>
      </div>
      <div className={styles.inlineMonitoringNote}>
        Parveil only monitors this issue. No Stripe changes are made.
      </div>
      <div className={styles.previewIssueActions}>
        <Link href={reviewHref} className={styles.previewActionSecondary}>
          Review in Inbox
        </Link>
        {alert.id && alert.stripeAccountId ? (
          <form action={markAlertReviewedAction} className={styles.alertRowActions}>
            <input type="hidden" name="alertId" value={alert.id} />
            <input type="hidden" name="stripeAccountId" value={alert.stripeAccountId} />
            <button type="submit" className={styles.previewActionPrimary}>
              Mark as reviewed
            </button>
          </form>
        ) : null}
      </div>
    </article>
  );
}

function AccountHistoryItem({ alert }: { alert: AlertLike }) {
  const timestamp =
    alert.displayTimestamp ?? fmtDetectedDate(alert.createdAt) ?? fmtDate(alert.createdAt);

  return (
    <article className={styles.previewHistoryItem}>
      <div className={styles.previewHistoryMain}>
        <span className={styles.previewHistoryDot} aria-hidden="true" />
        <div>
          <strong>{alertLabel(alert.type)}</strong>
          <p>{buildHistoryAlertMessage(alert)}</p>
        </div>
      </div>
      <div className={styles.previewHistoryMeta}>
        <span className={styles.previewHistoryPill}>Reviewed</span>
        <small>{timestamp}</small>
      </div>
    </article>
  );
}

function PreviewInfoTooltip({ text }: { text: string }) {
  const tooltipId = `account-preview-tooltip-${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;

  return (
    <span className={dashboardStyles.infoTooltipWrap}>
      <button
        type="button"
        className={dashboardStyles.infoTooltip}
        aria-label={text}
        aria-describedby={tooltipId}
      >
        i
      </button>
      <span id={tooltipId} role="tooltip" className={dashboardStyles.infoTooltipBubble}>
        {text}
      </span>
    </span>
  );
}

function ActiveAlertRowInner({
  alert,
  previewMode,
}: {
  alert: AlertLike;
  previewMode: boolean;
}) {
  const severity = getSeverityPresentation(alert.severity);
  const detectedAt = fmtDetectedDate(alert.createdAt);

  return (
    <article className={styles.alertRow}>
      <div className={severity.iconClass}>!</div>
      <div className={styles.alertRowBody}>
        <div className={styles.alertRowHeader}>
          <h3>{alertLabel(alert.type)}</h3>
          <span className={styles.activeAlertPill}>{getSeverityLabel(alert.severity)}</span>
        </div>
        <p>{buildReadableAlertMessage(alert)}</p>
        <span className={styles.alertMetaText}>
          {detectedAt
            ? `Detected ${detectedAt}`
            : alert.detectedLabel
              ? `Detected ${alert.detectedLabel}`
              : `Triggered ${fmtDate(alert.createdAt)}`}
        </span>
        <div className={styles.inlineMonitoringNote}>
          Parveil only monitors this issue. No Stripe changes are made.
        </div>
        {previewMode ? (
          <div className={styles.alertRowActions}>
            <Link href="/dashboard/inbox?preview=subscription-health" className={styles.reviewActionSecondary}>
              View details
            </Link>
            <button type="button" className={styles.reviewAction} disabled>
              Mark as reviewed
            </button>
          </div>
        ) : alert.id && alert.stripeAccountId ? (
          <form action={markAlertReviewedAction} className={styles.alertRowActions}>
            <input type="hidden" name="alertId" value={alert.id} />
            <input type="hidden" name="stripeAccountId" value={alert.stripeAccountId} />
            <button type="submit" className={styles.reviewAction}>
              Mark as reviewed
            </button>
          </form>
        ) : null}
      </div>
    </article>
  );
}

function HistoryRow({ alert }: { alert: AlertLike }) {
  const detectedAt =
    alert.displayTimestamp ?? fmtDetectedDate(alert.createdAt) ?? fmtDate(alert.createdAt);

  return (
    <article className={styles.resolvedRow}>
      <div className={styles.resolvedRowBody}>
        <div className={styles.resolvedRowHeader}>
          <h3>{alertLabel(alert.type)}</h3>
          <span className={styles.historyPill}>Reviewed</span>
        </div>
        <p>{buildHistoryAlertMessage(alert)}</p>
        <span className={styles.historyDetected}>Detected {detectedAt}</span>
      </div>
    </article>
  );
}

function SubscriptionHealthSection({
  summary,
  periodMetrics,
}: {
  summary: SubscriptionHealthSummary | null;
  periodMetrics: {
    failedRenewalsLast7Days: number;
    cancellationsLast7Days: number;
    netSubscriptionsThisMonth: number;
  } | null;
}) {
  const metrics = summary
    ? [
        {
          label: "Active subscriptions",
          value: formatCount(summary.activeSubscriptions),
          help: "Currently active paid subscriptions.",
        },
        {
          label: "Trials",
          value: formatCount(summary.trialingSubscriptions),
          help: "Currently in trial",
        },
        {
          label: "Past-due",
          value: formatCount(summary.pastDueSubscriptions),
          help: "Payment not collected yet",
        },
        {
          label: "Unpaid",
          value: formatCount(summary.unpaidSubscriptions),
          help: "Marked unpaid in Stripe",
        },
        {
          label: "Canceled",
          value: formatCount(periodMetrics?.cancellationsLast7Days ?? 0),
          help: "Canceled · Last 7 days",
        },
        {
          label: "Failed renewals",
          value: formatCount(periodMetrics?.failedRenewalsLast7Days ?? 0),
          help: "Failed payments · Last 7 days",
        },
        {
          label: "Estimated MRR",
          value: formatMoneyAmount(summary.estimatedMonthlyRevenue, summary.currency),
          help: "Active subscriptions only",
        },
        {
          label: "Net subscriptions",
          value:
            (periodMetrics?.netSubscriptionsThisMonth ?? 0) > 0
              ? `+${formatCount(periodMetrics?.netSubscriptionsThisMonth ?? 0)}`
              : formatCount(periodMetrics?.netSubscriptionsThisMonth ?? 0),
          help: "New minus canceled · This month",
        },
      ]
    : [];

  return (
    <section className={styles.subscriptionHealthCard}>
          <div className={styles.subscriptionHealthHeader}>
        <div>
          <h2>Subscription health</h2>
          <p>Monitor subscription health before revenue problems grow.</p>
          <p className={styles.subscriptionHealthHelper}>
            Track active subscriptions, cancellations, failed renewals, past-due
            subscriptions, and estimated MRR.
          </p>
        </div>
      </div>

      {summary ? (
        <div className={styles.subscriptionHealthGrid}>
          {metrics.map((metric) => (
            <article key={metric.label} className={styles.subscriptionMetricCard}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.help}</small>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.subscriptionEmptyState}>
          Subscription health data is not available yet. It will appear after the next
          subscription sync.
        </div>
      )}
    </section>
  );
}

export default async function AccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams?: Promise<{ preview?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  const { accountId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const isPreviewMode = resolvedSearchParams?.preview === "subscription-health";
  const previewAccount = isPreviewMode ? previewAccountDetails[accountId] : undefined;
  const previewClientAccount = isPreviewMode ? previewAccountDetails[accountId] : undefined;

  if (previewClientAccount) {
    return <PreviewAccountDetailClient previewAccount={previewClientAccount} />;
  }

  if (previewAccount) {
    const previewNetMovement = Number.parseInt(previewAccount.netSubscriptions, 10) || 0;
    const previewHistory = previewAccount.history.map((entry) => ({
      id: entry.id,
      label: alertLabel(entry.type),
      message: entry.message,
      timestamp: entry.timestamp,
    }));

    const primaryTrendByAccount: Record<string, { active: string; mrr: string; activePoints: number[]; mrrPoints: number[] }> = {
      "northstar-commerce": {
        active: "+3.4% this month",
        mrr: "+2.1% this month",
        activePoints: [92, 98, 101, 109, 112, 124],
        mrrPoints: [5400, 5520, 5660, 5890, 6110, 6420],
      },
      "bluepeak-studio": {
        active: "+2.6% this month",
        mrr: "+1.8% this month",
        activePoints: [74, 76, 79, 81, 84, 88],
        mrrPoints: [3320, 3390, 3510, 3600, 3720, 3900],
      },
      "cedar-labs": {
        active: "+4.1% this month",
        mrr: "+2.7% this month",
        activePoints: [182, 188, 194, 201, 207, 216],
        mrrPoints: [7240, 7380, 7520, 7710, 7890, 8100],
      },
    };

    const primaryTrend =
      primaryTrendByAccount[previewAccount.slug] ?? primaryTrendByAccount["northstar-commerce"];
    const currentIssueStatus: PreviewAccountStatus =
      previewAccount.currentIssue.severity === "critical" ? "Attention needed" : "Review needed";

    return (
      <main className={styles.page}>
        <div className={`${styles.shell} ${styles.previewShell}`}>
          <header className={styles.previewHeader}>
            <div className={styles.previewHeaderCopy}>
              <div className={styles.previewTitleRow}>
                <h1 className={styles.previewPageTitle}>{previewAccount.name}</h1>
                <span className={`${styles.previewStatusPill} ${previewStatusTone(previewAccount.status)}`}>
                  {previewAccount.status}
                </span>
              </div>
              <p className={styles.previewHeaderSubtitle}>
                Subscription-health monitoring for this connected Stripe account.
              </p>
              
            </div>

            <div className={styles.previewHeaderActions}>
              <Link href="/dashboard?preview=subscription-health" className={styles.previewHeaderAction}>
                Back to dashboard
              </Link>
            </div>
          </header>

          <section className={styles.previewPrimaryMetrics}>
            <PreviewLargeMetricCard
              label="Active subscriptions"
              value={previewAccount.activeSubscriptions}
              helper="Currently active paid subscriptions"
              badge={primaryTrend.active}
              points={primaryTrend.activePoints}
            />
            <PreviewLargeMetricCard
              label="Estimated MRR"
              value={previewAccount.estimatedMrr}
              helper="Active subscriptions only"
              badge={primaryTrend.mrr}
              points={primaryTrend.mrrPoints}
              tooltip="Estimated monthly recurring revenue from active subscriptions only. Trials, canceled, unpaid, and past-due subscriptions are not counted."
            />
            <div className={dashboardStyles.metricStack}>
              <PreviewCompactMetricCard
                label="Needs review"
                value={previewAccount.activeAlerts}
                helper="Active issues waiting in Inbox"
                pill="Inbox"
                tone="review"
              />
              <PreviewCompactMetricCard
                label="Failed renewals"
                value={previewAccount.failedRenewals}
                helper="Failed payments · Last 7 days"
                pill="At risk"
                tone="risk"
                tooltip="Renewal invoice payments that failed in the last 7 days. For example, a customer's subscription tried to renew, but the payment did not go through."
              />
            </div>
          </section>

          <section className={styles.previewSecondaryMetrics}>
            <PreviewSupportingMetricCard
              label="Trials"
              value={previewAccount.trials}
              helper="Currently in trial"
            />
            <PreviewSupportingMetricCard
              label="Past-due"
              value={previewAccount.pastDue}
              helper="Payment not collected yet"
              tooltip="Subscriptions where Stripe has not collected the latest payment yet. If payment is completed and the subscription becomes active again, this count goes down."
            />
            <PreviewSupportingMetricCard
              label="Unpaid"
              value={previewAccount.unpaid}
              helper="Marked unpaid in Stripe"
              tooltip="Subscriptions Stripe currently marks as unpaid after payment could not be collected. If the status changes, this count updates."
            />
            <PreviewSupportingMetricCard
              label="Canceled"
              value={previewAccount.canceledThisWeek}
              helper="Canceled · Last 7 days"
            />
            <PreviewSupportingMetricCard
              label="Net subscriptions"
              value={previewNetMovement > 0 ? `+${previewNetMovement}` : previewNetMovement}
              helper="New minus canceled · This month"
              tooltip="New subscriptions minus canceled subscriptions during this month. For example, 20 new subscriptions and 2 cancellations means +18 net subscriptions."
            />
          </section>

          <section className={styles.previewLowerGrid}>
            <section className={styles.previewSectionCard}>
              <div className={styles.previewSectionHeader}>
                <div>
                  <h2>Current issue</h2>
                  <p>Active subscription-health alert for this account.</p>
                </div>
              </div>

              <article className={`${styles.previewIssueCard} ${previewIssueTone(currentIssueStatus)}`}>
                <div className={styles.previewIssueHeader}>
                  <div>
                    <strong>{alertLabel(previewAccount.currentIssue.type)}</strong>
                    <span>{previewAccount.currentIssue.detectedLabel}</span>
                  </div>
                </div>
                <p>{previewAccount.currentIssue.message}</p>
                <div className={styles.previewIssuePills}>
                  <span className={styles.previewIssueImpact}>{previewAccount.currentIssue.impact}</span>
                  <span className={`${styles.previewStatusPill} ${previewStatusTone(currentIssueStatus)}`}>
                    {currentIssueStatus}
                  </span>
                </div>
                <div className={styles.previewIssueActions}>
                  <Link href="/dashboard/inbox?preview=subscription-health" className={styles.previewActionSecondary}>
                    View details
                  </Link>
                  <button type="button" className={styles.previewActionPrimary} disabled>
                    Mark as reviewed
                  </button>
                </div>
              </article>
            </section>

            <section className={styles.previewSectionCard}>
              <div className={styles.previewSectionHeader}>
                <div>
                  <h2>Alert history</h2>
                  <p>Recent alerts that were reviewed or moved to history.</p>
                </div>
              </div>

              <div className={styles.previewHistoryList}>
                {previewHistory.map((entry) => (
                  <article key={entry.id} className={styles.previewHistoryItem}>
                    <div className={styles.previewHistoryMain}>
                      <span className={styles.previewHistoryDot} aria-hidden="true" />
                      <div>
                        <strong>{entry.label}</strong>
                        <p>{entry.message}</p>
                      </div>
                    </div>
                    <div className={styles.previewHistoryMeta}>
                      <span className={styles.previewHistoryPill}>Reviewed</span>
                      <small>{entry.timestamp}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </div>
      </main>
    );
  }

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

  const subscriptionHealthSummary =
    account && !demoAccount
      ? await getLatestSubscriptionHealthSummary({
          stripeAccountId: account.stripeAccountId,
        })
      : null;
  const subscriptionHealthPeriodMetrics =
    account && !demoAccount
      ? await getSubscriptionHealthKpiPeriodMetrics({
          stripeAccountId: account.stripeAccountId,
        })
      : null;

  const now = new Date();
  const demoSeverity = demoAccount ? getDemoSeverity(demoAccount) : null;
  const activeAlerts: AlertLike[] =
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

  const historicalAlerts: AlertLike[] =
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
  const isImportingHistory =
    account?.backfillStatus === "pending" || account?.backfillStatus === "running";
  const headerStatusLabel: AccountDetailStatus = detailSeverity
    ? (detailSeverity.label as AccountDetailStatus)
    : account?.status === "paused"
      ? "Review needed"
      : account?.status === "disconnected"
        ? "Attention needed"
        : isImportingHistory
          ? "Monitoring active"
          : "Monitoring active";
  const metricCurrency = subscriptionHealthSummary?.currency ?? "EUR";
  const activeIssueCount = activeAlerts.length;
  const primaryActiveAlert = activeAlerts[0] ?? null;
  const currentIssueTitle = activeIssueCount > 1 ? "Current issues" : "Current issue";
  const currentIssueSummary = formatIssueCountLabel(activeIssueCount);
  const activeSubscriptionsValue = formatCount(subscriptionHealthSummary?.activeSubscriptions ?? 0);
  const estimatedMrrValue = formatMoneyAmount(
    subscriptionHealthSummary?.estimatedMonthlyRevenue ?? 0,
    metricCurrency,
  );
  const trialsValue = formatCount(subscriptionHealthSummary?.trialingSubscriptions ?? 0);
  const pastDueValue = formatCount(subscriptionHealthSummary?.pastDueSubscriptions ?? 0);
  const unpaidValue = formatCount(subscriptionHealthSummary?.unpaidSubscriptions ?? 0);
  const canceledValue = formatCount(subscriptionHealthPeriodMetrics?.cancellationsLast7Days ?? 0);
  const failedRenewalsValue = formatCount(
    subscriptionHealthPeriodMetrics?.failedRenewalsLast7Days ?? 0,
  );
  const netSubscriptionsRaw = subscriptionHealthPeriodMetrics?.netSubscriptionsThisMonth ?? 0;
  const netSubscriptionsValue =
    netSubscriptionsRaw > 0 ? `+${formatCount(netSubscriptionsRaw)}` : formatCount(netSubscriptionsRaw);
  const currentIssue =
    primaryActiveAlert && primaryActiveAlert.id && primaryActiveAlert.stripeAccountId
      ? {
          title: alertLabel(primaryActiveAlert.type),
          detectedLabel:
            fmtDetectedDate(primaryActiveAlert.createdAt) ??
            primaryActiveAlert.detectedLabel ??
            `Triggered ${fmtDate(primaryActiveAlert.createdAt)}`,
          message: buildReadableAlertMessage(primaryActiveAlert),
          impact: buildAlertImpactLabel(primaryActiveAlert),
          status:
            primaryActiveAlert.severity === "critical"
              ? ("Attention needed" as const)
              : ("Review needed" as const),
          reviewInInboxHref: `/dashboard/inbox?alert=${encodeURIComponent(
            primaryActiveAlert.id,
          )}&account=${encodeURIComponent(primaryActiveAlert.stripeAccountId)}`,
          reviewAction: {
            kind: "real" as const,
            alertId: primaryActiveAlert.id,
            stripeAccountId: primaryActiveAlert.stripeAccountId,
          },
        }
      : primaryActiveAlert
        ? {
            title: alertLabel(primaryActiveAlert.type),
            detectedLabel:
              fmtDetectedDate(primaryActiveAlert.createdAt) ??
              primaryActiveAlert.detectedLabel ??
              `Triggered ${fmtDate(primaryActiveAlert.createdAt)}`,
            message: buildReadableAlertMessage(primaryActiveAlert),
            impact: buildAlertImpactLabel(primaryActiveAlert),
            status:
              primaryActiveAlert.severity === "critical"
                ? ("Attention needed" as const)
                : ("Review needed" as const),
          }
        : null;

  const history = historicalAlerts.map((alert) => ({
    id: alert.id ?? alert.type,
    typeLabel: alertLabel(alert.type),
    message: buildHistoryAlertMessage(alert),
    timestamp:
      alert.displayTimestamp ?? fmtDetectedDate(alert.createdAt) ?? fmtDate(alert.createdAt),
  }));

  const viewModel: AccountDetailViewModel = {
    name: accountName,
    status: headerStatusLabel,
    backHref: "/dashboard/accounts",
    backLabel: "Back to accounts",
    activeSubscriptions: activeSubscriptionsValue,
    estimatedMrr: estimatedMrrValue,
    needsReview: formatCount(activeIssueCount),
    failedRenewals: failedRenewalsValue,
    trials: trialsValue,
    pastDue: pastDueValue,
    unpaid: unpaidValue,
    canceled: canceledValue,
    netSubscriptions: netSubscriptionsValue,
    currentIssueCountText: currentIssueSummary,
    currentIssueTitle,
    currentIssue,
    history,
  };

  return <AccountDetailView viewModel={viewModel} />;
}

