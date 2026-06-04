import { Prisma } from "@prisma/client";
import Stripe from "stripe";
import { randomUUID } from "crypto";
import { formatMoneyAmount, normalizeCurrencyCode } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

const SNAPSHOT_WINDOW_DAYS = 30;
const SUBSCRIPTION_BACKFILL_PAGE_SIZE = 100;
const SUBSCRIPTION_BACKFILL_MAX_SUBSCRIPTIONS = 2000;
const DEV_SEED_PREFIX = "dev_seed";

type QueryClient = {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
  $executeRaw(query: Prisma.Sql): Promise<number>;
  alert: {
    upsert: typeof prisma.alert.upsert;
  };
};

type UpsertSubscriptionInput = {
  stripeAccountId: string;
  subscription: Stripe.Subscription;
  occurredAt?: Date | null;
};

type RecordSubscriptionHealthEventInput = {
  stripeEventId: string;
  stripeAccountId: string;
  type: string;
  occurredAt: Date;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  subscriptionStatus?: string | null;
  billingReason?: string | null;
  currency?: string | null;
  amountDue?: number | null;
  amountPaid?: number | null;
  estimatedMonthlyRevenue?: number;
};

type SubscriptionHealthCounts = {
  activeSubscriptions: number;
  trialingSubscriptions: number;
  pastDueSubscriptions: number;
  unpaidSubscriptions: number;
  canceledSubscriptions: number;
  newSubscriptions: number;
  cancellations: number;
  failedRenewalPayments: number;
  estimatedMonthlyRevenue: number;
  netSubscriptionMovement: number;
  windowStart: Date;
  windowEnd: Date;
};

export type SubscriptionHealthSnapshotCounts = SubscriptionHealthCounts;

export type SubscriptionHealthSummary = SubscriptionHealthSnapshotCounts & {
  currency: string;
};

export type SubscriptionHealthKpiPeriodMetrics = {
  failedRenewalsLast7Days: number;
  cancellationsLast7Days: number;
  netSubscriptionsThisMonth: number;
};

export type SubscriptionHealthTestScenario =
  | "basic-active"
  | "multiple-active"
  | "yearly-active"
  | "quantity-active"
  | "mixed-health"
  | "mixed-mrr"
  | "trend-subscription-drop"
  | "trend-cancellation-spike"
  | "trend-past-due-increase"
  | "trend-unpaid-subscription"
  | "smart-low-single-cancellation"
  | "smart-high-normal-cancellations"
  | "smart-high-cancellation-spike"
  | "smart-high-positive-net-movement"
  | "smart-failed-renewal-spike"
  | "smart-past-due-baseline-increase"
  | "smart-unpaid-baseline-increase"
  | "empty";

type SubscriptionHealthSnapshotRecord = SubscriptionHealthCounts & {
  id: string;
  snapshotKey: string;
  source: string;
};

type AccountActivityLevel = "low" | "medium" | "high";

type BaselineConfidence = "low" | "medium" | "high";

type SubscriptionHealthBaseline = {
  activityLevel: AccountActivityLevel;
  confidence: BaselineConfidence;
  daysObserved: number;
  avgDailyCancellations: number;
  avgDailyFailedRenewals: number;
  avgDailyNewSubscriptions: number;
  avgDailyNetSubscriptionMovement: number;
  avgPastDueSubscriptions: number;
  avgUnpaidSubscriptions: number;
  avgActiveSubscriptions: number;
  avgEstimatedMonthlyRevenue: number;
  estimatedMrrTrendRatio: number;
  currentDayCancellations: number;
  currentDayFailedRenewals: number;
  currentDayNewSubscriptions: number;
  currentDayNetSubscriptionMovement: number;
};

function toDateFromUnix(value?: number | null) {
  if (!value) return null;
  return new Date(value * 1000);
}

function getCustomerId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function getSubscriptionPrice(subscription: Stripe.Subscription) {
  return subscription.items.data[0]?.price ?? null;
}

function getSubscriptionQuantity(subscription: Stripe.Subscription) {
  return subscription.items.data[0]?.quantity ?? 1;
}

function normalizeRecurringAmountToMonthly({
  unitAmount,
  quantity,
  interval,
  intervalCount,
}: {
  unitAmount?: number | null;
  quantity?: number | null;
  interval?: Stripe.Price.Recurring.Interval | null;
  intervalCount?: number | null;
}) {
  const normalizedUnitAmount =
    typeof unitAmount === "number" && Number.isFinite(unitAmount)
      ? Math.max(0, Math.round(unitAmount))
      : 0;
  const normalizedQuantity =
    typeof quantity === "number" && Number.isFinite(quantity)
      ? Math.max(1, Math.round(quantity))
      : 1;
  const normalizedIntervalCount =
    typeof intervalCount === "number" && Number.isFinite(intervalCount)
      ? Math.max(1, Math.round(intervalCount))
      : 1;
  const totalAmount = normalizedUnitAmount * normalizedQuantity;

  if (!interval || totalAmount <= 0) {
    return 0;
  }

  if (interval === "month") {
    return Math.round(totalAmount / normalizedIntervalCount);
  }

  if (interval === "year") {
    return Math.round(totalAmount / (normalizedIntervalCount * 12));
  }

  if (interval === "week") {
    return Math.round((totalAmount * 52) / (normalizedIntervalCount * 12));
  }

  if (interval === "day") {
    return Math.round((totalAmount * 30) / normalizedIntervalCount);
  }

  return 0;
}

function calculateEstimatedMonthlyRevenue(subscription: Stripe.Subscription) {
  return subscription.items.data.reduce((total, item) => {
    return (
      total +
      normalizeRecurringAmountToMonthly({
        unitAmount: item.price.unit_amount,
        quantity: item.quantity ?? 1,
        interval: item.price.recurring?.interval ?? null,
        intervalCount: item.price.recurring?.interval_count ?? 1,
      })
    );
  }, 0);
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function diffUtcDays(start: Date, end: Date) {
  return Math.max(
    0,
    Math.round(
      (startOfUtcDay(end).getTime() - startOfUtcDay(start).getTime()) /
        (24 * 60 * 60 * 1000)
    )
  );
}

function getUtcDayKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function averageFromNumbers(values: number[], fallback = 0) {
  if (values.length === 0) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundMetric(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(2));
}

function getSubscriptionCancellationDate(
  subscription: Stripe.Subscription,
  fallbackDate: Date
) {
  return (
    toDateFromUnix(subscription.canceled_at) ??
    toDateFromUnix(subscription.ended_at) ??
    fallbackDate
  );
}

function buildSubscriptionCanceledAlertKey({
  stripeSubscriptionId,
  canceledAt,
}: {
  stripeSubscriptionId: string;
  canceledAt: Date;
}) {
  return `subscription_canceled:${stripeSubscriptionId}:${canceledAt.toISOString()}`;
}

function buildFailedRenewalAlertKey({
  stripeInvoiceId,
  stripeSubscriptionId,
}: {
  stripeInvoiceId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  if (stripeInvoiceId) {
  return `failed_renewal:${stripeInvoiceId}`;
  }

  return `failed_renewal:${stripeSubscriptionId ?? "unknown_subscription"}`;
}

function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function buildSubscriptionDropAlertKey({
  stripeAccountId,
  currentSnapshotKey,
}: {
  stripeAccountId: string;
  currentSnapshotKey: string;
}) {
  return `subscription_drop:${stripeAccountId}:${currentSnapshotKey}`;
}

function buildCancellationSpikeAlertKey({
  stripeAccountId,
  currentSnapshotKey,
}: {
  stripeAccountId: string;
  currentSnapshotKey: string;
}) {
  return `cancellation_spike:${stripeAccountId}:${currentSnapshotKey}`;
}

function buildPastDueIncreaseAlertKey({
  stripeAccountId,
  currentSnapshotKey,
}: {
  stripeAccountId: string;
  currentSnapshotKey: string;
}) {
  return `past_due_increase:${stripeAccountId}:${currentSnapshotKey}`;
}

function buildUnpaidSubscriptionAlertKey({
  stripeAccountId,
  currentSnapshotKey,
}: {
  stripeAccountId: string;
  currentSnapshotKey: string;
}) {
  return `unpaid_subscription:${stripeAccountId}:${currentSnapshotKey}`;
}

function buildFailedRenewalSpikeAlertKey({
  stripeAccountId,
  currentSnapshotKey,
}: {
  stripeAccountId: string;
  currentSnapshotKey: string;
}) {
  return `failed_renewal_spike:${stripeAccountId}:${currentSnapshotKey}`;
}

function buildUnpaidIncreaseAlertKey({
  stripeAccountId,
  currentSnapshotKey,
}: {
  stripeAccountId: string;
  currentSnapshotKey: string;
}) {
  return `unpaid_increase:${stripeAccountId}:${currentSnapshotKey}`;
}

function buildNegativeNetSubscriptionMovementAlertKey({
  stripeAccountId,
  currentSnapshotKey,
}: {
  stripeAccountId: string;
  currentSnapshotKey: string;
}) {
  return `negative_net_subscription_movement:${stripeAccountId}:${currentSnapshotKey}`;
}

function buildMeaningfulMrrDropAlertKey({
  stripeAccountId,
  currentSnapshotKey,
}: {
  stripeAccountId: string;
  currentSnapshotKey: string;
}) {
  return `meaningful_mrr_drop:${stripeAccountId}:${currentSnapshotKey}`;
}

function buildDevSeedId(kind: string, stripeAccountId: string, suffix: string) {
  return `${DEV_SEED_PREFIX}:${kind}:${stripeAccountId}:${suffix}`;
}

function buildDevSeedSnapshotKey(stripeAccountId: string) {
  return `${DEV_SEED_PREFIX}:snapshot:${stripeAccountId}`;
}

function classifyAccountActivity({
  avgActiveSubscriptions,
  avgDailySubscriptionEvents,
  avgDailyCancellations,
  avgDailyFailedRenewals,
}: {
  avgActiveSubscriptions: number;
  avgDailySubscriptionEvents: number;
  avgDailyCancellations: number;
  avgDailyFailedRenewals: number;
}): AccountActivityLevel {
  if (
    avgActiveSubscriptions >= 150 ||
    avgDailySubscriptionEvents >= 15 ||
    avgDailyCancellations >= 8 ||
    avgDailyFailedRenewals >= 4
  ) {
    return "high";
  }

  if (
    avgActiveSubscriptions >= 40 ||
    avgDailySubscriptionEvents >= 4 ||
    avgDailyCancellations >= 2 ||
    avgDailyFailedRenewals >= 1
  ) {
    return "medium";
  }

  return "low";
}

async function getSubscriptionHealthBaseline({
  client,
  stripeAccountId,
  currentSnapshot,
  windowEnd,
}: {
  client: QueryClient;
  stripeAccountId: string;
  currentSnapshot?: SubscriptionHealthSnapshotRecord | null;
  windowEnd?: Date;
}): Promise<SubscriptionHealthBaseline> {
  const baselineWindowEnd = windowEnd ?? currentSnapshot?.windowEnd ?? new Date();
  const currentDayStart = startOfUtcDay(baselineWindowEnd);
  const nextDayStart = addUtcDays(currentDayStart, 1);
  const baselineStart = addUtcDays(currentDayStart, -(SNAPSHOT_WINDOW_DAYS - 1));
  const currentDayKey = getUtcDayKey(currentDayStart);

  const [eventRows, snapshotRows] = await Promise.all([
    client.$queryRaw<
      Array<{
        day: Date | string;
        cancellations: number;
        failedRenewals: number;
        newSubscriptions: number;
      }>
    >(Prisma.sql`
      SELECT
        DATE("occurredAt") AS "day",
        SUM(CASE WHEN "type" = 'customer.subscription.deleted' THEN 1 ELSE 0 END)::int AS "cancellations",
        SUM(
          CASE
            WHEN "type" = 'invoice.payment_failed'
              AND ("stripeSubscriptionId" IS NOT NULL OR COALESCE("billingReason", '') LIKE 'subscription%')
            THEN 1
            ELSE 0
          END
        )::int AS "failedRenewals",
        SUM(CASE WHEN "type" = 'customer.subscription.created' THEN 1 ELSE 0 END)::int AS "newSubscriptions"
      FROM "SubscriptionHealthEvent"
      WHERE "stripeAccountId" = ${stripeAccountId}
        AND "occurredAt" >= ${baselineStart}
        AND "occurredAt" < ${nextDayStart}
      GROUP BY DATE("occurredAt")
      ORDER BY DATE("occurredAt") DESC
    `),
    client.$queryRaw<
      Array<{
        day: Date | string;
        activeSubscriptions: number;
        pastDueSubscriptions: number;
        unpaidSubscriptions: number;
        estimatedMonthlyRevenue: number;
        netSubscriptionMovement: number;
      }>
    >(Prisma.sql`
      WITH ranked AS (
        SELECT
          DATE("windowEnd") AS "day",
          "activeSubscriptions",
          "pastDueSubscriptions",
          "unpaidSubscriptions",
          "estimatedMonthlyRevenue",
          "netSubscriptionMovement",
          ROW_NUMBER() OVER (
            PARTITION BY DATE("windowEnd")
            ORDER BY "updatedAt" DESC, "createdAt" DESC
          ) AS "rowNumber"
        FROM "SubscriptionHealthSnapshot"
        WHERE "stripeAccountId" = ${stripeAccountId}
          AND "windowEnd" >= ${baselineStart}
          AND "windowEnd" < ${nextDayStart}
          ${currentSnapshot
            ? Prisma.sql`AND "id" <> ${currentSnapshot.id}`
            : Prisma.empty}
      )
      SELECT
        "day",
        "activeSubscriptions",
        "pastDueSubscriptions",
        "unpaidSubscriptions",
        "estimatedMonthlyRevenue",
        "netSubscriptionMovement"
      FROM ranked
      WHERE "rowNumber" = 1
      ORDER BY "day" DESC
    `),
  ]);

  const liveCountsRows =
    !currentSnapshot && snapshotRows.length === 0
      ? await client.$queryRaw<
          Array<{
            activeSubscriptions: number;
            pastDueSubscriptions: number;
            unpaidSubscriptions: number;
            estimatedMonthlyRevenue: number;
          }>
        >(Prisma.sql`
          SELECT
            COUNT(*) FILTER (WHERE "status" = 'active')::int AS "activeSubscriptions",
            COUNT(*) FILTER (WHERE "status" = 'past_due')::int AS "pastDueSubscriptions",
            COUNT(*) FILTER (WHERE "status" = 'unpaid')::int AS "unpaidSubscriptions",
            COALESCE(SUM(CASE WHEN "status" = 'active' THEN "estimatedMonthlyRevenue" ELSE 0 END), 0)::int AS "estimatedMonthlyRevenue"
          FROM "SubscriptionHealthSubscription"
          WHERE "stripeAccountId" = ${stripeAccountId}
        `)
      : [];
  const liveCounts = liveCountsRows[0];
  const snapshotFallback = currentSnapshot ?? snapshotRows[0] ?? null;

  const currentDayEvents = eventRows.find(
    (row) => getUtcDayKey(row.day) === currentDayKey
  );
  const baselineEventRows = eventRows.filter(
    (row) => getUtcDayKey(row.day) !== currentDayKey
  );
  const baselineSnapshotRows = snapshotRows.filter(
    (row) => getUtcDayKey(row.day) !== currentDayKey
  );
  const earliestObservedDate = [
    ...eventRows.map((row) =>
      typeof row.day === "string" ? new Date(row.day) : row.day
    ),
    ...snapshotRows.map((row) =>
      typeof row.day === "string" ? new Date(row.day) : row.day
    ),
  ].reduce<Date | null>((earliest, value) => {
    if (!earliest || value.getTime() < earliest.getTime()) {
      return value;
    }
    return earliest;
  }, null);
  const daysObserved = earliestObservedDate
    ? Math.min(
        SNAPSHOT_WINDOW_DAYS,
        diffUtcDays(earliestObservedDate, currentDayStart) + 1
      )
    : 1;
  const baselineDaysObserved = Math.max(1, daysObserved - 1);
  const confidence: BaselineConfidence =
    daysObserved >= 21 ? "high" : daysObserved >= 10 ? "medium" : "low";

  const avgDailyCancellations = roundMetric(
    baselineEventRows.reduce(
      (sum, row) => sum + Number(row.cancellations ?? 0),
      0
    ) / baselineDaysObserved
  );
  const avgDailyFailedRenewals = roundMetric(
    baselineEventRows.reduce(
      (sum, row) => sum + Number(row.failedRenewals ?? 0),
      0
    ) / baselineDaysObserved
  );
  const avgDailyNewSubscriptions = roundMetric(
    baselineEventRows.reduce(
      (sum, row) => sum + Number(row.newSubscriptions ?? 0),
      0
    ) / baselineDaysObserved
  );
  const avgDailyNetSubscriptionMovement = roundMetric(
    baselineEventRows.reduce(
      (sum, row) =>
        sum +
        (Number(row.newSubscriptions ?? 0) - Number(row.cancellations ?? 0)),
      0
    ) / baselineDaysObserved
  );

  const avgPastDueSubscriptions = roundMetric(
    averageFromNumbers(
      baselineSnapshotRows.map((row) => Number(row.pastDueSubscriptions ?? 0)),
      snapshotFallback?.pastDueSubscriptions ?? liveCounts?.pastDueSubscriptions ?? 0
    )
  );
  const avgUnpaidSubscriptions = roundMetric(
    averageFromNumbers(
      baselineSnapshotRows.map((row) => Number(row.unpaidSubscriptions ?? 0)),
      snapshotFallback?.unpaidSubscriptions ?? liveCounts?.unpaidSubscriptions ?? 0
    )
  );
  const avgActiveSubscriptions = roundMetric(
    averageFromNumbers(
      baselineSnapshotRows.map((row) => Number(row.activeSubscriptions ?? 0)),
      snapshotFallback?.activeSubscriptions ?? liveCounts?.activeSubscriptions ?? 0
    )
  );
  const avgEstimatedMonthlyRevenue = roundMetric(
    averageFromNumbers(
      baselineSnapshotRows.map((row) => Number(row.estimatedMonthlyRevenue ?? 0)),
      snapshotFallback?.estimatedMonthlyRevenue ?? liveCounts?.estimatedMonthlyRevenue ?? 0
    )
  );
  const latestBaselineRevenue =
    baselineSnapshotRows[0]?.estimatedMonthlyRevenue ??
    snapshotFallback?.estimatedMonthlyRevenue ??
    liveCounts?.estimatedMonthlyRevenue ??
    0;
  const currentRevenue =
    currentSnapshot?.estimatedMonthlyRevenue ??
    snapshotFallback?.estimatedMonthlyRevenue ??
    latestBaselineRevenue;
  const estimatedMrrTrendRatio =
    latestBaselineRevenue > 0
      ? roundMetric((currentRevenue - latestBaselineRevenue) / latestBaselineRevenue)
      : 0;

  const activityLevel = classifyAccountActivity({
    avgActiveSubscriptions,
    avgDailySubscriptionEvents:
      avgDailyNewSubscriptions +
      avgDailyCancellations +
      avgDailyFailedRenewals,
    avgDailyCancellations,
    avgDailyFailedRenewals,
  });

  const currentDayCancellations = Number(currentDayEvents?.cancellations ?? 0);
  const currentDayFailedRenewals = Number(currentDayEvents?.failedRenewals ?? 0);
  const currentDayNewSubscriptions = Number(currentDayEvents?.newSubscriptions ?? 0);

  return {
    activityLevel,
    confidence,
    daysObserved,
    avgDailyCancellations,
    avgDailyFailedRenewals,
    avgDailyNewSubscriptions,
    avgDailyNetSubscriptionMovement,
    avgPastDueSubscriptions,
    avgUnpaidSubscriptions,
    avgActiveSubscriptions,
    avgEstimatedMonthlyRevenue,
    estimatedMrrTrendRatio,
    currentDayCancellations,
    currentDayFailedRenewals,
    currentDayNewSubscriptions,
    currentDayNetSubscriptionMovement:
      currentDayNewSubscriptions - currentDayCancellations,
  };
}

function shouldCreateIndividualSubscriptionCanceledAlert(
  baseline: SubscriptionHealthBaseline
) {
  return baseline.activityLevel === "low";
}

function shouldCreateIndividualFailedRenewalAlert(
  baseline: SubscriptionHealthBaseline
) {
  return baseline.activityLevel === "low";
}

async function createSubscriptionDropAlert({
  client,
  stripeAccountId,
  previousSnapshot,
  currentSnapshot,
  baseline,
}: {
  client: QueryClient;
  stripeAccountId: string;
  previousSnapshot: SubscriptionHealthSnapshotRecord;
  currentSnapshot: SubscriptionHealthSnapshotRecord;
  baseline: SubscriptionHealthBaseline;
}) {
  const dropCount =
    previousSnapshot.activeSubscriptions - currentSnapshot.activeSubscriptions;
  const dropPercent = Math.round(
    (dropCount / previousSnapshot.activeSubscriptions) * 100
  );
  const message = `Active subscriptions dropped from ${previousSnapshot.activeSubscriptions} to ${currentSnapshot.activeSubscriptions}.`;

  await client.alert.upsert({
    where: {
      stripeEventId: buildSubscriptionDropAlertKey({
        stripeAccountId,
        currentSnapshotKey: currentSnapshot.snapshotKey,
      }),
    },
    update: {},
    create: {
      type: "subscription_drop",
      severity: "critical",
      status: "active",
      stripeAccountId,
      stripeEventId: buildSubscriptionDropAlertKey({
        stripeAccountId,
        currentSnapshotKey: currentSnapshot.snapshotKey,
      }),
      message,
      context: JSON.stringify({
        previousActiveSubscriptions: previousSnapshot.activeSubscriptions,
        currentActiveSubscriptions: currentSnapshot.activeSubscriptions,
        dropCount,
        dropPercent,
        baselineActiveSubscriptions: baseline.avgActiveSubscriptions,
        activityLevel: baseline.activityLevel,
        confidence: baseline.confidence,
        daysObserved: baseline.daysObserved,
        previousSnapshotId: previousSnapshot.id,
        previousSnapshotKey: previousSnapshot.snapshotKey,
        currentSnapshotId: currentSnapshot.id,
        currentSnapshotKey: currentSnapshot.snapshotKey,
        source: currentSnapshot.source,
        displayMessage: message,
      }),
      windowStart: currentSnapshot.windowStart,
      windowEnd: currentSnapshot.windowEnd,
    },
  });
}

async function createCancellationSpikeAlert({
  client,
  stripeAccountId,
  currentSnapshot,
  baseline,
}: {
  client: QueryClient;
  stripeAccountId: string;
  currentSnapshot: SubscriptionHealthSnapshotRecord;
  baseline: SubscriptionHealthBaseline;
}) {
  const multiplier =
    baseline.avgDailyCancellations > 0
      ? Number(
          (
            baseline.currentDayCancellations / baseline.avgDailyCancellations
          ).toFixed(2)
        )
      : null;
  const message = `Cancellations are higher than usual. This account usually sees about ${Math.round(
    baseline.avgDailyCancellations
  )} cancellations per day, but ${baseline.currentDayCancellations} were detected today.`;

  await client.alert.upsert({
    where: {
      stripeEventId: buildCancellationSpikeAlertKey({
        stripeAccountId,
        currentSnapshotKey: currentSnapshot.snapshotKey,
      }),
    },
    update: {},
    create: {
      type: "cancellation_spike",
      severity: "critical",
      status: "active",
      stripeAccountId,
      stripeEventId: buildCancellationSpikeAlertKey({
        stripeAccountId,
        currentSnapshotKey: currentSnapshot.snapshotKey,
      }),
      message,
      context: JSON.stringify({
        currentDayCancellations: baseline.currentDayCancellations,
        baselineDailyCancellations: baseline.avgDailyCancellations,
        multiplier,
        activityLevel: baseline.activityLevel,
        confidence: baseline.confidence,
        daysObserved: baseline.daysObserved,
        windowStart: currentSnapshot.windowStart.toISOString(),
        windowEnd: currentSnapshot.windowEnd.toISOString(),
        currentSnapshotId: currentSnapshot.id,
        currentSnapshotKey: currentSnapshot.snapshotKey,
        source: currentSnapshot.source,
        displayMessage: message,
      }),
      windowStart: currentSnapshot.windowStart,
      windowEnd: currentSnapshot.windowEnd,
    },
  });
}

async function createPastDueIncreaseAlert({
  client,
  stripeAccountId,
  previousSnapshot,
  currentSnapshot,
  baseline,
}: {
  client: QueryClient;
  stripeAccountId: string;
  previousSnapshot: SubscriptionHealthSnapshotRecord | null;
  currentSnapshot: SubscriptionHealthSnapshotRecord;
  baseline: SubscriptionHealthBaseline;
}) {
  const previousPastDueSubscriptions =
    previousSnapshot?.pastDueSubscriptions ?? 0;
  const currentPastDueSubscriptions = currentSnapshot.pastDueSubscriptions;
  const increaseCount =
    currentPastDueSubscriptions - previousPastDueSubscriptions;
  const message = `Past-due subscriptions increased from ${previousPastDueSubscriptions} to ${currentPastDueSubscriptions}.`;

  await client.alert.upsert({
    where: {
      stripeEventId: buildPastDueIncreaseAlertKey({
        stripeAccountId,
        currentSnapshotKey: currentSnapshot.snapshotKey,
      }),
    },
    update: {},
    create: {
      type: "past_due_increase",
      severity: "critical",
      status: "active",
      stripeAccountId,
      stripeEventId: buildPastDueIncreaseAlertKey({
        stripeAccountId,
        currentSnapshotKey: currentSnapshot.snapshotKey,
      }),
      message,
      context: JSON.stringify({
        previousPastDueSubscriptions,
        currentPastDueSubscriptions,
        increaseCount,
        baselinePastDueSubscriptions: baseline.avgPastDueSubscriptions,
        activityLevel: baseline.activityLevel,
        confidence: baseline.confidence,
        daysObserved: baseline.daysObserved,
        previousSnapshotKey: previousSnapshot?.snapshotKey ?? null,
        currentSnapshotKey: currentSnapshot.snapshotKey,
        source: currentSnapshot.source,
        displayMessage: message,
      }),
      windowStart: currentSnapshot.windowStart,
      windowEnd: currentSnapshot.windowEnd,
    },
  });
}

async function createUnpaidSubscriptionAlert({
  client,
  stripeAccountId,
  currentSnapshot,
}: {
  client: QueryClient;
  stripeAccountId: string;
  currentSnapshot: SubscriptionHealthSnapshotRecord;
}) {
  const unpaidSubscriptions = currentSnapshot.unpaidSubscriptions;
  const message =
    unpaidSubscriptions === 1
      ? "1 subscription is marked unpaid."
      : `${unpaidSubscriptions} subscriptions are marked unpaid.`;

  await client.alert.upsert({
    where: {
      stripeEventId: buildUnpaidSubscriptionAlertKey({
        stripeAccountId,
        currentSnapshotKey: currentSnapshot.snapshotKey,
      }),
    },
    update: {},
    create: {
      type: "unpaid_subscription",
      severity: "warning",
      status: "active",
      stripeAccountId,
      stripeEventId: buildUnpaidSubscriptionAlertKey({
        stripeAccountId,
        currentSnapshotKey: currentSnapshot.snapshotKey,
      }),
      message,
      context: JSON.stringify({
        unpaidSubscriptions,
        currentSnapshotKey: currentSnapshot.snapshotKey,
        source: currentSnapshot.source,
        displayMessage: message,
      }),
      windowStart: currentSnapshot.windowStart,
      windowEnd: currentSnapshot.windowEnd,
    },
  });
}

async function createFailedRenewalSpikeAlert({
  client,
  stripeAccountId,
  currentSnapshot,
  baseline,
}: {
  client: QueryClient;
  stripeAccountId: string;
  currentSnapshot: SubscriptionHealthSnapshotRecord;
  baseline: SubscriptionHealthBaseline;
}) {
  const message = `Failed renewals are higher than usual. This account usually sees about ${Math.round(
    baseline.avgDailyFailedRenewals
  )} failed renewals per day, but ${baseline.currentDayFailedRenewals} were detected today.`;

  await client.alert.upsert({
    where: {
      stripeEventId: buildFailedRenewalSpikeAlertKey({
        stripeAccountId,
        currentSnapshotKey: currentSnapshot.snapshotKey,
      }),
    },
    update: {},
    create: {
      type: "failed_renewal_spike",
      severity: "critical",
      status: "active",
      stripeAccountId,
      stripeEventId: buildFailedRenewalSpikeAlertKey({
        stripeAccountId,
        currentSnapshotKey: currentSnapshot.snapshotKey,
      }),
      message,
      context: JSON.stringify({
        baselineDailyFailedRenewals: baseline.avgDailyFailedRenewals,
        currentDayFailedRenewals: baseline.currentDayFailedRenewals,
        activityLevel: baseline.activityLevel,
        confidence: baseline.confidence,
        daysObserved: baseline.daysObserved,
        currentSnapshotKey: currentSnapshot.snapshotKey,
        source: currentSnapshot.source,
        displayMessage: message,
      }),
      windowStart: currentSnapshot.windowStart,
      windowEnd: currentSnapshot.windowEnd,
    },
  });
}

async function createUnpaidIncreaseAlert({
  client,
  stripeAccountId,
  previousSnapshot,
  currentSnapshot,
  baseline,
}: {
  client: QueryClient;
  stripeAccountId: string;
  previousSnapshot: SubscriptionHealthSnapshotRecord | null;
  currentSnapshot: SubscriptionHealthSnapshotRecord;
  baseline: SubscriptionHealthBaseline;
}) {
  const previousUnpaidSubscriptions = previousSnapshot?.unpaidSubscriptions ?? 0;
  const currentUnpaidSubscriptions = currentSnapshot.unpaidSubscriptions;
  const message = `Unpaid subscriptions are higher than usual. This account typically has about ${Math.round(
    baseline.avgUnpaidSubscriptions
  )} unpaid subscriptions, but ${currentUnpaidSubscriptions} are now marked unpaid.`;

  await client.alert.upsert({
    where: {
      stripeEventId: buildUnpaidIncreaseAlertKey({
        stripeAccountId,
        currentSnapshotKey: currentSnapshot.snapshotKey,
      }),
    },
    update: {},
    create: {
      type: "unpaid_increase",
      severity: "critical",
      status: "active",
      stripeAccountId,
      stripeEventId: buildUnpaidIncreaseAlertKey({
        stripeAccountId,
        currentSnapshotKey: currentSnapshot.snapshotKey,
      }),
      message,
      context: JSON.stringify({
        previousUnpaidSubscriptions,
        currentUnpaidSubscriptions,
        baselineUnpaidSubscriptions: baseline.avgUnpaidSubscriptions,
        activityLevel: baseline.activityLevel,
        confidence: baseline.confidence,
        daysObserved: baseline.daysObserved,
        currentSnapshotKey: currentSnapshot.snapshotKey,
        source: currentSnapshot.source,
        displayMessage: message,
      }),
      windowStart: currentSnapshot.windowStart,
      windowEnd: currentSnapshot.windowEnd,
    },
  });
}

async function createNegativeNetSubscriptionMovementAlert({
  client,
  stripeAccountId,
  currentSnapshot,
  baseline,
}: {
  client: QueryClient;
  stripeAccountId: string;
  currentSnapshot: SubscriptionHealthSnapshotRecord;
  baseline: SubscriptionHealthBaseline;
}) {
  const message = `Net subscription movement turned negative. This account added ${baseline.currentDayNewSubscriptions} subscriptions and lost ${baseline.currentDayCancellations} during the current period.`;

  await client.alert.upsert({
    where: {
      stripeEventId: buildNegativeNetSubscriptionMovementAlertKey({
        stripeAccountId,
        currentSnapshotKey: currentSnapshot.snapshotKey,
      }),
    },
    update: {},
    create: {
      type: "negative_net_subscription_movement",
      severity: "critical",
      status: "active",
      stripeAccountId,
      stripeEventId: buildNegativeNetSubscriptionMovementAlertKey({
        stripeAccountId,
        currentSnapshotKey: currentSnapshot.snapshotKey,
      }),
      message,
      context: JSON.stringify({
        currentDayNewSubscriptions: baseline.currentDayNewSubscriptions,
        currentDayCancellations: baseline.currentDayCancellations,
        currentDayNetSubscriptionMovement:
          baseline.currentDayNetSubscriptionMovement,
        baselineDailyNetSubscriptionMovement:
          baseline.avgDailyNetSubscriptionMovement,
        activityLevel: baseline.activityLevel,
        confidence: baseline.confidence,
        daysObserved: baseline.daysObserved,
        currentSnapshotKey: currentSnapshot.snapshotKey,
        source: currentSnapshot.source,
        displayMessage: message,
      }),
      windowStart: currentSnapshot.windowStart,
      windowEnd: currentSnapshot.windowEnd,
    },
  });
}

async function createMeaningfulMrrDropAlert({
  client,
  stripeAccountId,
  currentSnapshot,
  baseline,
}: {
  client: QueryClient;
  stripeAccountId: string;
  currentSnapshot: SubscriptionHealthSnapshotRecord;
  baseline: SubscriptionHealthBaseline;
}) {
  const baselineMrr = Math.round(baseline.avgEstimatedMonthlyRevenue);
  const currentMrr = currentSnapshot.estimatedMonthlyRevenue;
  const message = `Estimated MRR is lower than usual. This account typically sees about ${formatMoneyAmount(
    baselineMrr,
    "EUR"
  )} in monthly recurring revenue, but the latest snapshot is ${formatMoneyAmount(
    currentMrr,
    "EUR"
  )}.`;

  await client.alert.upsert({
    where: {
      stripeEventId: buildMeaningfulMrrDropAlertKey({
        stripeAccountId,
        currentSnapshotKey: currentSnapshot.snapshotKey,
      }),
    },
    update: {},
    create: {
      type: "meaningful_mrr_drop",
      severity: "critical",
      status: "active",
      stripeAccountId,
      stripeEventId: buildMeaningfulMrrDropAlertKey({
        stripeAccountId,
        currentSnapshotKey: currentSnapshot.snapshotKey,
      }),
      message,
      context: JSON.stringify({
        baselineEstimatedMonthlyRevenue: baseline.avgEstimatedMonthlyRevenue,
        currentEstimatedMonthlyRevenue: currentMrr,
        estimatedMrrTrendRatio: baseline.estimatedMrrTrendRatio,
        activityLevel: baseline.activityLevel,
        confidence: baseline.confidence,
        daysObserved: baseline.daysObserved,
        currentSnapshotKey: currentSnapshot.snapshotKey,
        source: currentSnapshot.source,
        displayMessage: message,
      }),
      windowStart: currentSnapshot.windowStart,
      windowEnd: currentSnapshot.windowEnd,
    },
  });
}

async function createSubscriptionCanceledAlert({
  client = prisma,
  stripeAccountId,
  stripeSubscriptionId,
  stripeCustomerId,
  status,
  estimatedMonthlyRevenue,
  currency,
  canceledAt,
  source,
}: {
  client?: QueryClient;
  stripeAccountId: string;
  stripeSubscriptionId: string;
  stripeCustomerId?: string | null;
  status: string;
  estimatedMonthlyRevenue: number;
  currency?: string | null;
  canceledAt: Date;
  source: "webhook" | "backfill";
}) {
  const normalizedCurrency = normalizeCurrencyCode(currency ?? "EUR");
  const alertKey = buildSubscriptionCanceledAlertKey({
    stripeSubscriptionId,
    canceledAt,
  });
  const baseline = await getSubscriptionHealthBaseline({
    client,
    stripeAccountId,
    windowEnd: canceledAt,
  });

  if (!shouldCreateIndividualSubscriptionCanceledAlert(baseline)) {
    return;
  }

  const message = `A customer canceled a subscription. Estimated monthly revenue impact: ${formatMoneyAmount(
    estimatedMonthlyRevenue,
    normalizedCurrency
  )}.`;

  await client.alert.upsert({
    where: { stripeEventId: alertKey },
    update: {},
    create: {
      type: "subscription_canceled",
      severity: "warning",
      status: "active",
      stripeAccountId,
      stripeEventId: alertKey,
      message,
      context: JSON.stringify({
        stripeSubscriptionId,
        stripeCustomerId: stripeCustomerId ?? null,
        status,
        estimatedMonthlyRevenue,
        currency: normalizedCurrency,
        canceledAt: canceledAt.toISOString(),
        activityLevel: baseline.activityLevel,
        confidence: baseline.confidence,
        avgDailyCancellations: baseline.avgDailyCancellations,
        source,
        displayMessage: message,
      }),
      windowStart: canceledAt,
      windowEnd: canceledAt,
    },
  });
}

export async function upsertFailedRenewalAlert({
  client = prisma,
  stripeAccountId,
  stripeInvoiceId,
  stripeSubscriptionId,
  stripeCustomerId,
  amountDue,
  amountPaid,
  currency,
  billingReason,
  occurredAt,
  source,
}: {
  client?: QueryClient;
  stripeAccountId: string;
  stripeInvoiceId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  amountDue?: number | null;
  amountPaid?: number | null;
  currency?: string | null;
  billingReason?: string | null;
  occurredAt: Date;
  source?: "webhook" | "dev";
}) {
  const normalizedCurrency = normalizeCurrencyCode(currency ?? "EUR");
  const amountAtRisk =
    typeof amountDue === "number" && amountDue > 0
      ? amountDue
      : typeof amountPaid === "number" && amountPaid > 0
        ? amountPaid
        : 0;
  let baseline: SubscriptionHealthBaseline | null = null;
  if (source !== "dev") {
    baseline = await getSubscriptionHealthBaseline({
      client,
      stripeAccountId,
      windowEnd: occurredAt,
    });

    if (!shouldCreateIndividualFailedRenewalAlert(baseline)) {
      return;
    }
  }

  const message = `A subscription renewal payment failed. Amount at risk: ${formatMoneyAmount(
    amountAtRisk,
    normalizedCurrency
  )}.`;

  await client.alert.upsert({
    where: {
      stripeEventId: buildFailedRenewalAlertKey({
        stripeInvoiceId,
        stripeSubscriptionId,
      }),
    },
    update: {},
    create: {
      type: "failed_renewal",
      severity: "warning",
      status: "active",
      stripeAccountId,
      stripeEventId: buildFailedRenewalAlertKey({
        stripeInvoiceId,
        stripeSubscriptionId,
      }),
      message,
      context: JSON.stringify({
        stripeInvoiceId: stripeInvoiceId ?? null,
        stripeSubscriptionId: stripeSubscriptionId ?? null,
        stripeCustomerId: stripeCustomerId ?? null,
        amountDue: amountDue ?? null,
        amountPaid: amountPaid ?? null,
        currency: normalizedCurrency,
        billingReason: billingReason ?? null,
        activityLevel: baseline?.activityLevel ?? "low",
        confidence: baseline?.confidence ?? "low",
        avgDailyFailedRenewals: baseline?.avgDailyFailedRenewals ?? 0,
        source: source ?? "webhook",
        displayMessage: message,
      }),
      windowStart: occurredAt,
      windowEnd: occurredAt,
    },
  });
}

async function countSingleValue(
  client: QueryClient,
  sql: Prisma.Sql
) {
  const rows = await client.$queryRaw<Array<{ count: number | bigint }>>(sql);
  const value = rows[0]?.count ?? 0;
  return typeof value === "bigint" ? Number(value) : Number(value);
}

export async function upsertSubscriptionHealthSubscription(
  client: QueryClient,
  input: UpsertSubscriptionInput
) {
  const { subscription, stripeAccountId } = input;
  const price = getSubscriptionPrice(subscription);
  const occurredAt =
    input.occurredAt ??
    toDateFromUnix(subscription.created) ??
    new Date();
  const stripeCustomerId = getCustomerId(subscription.customer);
  const quantity = getSubscriptionQuantity(subscription);
  const interval = price?.recurring?.interval ?? null;
  const intervalCount = price?.recurring?.interval_count ?? null;
  const unitAmount = price?.unit_amount ?? null;
  const estimatedMonthlyRevenue = calculateEstimatedMonthlyRevenue(subscription);
  const currentPeriodStart =
    toDateFromUnix((subscription as Stripe.Subscription & { current_period_start?: number }).current_period_start ?? null);
  const currentPeriodEnd =
    toDateFromUnix((subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end ?? null);

  await client.$executeRaw(Prisma.sql`
    INSERT INTO "SubscriptionHealthSubscription" (
      "id",
      "stripeSubscriptionId",
      "stripeAccountId",
      "stripeCustomerId",
      "status",
      "priceId",
      "currency",
      "interval",
      "intervalCount",
      "quantity",
      "unitAmount",
      "estimatedMonthlyRevenue",
      "cancelAtPeriodEnd",
      "currentPeriodStart",
      "currentPeriodEnd",
      "trialStart",
      "trialEnd",
      "canceledAt",
      "endedAt",
      "lastEventCreatedAt",
      "lastSyncedAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${subscription.id},
      ${stripeAccountId},
      ${stripeCustomerId},
      ${subscription.status},
      ${price?.id ?? null},
      ${normalizeCurrencyCode(price?.currency ?? subscription.currency ?? null)},
      ${interval},
      ${intervalCount},
      ${quantity},
      ${unitAmount},
      ${estimatedMonthlyRevenue},
      ${subscription.cancel_at_period_end},
      ${currentPeriodStart},
      ${currentPeriodEnd},
      ${toDateFromUnix(subscription.trial_start)},
      ${toDateFromUnix(subscription.trial_end)},
      ${toDateFromUnix(subscription.canceled_at)},
      ${toDateFromUnix(subscription.ended_at)},
      ${occurredAt},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("stripeSubscriptionId") DO UPDATE SET
      "stripeAccountId" = EXCLUDED."stripeAccountId",
      "stripeCustomerId" = EXCLUDED."stripeCustomerId",
      "status" = EXCLUDED."status",
      "priceId" = EXCLUDED."priceId",
      "currency" = EXCLUDED."currency",
      "interval" = EXCLUDED."interval",
      "intervalCount" = EXCLUDED."intervalCount",
      "quantity" = EXCLUDED."quantity",
      "unitAmount" = EXCLUDED."unitAmount",
      "estimatedMonthlyRevenue" = EXCLUDED."estimatedMonthlyRevenue",
      "cancelAtPeriodEnd" = EXCLUDED."cancelAtPeriodEnd",
      "currentPeriodStart" = EXCLUDED."currentPeriodStart",
      "currentPeriodEnd" = EXCLUDED."currentPeriodEnd",
      "trialStart" = EXCLUDED."trialStart",
      "trialEnd" = EXCLUDED."trialEnd",
      "canceledAt" = EXCLUDED."canceledAt",
      "endedAt" = EXCLUDED."endedAt",
      "lastEventCreatedAt" = EXCLUDED."lastEventCreatedAt",
      "lastSyncedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
  `);
}

export async function recordSubscriptionHealthEvent(
  client: QueryClient,
  input: RecordSubscriptionHealthEventInput
) {
  await client.$executeRaw(Prisma.sql`
    INSERT INTO "SubscriptionHealthEvent" (
      "id",
      "stripeEventId",
      "stripeAccountId",
      "stripeSubscriptionId",
      "stripeCustomerId",
      "type",
      "subscriptionStatus",
      "billingReason",
      "currency",
      "amountDue",
      "amountPaid",
      "estimatedMonthlyRevenue",
      "occurredAt",
      "createdAt"
    )
    VALUES (
      ${randomUUID()},
      ${input.stripeEventId},
      ${input.stripeAccountId},
      ${input.stripeSubscriptionId ?? null},
      ${input.stripeCustomerId ?? null},
      ${input.type},
      ${input.subscriptionStatus ?? null},
      ${input.billingReason ?? null},
      ${normalizeCurrencyCode(input.currency ?? null)},
      ${input.amountDue ?? null},
      ${input.amountPaid ?? null},
      ${input.estimatedMonthlyRevenue ?? 0},
      ${input.occurredAt},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("stripeEventId") DO NOTHING
  `);
}

export async function computeSubscriptionHealthCounts(
  client: QueryClient,
  stripeAccountId: string,
  windowEnd = new Date()
): Promise<SubscriptionHealthCounts> {
  const windowStart = new Date(windowEnd.getTime() - SNAPSHOT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [
    activeSubscriptions,
    trialingSubscriptions,
    pastDueSubscriptions,
    unpaidSubscriptions,
    canceledSubscriptions,
    newSubscriptions,
    cancellations,
    failedRenewalPayments,
  ] = await Promise.all([
    countSingleValue(
      client,
      Prisma.sql`SELECT COUNT(*) AS count FROM "SubscriptionHealthSubscription" WHERE "stripeAccountId" = ${stripeAccountId} AND "status" = 'active'`
    ),
    countSingleValue(
      client,
      Prisma.sql`SELECT COUNT(*) AS count FROM "SubscriptionHealthSubscription" WHERE "stripeAccountId" = ${stripeAccountId} AND "status" = 'trialing'`
    ),
    countSingleValue(
      client,
      Prisma.sql`SELECT COUNT(*) AS count FROM "SubscriptionHealthSubscription" WHERE "stripeAccountId" = ${stripeAccountId} AND "status" = 'past_due'`
    ),
    countSingleValue(
      client,
      Prisma.sql`SELECT COUNT(*) AS count FROM "SubscriptionHealthSubscription" WHERE "stripeAccountId" = ${stripeAccountId} AND "status" = 'unpaid'`
    ),
    countSingleValue(
      client,
      Prisma.sql`SELECT COUNT(*) AS count FROM "SubscriptionHealthSubscription" WHERE "stripeAccountId" = ${stripeAccountId} AND "status" = 'canceled'`
    ),
    countSingleValue(
      client,
      Prisma.sql`SELECT COUNT(*) AS count FROM "SubscriptionHealthEvent" WHERE "stripeAccountId" = ${stripeAccountId} AND "type" = 'customer.subscription.created' AND "occurredAt" >= ${windowStart} AND "occurredAt" <= ${windowEnd}`
    ),
    countSingleValue(
      client,
      Prisma.sql`SELECT COUNT(*) AS count FROM "SubscriptionHealthEvent" WHERE "stripeAccountId" = ${stripeAccountId} AND "type" = 'customer.subscription.deleted' AND "occurredAt" >= ${windowStart} AND "occurredAt" <= ${windowEnd}`
    ),
    countSingleValue(
      client,
      Prisma.sql`SELECT COUNT(*) AS count FROM "SubscriptionHealthEvent" WHERE "stripeAccountId" = ${stripeAccountId} AND "type" = 'invoice.payment_failed' AND ("stripeSubscriptionId" IS NOT NULL OR COALESCE("billingReason",'') LIKE 'subscription%') AND "occurredAt" >= ${windowStart} AND "occurredAt" <= ${windowEnd}`
    ),
  ]);

  const revenueRows = await client.$queryRaw<Array<{ total: number | bigint | null }>>(Prisma.sql`
    SELECT COALESCE(SUM("estimatedMonthlyRevenue"), 0) AS total
    FROM "SubscriptionHealthSubscription"
    WHERE "stripeAccountId" = ${stripeAccountId}
      AND "status" = 'active'
  `);
  const totalValue = revenueRows[0]?.total ?? 0;
  const estimatedMonthlyRevenue =
    typeof totalValue === "bigint" ? Number(totalValue) : Number(totalValue);

  return {
    activeSubscriptions,
    trialingSubscriptions,
    pastDueSubscriptions,
    unpaidSubscriptions,
    canceledSubscriptions,
    newSubscriptions,
    cancellations,
    failedRenewalPayments,
    estimatedMonthlyRevenue,
    netSubscriptionMovement: newSubscriptions - cancellations,
    windowStart,
    windowEnd,
  };
}

export async function upsertSubscriptionHealthSnapshot({
  client,
  stripeAccountId,
  snapshotKey,
  source,
  counts,
}: {
  client: QueryClient;
  stripeAccountId: string;
  snapshotKey: string;
  source: string;
  counts: SubscriptionHealthCounts;
}) {
  await client.$executeRaw(Prisma.sql`
    INSERT INTO "SubscriptionHealthSnapshot" (
      "id",
      "snapshotKey",
      "stripeAccountId",
      "source",
      "activeSubscriptions",
      "trialingSubscriptions",
      "pastDueSubscriptions",
      "unpaidSubscriptions",
      "canceledSubscriptions",
      "newSubscriptions",
      "cancellations",
      "failedRenewalPayments",
      "estimatedMonthlyRevenue",
      "netSubscriptionMovement",
      "windowStart",
      "windowEnd",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${snapshotKey},
      ${stripeAccountId},
      ${source},
      ${counts.activeSubscriptions},
      ${counts.trialingSubscriptions},
      ${counts.pastDueSubscriptions},
      ${counts.unpaidSubscriptions},
      ${counts.canceledSubscriptions},
      ${counts.newSubscriptions},
      ${counts.cancellations},
      ${counts.failedRenewalPayments},
      ${counts.estimatedMonthlyRevenue},
      ${counts.netSubscriptionMovement},
      ${counts.windowStart},
      ${counts.windowEnd},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("snapshotKey") DO UPDATE SET
      "source" = EXCLUDED."source",
      "activeSubscriptions" = EXCLUDED."activeSubscriptions",
      "trialingSubscriptions" = EXCLUDED."trialingSubscriptions",
      "pastDueSubscriptions" = EXCLUDED."pastDueSubscriptions",
      "unpaidSubscriptions" = EXCLUDED."unpaidSubscriptions",
      "canceledSubscriptions" = EXCLUDED."canceledSubscriptions",
      "newSubscriptions" = EXCLUDED."newSubscriptions",
      "cancellations" = EXCLUDED."cancellations",
      "failedRenewalPayments" = EXCLUDED."failedRenewalPayments",
      "estimatedMonthlyRevenue" = EXCLUDED."estimatedMonthlyRevenue",
      "netSubscriptionMovement" = EXCLUDED."netSubscriptionMovement",
      "windowStart" = EXCLUDED."windowStart",
      "windowEnd" = EXCLUDED."windowEnd",
      "updatedAt" = CURRENT_TIMESTAMP
  `);
}

async function getSubscriptionHealthSnapshotRecordByKey({
  client,
  snapshotKey,
}: {
  client: QueryClient;
  snapshotKey: string;
}): Promise<SubscriptionHealthSnapshotRecord | null> {
  const rows = await client.$queryRaw<Array<{
    id: string;
    snapshotKey: string;
    source: string;
    activeSubscriptions: number;
    trialingSubscriptions: number;
    pastDueSubscriptions: number;
    unpaidSubscriptions: number;
    canceledSubscriptions: number;
    newSubscriptions: number;
    cancellations: number;
    failedRenewalPayments: number;
    estimatedMonthlyRevenue: number;
    netSubscriptionMovement: number;
    windowStart: Date | null;
    windowEnd: Date | null;
  }>>(Prisma.sql`
    SELECT
      "id",
      "snapshotKey",
      "source",
      "activeSubscriptions",
      "trialingSubscriptions",
      "pastDueSubscriptions",
      "unpaidSubscriptions",
      "canceledSubscriptions",
      "newSubscriptions",
      "cancellations",
      "failedRenewalPayments",
      "estimatedMonthlyRevenue",
      "netSubscriptionMovement",
      "windowStart",
      "windowEnd"
    FROM "SubscriptionHealthSnapshot"
    WHERE "snapshotKey" = ${snapshotKey}
    LIMIT 1
  `);

  const row = rows[0];
  if (!row || !row.windowStart || !row.windowEnd) {
    return null;
  }

  return row as SubscriptionHealthSnapshotRecord;
}

async function getPreviousSubscriptionHealthSnapshotRecord({
  client,
  stripeAccountId,
  currentSnapshotId,
}: {
  client: QueryClient;
  stripeAccountId: string;
  currentSnapshotId: string;
}): Promise<SubscriptionHealthSnapshotRecord | null> {
  const rows = await client.$queryRaw<Array<{
    id: string;
    snapshotKey: string;
    source: string;
    activeSubscriptions: number;
    trialingSubscriptions: number;
    pastDueSubscriptions: number;
    unpaidSubscriptions: number;
    canceledSubscriptions: number;
    newSubscriptions: number;
    cancellations: number;
    failedRenewalPayments: number;
    estimatedMonthlyRevenue: number;
    netSubscriptionMovement: number;
    windowStart: Date | null;
    windowEnd: Date | null;
  }>>(Prisma.sql`
    SELECT
      "id",
      "snapshotKey",
      "source",
      "activeSubscriptions",
      "trialingSubscriptions",
      "pastDueSubscriptions",
      "unpaidSubscriptions",
      "canceledSubscriptions",
      "newSubscriptions",
      "cancellations",
      "failedRenewalPayments",
      "estimatedMonthlyRevenue",
      "netSubscriptionMovement",
      "windowStart",
      "windowEnd"
    FROM "SubscriptionHealthSnapshot"
    WHERE "stripeAccountId" = ${stripeAccountId}
      AND "id" <> ${currentSnapshotId}
    ORDER BY "updatedAt" DESC, "createdAt" DESC
    LIMIT 1
  `);

  const row = rows[0];
  if (!row || !row.windowStart || !row.windowEnd) {
    return null;
  }

  return row as SubscriptionHealthSnapshotRecord;
}

function shouldCreateSubscriptionDropAlert({
  previousSnapshot,
  currentSnapshot,
  baseline,
}: {
  previousSnapshot: SubscriptionHealthSnapshotRecord | null;
  currentSnapshot: SubscriptionHealthSnapshotRecord;
  baseline: SubscriptionHealthBaseline;
}) {
  if (!previousSnapshot) return false;
  if (previousSnapshot.activeSubscriptions < 5) return false;
  if (
    currentSnapshot.activeSubscriptions >= previousSnapshot.activeSubscriptions
  ) {
    return false;
  }

  const dropCount =
    previousSnapshot.activeSubscriptions - currentSnapshot.activeSubscriptions;
  const dropPercent = dropCount / previousSnapshot.activeSubscriptions;
  const baselineDropCount = Math.max(
    2,
    Math.round(baseline.avgActiveSubscriptions * 0.05)
  );
  const belowBaseline =
    baseline.avgActiveSubscriptions <= 0 ||
    currentSnapshot.activeSubscriptions <= baseline.avgActiveSubscriptions * 0.9;

  return dropPercent >= 0.2 && (dropCount >= baselineDropCount || belowBaseline);
}

function shouldCreateCancellationSpikeAlert({
  baseline,
}: {
  baseline: SubscriptionHealthBaseline;
}) {
  const currentCancellations = baseline.currentDayCancellations;
  if (currentCancellations < 3) return false;

  if (baseline.avgDailyCancellations > 0) {
    return (
      currentCancellations >= Math.ceil(baseline.avgDailyCancellations * 2) &&
      currentCancellations >=
        Math.ceil(baseline.avgDailyCancellations + Math.max(2, baseline.avgDailyCancellations * 0.5))
    );
  }

  return currentCancellations >= 5;
}

function shouldCreatePastDueIncreaseAlert({
  previousSnapshot,
  currentSnapshot,
  baseline,
}: {
  previousSnapshot: SubscriptionHealthSnapshotRecord | null;
  currentSnapshot: SubscriptionHealthSnapshotRecord;
  baseline: SubscriptionHealthBaseline;
}) {
  const previousPastDueSubscriptions =
    previousSnapshot?.pastDueSubscriptions ?? 0;
  const currentPastDueSubscriptions = currentSnapshot.pastDueSubscriptions;

  if (currentPastDueSubscriptions < 1) return false;
  if (previousPastDueSubscriptions === 0) {
    return (
      currentPastDueSubscriptions >=
      Math.max(
        1,
        Math.ceil(baseline.avgPastDueSubscriptions + 1)
      )
    );
  }

  const increaseCount =
    currentPastDueSubscriptions - previousPastDueSubscriptions;
  const aboveBaseline =
    currentPastDueSubscriptions >=
    Math.max(
      1,
      Math.ceil(baseline.avgPastDueSubscriptions + Math.max(1, baseline.avgPastDueSubscriptions * 0.75))
    );

  return aboveBaseline || (
    increaseCount >= 2 ||
    currentPastDueSubscriptions >= previousPastDueSubscriptions * 2
  );
}

function shouldCreateUnpaidSubscriptionAlert({
  currentSnapshot,
  baseline,
}: {
  currentSnapshot: SubscriptionHealthSnapshotRecord;
  baseline: SubscriptionHealthBaseline;
}) {
  if (baseline.activityLevel === "low") {
    return currentSnapshot.unpaidSubscriptions >= 1;
  }

  return false;
}

function shouldCreateUnpaidIncreaseAlert({
  previousSnapshot,
  currentSnapshot,
  baseline,
}: {
  previousSnapshot: SubscriptionHealthSnapshotRecord | null;
  currentSnapshot: SubscriptionHealthSnapshotRecord;
  baseline: SubscriptionHealthBaseline;
}) {
  if (currentSnapshot.unpaidSubscriptions < 1) return false;

  const previousUnpaidSubscriptions = previousSnapshot?.unpaidSubscriptions ?? 0;
  const increaseCount =
    currentSnapshot.unpaidSubscriptions - previousUnpaidSubscriptions;
  const aboveBaseline =
    currentSnapshot.unpaidSubscriptions >=
    Math.max(
      1,
      Math.ceil(baseline.avgUnpaidSubscriptions + Math.max(1, baseline.avgUnpaidSubscriptions))
    );

  return aboveBaseline || increaseCount >= 1;
}

function shouldCreateFailedRenewalSpikeAlert({
  baseline,
}: {
  baseline: SubscriptionHealthBaseline;
}) {
  if (baseline.currentDayFailedRenewals < 3) return false;

  if (baseline.avgDailyFailedRenewals > 0) {
    return (
      baseline.currentDayFailedRenewals >=
        Math.ceil(baseline.avgDailyFailedRenewals * 2) &&
      baseline.currentDayFailedRenewals >=
        Math.ceil(baseline.avgDailyFailedRenewals + Math.max(2, baseline.avgDailyFailedRenewals * 0.5))
    );
  }

  return baseline.currentDayFailedRenewals >= 3;
}

function shouldCreateNegativeNetSubscriptionMovementAlert({
  baseline,
}: {
  baseline: SubscriptionHealthBaseline;
}) {
  if (baseline.currentDayNetSubscriptionMovement >= 0) return false;

  return (
    Math.abs(baseline.currentDayNetSubscriptionMovement) >=
    Math.max(2, Math.ceil(Math.abs(baseline.avgDailyNetSubscriptionMovement)) + 2)
  );
}

function shouldCreateMeaningfulMrrDropAlert({
  currentSnapshot,
  baseline,
}: {
  currentSnapshot: SubscriptionHealthSnapshotRecord;
  baseline: SubscriptionHealthBaseline;
}) {
  if (baseline.avgEstimatedMonthlyRevenue <= 0) return false;

  const mrrDropAmount =
    baseline.avgEstimatedMonthlyRevenue - currentSnapshot.estimatedMonthlyRevenue;
  const thresholdAmount = Math.max(
    2000,
    Math.round(baseline.avgEstimatedMonthlyRevenue * 0.08)
  );

  return (
    currentSnapshot.estimatedMonthlyRevenue <=
      baseline.avgEstimatedMonthlyRevenue * 0.9 &&
    mrrDropAmount >= thresholdAmount
  );
}

async function evaluateSubscriptionHealthTrendAlerts({
  client,
  stripeAccountId,
  currentSnapshotKey,
}: {
  client: QueryClient;
  stripeAccountId: string;
  currentSnapshotKey: string;
}) {
  const currentSnapshot = await getSubscriptionHealthSnapshotRecordByKey({
    client,
    snapshotKey: currentSnapshotKey,
  });

  if (!currentSnapshot) {
    return;
  }

  const previousSnapshot = await getPreviousSubscriptionHealthSnapshotRecord({
    client,
    stripeAccountId,
    currentSnapshotId: currentSnapshot.id,
  });
  const baseline = await getSubscriptionHealthBaseline({
    client,
    stripeAccountId,
    currentSnapshot,
  });

  if (
    shouldCreateSubscriptionDropAlert({
      previousSnapshot,
      currentSnapshot,
      baseline,
    }) &&
    previousSnapshot
  ) {
    await createSubscriptionDropAlert({
      client,
      stripeAccountId,
      previousSnapshot,
      currentSnapshot,
      baseline,
    });
  }

  if (
    shouldCreateCancellationSpikeAlert({
      baseline,
    })
  ) {
    await createCancellationSpikeAlert({
      client,
      stripeAccountId,
      currentSnapshot,
      baseline,
    });
  }

  if (
    shouldCreatePastDueIncreaseAlert({
      previousSnapshot,
      currentSnapshot,
      baseline,
    })
  ) {
    await createPastDueIncreaseAlert({
      client,
      stripeAccountId,
      previousSnapshot,
      currentSnapshot,
      baseline,
    });
  }

  if (
    shouldCreateFailedRenewalSpikeAlert({
      baseline,
    })
  ) {
    await createFailedRenewalSpikeAlert({
      client,
      stripeAccountId,
      currentSnapshot,
      baseline,
    });
  }

  if (
    shouldCreateNegativeNetSubscriptionMovementAlert({
      baseline,
    })
  ) {
    await createNegativeNetSubscriptionMovementAlert({
      client,
      stripeAccountId,
      currentSnapshot,
      baseline,
    });
  }

  if (
    shouldCreateMeaningfulMrrDropAlert({
      currentSnapshot,
      baseline,
    })
  ) {
    await createMeaningfulMrrDropAlert({
      client,
      stripeAccountId,
      currentSnapshot,
      baseline,
    });
  }

  if (
    shouldCreateUnpaidIncreaseAlert({
      previousSnapshot,
      currentSnapshot,
      baseline,
    })
  ) {
    await createUnpaidIncreaseAlert({
      client,
      stripeAccountId,
      previousSnapshot,
      currentSnapshot,
      baseline,
    });
  } else if (
    shouldCreateUnpaidSubscriptionAlert({
      currentSnapshot,
      baseline,
    })
  ) {
    await createUnpaidSubscriptionAlert({
      client,
      stripeAccountId,
      currentSnapshot,
    });
  }
}

export async function syncSubscriptionHealthSnapshot({
  client,
  stripeAccountId,
  snapshotKey,
  source,
  windowEnd,
}: {
  client: QueryClient;
  stripeAccountId: string;
  snapshotKey: string;
  source: string;
  windowEnd?: Date;
}) {
  const counts = await computeSubscriptionHealthCounts(client, stripeAccountId, windowEnd);
  await upsertSubscriptionHealthSnapshot({
    client,
    stripeAccountId,
    snapshotKey,
    source,
    counts,
  });
  await evaluateSubscriptionHealthTrendAlerts({
    client,
    stripeAccountId,
    currentSnapshotKey: snapshotKey,
  });
  return counts;
}

export async function getLatestSubscriptionHealthSnapshotCounts({
  client = prisma,
  stripeAccountId,
}: {
  client?: QueryClient;
  stripeAccountId: string;
}) {
  const rows = await client.$queryRaw<Array<{
    activeSubscriptions: number;
    trialingSubscriptions: number;
    pastDueSubscriptions: number;
    unpaidSubscriptions: number;
    canceledSubscriptions: number;
    newSubscriptions: number;
    cancellations: number;
    failedRenewalPayments: number;
    estimatedMonthlyRevenue: number;
    netSubscriptionMovement: number;
    windowStart: Date | null;
    windowEnd: Date | null;
  }>>(Prisma.sql`
    SELECT
      "activeSubscriptions",
      "trialingSubscriptions",
      "pastDueSubscriptions",
      "unpaidSubscriptions",
      "canceledSubscriptions",
      "newSubscriptions",
      "cancellations",
      "failedRenewalPayments",
      "estimatedMonthlyRevenue",
      "netSubscriptionMovement",
      "windowStart",
      "windowEnd"
    FROM "SubscriptionHealthSnapshot"
    WHERE "stripeAccountId" = ${stripeAccountId}
    ORDER BY "updatedAt" DESC, "createdAt" DESC
    LIMIT 1
  `);

  const row = rows[0];
  if (!row || !row.windowStart || !row.windowEnd) {
    return null;
  }

  return row as SubscriptionHealthSnapshotCounts;
}

export async function getLatestSubscriptionHealthSummary({
  client = prisma,
  stripeAccountId,
}: {
  client?: QueryClient;
  stripeAccountId: string;
}): Promise<SubscriptionHealthSummary | null> {
  const counts = await getLatestSubscriptionHealthSnapshotCounts({
    client,
    stripeAccountId,
  });

  if (!counts) {
    return null;
  }

  const currencyRows = await client.$queryRaw<Array<{ currency: string | null }>>(Prisma.sql`
    SELECT "currency"
    FROM "SubscriptionHealthSubscription"
    WHERE "stripeAccountId" = ${stripeAccountId}
      AND "currency" IS NOT NULL
      AND "status" IN ('active', 'trialing', 'past_due', 'unpaid')
    ORDER BY "updatedAt" DESC, "createdAt" DESC
    LIMIT 1
  `);

  const fallbackCurrencyRows =
    currencyRows[0]?.currency
      ? currencyRows
      : await client.$queryRaw<Array<{ currency: string | null }>>(Prisma.sql`
          SELECT "currency"
          FROM "SubscriptionHealthSubscription"
          WHERE "stripeAccountId" = ${stripeAccountId}
            AND "currency" IS NOT NULL
          ORDER BY "updatedAt" DESC, "createdAt" DESC
          LIMIT 1
        `);

  return {
    ...counts,
    currency: normalizeCurrencyCode(fallbackCurrencyRows[0]?.currency ?? "EUR"),
  };
}

export async function getSubscriptionHealthKpiPeriodMetrics({
  client = prisma,
  stripeAccountId,
  now = new Date(),
}: {
  client?: QueryClient;
  stripeAccountId: string;
  now?: Date;
}): Promise<SubscriptionHealthKpiPeriodMetrics> {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = startOfUtcMonth(now);

  const [
    failedRenewalsLast7Days,
    cancellationsLast7Days,
    newSubscriptionsThisMonth,
    canceledSubscriptionsThisMonth,
  ] = await Promise.all([
    countSingleValue(
      client,
      Prisma.sql`SELECT COUNT(*) AS count
                 FROM "SubscriptionHealthEvent"
                 WHERE "stripeAccountId" = ${stripeAccountId}
                   AND "type" = 'invoice.payment_failed'
                   AND ("stripeSubscriptionId" IS NOT NULL OR COALESCE("billingReason",'') LIKE 'subscription%')
                   AND "occurredAt" >= ${sevenDaysAgo}
                   AND "occurredAt" <= ${now}`
    ),
    countSingleValue(
      client,
      Prisma.sql`SELECT COUNT(*) AS count
                 FROM "SubscriptionHealthEvent"
                 WHERE "stripeAccountId" = ${stripeAccountId}
                   AND "type" = 'customer.subscription.deleted'
                   AND "occurredAt" >= ${sevenDaysAgo}
                   AND "occurredAt" <= ${now}`
    ),
    countSingleValue(
      client,
      Prisma.sql`SELECT COUNT(*) AS count
                 FROM "SubscriptionHealthEvent"
                 WHERE "stripeAccountId" = ${stripeAccountId}
                   AND "type" = 'customer.subscription.created'
                   AND "occurredAt" >= ${monthStart}
                   AND "occurredAt" <= ${now}`
    ),
    countSingleValue(
      client,
      Prisma.sql`SELECT COUNT(*) AS count
                 FROM "SubscriptionHealthEvent"
                 WHERE "stripeAccountId" = ${stripeAccountId}
                   AND "type" = 'customer.subscription.deleted'
                   AND "occurredAt" >= ${monthStart}
                   AND "occurredAt" <= ${now}`
    ),
  ]);

  return {
    failedRenewalsLast7Days,
    cancellationsLast7Days,
    netSubscriptionsThisMonth:
      newSubscriptionsThisMonth - canceledSubscriptionsThisMonth,
  };
}

async function retrieveSubscriptionForInvoice({
  stripeAccountId,
  subscriptionId,
}: {
  stripeAccountId: string;
  subscriptionId: string;
}) {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId, {
      stripeAccount: stripeAccountId,
    });
  } catch {
    return null;
  }
}

export async function handleConnectedAccountSubscriptionHealthEvent({
  event,
  stripeAccountId,
}: {
  event: Stripe.Event;
  stripeAccountId: string;
}) {
  const occurredAt = new Date(event.created * 1000);

  await prisma.$transaction(async (tx) => {
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      await upsertSubscriptionHealthSubscription(tx, {
        stripeAccountId,
        subscription,
        occurredAt,
      });
      await recordSubscriptionHealthEvent(tx, {
        stripeEventId: event.id,
        stripeAccountId,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: getCustomerId(subscription.customer),
        type: event.type,
        subscriptionStatus: subscription.status,
        currency: subscription.currency ?? getSubscriptionPrice(subscription)?.currency ?? null,
        estimatedMonthlyRevenue: calculateEstimatedMonthlyRevenue(subscription),
        occurredAt,
      });
      await syncSubscriptionHealthSnapshot({
        client: tx,
        stripeAccountId,
        snapshotKey: `webhook:${event.id}`,
        source: "webhook",
        windowEnd: occurredAt,
      });

      if (event.type === "customer.subscription.deleted") {
        await createSubscriptionCanceledAlert({
          client: tx,
          stripeAccountId,
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: getCustomerId(subscription.customer),
          status: subscription.status,
          estimatedMonthlyRevenue: calculateEstimatedMonthlyRevenue(subscription),
          currency: subscription.currency ?? getSubscriptionPrice(subscription)?.currency ?? null,
          canceledAt: getSubscriptionCancellationDate(subscription, occurredAt),
          source: "webhook",
        });
      }
      return;
    }

    if (
      event.type === "invoice.payment_failed" ||
      event.type === "invoice.payment_succeeded"
    ) {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null;
      };
      const subscriptionId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id ?? null;
      const stripeCustomerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id ?? null;

      let estimatedMonthlyRevenue = 0;

      if (subscriptionId) {
        const liveSubscription = await retrieveSubscriptionForInvoice({
          stripeAccountId,
          subscriptionId,
        });

        if (liveSubscription) {
          estimatedMonthlyRevenue = calculateEstimatedMonthlyRevenue(liveSubscription);
          await upsertSubscriptionHealthSubscription(tx, {
            stripeAccountId,
            subscription: liveSubscription,
            occurredAt,
          });
        }
      }

      await recordSubscriptionHealthEvent(tx, {
        stripeEventId: event.id,
        stripeAccountId,
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId,
        type: event.type,
        billingReason: invoice.billing_reason ?? null,
        currency: invoice.currency ?? null,
        amountDue: invoice.amount_due ?? null,
        amountPaid: invoice.amount_paid ?? null,
        estimatedMonthlyRevenue,
        occurredAt,
      });

      await syncSubscriptionHealthSnapshot({
        client: tx,
        stripeAccountId,
        snapshotKey: `webhook:${event.id}`,
        source: "webhook",
        windowEnd: occurredAt,
      });

      if (event.type === "invoice.payment_failed" && subscriptionId) {
        await upsertFailedRenewalAlert({
          client: tx,
          stripeAccountId,
          stripeInvoiceId: invoice.id,
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId,
          amountDue: invoice.amount_due ?? null,
          amountPaid: invoice.amount_paid ?? null,
          currency: invoice.currency ?? null,
          billingReason: invoice.billing_reason ?? null,
          occurredAt,
          source: "webhook",
        });
      }
    }
  });
}

export async function backfillStripeAccountSubscriptions({
  stripeAccountId,
}: {
  stripeAccountId: string;
}) {
  let processedSubscriptions = 0;
  let importedSubscriptions = 0;
  let updatedSubscriptions = 0;
  let backfillIncomplete = false;

  const subscriptions = stripe.subscriptions.list(
    {
      status: "all",
      limit: SUBSCRIPTION_BACKFILL_PAGE_SIZE,
    },
    {
      stripeAccount: stripeAccountId,
    }
  );

  for await (const subscription of subscriptions) {
    processedSubscriptions += 1;

    if (processedSubscriptions > SUBSCRIPTION_BACKFILL_MAX_SUBSCRIPTIONS) {
      backfillIncomplete = true;
      break;
    }

    const existingRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "SubscriptionHealthSubscription"
      WHERE "stripeSubscriptionId" = ${subscription.id}
      LIMIT 1
    `);

    await upsertSubscriptionHealthSubscription(prisma, {
      stripeAccountId,
      subscription,
      occurredAt: toDateFromUnix(subscription.created) ?? new Date(),
    });

    if (subscription.status === "canceled") {
      await createSubscriptionCanceledAlert({
        client: prisma,
        stripeAccountId,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: getCustomerId(subscription.customer),
        status: subscription.status,
        estimatedMonthlyRevenue: calculateEstimatedMonthlyRevenue(subscription),
        currency: subscription.currency ?? getSubscriptionPrice(subscription)?.currency ?? null,
        canceledAt: getSubscriptionCancellationDate(
          subscription,
          toDateFromUnix(subscription.created) ?? new Date()
        ),
        source: "backfill",
      });
    }

    if (existingRows[0]) {
      updatedSubscriptions += 1;
    } else {
      importedSubscriptions += 1;
    }
  }

  const snapshotCounts = await syncSubscriptionHealthSnapshot({
    client: prisma,
    stripeAccountId,
    snapshotKey: `backfill:${stripeAccountId}:current`,
    source: "backfill",
  });

  return {
    processedSubscriptions,
    importedSubscriptions,
    updatedSubscriptions,
    snapshotCounts,
    backfillIncomplete,
  };
}

export async function clearDevSeedSubscriptionHealthTestState({
  stripeAccountId,
}: {
  stripeAccountId: string;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM "Alert"
      WHERE "stripeAccountId" = ${stripeAccountId}
        AND (
          "stripeEventId" LIKE ${`subscription_drop:${stripeAccountId}:${DEV_SEED_PREFIX}:%`}
          OR "stripeEventId" LIKE ${`cancellation_spike:${stripeAccountId}:${DEV_SEED_PREFIX}:%`}
          OR "stripeEventId" LIKE ${`failed_renewal_spike:${stripeAccountId}:${DEV_SEED_PREFIX}:%`}
          OR "stripeEventId" LIKE ${`past_due_increase:${stripeAccountId}:${DEV_SEED_PREFIX}:%`}
          OR "stripeEventId" LIKE ${`unpaid_subscription:${stripeAccountId}:${DEV_SEED_PREFIX}:%`}
          OR "stripeEventId" LIKE ${`unpaid_increase:${stripeAccountId}:${DEV_SEED_PREFIX}:%`}
          OR "stripeEventId" LIKE ${`negative_net_subscription_movement:${stripeAccountId}:${DEV_SEED_PREFIX}:%`}
          OR "stripeEventId" LIKE ${`meaningful_mrr_drop:${stripeAccountId}:${DEV_SEED_PREFIX}:%`}
          OR "stripeEventId" LIKE 'subscription_canceled:dev_seed:%'
          OR "stripeEventId" LIKE 'failed_renewal:dev_seed:%'
          OR "stripeEventId" LIKE 'failed_renewal:dev_failed_renewal_invoice:%'
        )
    `);

    await tx.$executeRaw(Prisma.sql`
      DELETE FROM "SubscriptionHealthEvent"
      WHERE "stripeAccountId" = ${stripeAccountId}
        AND (
          "stripeEventId" LIKE ${`${DEV_SEED_PREFIX}:%`}
          OR "stripeSubscriptionId" LIKE ${`${DEV_SEED_PREFIX}:%`}
          OR "stripeCustomerId" LIKE ${`${DEV_SEED_PREFIX}:%`}
        )
    `);

    await tx.$executeRaw(Prisma.sql`
      DELETE FROM "SubscriptionHealthSubscription"
      WHERE "stripeAccountId" = ${stripeAccountId}
        AND (
          "stripeSubscriptionId" LIKE ${`${DEV_SEED_PREFIX}:%`}
          OR "stripeCustomerId" LIKE ${`${DEV_SEED_PREFIX}:%`}
          OR "priceId" LIKE ${`${DEV_SEED_PREFIX}:%`}
        )
    `);

    await tx.$executeRaw(Prisma.sql`
      DELETE FROM "SubscriptionHealthSnapshot"
      WHERE "stripeAccountId" = ${stripeAccountId}
        AND "snapshotKey" LIKE ${`${DEV_SEED_PREFIX}:%`}
    `);
  });
}

export async function seedSubscriptionHealthTestState({
  stripeAccountId,
  scenario,
}: {
  stripeAccountId: string;
  scenario: Exclude<SubscriptionHealthTestScenario, "empty">;
}) {
  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const lastWeek = new Date(now);
  lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);
  const baselineWindowEnd = new Date(now);
  baselineWindowEnd.setUTCDate(baselineWindowEnd.getUTCDate() - 7);
  const baselineWindowStart = new Date(baselineWindowEnd);
  baselineWindowStart.setUTCDate(
    baselineWindowStart.getUTCDate() - SNAPSHOT_WINDOW_DAYS
  );

  await clearDevSeedSubscriptionHealthTestState({ stripeAccountId });

  const subscriptionRows: Array<{
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    status: string;
    interval: string;
    intervalCount: number;
    quantity: number;
    unitAmount: number;
    estimatedMonthlyRevenue: number;
    canceledAt: Date | null;
  }> = [];

  const eventRows: Array<{
    stripeEventId: string;
    stripeSubscriptionId: string | null;
    stripeCustomerId: string | null;
    type: string;
    billingReason: string | null;
    amountDue: number | null;
    amountPaid: number | null;
    estimatedMonthlyRevenue: number;
    occurredAt: Date;
  }> = [];

  const baselineSnapshots: Array<{
    snapshotKey: string;
    source: string;
    counts: SubscriptionHealthCounts;
  }> = [];
  const afterSyncActions: Array<
    (client: QueryClient, snapshotCounts: SubscriptionHealthCounts) => Promise<void>
  > = [];

  const pushSubscription = ({
    suffix,
    status,
    interval = "month",
    intervalCount = 1,
    quantity = 1,
    unitAmount = 3900,
    estimatedMonthlyRevenue = normalizeRecurringAmountToMonthly({
      unitAmount,
      quantity,
      interval: interval as Stripe.Price.Recurring.Interval,
      intervalCount,
    }),
    canceledAt = null,
  }: {
    suffix: string;
    status: string;
    interval?: string;
    intervalCount?: number;
    quantity?: number;
    unitAmount?: number;
    estimatedMonthlyRevenue?: number;
    canceledAt?: Date | null;
  }) => {
    subscriptionRows.push({
      stripeSubscriptionId: buildDevSeedId("subscription", stripeAccountId, suffix),
      stripeCustomerId: buildDevSeedId("customer", stripeAccountId, suffix),
      status,
      interval,
      intervalCount,
      quantity,
      unitAmount,
      estimatedMonthlyRevenue,
      canceledAt,
    });
  };

  const pushEvent = ({
    suffix,
    type,
    occurredAt,
    billingReason = null,
    amountDue = null,
    amountPaid = null,
    estimatedMonthlyRevenue = 0,
  }: {
    suffix: string;
    type: string;
    occurredAt: Date;
    billingReason?: string | null;
    amountDue?: number | null;
    amountPaid?: number | null;
    estimatedMonthlyRevenue?: number;
  }) => {
    eventRows.push({
      stripeEventId: buildDevSeedId("event", stripeAccountId, suffix),
      stripeSubscriptionId: buildDevSeedId("subscription", stripeAccountId, suffix),
      stripeCustomerId: buildDevSeedId("customer", stripeAccountId, suffix),
      type,
      billingReason,
      amountDue,
      amountPaid,
      estimatedMonthlyRevenue,
      occurredAt,
    });
  };

  const pushDailyEvents = ({
    prefix,
    type,
    dayOffsets,
    amountDue = null,
    estimatedMonthlyRevenue = 0,
    billingReason = null,
  }: {
    prefix: string;
    type: string;
    dayOffsets: Array<{ daysAgo: number; count: number }>;
    amountDue?: number | null;
    estimatedMonthlyRevenue?: number;
    billingReason?: string | null;
  }) => {
    for (const bucket of dayOffsets) {
      for (let index = 1; index <= bucket.count; index += 1) {
        const occurredAt = new Date(now);
        occurredAt.setUTCDate(occurredAt.getUTCDate() - bucket.daysAgo);
        occurredAt.setUTCHours(10, index, 0, 0);
        pushEvent({
          suffix: `${prefix}-${bucket.daysAgo}-${index}`,
          type,
          occurredAt,
          billingReason,
          amountDue,
          estimatedMonthlyRevenue,
        });
      }
    }
  };

  if (scenario === "basic-active") {
    pushSubscription({ suffix: "active-1", status: "active" });
  }

  if (scenario === "multiple-active") {
    pushSubscription({ suffix: "active-1", status: "active" });
    pushSubscription({ suffix: "active-2", status: "active" });
    pushSubscription({ suffix: "active-3", status: "active" });
  }

  if (scenario === "yearly-active") {
    pushSubscription({
      suffix: "yearly-active-1",
      status: "active",
      interval: "year",
      intervalCount: 1,
      unitAmount: 12000,
    });
  }

  if (scenario === "quantity-active") {
    pushSubscription({
      suffix: "quantity-active-1",
      status: "active",
      interval: "month",
      intervalCount: 1,
      quantity: 3,
      unitAmount: 3900,
    });
  }

  if (scenario === "mixed-health") {
    pushSubscription({ suffix: "active-1", status: "active" });
    pushSubscription({ suffix: "active-2", status: "active" });
    pushSubscription({ suffix: "active-3", status: "active" });
    pushSubscription({ suffix: "trialing-1", status: "trialing" });
    pushSubscription({ suffix: "past-due-1", status: "past_due" });
    pushSubscription({ suffix: "unpaid-1", status: "unpaid" });
    pushSubscription({ suffix: "canceled-1", status: "canceled", canceledAt: lastWeek });
    pushSubscription({ suffix: "canceled-2", status: "canceled", canceledAt: lastWeek });

    eventRows.push({
      stripeEventId: buildDevSeedId("event", stripeAccountId, "failed-renewal-1"),
      stripeSubscriptionId: buildDevSeedId("subscription", stripeAccountId, "past-due-1"),
      stripeCustomerId: buildDevSeedId("customer", stripeAccountId, "past-due-1"),
      type: "invoice.payment_failed",
      billingReason: "subscription_cycle",
      amountDue: 3900,
      amountPaid: 0,
      estimatedMonthlyRevenue: 3900,
      occurredAt: now,
    });
  }

  if (scenario === "mixed-mrr") {
    pushSubscription({
      suffix: "monthly-active-1",
      status: "active",
      interval: "month",
      intervalCount: 1,
      unitAmount: 3900,
    });
    pushSubscription({
      suffix: "yearly-active-1",
      status: "active",
      interval: "year",
      intervalCount: 1,
      unitAmount: 12000,
    });
    pushSubscription({
      suffix: "quantity-active-1",
      status: "active",
      interval: "month",
      intervalCount: 1,
      quantity: 3,
      unitAmount: 3900,
    });
    pushSubscription({
      suffix: "trialing-1",
      status: "trialing",
      interval: "month",
      intervalCount: 1,
      unitAmount: 3900,
    });
    pushSubscription({
      suffix: "past-due-1",
      status: "past_due",
      interval: "month",
      intervalCount: 3,
      unitAmount: 11700,
    });
    pushSubscription({
      suffix: "unpaid-1",
      status: "unpaid",
      interval: "month",
      intervalCount: 1,
      unitAmount: 3900,
    });
    pushSubscription({
      suffix: "canceled-1",
      status: "canceled",
      interval: "year",
      intervalCount: 1,
      unitAmount: 24000,
      canceledAt: lastWeek,
    });

    eventRows.push({
      stripeEventId: buildDevSeedId("event", stripeAccountId, "failed-renewal-1"),
      stripeSubscriptionId: buildDevSeedId("subscription", stripeAccountId, "past-due-1"),
      stripeCustomerId: buildDevSeedId("customer", stripeAccountId, "past-due-1"),
      type: "invoice.payment_failed",
      billingReason: "subscription_cycle",
      amountDue: 3900,
      amountPaid: 0,
      estimatedMonthlyRevenue: 3900,
      occurredAt: now,
    });
  }

  if (scenario === "trend-subscription-drop") {
    for (let index = 1; index <= 7; index += 1) {
      pushSubscription({
        suffix: `active-${index}`,
        status: "active",
        interval: "month",
        intervalCount: 1,
        unitAmount: 3900,
      });
    }

    baselineSnapshots.push({
      snapshotKey: `${DEV_SEED_PREFIX}:baseline-subscription-drop:${stripeAccountId}`,
      source: "dev",
      counts: {
        activeSubscriptions: 10,
        trialingSubscriptions: 0,
        pastDueSubscriptions: 0,
        unpaidSubscriptions: 0,
        canceledSubscriptions: 0,
        newSubscriptions: 0,
        cancellations: 0,
        failedRenewalPayments: 0,
        estimatedMonthlyRevenue: 39000,
        netSubscriptionMovement: 0,
        windowStart: baselineWindowStart,
        windowEnd: baselineWindowEnd,
      },
    });
  }

  if (scenario === "trend-cancellation-spike") {
    for (let index = 1; index <= 5; index += 1) {
      eventRows.push({
        stripeEventId: buildDevSeedId(
          "event",
          stripeAccountId,
          `cancellation-${index}`
        ),
        stripeSubscriptionId: buildDevSeedId(
          "subscription",
          stripeAccountId,
          `cancellation-${index}`
        ),
        stripeCustomerId: buildDevSeedId(
          "customer",
          stripeAccountId,
          `cancellation-${index}`
        ),
        type: "customer.subscription.deleted",
        billingReason: null,
        amountDue: null,
        amountPaid: null,
        estimatedMonthlyRevenue: 0,
        occurredAt: now,
      });
    }

    baselineSnapshots.push({
      snapshotKey: `${DEV_SEED_PREFIX}:baseline-cancellation-spike:${stripeAccountId}`,
      source: "dev",
      counts: {
        activeSubscriptions: 10,
        trialingSubscriptions: 0,
        pastDueSubscriptions: 0,
        unpaidSubscriptions: 0,
        canceledSubscriptions: 0,
        newSubscriptions: 0,
        cancellations: 2,
        failedRenewalPayments: 0,
        estimatedMonthlyRevenue: 39000,
        netSubscriptionMovement: -2,
        windowStart: baselineWindowStart,
        windowEnd: baselineWindowEnd,
      },
    });
  }

  if (scenario === "trend-past-due-increase") {
    pushSubscription({
      suffix: "past-due-1",
      status: "past_due",
      interval: "month",
      intervalCount: 1,
      unitAmount: 3900,
    });
    pushSubscription({
      suffix: "past-due-2",
      status: "past_due",
      interval: "month",
      intervalCount: 1,
      unitAmount: 3900,
    });

    baselineSnapshots.push({
      snapshotKey: `${DEV_SEED_PREFIX}:baseline-past-due-increase:${stripeAccountId}`,
      source: "dev",
      counts: {
        activeSubscriptions: 10,
        trialingSubscriptions: 0,
        pastDueSubscriptions: 0,
        unpaidSubscriptions: 0,
        canceledSubscriptions: 0,
        newSubscriptions: 0,
        cancellations: 0,
        failedRenewalPayments: 0,
        estimatedMonthlyRevenue: 39000,
        netSubscriptionMovement: 0,
        windowStart: baselineWindowStart,
        windowEnd: baselineWindowEnd,
      },
    });
  }

  if (scenario === "trend-unpaid-subscription") {
    pushSubscription({
      suffix: "unpaid-1",
      status: "unpaid",
      interval: "month",
      intervalCount: 1,
      unitAmount: 3900,
    });
    pushSubscription({
      suffix: "unpaid-2",
      status: "unpaid",
      interval: "month",
      intervalCount: 1,
      unitAmount: 3900,
    });
  }

  if (scenario === "smart-low-single-cancellation") {
    for (let index = 1; index <= 5; index += 1) {
      pushSubscription({ suffix: `active-${index}`, status: "active" });
    }
    pushSubscription({
      suffix: "canceled-trigger",
      status: "canceled",
      canceledAt: now,
    });
    pushEvent({
      suffix: "single-cancellation-today",
      type: "customer.subscription.deleted",
      occurredAt: now,
    });

    afterSyncActions.push(async (client) => {
      await createSubscriptionCanceledAlert({
        client,
        stripeAccountId,
        stripeSubscriptionId: buildDevSeedId(
          "subscription",
          stripeAccountId,
          "canceled-trigger"
        ),
        stripeCustomerId: buildDevSeedId(
          "customer",
          stripeAccountId,
          "canceled-trigger"
        ),
        status: "canceled",
        estimatedMonthlyRevenue: 3900,
        currency: "eur",
        canceledAt: now,
        source: "webhook",
      });
    });
  }

  if (scenario === "smart-high-normal-cancellations") {
    for (let index = 1; index <= 120; index += 1) {
      pushSubscription({ suffix: `active-${index}`, status: "active" });
    }
    pushSubscription({
      suffix: "canceled-trigger",
      status: "canceled",
      canceledAt: now,
    });

    pushDailyEvents({
      prefix: "baseline-cancel",
      type: "customer.subscription.deleted",
      dayOffsets: [
        { daysAgo: 7, count: 8 },
        { daysAgo: 6, count: 8 },
        { daysAgo: 5, count: 7 },
        { daysAgo: 4, count: 9 },
        { daysAgo: 3, count: 8 },
        { daysAgo: 2, count: 8 },
        { daysAgo: 1, count: 8 },
        { daysAgo: 0, count: 8 },
      ],
    });
    pushDailyEvents({
      prefix: "baseline-new",
      type: "customer.subscription.created",
      dayOffsets: [
        { daysAgo: 7, count: 16 },
        { daysAgo: 6, count: 17 },
        { daysAgo: 5, count: 15 },
        { daysAgo: 4, count: 18 },
        { daysAgo: 3, count: 16 },
        { daysAgo: 2, count: 17 },
        { daysAgo: 1, count: 16 },
        { daysAgo: 0, count: 15 },
      ],
    });

    baselineSnapshots.push({
      snapshotKey: `${DEV_SEED_PREFIX}:baseline-smart-high-normal:${stripeAccountId}`,
      source: "dev",
      counts: {
        activeSubscriptions: 128,
        trialingSubscriptions: 10,
        pastDueSubscriptions: 2,
        unpaidSubscriptions: 1,
        canceledSubscriptions: 12,
        newSubscriptions: 480,
        cancellations: 240,
        failedRenewalPayments: 18,
        estimatedMonthlyRevenue: 499200,
        netSubscriptionMovement: 240,
        windowStart: baselineWindowStart,
        windowEnd: baselineWindowEnd,
      },
    });

    afterSyncActions.push(async (client) => {
      await createSubscriptionCanceledAlert({
        client,
        stripeAccountId,
        stripeSubscriptionId: buildDevSeedId(
          "subscription",
          stripeAccountId,
          "canceled-trigger"
        ),
        stripeCustomerId: buildDevSeedId(
          "customer",
          stripeAccountId,
          "canceled-trigger"
        ),
        status: "canceled",
        estimatedMonthlyRevenue: 3900,
        currency: "eur",
        canceledAt: now,
        source: "webhook",
      });
    });
  }

  if (scenario === "smart-high-cancellation-spike") {
    for (let index = 1; index <= 180; index += 1) {
      pushSubscription({ suffix: `active-${index}`, status: "active" });
    }

    pushDailyEvents({
      prefix: "spike-cancel",
      type: "customer.subscription.deleted",
      dayOffsets: [
        { daysAgo: 7, count: 8 },
        { daysAgo: 6, count: 7 },
        { daysAgo: 5, count: 8 },
        { daysAgo: 4, count: 9 },
        { daysAgo: 3, count: 8 },
        { daysAgo: 2, count: 7 },
        { daysAgo: 1, count: 8 },
        { daysAgo: 0, count: 21 },
      ],
    });
    pushDailyEvents({
      prefix: "spike-new",
      type: "customer.subscription.created",
      dayOffsets: [
        { daysAgo: 7, count: 18 },
        { daysAgo: 6, count: 17 },
        { daysAgo: 5, count: 19 },
        { daysAgo: 4, count: 18 },
        { daysAgo: 3, count: 17 },
        { daysAgo: 2, count: 18 },
        { daysAgo: 1, count: 18 },
        { daysAgo: 0, count: 15 },
      ],
    });

    baselineSnapshots.push({
      snapshotKey: `${DEV_SEED_PREFIX}:baseline-smart-high-spike:${stripeAccountId}`,
      source: "dev",
      counts: {
        activeSubscriptions: 196,
        trialingSubscriptions: 14,
        pastDueSubscriptions: 3,
        unpaidSubscriptions: 1,
        canceledSubscriptions: 15,
        newSubscriptions: 540,
        cancellations: 255,
        failedRenewalPayments: 21,
        estimatedMonthlyRevenue: 764400,
        netSubscriptionMovement: 285,
        windowStart: baselineWindowStart,
        windowEnd: baselineWindowEnd,
      },
    });
  }

  if (scenario === "smart-high-positive-net-movement") {
    for (let index = 1; index <= 220; index += 1) {
      pushSubscription({ suffix: `active-${index}`, status: "active" });
    }

    pushDailyEvents({
      prefix: "growth-cancel",
      type: "customer.subscription.deleted",
      dayOffsets: [
        { daysAgo: 7, count: 15 },
        { daysAgo: 6, count: 16 },
        { daysAgo: 5, count: 15 },
        { daysAgo: 4, count: 17 },
        { daysAgo: 3, count: 16 },
        { daysAgo: 2, count: 15 },
        { daysAgo: 1, count: 16 },
        { daysAgo: 0, count: 18 },
      ],
    });
    pushDailyEvents({
      prefix: "growth-new",
      type: "customer.subscription.created",
      dayOffsets: [
        { daysAgo: 7, count: 28 },
        { daysAgo: 6, count: 30 },
        { daysAgo: 5, count: 29 },
        { daysAgo: 4, count: 31 },
        { daysAgo: 3, count: 30 },
        { daysAgo: 2, count: 29 },
        { daysAgo: 1, count: 30 },
        { daysAgo: 0, count: 32 },
      ],
    });

    baselineSnapshots.push({
      snapshotKey: `${DEV_SEED_PREFIX}:baseline-smart-positive-net:${stripeAccountId}`,
      source: "dev",
      counts: {
        activeSubscriptions: 230,
        trialingSubscriptions: 20,
        pastDueSubscriptions: 2,
        unpaidSubscriptions: 1,
        canceledSubscriptions: 20,
        newSubscriptions: 840,
        cancellations: 448,
        failedRenewalPayments: 18,
        estimatedMonthlyRevenue: 858000,
        netSubscriptionMovement: 392,
        windowStart: baselineWindowStart,
        windowEnd: baselineWindowEnd,
      },
    });
  }

  if (scenario === "smart-failed-renewal-spike") {
    for (let index = 1; index <= 88; index += 1) {
      pushSubscription({ suffix: `active-${index}`, status: "active" });
    }

    pushDailyEvents({
      prefix: "failed-renewal",
      type: "invoice.payment_failed",
      dayOffsets: [
        { daysAgo: 7, count: 4 },
        { daysAgo: 6, count: 5 },
        { daysAgo: 5, count: 4 },
        { daysAgo: 4, count: 4 },
        { daysAgo: 3, count: 3 },
        { daysAgo: 2, count: 4 },
        { daysAgo: 1, count: 4 },
        { daysAgo: 0, count: 13 },
      ],
      amountDue: 3900,
      estimatedMonthlyRevenue: 3900,
      billingReason: "subscription_cycle",
    });

    baselineSnapshots.push({
      snapshotKey: `${DEV_SEED_PREFIX}:baseline-smart-failed-renewal:${stripeAccountId}`,
      source: "dev",
      counts: {
        activeSubscriptions: 88,
        trialingSubscriptions: 6,
        pastDueSubscriptions: 2,
        unpaidSubscriptions: 1,
        canceledSubscriptions: 6,
        newSubscriptions: 220,
        cancellations: 110,
        failedRenewalPayments: 30,
        estimatedMonthlyRevenue: 343200,
        netSubscriptionMovement: 110,
        windowStart: baselineWindowStart,
        windowEnd: baselineWindowEnd,
      },
    });
  }

  if (scenario === "smart-past-due-baseline-increase") {
    for (let index = 1; index <= 58; index += 1) {
      pushSubscription({ suffix: `active-${index}`, status: "active" });
    }
    for (let index = 1; index <= 6; index += 1) {
      pushSubscription({ suffix: `past-due-${index}`, status: "past_due" });
    }

    baselineSnapshots.push({
      snapshotKey: `${DEV_SEED_PREFIX}:baseline-smart-past-due:${stripeAccountId}`,
      source: "dev",
      counts: {
        activeSubscriptions: 62,
        trialingSubscriptions: 5,
        pastDueSubscriptions: 2,
        unpaidSubscriptions: 0,
        canceledSubscriptions: 4,
        newSubscriptions: 160,
        cancellations: 84,
        failedRenewalPayments: 9,
        estimatedMonthlyRevenue: 241800,
        netSubscriptionMovement: 76,
        windowStart: baselineWindowStart,
        windowEnd: baselineWindowEnd,
      },
    });
  }

  if (scenario === "smart-unpaid-baseline-increase") {
    for (let index = 1; index <= 72; index += 1) {
      pushSubscription({ suffix: `active-${index}`, status: "active" });
    }
    for (let index = 1; index <= 3; index += 1) {
      pushSubscription({ suffix: `unpaid-${index}`, status: "unpaid" });
    }

    baselineSnapshots.push({
      snapshotKey: `${DEV_SEED_PREFIX}:baseline-smart-unpaid:${stripeAccountId}`,
      source: "dev",
      counts: {
        activeSubscriptions: 75,
        trialingSubscriptions: 7,
        pastDueSubscriptions: 1,
        unpaidSubscriptions: 1,
        canceledSubscriptions: 5,
        newSubscriptions: 190,
        cancellations: 102,
        failedRenewalPayments: 11,
        estimatedMonthlyRevenue: 292500,
        netSubscriptionMovement: 88,
        windowStart: baselineWindowStart,
        windowEnd: baselineWindowEnd,
      },
    });
  }

  await prisma.$transaction(async (tx) => {
    for (const row of subscriptionRows) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "SubscriptionHealthSubscription" (
          "id",
          "stripeSubscriptionId",
          "stripeAccountId",
          "stripeCustomerId",
          "status",
          "priceId",
          "currency",
          "interval",
          "intervalCount",
          "quantity",
          "unitAmount",
          "estimatedMonthlyRevenue",
          "cancelAtPeriodEnd",
          "currentPeriodStart",
          "currentPeriodEnd",
          "trialStart",
          "trialEnd",
          "canceledAt",
          "endedAt",
          "lastEventCreatedAt",
          "lastSyncedAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${randomUUID()},
          ${row.stripeSubscriptionId},
          ${stripeAccountId},
          ${row.stripeCustomerId},
          ${row.status},
          ${buildDevSeedId("price", stripeAccountId, row.stripeSubscriptionId)},
          ${"EUR"},
          ${row.interval},
          ${row.intervalCount},
          ${row.quantity},
          ${row.unitAmount},
          ${row.estimatedMonthlyRevenue},
          ${false},
          ${now},
          ${nextMonth},
          ${row.status === "trialing" ? now : null},
          ${row.status === "trialing" ? nextMonth : null},
          ${row.canceledAt},
          ${row.canceledAt},
          ${now},
          ${now},
          ${now},
          ${now}
        )
      `);
    }

    for (const event of eventRows) {
      await recordSubscriptionHealthEvent(tx, {
        stripeEventId: event.stripeEventId,
        stripeAccountId,
        stripeSubscriptionId: event.stripeSubscriptionId,
        stripeCustomerId: event.stripeCustomerId,
        type: event.type,
        billingReason: event.billingReason,
        currency: "eur",
        amountDue: event.amountDue,
        amountPaid: event.amountPaid,
        estimatedMonthlyRevenue: event.estimatedMonthlyRevenue,
        occurredAt: event.occurredAt,
      });
    }

    for (const snapshot of baselineSnapshots) {
      await upsertSubscriptionHealthSnapshot({
        client: tx,
        stripeAccountId,
        snapshotKey: snapshot.snapshotKey,
        source: snapshot.source,
        counts: snapshot.counts,
      });
    }
  });

  const snapshotCounts = await syncSubscriptionHealthSnapshot({
    client: prisma,
    stripeAccountId,
    snapshotKey: buildDevSeedSnapshotKey(stripeAccountId),
    source: "dev",
    windowEnd: now,
  });

  for (const action of afterSyncActions) {
    await action(prisma, snapshotCounts);
  }

  return snapshotCounts;
}
