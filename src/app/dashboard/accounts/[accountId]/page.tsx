import Link from "next/link";
import Navbar from "@/components/Navbar";
import MarketingFooter from "@/components/MarketingFooter";
import { prisma } from "@/lib/prisma";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type AlertLike = {
  id?: string;
  type: string;
  severity?: string;
  message?: string;
  context?: string | null;
  createdAt?: Date;
  windowEnd?: Date;
  stripeAccountId?: string | null;
  accountName?: string | null;
};

type AccountLike = {
  id: string;
  name: string | null;
  stripeAccountId: string;
  status: string;
  createdAt: Date;
};

type RevenueContext = {
  parsed: Record<string, unknown>;
  baselineAmount: number;
  currentAmount: number;
  dropRatio: number;
  threshold: number;
  alertThresholdAmount: number;
  baselineLabel: string;
  baselineSampleCount: number | null;
  windowLabel: string;
  hourOfDay: number | null;
};

type PaymentFailureContext = {
  failures: number;
  threshold: number;
  windowLabel: string;
};

type ChartPoint = {
  hour: number;
  expected: number;
  actual: number;
};

type RevenueChartModel = {
  points: ChartPoint[];
  expectedValue: number;
  actualValue: number;
  thresholdValue: number;
  dropThreshold: number;
  peakValue: number;
  lowValue: number;
  activeHour: number;
  baselineLabel: string;
  windowLabel: string;
  isAlerting: boolean;
};

type FailureChartPoint = {
  minute: number;
  failures: number;
};

type FailureChartModel = {
  points: FailureChartPoint[];
  failures: number;
  threshold: number;
  windowLabel: string;
  peakFailures: number;
  activeMinute: number;
  windowStartLabel: string;
  windowEndLabel: string;
};

type DemoMonitoringData = {
  activeHour: number;
  revenuePoints: ChartPoint[];
  failurePoints: FailureChartPoint[];
  failureThreshold: number;
};

const DEMO_NOW = new Date("2026-03-24T10:30:00Z");

function buildDemoRevenueSeries({
  baseline,
  activeHour,
  activeActual,
  seed,
}: {
  baseline: number;
  activeHour: number;
  activeActual: number;
  seed: number;
}) {
  const points = Array.from({ length: 24 }, (_, hour) => {
    const dayShape = 0.72 + Math.sin(((hour - 5) / 24) * Math.PI * 2) * 0.18;
    const businessLift = hour >= 8 && hour <= 20 ? 1.16 : 0.74;
    const expected = Math.round(baseline * dayShape * businessLift);
    const variation = 0.9 + (((hour * 13 + seed * 7) % 9) / 100);
    const actual = Math.round(expected * variation);

    return { hour, expected, actual };
  });

  points[activeHour] = {
    hour: activeHour,
    expected: baseline,
    actual: activeActual,
  };

  return points;
}

function buildDemoFailureSeries({
  failures,
  seed,
}: {
  failures: number;
  seed: number;
}) {
  const points = Array.from({ length: 30 }, (_, minute) => {
    const normalNoise = (minute + seed) % 11 === 0 ? 1 : 0;
    const lateRamp =
      failures >= 5 && minute >= 22
        ? Math.max(1, Math.round((failures / 8) * (1 + ((minute + seed) % 3))))
        : 0;

    return {
      minute,
      failures: Math.min(failures, Math.max(normalNoise, lateRamp)),
    };
  });

  points[29] = { minute: 29, failures };

  return points;
}

const demoAccounts: AccountLike[] = [
  {
    id: "sample-1",
    name: "Atlas Commerce",
    stripeAccountId: "acct_sample_atlas",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "sample-2",
    name: "Northstar Digital",
    stripeAccountId: "acct_sample_northstar",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "sample-3",
    name: "BluePeak Subscriptions",
    stripeAccountId: "acct_sample_bluepeak",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "sample-4",
    name: "Meridian Market",
    stripeAccountId: "acct_sample_meridian",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "sample-5",
    name: "Luma Health Co",
    stripeAccountId: "acct_sample_luma",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "sample-6",
    name: "Forge Analytics",
    stripeAccountId: "acct_sample_forge",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "sample-7",
    name: "Cedar Creative",
    stripeAccountId: "acct_sample_cedar",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "sample-8",
    name: "Pixel Harbor",
    stripeAccountId: "acct_sample_pixel",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "sample-9",
    name: "BrightGrowth Studio",
    stripeAccountId: "acct_sample_brightgrowth",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "sample-10",
    name: "Nova Ops",
    stripeAccountId: "acct_sample_nova",
    status: "active",
    createdAt: DEMO_NOW,
  },
];

const demoLastEventByAccount = new Map<string, Date>([
  ["acct_sample_atlas", new Date("2026-03-24T10:26:00Z")],
  ["acct_sample_northstar", new Date("2026-03-24T10:19:00Z")],
  ["acct_sample_bluepeak", new Date("2026-03-24T10:12:00Z")],
  ["acct_sample_meridian", new Date("2026-03-24T10:03:00Z")],
  ["acct_sample_luma", new Date("2026-03-24T09:57:00Z")],
  ["acct_sample_forge", new Date("2026-03-24T09:49:00Z")],
  ["acct_sample_cedar", new Date("2026-03-24T09:42:00Z")],
  ["acct_sample_pixel", new Date("2026-03-24T09:34:00Z")],
  ["acct_sample_brightgrowth", new Date("2026-03-24T09:27:00Z")],
  ["acct_sample_nova", new Date("2026-03-24T09:12:00Z")],
]);

const demoMonitoringByAccount: Record<string, DemoMonitoringData> = {
  acct_sample_atlas: {
    activeHour: 10,
    revenuePoints: buildDemoRevenueSeries({
      baseline: 4200,
      activeHour: 10,
      activeActual: 3948,
      seed: 1,
    }),
    failurePoints: buildDemoFailureSeries({ failures: 18, seed: 1 }),
    failureThreshold: 5,
  },
  acct_sample_northstar: {
    activeHour: 9,
    revenuePoints: buildDemoRevenueSeries({
      baseline: 8200,
      activeHour: 9,
      activeActual: 4920,
      seed: 2,
    }),
    failurePoints: buildDemoFailureSeries({ failures: 2, seed: 2 }),
    failureThreshold: 5,
  },
  acct_sample_bluepeak: {
    activeHour: 8,
    revenuePoints: buildDemoRevenueSeries({
      baseline: 2200,
      activeHour: 8,
      activeActual: 2110,
      seed: 3,
    }),
    failurePoints: buildDemoFailureSeries({ failures: 9, seed: 3 }),
    failureThreshold: 5,
  },
  acct_sample_meridian: {
    activeHour: 7,
    revenuePoints: buildDemoRevenueSeries({
      baseline: 3100,
      activeHour: 7,
      activeActual: 2418,
      seed: 4,
    }),
    failurePoints: buildDemoFailureSeries({ failures: 1, seed: 4 }),
    failureThreshold: 5,
  },
  acct_sample_luma: {
    activeHour: 10,
    revenuePoints: buildDemoRevenueSeries({
      baseline: 2600,
      activeHour: 10,
      activeActual: 2444,
      seed: 5,
    }),
    failurePoints: buildDemoFailureSeries({ failures: 1, seed: 5 }),
    failureThreshold: 5,
  },
  acct_sample_forge: {
    activeHour: 9,
    revenuePoints: buildDemoRevenueSeries({
      baseline: 2100,
      activeHour: 9,
      activeActual: 1974,
      seed: 6,
    }),
    failurePoints: buildDemoFailureSeries({ failures: 0, seed: 6 }),
    failureThreshold: 5,
  },
  acct_sample_cedar: {
    activeHour: 10,
    revenuePoints: buildDemoRevenueSeries({
      baseline: 940,
      activeHour: 10,
      activeActual: 910,
      seed: 7,
    }),
    failurePoints: buildDemoFailureSeries({ failures: 1, seed: 7 }),
    failureThreshold: 5,
  },
  acct_sample_pixel: {
    activeHour: 10,
    revenuePoints: buildDemoRevenueSeries({
      baseline: 980,
      activeHour: 10,
      activeActual: 1040,
      seed: 8,
    }),
    failurePoints: buildDemoFailureSeries({ failures: 0, seed: 8 }),
    failureThreshold: 5,
  },
  acct_sample_brightgrowth: {
    activeHour: 9,
    revenuePoints: buildDemoRevenueSeries({
      baseline: 1240,
      activeHour: 9,
      activeActual: 1188,
      seed: 9,
    }),
    failurePoints: buildDemoFailureSeries({ failures: 2, seed: 9 }),
    failureThreshold: 5,
  },
  acct_sample_nova: {
    activeHour: 10,
    revenuePoints: buildDemoRevenueSeries({
      baseline: 1800,
      activeHour: 10,
      activeActual: 1770,
      seed: 10,
    }),
    failurePoints: buildDemoFailureSeries({ failures: 1, seed: 10 }),
    failureThreshold: 5,
  },
};

const demoAlerts: AlertLike[] = [
  {
    id: "sample-alert-1",
    type: "payment_failed",
    severity: "critical",
    message: "Payment failures spiked above normal levels in the last 30 minutes.",
    stripeAccountId: "acct_sample_atlas",
    accountName: "Atlas Commerce",
    createdAt: new Date("2026-03-24T09:52:00Z"),
    windowEnd: new Date("2026-03-24T13:52:00Z"),
    context: JSON.stringify({
      failuresCounted: 18,
      failureThreshold: 5,
      failureWindowMinutes: 30,
    }),
  },
  {
    id: "sample-alert-2",
    type: "revenue_drop",
    severity: "critical",
    message: "Revenue is significantly below expected levels for this account.",
    stripeAccountId: "acct_sample_northstar",
    accountName: "Northstar Digital",
    createdAt: new Date("2026-03-24T09:16:00Z"),
    windowEnd: new Date("2026-03-24T13:16:00Z"),
    context: JSON.stringify({
      baselineAmount: 8200,
      currentAmount: 4920,
      currentWindowMinutes: 60,
      threshold: 0.5,
      baselineLabel: "same day and same hour",
      baselineSampleCount: 6,
      hourOfDay: 9,
    }),
  },
  {
    id: "sample-alert-3",
    type: "payment_failed",
    severity: "warning",
    message: "Payment failures increased for this account and should be reviewed.",
    stripeAccountId: "acct_sample_bluepeak",
    accountName: "BluePeak Subscriptions",
    createdAt: new Date("2026-03-24T08:24:00Z"),
    windowEnd: new Date("2026-03-24T11:24:00Z"),
    context: JSON.stringify({
      failuresCounted: 9,
      failureThreshold: 5,
      failureWindowMinutes: 30,
    }),
  },
  {
    id: "sample-alert-4",
    type: "revenue_drop",
    severity: "warning",
    message: "Revenue dipped below normal weekday levels during the current monitoring window.",
    stripeAccountId: "acct_sample_meridian",
    accountName: "Meridian Market",
    createdAt: new Date("2026-03-24T07:46:00Z"),
    windowEnd: new Date("2026-03-24T10:46:00Z"),
    context: JSON.stringify({
      baselineAmount: 3100,
      currentAmount: 2418,
      currentWindowMinutes: 60,
      threshold: 0.5,
      baselineLabel: "same day and same hour",
      baselineSampleCount: 5,
      hourOfDay: 7,
    }),
  },
  {
    id: "sample-history-1",
    type: "payment_failed",
    severity: "warning",
    message: "A temporary payment failure increase returned to normal.",
    stripeAccountId: "acct_sample_luma",
    accountName: "Luma Health Co",
    createdAt: new Date("2026-03-23T09:30:00Z"),
    windowEnd: new Date("2026-03-23T12:30:00Z"),
    context: JSON.stringify({
      failuresCounted: 7,
      failureThreshold: 5,
      failureWindowMinutes: 30,
    }),
  },
  {
    id: "sample-history-2",
    type: "revenue_drop",
    severity: "warning",
    message: "A short revenue dip recovered within the same business day.",
    stripeAccountId: "acct_sample_forge",
    accountName: "Forge Analytics",
    createdAt: new Date("2026-03-22T09:10:00Z"),
    windowEnd: new Date("2026-03-22T12:10:00Z"),
    context: JSON.stringify({
      baselineAmount: 2600,
      currentAmount: 1980,
      currentWindowMinutes: 60,
      threshold: 0.5,
      baselineLabel: "same day and same hour",
      baselineSampleCount: 5,
      hourOfDay: 9,
    }),
  },
];

function safeParseContext(input?: string | null) {
  if (!input) return null;

  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function formatMoneyAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
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

function fmtUtcHour(hour?: number | null) {
  if (typeof hour !== "number") return "Current UTC hour";
  return `${String(hour).padStart(2, "0")}:00 UTC`;
}

function fmtUtcDayAndHour(d?: Date | null) {
  if (!d) return "No event recorded";
  const date = new Date(d);
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(date);
  return `${day}, ${String(date.getUTCHours()).padStart(2, "0")}:00 UTC`;
}

function fmtUtcTime(d?: Date | null) {
  if (!d) return "No time";
  const date = new Date(d);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes()
  ).padStart(2, "0")} UTC`;
}

function alertLabel(type: string) {
  if (type === "revenue_drop") return "Revenue drop detected";
  if (type === "payment_failed") return "Payment failure spike";
  return type.replace(/_/g, " ");
}

function getSeverityLabel(severity?: string) {
  if (severity === "critical") return "Critical";
  return "Warning";
}

function formatContextMoney(parsed: Record<string, unknown>, value: number) {
  return formatMoneyAmount(parsed.amountUnit === "cents" ? value / 100 : value);
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

  const currentWindowMinutes =
    typeof parsed.currentWindowMinutes === "number"
      ? parsed.currentWindowMinutes
      : null;

  return {
    parsed,
    baselineAmount,
    currentAmount,
    dropRatio:
      typeof parsed.dropRatio === "number"
        ? parsed.dropRatio
        : (baselineAmount - currentAmount) / baselineAmount,
    threshold: typeof parsed.threshold === "number" ? parsed.threshold : 0.5,
    alertThresholdAmount:
      typeof parsed.alertThresholdAmount === "number"
        ? parsed.alertThresholdAmount
        : Math.round(baselineAmount * 0.5),
    baselineLabel:
      typeof parsed.baselineLabel === "string"
        ? parsed.baselineLabel
        : "matched historical windows",
    baselineSampleCount:
      typeof parsed.baselineSampleCount === "number"
        ? parsed.baselineSampleCount
        : null,
    windowLabel:
      currentWindowMinutes !== null
        ? `last ${currentWindowMinutes} minutes`
        : typeof parsed.window === "string"
          ? parsed.window
          : "current window",
    hourOfDay: typeof parsed.hourOfDay === "number" ? parsed.hourOfDay : null,
  };
}

function getPaymentFailureContext(alert?: AlertLike | null): PaymentFailureContext | null {
  if (!alert || alert.type !== "payment_failed") return null;

  const parsed = safeParseContext(alert.context);
  if (!parsed) return null;

  const failures =
    typeof parsed.failuresCounted === "number"
      ? parsed.failuresCounted
      : typeof parsed.failedPayments === "number"
        ? parsed.failedPayments
        : null;

  if (failures === null) return null;

  const failureWindowMinutes =
    typeof parsed.failureWindowMinutes === "number"
      ? parsed.failureWindowMinutes
      : null;

  return {
    failures,
    threshold:
      typeof parsed.failureThreshold === "number"
        ? parsed.failureThreshold
        : 5,
    windowLabel:
      failureWindowMinutes !== null
        ? `last ${failureWindowMinutes} minutes`
        : typeof parsed.window === "string"
          ? parsed.window
          : "recent window",
  };
}

function normalizeWindowLabel(windowLabel: string) {
  return windowLabel.replace(/^last /, "");
}

function getAccountDefaults(accountId: string) {
  const defaults: Record<string, { expectedRevenue: number; baselineFailures: number }> = {
    acct_sample_atlas: { expectedRevenue: 4200, baselineFailures: 3 },
    acct_sample_northstar: { expectedRevenue: 8200, baselineFailures: 3 },
    acct_sample_bluepeak: { expectedRevenue: 2200, baselineFailures: 2 },
    acct_sample_meridian: { expectedRevenue: 3100, baselineFailures: 2 },
    acct_sample_luma: { expectedRevenue: 2600, baselineFailures: 2 },
    acct_sample_forge: { expectedRevenue: 2100, baselineFailures: 2 },
    acct_sample_cedar: { expectedRevenue: 940, baselineFailures: 2 },
    acct_sample_pixel: { expectedRevenue: 980, baselineFailures: 2 },
    acct_sample_brightgrowth: { expectedRevenue: 1240, baselineFailures: 2 },
    acct_sample_nova: { expectedRevenue: 1800, baselineFailures: 2 },
  };

  return defaults[accountId] ?? { expectedRevenue: 2400, baselineFailures: 2 };
}

function buildReadableAlertMessage(alert: AlertLike) {
  const revenueContext = getRevenueContext(alert);
  if (revenueContext) {
    const dropPercent = Math.round(revenueContext.dropRatio * 100);

    return `Revenue is down ${dropPercent}% vs expected (${formatContextMoney(
      revenueContext.parsed,
      revenueContext.currentAmount
    )} vs ${formatContextMoney(
      revenueContext.parsed,
      revenueContext.baselineAmount
    )}) in the ${revenueContext.windowLabel}.`;
  }

  const paymentContext = getPaymentFailureContext(alert);
  if (paymentContext) {
    return `${formatCount(paymentContext.failures)} failed payments were detected in the ${paymentContext.windowLabel}, reaching the alert threshold of ${formatCount(paymentContext.threshold)}.`;
  }

  return alert.message ?? "Alert details unavailable.";
}

function buildTriggerReason(alert: AlertLike) {
  const revenueContext = getRevenueContext(alert);
  if (revenueContext) {
    const shortfall = revenueContext.baselineAmount - revenueContext.currentAmount;
    const reasons = [
      `Compared against ${revenueContext.baselineLabel}.`,
      `Expected ${formatContextMoney(revenueContext.parsed, revenueContext.baselineAmount)} in the ${revenueContext.windowLabel}.`,
      `Observed ${formatContextMoney(revenueContext.parsed, revenueContext.currentAmount)} instead.`,
      `Shortfall: ${formatContextMoney(revenueContext.parsed, shortfall)}.`,
    ];

    if (revenueContext.baselineSampleCount !== null) {
      reasons.push(
        `Baseline used ${formatCount(revenueContext.baselineSampleCount)} matching historical windows.`
      );
    }

    return reasons;
  }

  const paymentContext = getPaymentFailureContext(alert);
  if (paymentContext) {
    return [
      `Observed ${formatCount(paymentContext.failures)} failed payments in the ${paymentContext.windowLabel}.`,
      `Configured alert threshold is ${formatCount(paymentContext.threshold)} failed payments.`,
      "Payment failure alerts use a fixed spike threshold, not a historical baseline.",
    ];
  }

  return [];
}

function buildRevenueChartModel(
  accountId: string,
  topAlert: AlertLike | null,
  now: Date,
  demoMonitoring?: DemoMonitoringData | null
): RevenueChartModel {
  const revenueContext = getRevenueContext(topAlert);
  const defaults = getAccountDefaults(accountId);
  const amountIsCents = revenueContext?.parsed.amountUnit === "cents";
  const expectedValue = revenueContext
    ? amountIsCents
      ? revenueContext.baselineAmount / 100
      : revenueContext.baselineAmount
    : defaults.expectedRevenue;
  const actualValue = revenueContext
    ? amountIsCents
      ? revenueContext.currentAmount / 100
      : revenueContext.currentAmount
    : Math.round(expectedValue * 0.94);
  const threshold = revenueContext?.threshold ?? 0.5;
  const thresholdValue = Math.round(expectedValue * (1 - threshold));
  const activeHour =
    revenueContext?.hourOfDay ?? demoMonitoring?.activeHour ?? now.getUTCHours();

  const points = demoMonitoring
    ? demoMonitoring.revenuePoints.map((point) => ({ ...point }))
    : Array.from({ length: 24 }, (_, hour) => {
        const dayCurve = 0.86 + Math.sin((hour / 24) * Math.PI * 2 - 0.5) * 0.16;
        const workdayLift = hour >= 8 && hour <= 21 ? 1.1 : 0.74;
        const expected = Math.round(expectedValue * dayCurve * workdayLift);
        const distance = Math.min(Math.abs(hour - activeHour), 24 - Math.abs(hour - activeHour));
        const actual =
          revenueContext && distance <= 1
            ? Math.round(actualValue * (distance === 0 ? 1 : 1.08))
            : Math.round(expected * (0.92 + (hour % 5) * 0.03));

        return { hour, expected, actual };
      });

  points[activeHour] = {
    hour: activeHour,
    expected: expectedValue,
    actual: actualValue,
  };

  const actualValues = points.map((point) => point.actual);

  return {
    points,
    expectedValue,
    actualValue,
    thresholdValue,
    dropThreshold: threshold,
    peakValue: Math.max(...actualValues),
    lowValue: Math.min(...actualValues),
    activeHour,
    baselineLabel: revenueContext?.baselineLabel ?? "same day and same hour",
    windowLabel: revenueContext?.windowLabel ?? "current window",
    isAlerting: actualValue < thresholdValue,
  };
}

function buildFailureChartModel(
  paymentContext: PaymentFailureContext | null,
  lastEventAt?: Date | null,
  demoMonitoring?: DemoMonitoringData | null
): FailureChartModel {
  const demoFailures = demoMonitoring?.failurePoints.at(-1)?.failures;
  const failures = paymentContext?.failures ?? demoFailures ?? 0;
  const threshold = paymentContext?.threshold ?? demoMonitoring?.failureThreshold ?? 5;
  const activeMinute = 29;
  const windowMinutesMatch = paymentContext?.windowLabel.match(/\d+/);
  const windowMinutes = windowMinutesMatch ? Number(windowMinutesMatch[0]) : 30;
  const windowEnd = lastEventAt ? new Date(lastEventAt) : null;
  const windowStart = windowEnd
    ? new Date(windowEnd.getTime() - windowMinutes * 60 * 1000)
    : null;
  const points = demoMonitoring
    ? demoMonitoring.failurePoints.map((point) => ({ ...point }))
    : Array.from({ length: 30 }, (_, minute) => {
        const lateWindow = minute >= 22;
        const base = minute % 7 === 0 ? 1 : 0;
        const failuresAtMinute = lateWindow
          ? Math.max(1, Math.round((failures / 8) * (1 + ((minute - 22) % 3))))
          : base;

        return {
          minute,
          failures: Math.min(failuresAtMinute, failures),
        };
      });

  points[activeMinute] = {
    minute: activeMinute,
    failures,
  };

  return {
    points,
    failures,
    threshold,
    windowLabel: paymentContext?.windowLabel ?? "last 30 minutes",
    peakFailures: Math.max(...points.map((point) => point.failures)),
    activeMinute,
    windowStartLabel: fmtUtcTime(windowStart),
    windowEndLabel: fmtUtcTime(windowEnd),
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

function buildMoneyTicks(maxValue: number) {
  const rawTicks = [0, maxValue * 0.33, maxValue * 0.66, maxValue];

  return rawTicks.map((value) => {
    if (value === 0) return 0;
    const rounded = Math.ceil(value / 500) * 500;
    return Math.max(500, rounded);
  });
}

function FailureChart({ model }: { model: FailureChartModel }) {
  const maxValue = Math.max(model.peakFailures, model.threshold) * 1.25;

  return (
    <>
      <div className={styles.failureChartWrap}>
        <div
          className={styles.failureThresholdLine}
          style={{
            bottom: `${Math.min(86, Math.max(12, (model.threshold / maxValue) * 100))}%`,
          }}
        />
        <div
          className={styles.failureThreshold}
        >
          Threshold: {formatCount(model.threshold)}
        </div>

        <div className={styles.failureBars} aria-label="Failed payments over the current window">
          {model.points.map((point) => {
            const isActive = point.minute === model.activeMinute;
            const height = Math.max(8, (point.failures / maxValue) * 100);

            return (
              <div key={point.minute} className={styles.failureBarSlot}>
                <span
                  className={isActive ? styles.failureBarActive : styles.failureBar}
                  style={{ height: `${height}%` }}
                  title={`${formatCount(point.failures)} failures`}
                />
              </div>
            );
          })}
        </div>

        <div className={styles.failureTimeAxis}>
          <span>{model.windowStartLabel}</span>
          <span>{model.windowEndLabel}</span>
        </div>
      </div>

      <div className={styles.chartFooter}>
        <div className={styles.legend}>
          <span>
            <i className={styles.legendRed} /> Failed payments
          </span>
          <span>
            <i className={styles.legendGray} /> Threshold
          </span>
        </div>
      </div>
    </>
  );
}

function MonitorInsightPanel({
  model,
  topAlert,
  revenueContext,
  paymentContext,
  lastEventAt,
}: {
  model: RevenueChartModel;
  topAlert: AlertLike | null;
  revenueContext: RevenueContext | null;
  paymentContext: PaymentFailureContext | null;
  lastEventAt?: Date | null;
}) {
  const isPaymentFailure = topAlert?.type === "payment_failed" && paymentContext;
  const isRevenueDrop = topAlert?.type === "revenue_drop" && revenueContext;

  const panelClassName = `${styles.monitorPanel} ${
    topAlert ? styles.monitorPanelIssue : styles.monitorPanelNormal
  }`;

  return (
    <aside className={panelClassName}>
      <div>
        <span className={styles.panelEyebrow}>
          <span className={styles.panelStatusDot} aria-hidden="true" />
          {topAlert ? "Current issue" : "Current state"}
        </span>
        <h3>
          {topAlert ? alertLabel(topAlert.type) : "Monitoring normally"}
        </h3>
        <p>
          {topAlert
            ? buildReadableAlertMessage(topAlert)
            : "RevenueWatch is checking this account in read-only mode."}
        </p>
      </div>

      <div className={styles.panelGrid}>
        {isPaymentFailure ? (
          <>
            <div className={styles.panelMetric}>
              <span>Failures seen</span>
              <strong className={styles.dangerText}>
                {formatCount(paymentContext.failures)}
              </strong>
            </div>
            <div className={styles.panelMetric}>
              <span>Alert threshold</span>
              <strong>{formatCount(paymentContext.threshold)}</strong>
            </div>
            <div className={styles.panelMetric}>
              <span>Measured over</span>
              <strong>{paymentContext.windowLabel}</strong>
            </div>
          </>
        ) : (
          <>
            <div className={styles.panelMetric}>
              <span>Actual revenue</span>
              <strong className={model.isAlerting ? styles.dangerText : undefined}>
                {formatMoneyAmount(model.actualValue)}
              </strong>
            </div>
            <div className={styles.panelMetric}>
              <span>Expected baseline</span>
              <strong>{formatMoneyAmount(model.expectedValue)}</strong>
            </div>
            <div className={styles.panelMetric}>
              <span>Alert if below</span>
              <strong>{formatMoneyAmount(model.thresholdValue)}</strong>
            </div>
          </>
        )}
      </div>

      {!isPaymentFailure ? (
        <div className={styles.panelContext}>
          <div>
            <span>Comparison basis</span>
            <strong>
              Compared against {model.baselineLabel} history
            </strong>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function AccountMonitor({
  model,
  topAlert,
  revenueContext,
  paymentContext,
  lastEventAt,
  demoMonitoring,
}: {
  model: RevenueChartModel;
  topAlert: AlertLike | null;
  revenueContext: RevenueContext | null;
  paymentContext: PaymentFailureContext | null;
  lastEventAt?: Date | null;
  demoMonitoring?: DemoMonitoringData | null;
}) {
  const isPaymentFailure = topAlert?.type === "payment_failed" && paymentContext;
  const failureModel = isPaymentFailure
    ? buildFailureChartModel(paymentContext, lastEventAt, demoMonitoring)
    : null;
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
      ...model.points.map((point) => Math.round(point.expected * (1 - model.dropThreshold))),
      model.thresholdValue
    ) * 1.18;

  const x = (hour: number) => plot.left + (hour / 23) * plotWidth;
  const y = (value: number) => plot.bottom - (value / maxValue) * plotHeight;
  const actualCoordinates = model.points.map((point) => ({
    x: x(point.hour),
    y: y(point.actual),
  }));
  const expectedCoordinates = model.points.map((point) => ({
    x: x(point.hour),
    y: y(point.expected),
  }));
  const thresholdCoordinates = model.points.map((point) => ({
    x: x(point.hour),
    y: y(Math.round(point.expected * (1 - model.dropThreshold))),
  }));
  const actualPath = buildSmoothPath(actualCoordinates);
  const expectedPath = buildSmoothPath(expectedCoordinates);
  const thresholdPath = buildSmoothPath(thresholdCoordinates);
  const activePoint = model.points[model.activeHour];
  const yTicks = buildMoneyTicks(maxValue);
  const xTicks = [0, 6, 12, 18, 23];
  const monitorTitle = isPaymentFailure
    ? "Payment Failure Monitor"
    : "Revenue Monitor (24h)";
  const monitorDescription = isPaymentFailure
    ? `Failed payment events counted during the current ${normalizeWindowLabel(
        paymentContext.windowLabel
      )} monitoring window. RevenueWatch triggers when the fixed threshold is reached.`
    : "Actual revenue against the historical baseline for the same day and hour.";
  const monitorMeta = failureModel
    ? `Current window: ${failureModel.windowStartLabel} - ${failureModel.windowEndLabel}`
    : `Time context: ${fmtUtcHour(model.activeHour)}`;

  return (
    <section className={styles.chartCard}>
      <div className={styles.chartLayout}>
        <div className={styles.chartMain}>
          <div className={styles.chartHeader}>
            <div>
              <h2>{monitorTitle}</h2>
              <p>{monitorDescription}</p>
              <div className={styles.chartMeta}>{monitorMeta}</div>
            </div>
            <span className={styles.liveBadge}>
              <span />
              Live stream
            </span>
          </div>

          {failureModel ? (
            <FailureChart model={failureModel} />
          ) : (
            <>
              <div className={styles.chartWrap}>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="none"
              className={styles.chartSvg}
              role="img"
              aria-label="Revenue chart showing actual revenue, expected baseline, and alert threshold"
            >
              <defs>
                <linearGradient id="accountChartFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#0058bc" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#0058bc" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="thresholdZone" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#ba1a1a" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#ba1a1a" stopOpacity="0" />
                </linearGradient>
              </defs>
              {yTicks.map((tick, index) => {
                const tickY = y(tick);

                return (
                  <g key={`${tick}-${index}`}>
                    <line
                      x1={plot.left}
                      x2={plot.right}
                      y1={tickY}
                      y2={tickY}
                      className={styles.gridLine}
                    />
                    <text
                      x={plot.left - 14}
                      y={tickY + 4}
                      textAnchor="end"
                      className={styles.axisLabel}
                    >
                      {formatMoneyAmount(tick)}
                    </text>
                  </g>
                );
              })}
              {xTicks.map((tick) => (
                <text
                  key={tick}
                  x={x(tick)}
                  y={height - 12}
                  textAnchor={tick === 0 ? "start" : tick === 23 ? "end" : "middle"}
                  className={styles.axisLabel}
                >
                  {fmtUtcHour(tick)}
                </text>
              ))}
              <line
                x1={x(activePoint.hour)}
                x2={x(activePoint.hour)}
                y1={plot.top}
                y2={plot.bottom}
                className={styles.activeHourLine}
              />
              <path
                d={`${actualPath} L${plot.right},${plot.bottom} L${plot.left},${plot.bottom} Z`}
                fill="url(#accountChartFill)"
              />
              <path d={expectedPath} className={styles.expectedPath} />
              <path d={thresholdPath} className={styles.thresholdLine} />
              <path d={actualPath} className={styles.actualPath} />
              <circle
                cx={x(activePoint.hour)}
                cy={y(activePoint.actual)}
                r="5"
                className={model.isAlerting ? styles.alertPoint : styles.activePoint}
              />
            </svg>
            <div
              className={styles.activeHourLabel}
              style={{ left: `${Math.max(3, Math.min(91, (x(activePoint.hour) / width) * 100))}%` }}
            >
              {fmtUtcHour(model.activeHour)}
            </div>
              </div>

              <div className={`${styles.chartFooter} ${styles.chartFooterCompact}`}>
                <div className={styles.legend}>
                  <span>
                    <i className={styles.legendBlue} /> Current
                  </span>
                  <span>
                    <i className={styles.legendGray} /> Expected baseline
                  </span>
                  <span>
                    <i className={styles.legendRed} /> Alert threshold
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <MonitorInsightPanel
          model={model}
          topAlert={topAlert}
          revenueContext={revenueContext}
          paymentContext={paymentContext}
          lastEventAt={lastEventAt}
        />
      </div>
    </section>
  );
}

function ActiveAlertRow({ alert, now }: { alert: AlertLike; now: Date }) {
  const isCritical = alert.severity === "critical";
  const reasons = buildTriggerReason(alert);
  const isPaymentFailure = alert.type === "payment_failed";
  const activeUntil =
    alert.windowEnd && alert.windowEnd > now
      ? ` - Active until ${fmtDate(alert.windowEnd)}`
      : "";

  return (
    <article className={styles.alertRow}>
      <div className={isCritical ? styles.alertIconCritical : styles.alertIconWarning}>
        !
      </div>
      <div>
        <h3>{alertLabel(alert.type)}</h3>
        <p>
          {isPaymentFailure
            ? "Open alert. Review recent failed payment events."
            : "Open alert. Review recent revenue activity."}
        </p>
        <span>{getSeverityLabel(alert.severity)} - Triggered {fmtDate(alert.createdAt)}{activeUntil}</span>
        {reasons.length > 0 && !isPaymentFailure ? (
          <ul className={styles.reasonList}>
            {reasons.slice(0, 3).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

function ResolvedAlertRow({ alert }: { alert: AlertLike }) {
  return (
    <article className={styles.resolvedRow}>
      <span className={styles.resolvedIcon}>OK</span>
      <div>
        <h3>{alertLabel(alert.type)}</h3>
        <p>{buildReadableAlertMessage(alert)}</p>
        <span>Ended {fmtDate(alert.windowEnd)}</span>
      </div>
    </article>
  );
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const demoAccount = demoAccounts.find((account) => account.stripeAccountId === accountId) ?? null;

  const [realAccount, realAlerts, realLastEvent] = demoAccount
    ? [null, [] as AlertLike[], null]
    : await Promise.all([
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

  const account = realAccount ?? demoAccount;
  const isDemo = !realAccount && !!demoAccount;
  const alerts = isDemo
    ? demoAlerts
        .filter((alert) => alert.stripeAccountId === accountId)
        .sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
        )
    : realAlerts;
  const lastEvent = isDemo
    ? (() => {
        const createdAt = demoLastEventByAccount.get(accountId);
        return createdAt ? { createdAt } : null;
      })()
    : realLastEvent;
  const now = isDemo ? DEMO_NOW : new Date();
  const activeAlerts = alerts.filter((alert) => alert.windowEnd && alert.windowEnd > now);
  const historicalAlerts = alerts.filter((alert) => !alert.windowEnd || alert.windowEnd <= now);
  const topAlert = activeAlerts[0] ?? null;
  const demoMonitoring = isDemo ? demoMonitoringByAccount[accountId] ?? null : null;
  const chartModel = buildRevenueChartModel(accountId, topAlert, now, demoMonitoring);
  const paymentContext = getPaymentFailureContext(topAlert);
  const revenueContext = getRevenueContext(topAlert);
  const accountName = account?.name ?? accountId;

  return (
    <main className={styles.page}>
      <Navbar />

      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <div className={styles.kickerRow}>
              <span className={activeAlerts.length > 0 ? styles.activeNode : styles.nominalNode}>
                {activeAlerts.length > 0 ? "Attention needed" : "Monitoring"}
              </span>
              <span className={styles.accountId}>ID: {accountId}</span>
            </div>
            <h1>
              {accountName} <span>Account details</span>
            </h1>
          </div>

          <div className={styles.actions}>
            <Link href="/dashboard" className={styles.secondaryAction}>
              Back to dashboard
            </Link>
            <Link href="/api/stripe/connect" className={styles.primaryAction}>
              Add account
            </Link>
          </div>
        </header>

        <AccountMonitor
          model={chartModel}
          topAlert={topAlert}
          revenueContext={revenueContext}
          paymentContext={paymentContext}
          lastEventAt={lastEvent?.createdAt}
          demoMonitoring={demoMonitoring}
        />

        <section className={styles.lowerGrid}>
          <div>
            <div className={styles.sectionHeading}>
              <h2>Active & Recent Alerts</h2>
              <span>{activeAlerts.length} flagged items</span>
            </div>

            <div className={styles.alertStack} id="current-alert">
              {activeAlerts.length > 0 ? (
                activeAlerts.map((alert) => (
                  <ActiveAlertRow key={alert.id ?? alert.type} alert={alert} now={now} />
                ))
              ) : (
                <div className={styles.emptyState}>
                  No active alerts for this account right now.
                </div>
              )}
            </div>
          </div>

          <div>
            <div className={styles.sectionHeading}>
              <h2>Resolved Alerts</h2>
              <span>Last known events</span>
            </div>

            <div className={styles.resolvedStack}>
              {historicalAlerts.length > 0 ? (
                historicalAlerts.map((alert) => (
                  <ResolvedAlertRow key={alert.id ?? alert.type} alert={alert} />
                ))
              ) : (
                <div className={styles.emptyState}>No resolved alerts yet.</div>
              )}
            </div>
          </div>
        </section>
      </div>

      <MarketingFooter />
    </main>
  );
}
