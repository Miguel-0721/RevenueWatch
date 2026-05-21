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

export type SubscriptionHealthTestScenario =
  | "basic-active"
  | "multiple-active"
  | "yearly-active"
  | "quantity-active"
  | "mixed-health"
  | "mixed-mrr"
  | "trend-subscription-drop"
  | "trend-cancellation-spike"
  | "empty";

type SubscriptionHealthSnapshotRecord = SubscriptionHealthCounts & {
  id: string;
  snapshotKey: string;
  source: string;
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

function buildDevSeedId(kind: string, stripeAccountId: string, suffix: string) {
  return `${DEV_SEED_PREFIX}:${kind}:${stripeAccountId}:${suffix}`;
}

function buildDevSeedSnapshotKey(stripeAccountId: string) {
  return `${DEV_SEED_PREFIX}:snapshot:${stripeAccountId}`;
}

async function createSubscriptionDropAlert({
  stripeAccountId,
  previousSnapshot,
  currentSnapshot,
}: {
  stripeAccountId: string;
  previousSnapshot: SubscriptionHealthSnapshotRecord;
  currentSnapshot: SubscriptionHealthSnapshotRecord;
}) {
  const dropCount =
    previousSnapshot.activeSubscriptions - currentSnapshot.activeSubscriptions;
  const dropPercent = Math.round(
    (dropCount / previousSnapshot.activeSubscriptions) * 100
  );
  const message = `Active subscriptions dropped from ${previousSnapshot.activeSubscriptions} to ${currentSnapshot.activeSubscriptions}.`;

  await prisma.alert.upsert({
    where: {
      stripeEventId: buildSubscriptionDropAlertKey({
        stripeAccountId,
        currentSnapshotKey: currentSnapshot.snapshotKey,
      }),
    },
    update: {},
    create: {
      type: "subscription_drop",
      severity: "warning",
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
  stripeAccountId,
  previousSnapshot,
  currentSnapshot,
}: {
  stripeAccountId: string;
  previousSnapshot: SubscriptionHealthSnapshotRecord | null;
  currentSnapshot: SubscriptionHealthSnapshotRecord;
}) {
  const baselineCancellations = previousSnapshot?.cancellations ?? 0;
  const multiplier =
    baselineCancellations > 0
      ? Number(
          (currentSnapshot.cancellations / baselineCancellations).toFixed(2)
        )
      : null;
  const message =
    baselineCancellations > 0
      ? `Cancellations increased from ${baselineCancellations} to ${currentSnapshot.cancellations}.`
      : `Cancellations are higher than usual: ${currentSnapshot.cancellations} cancellations in the recent window.`;

  await prisma.alert.upsert({
    where: {
      stripeEventId: buildCancellationSpikeAlertKey({
        stripeAccountId,
        currentSnapshotKey: currentSnapshot.snapshotKey,
      }),
    },
    update: {},
    create: {
      type: "cancellation_spike",
      severity: "warning",
      status: "active",
      stripeAccountId,
      stripeEventId: buildCancellationSpikeAlertKey({
        stripeAccountId,
        currentSnapshotKey: currentSnapshot.snapshotKey,
      }),
      message,
      context: JSON.stringify({
        currentCancellations: currentSnapshot.cancellations,
        baselineCancellations,
        multiplier,
        windowStart: currentSnapshot.windowStart.toISOString(),
        windowEnd: currentSnapshot.windowEnd.toISOString(),
        previousSnapshotId: previousSnapshot?.id ?? null,
        previousSnapshotKey: previousSnapshot?.snapshotKey ?? null,
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

async function createSubscriptionCanceledAlert({
  stripeAccountId,
  stripeSubscriptionId,
  stripeCustomerId,
  status,
  estimatedMonthlyRevenue,
  currency,
  canceledAt,
  source,
}: {
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
  const message = `A customer canceled a subscription. Estimated monthly revenue impact: ${formatMoneyAmount(
    estimatedMonthlyRevenue,
    normalizedCurrency
  )}.`;

  await prisma.alert.upsert({
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
        source,
        displayMessage: message,
      }),
      windowStart: canceledAt,
      windowEnd: canceledAt,
    },
  });
}

export async function upsertFailedRenewalAlert({
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
  const message = `A subscription renewal payment failed. Amount at risk: ${formatMoneyAmount(
    amountAtRisk,
    normalizedCurrency
  )}.`;

  await prisma.alert.upsert({
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
}: {
  previousSnapshot: SubscriptionHealthSnapshotRecord | null;
  currentSnapshot: SubscriptionHealthSnapshotRecord;
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
  return dropPercent >= 0.2;
}

function shouldCreateCancellationSpikeAlert({
  previousSnapshot,
  currentSnapshot,
}: {
  previousSnapshot: SubscriptionHealthSnapshotRecord | null;
  currentSnapshot: SubscriptionHealthSnapshotRecord;
}) {
  const currentCancellations = currentSnapshot.cancellations;
  if (currentCancellations < 3) return false;

  const baselineCancellations = previousSnapshot?.cancellations ?? 0;
  if (baselineCancellations > 0) {
    return currentCancellations >= baselineCancellations * 2;
  }

  return currentCancellations >= 5;
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

  if (
    shouldCreateSubscriptionDropAlert({
      previousSnapshot,
      currentSnapshot,
    }) &&
    previousSnapshot
  ) {
    await createSubscriptionDropAlert({
      stripeAccountId,
      previousSnapshot,
      currentSnapshot,
    });
  }

  if (
    shouldCreateCancellationSpikeAlert({
      previousSnapshot,
      currentSnapshot,
    })
  ) {
    await createCancellationSpikeAlert({
      stripeAccountId,
      previousSnapshot,
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

  return syncSubscriptionHealthSnapshot({
    client: prisma,
    stripeAccountId,
    snapshotKey: buildDevSeedSnapshotKey(stripeAccountId),
    source: "dev",
    windowEnd: now,
  });
}
