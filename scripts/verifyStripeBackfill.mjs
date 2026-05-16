import { PrismaClient } from "@prisma/client";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

if (process.env.NODE_ENV === "production") {
  throw new Error("verifyStripeBackfill cannot run in production.");
}

const stripeAccountId = process.argv[2]?.trim();

if (!stripeAccountId) {
  throw new Error(
    "Missing stripeAccountId. Usage: npm run verify:stripe-backfill -- acct_..."
  );
}

const prisma = new PrismaClient();
const SUCCESS_PREFIX = "backfill:payment_intent.succeeded:";
const FAILURE_PREFIX = "backfill:payment_intent.payment_failed:";
const LIKELY_ENOUGH_HISTORY_SAMPLES = 5;

function isoOrNull(value) {
  return value ? value.toISOString() : null;
}

function safeParsePayload(payload) {
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function currencyBreakdown(rows) {
  const breakdown = new Map();

  for (const row of rows) {
    const currency = row.currency ?? "UNKNOWN";
    const current = breakdown.get(currency) ?? { count: 0, totalAmount: 0 };
    current.count += 1;
    current.totalAmount += row.amount;
    breakdown.set(currency, current);
  }

  return Object.fromEntries(
    Array.from(breakdown.entries()).sort(([a], [b]) => a.localeCompare(b))
  );
}

function baselineSummary(rows) {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentDay = now.getUTCDay();
  const sameDayAndHour = rows.filter(
    (row) => row.hourOfDay === currentHour && row.dayOfWeek === currentDay
  ).length;
  const sameDayTypeDays =
    currentDay === 0 || currentDay === 6 ? [0, 6] : [1, 2, 3, 4, 5];
  const sameDayTypeAndHour = rows.filter(
    (row) =>
      row.hourOfDay === currentHour &&
      row.dayOfWeek != null &&
      sameDayTypeDays.includes(row.dayOfWeek)
  ).length;
  const sameHour = rows.filter((row) => row.hourOfDay === currentHour).length;

  const likelyEnoughHistory =
    sameDayAndHour >= LIKELY_ENOUGH_HISTORY_SAMPLES ||
    sameDayTypeAndHour >= LIKELY_ENOUGH_HISTORY_SAMPLES ||
    sameHour >= LIKELY_ENOUGH_HISTORY_SAMPLES;

  return {
    currentUtcHour: currentHour,
    currentUtcDayOfWeek: currentDay,
    sameDayAndHourSamples: sameDayAndHour,
    sameDayTypeAndHourSamples: sameDayTypeAndHour,
    sameHourSamples: sameHour,
    likelyEnoughHistory,
  };
}

function duplicateHealth({
  successEvents,
  revenueMetrics,
}) {
  const successIds = successEvents.map((event) => event.stripeEventId);
  const distinctSuccessIds = new Set(successIds);

  const metricKeyCounts = new Map();
  for (const row of revenueMetrics) {
    const key = [
      row.amount,
      row.currency ?? "",
      row.createdAt.toISOString(),
      row.periodEnd.toISOString(),
    ].join("|");
    metricKeyCounts.set(key, (metricKeyCounts.get(key) ?? 0) + 1);
  }

  const obviousDuplicateRevenueMetrics = Array.from(metricKeyCounts.values()).filter(
    (count) => count > 1
  ).length;

  const matchedSuccessMetrics = successEvents.filter((event) => {
    const payload = safeParsePayload(event.payload);

    if (!payload || typeof payload.amountReceived !== "number") {
      return false;
    }

    const createdAt = new Date(event.createdAt).toISOString();
    const currency = String(payload.currency ?? "");

    return revenueMetrics.some(
      (row) =>
        row.amount === payload.amountReceived &&
        (row.currency ?? "") === currency &&
        row.createdAt.toISOString() === createdAt
    );
  }).length;

  return {
    duplicateSyntheticSuccessEventIds: successIds.length - distinctSuccessIds.size,
    obviousDuplicateRevenueMetricGroups: obviousDuplicateRevenueMetrics,
    matchedSuccessMetrics,
    successEventCount: successEvents.length,
    revenueMetricCount: revenueMetrics.length,
    healthy:
      successIds.length === distinctSuccessIds.size &&
      obviousDuplicateRevenueMetrics === 0,
  };
}

async function main() {
  const [
    stripeAccount,
    revenueMetrics,
    syntheticSuccessEvents,
    syntheticFailureEvents,
    webhookEvents,
  ] = await Promise.all([
    prisma.stripeAccount.findUnique({
      where: { stripeAccountId },
      select: {
        stripeAccountId: true,
        status: true,
        name: true,
        createdAt: true,
      },
    }),
    prisma.revenueMetric.findMany({
      where: { stripeAccountId },
      select: {
        amount: true,
        currency: true,
        periodEnd: true,
        hourOfDay: true,
        dayOfWeek: true,
        createdAt: true,
      },
      orderBy: {
        periodEnd: "asc",
      },
    }),
    prisma.stripeEvent.findMany({
      where: {
        stripeAccountId,
        stripeEventId: {
          startsWith: SUCCESS_PREFIX,
        },
      },
      select: {
        stripeEventId: true,
        payload: true,
        createdAt: true,
      },
    }),
    prisma.stripeEvent.findMany({
      where: {
        stripeAccountId,
        stripeEventId: {
          startsWith: FAILURE_PREFIX,
        },
      },
      select: {
        stripeEventId: true,
        createdAt: true,
      },
    }),
    prisma.stripeEvent.count({
      where: {
        stripeAccountId,
        NOT: [
          { stripeEventId: { startsWith: SUCCESS_PREFIX } },
          { stripeEventId: { startsWith: FAILURE_PREFIX } },
        ],
      },
    }),
  ]);

  const totalRevenueAmount = revenueMetrics.reduce((sum, row) => sum + row.amount, 0);
  const hourOfDayPopulated = revenueMetrics.filter(
    (row) => row.hourOfDay != null
  ).length;
  const dayOfWeekPopulated = revenueMetrics.filter(
    (row) => row.dayOfWeek != null
  ).length;

  const result = {
    stripeAccount: stripeAccount
      ? {
          stripeAccountId: stripeAccount.stripeAccountId,
          status: stripeAccount.status,
          name: stripeAccount.name,
          createdAt: isoOrNull(stripeAccount.createdAt),
        }
      : null,
    revenueMetrics: {
      count: revenueMetrics.length,
      totalAmount: totalRevenueAmount,
      earliestPeriodEnd: isoOrNull(revenueMetrics[0]?.periodEnd ?? null),
      latestPeriodEnd: isoOrNull(
        revenueMetrics[revenueMetrics.length - 1]?.periodEnd ?? null
      ),
      currencyBreakdown: currencyBreakdown(revenueMetrics),
      hourOfDayPopulated,
      dayOfWeekPopulated,
      hourOfDayPopulationHealthy:
        revenueMetrics.length === 0 || hourOfDayPopulated === revenueMetrics.length,
      dayOfWeekPopulationHealthy:
        revenueMetrics.length === 0 || dayOfWeekPopulated === revenueMetrics.length,
    },
    stripeEvents: {
      syntheticSuccessfulBackfillCount: syntheticSuccessEvents.length,
      syntheticFailedBackfillCount: syntheticFailureEvents.length,
      normalWebhookEventCount: webhookEvents,
    },
    duplicateHealth: duplicateHealth({
      successEvents: syntheticSuccessEvents,
      revenueMetrics,
    }),
    baselineReadiness: baselineSummary(revenueMetrics),
  };

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error("Failed to verify Stripe backfill:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
