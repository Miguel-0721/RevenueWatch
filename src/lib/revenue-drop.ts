import { canTriggerAlert } from "@/lib/alert-guard";
import { getAlertSensitivityConfig, normalizeAlertSensitivity } from "@/lib/alert-sensitivity";
import { formatMoneyAmount, normalizeCurrencyCode } from "@/lib/currency";
import { sendAlertEmail } from "@/lib/notify";
import { prisma } from "@/lib/prisma";

type RevenueBaselineLevel =
  | "same_day_and_hour"
  | "same_day_type_and_hour"
  | "same_hour";

type RevenueMetricSample = {
  amount: number;
  periodEnd: Date;
};

type EvaluateRevenueDropArgs = {
  stripeAccountId: string;
  alertSensitivity?: string | null;
  now?: Date;
  source: "webhook" | "cron";
  triggerEventId?: string | null;
};

type RevenueDropEvaluationResult = {
  alertsCreated: number;
  alertsResolved: number;
  skipped: boolean;
};

function safeParseAlertContext(input?: string | null) {
  if (!input) return null;

  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function dayTypeDays(dayOfWeek: number) {
  return dayOfWeek === 0 || dayOfWeek === 6 ? [0, 6] : [1, 2, 3, 4, 5];
}

function revenueBaselineLabel(level: RevenueBaselineLevel) {
  if (level === "same_day_and_hour") return "same day and same hour";
  if (level === "same_day_type_and_hour") return "same weekday/weekend type and same hour";
  return "same hour";
}

function buildRevenueDropMessage({
  dropRatio,
  baselineLevel,
  baselineHours,
  baselineAmount,
  currentWindowMinutes,
  currentAmount,
  metricCurrency,
}: {
  dropRatio: number;
  baselineLevel: RevenueBaselineLevel;
  baselineHours: number;
  baselineAmount: number;
  currentWindowMinutes: number;
  currentAmount: number;
  metricCurrency: string;
}) {
  return `Revenue dropped by ${(dropRatio * 100).toFixed(0)}% compared to baseline.
Baseline (${revenueBaselineLabel(baselineLevel)}, last ${baselineHours}h): ${formatMoneyAmount(
    baselineAmount,
    metricCurrency
  )}
Current (${currentWindowMinutes} min): ${formatMoneyAmount(currentAmount, metricCurrency)}`;
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

function getRevenueDropStripeEventId({
  stripeAccountId,
  currentWindowStart,
}: {
  stripeAccountId: string;
  currentWindowStart: Date;
}) {
  return `internal:cron:revenue_drop:${stripeAccountId}:${currentWindowStart.toISOString()}`;
}

function getRevenueDropCooldownUntil(now: Date) {
  return new Date(now.getTime() + 12 * 60 * 60 * 1000);
}

export async function evaluateRevenueDropForAccount({
  stripeAccountId,
  alertSensitivity,
  now = new Date(),
  source,
  triggerEventId = null,
}: EvaluateRevenueDropArgs): Promise<RevenueDropEvaluationResult> {
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

  const currentRevenue = await prisma.revenueMetric.aggregate({
    _sum: { amount: true },
    where: {
      stripeAccountId,
      periodEnd: { gte: currentWindowStart },
      OR: [{ currency: metricCurrency }, { currency: null }],
    },
  });

  const currentAmount = currentRevenue._sum.amount ?? 0;

  const activeRevenueAlerts = await prisma.alert.findMany({
    where: {
      stripeAccountId,
      type: "revenue_drop",
      status: "active",
    },
    select: {
      id: true,
      context: true,
    },
  });

  const recoveredRevenueAlertIds = activeRevenueAlerts
    .filter((alert) => {
      const parsed = safeParseAlertContext(alert.context);
      return (
        parsed &&
        typeof parsed.alertThresholdAmount === "number" &&
        currentAmount >= parsed.alertThresholdAmount
      );
    })
    .map((alert) => alert.id);

  if (recoveredRevenueAlertIds.length > 0) {
    await prisma.alert.updateMany({
      where: { id: { in: recoveredRevenueAlertIds } },
      data: { status: "resolved" },
    });
  }

  const recentRevenueMetrics = await prisma.revenueMetric.findMany({
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
  });

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

  if (!selectedBaseline) {
    return {
      alertsCreated: 0,
      alertsResolved: recoveredRevenueAlertIds.length,
      skipped: true,
    };
  }

  const baselineAmount = selectedBaseline.amount;

  if (baselineAmount < config.minBaselineRevenue) {
    return {
      alertsCreated: 0,
      alertsResolved: recoveredRevenueAlertIds.length,
      skipped: true,
    };
  }

  const canUseCronZeroRevenueSilenceCheck =
    source === "cron" &&
    currentAmount === 0 &&
    selectedBaseline.sampleCount >= config.minSamples &&
    baselineAmount >= config.minBaselineRevenue;

  if (currentAmount < config.minCurrentRevenue && !canUseCronZeroRevenueSilenceCheck) {
    return {
      alertsCreated: 0,
      alertsResolved: recoveredRevenueAlertIds.length,
      skipped: true,
    };
  }

  const dropRatio = 1 - currentAmount / baselineAmount;
  const severity: "warning" | "critical" = dropRatio >= 0.8 ? "critical" : "warning";

  if (dropRatio < config.dropThreshold) {
    return {
      alertsCreated: 0,
      alertsResolved: recoveredRevenueAlertIds.length,
      skipped: true,
    };
  }

  const allowed = await canTriggerAlert({
    stripeAccountId,
    type: "revenue_drop",
  });

  if (!allowed) {
    return {
      alertsCreated: 0,
      alertsResolved: recoveredRevenueAlertIds.length,
      skipped: true,
    };
  }

  const revenueSeries = buildRevenueSeriesFromSnapshot({
    recentMetrics: recentRevenueMetrics,
    baselineAmount,
    currentAmount,
    now,
  });

  const nextMessage = buildRevenueDropMessage({
    dropRatio,
    baselineLevel: selectedBaseline.level,
    baselineHours: config.baselineHours,
    baselineAmount,
    currentWindowMinutes: config.revenueWindowMinutes,
    currentAmount,
    metricCurrency,
  });
  const nextContext = JSON.stringify({
    dropRatio,
    baselineHours: config.baselineHours,
    baselineAmount,
    baselineLevel: selectedBaseline.level,
    baselineLabel: revenueBaselineLabel(selectedBaseline.level),
    baselineSampleCount: selectedBaseline.sampleCount,
    currentWindowMinutes: config.revenueWindowMinutes,
    currentAmount,
    threshold: config.dropThreshold,
    alertThresholdAmount: Math.round(baselineAmount * (1 - config.dropThreshold)),
    amountUnit: "cents",
    currency: metricCurrency,
    dayOfWeek: nowDay,
    hourOfDay: nowHour,
    revenueSeries,
    source,
    triggerEventId,
  });

  const activeRevenueAlert = await prisma.alert.findFirst({
    where: {
      stripeAccountId,
      type: "revenue_drop",
      status: "active",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      severity: true,
    },
  });

  if (activeRevenueAlert) {
    if (activeRevenueAlert.severity === "warning" && severity === "critical") {
      await prisma.alert.update({
        where: {
          id: activeRevenueAlert.id,
        },
        data: {
          severity: "critical",
          message: nextMessage,
          context: nextContext,
        },
      });
    }

    return {
      alertsCreated: 0,
      alertsResolved: recoveredRevenueAlertIds.length,
      skipped: true,
    };
  }

  const stripeEventId =
    triggerEventId ?? getRevenueDropStripeEventId({ stripeAccountId, currentWindowStart });

  const alert = await prisma.alert.create({
    data: {
      type: "revenue_drop",
      severity,
      status: "active",
      stripeEventId,
      stripeAccountId,
      message: nextMessage,
      context: nextContext,
      windowStart: currentWindowStart,
      windowEnd: new Date(now.getTime() + config.revenueWindowMinutes * 60 * 1000),
      cooldownUntil: getRevenueDropCooldownUntil(now),
    },
  });

  await sendAlertEmail({
    type: alert.type,
    severity: alert.severity,
    message: alert.message,
    stripeAccountId: alert.stripeAccountId,
    detectedAt: alert.createdAt,
    context: alert.context,
  });

  return {
    alertsCreated: 1,
    alertsResolved: recoveredRevenueAlertIds.length,
    skipped: false,
  };
}

export function getConservativeAlertSensitivity() {
  return normalizeAlertSensitivity("conservative");
}
