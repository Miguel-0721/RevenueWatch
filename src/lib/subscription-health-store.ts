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
  | "mixed-health"
  | "empty";

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

function estimateMonthlyRevenueFromSubscription(subscription: Stripe.Subscription) {
  const price = getSubscriptionPrice(subscription);
  const unitAmount = price?.unit_amount ?? 0;
  const quantity = getSubscriptionQuantity(subscription);
  const interval = price?.recurring?.interval ?? null;
  const intervalCount = price?.recurring?.interval_count ?? 1;
  const totalAmount = unitAmount * quantity;

  if (!interval || totalAmount <= 0) return 0;

  if (interval === "month") {
    return Math.round(totalAmount / Math.max(intervalCount, 1));
  }

  if (interval === "year") {
    return Math.round(totalAmount / Math.max(intervalCount * 12, 1));
  }

  if (interval === "week") {
    return Math.round((totalAmount * 52) / Math.max(intervalCount * 12, 1));
  }

  if (interval === "day") {
    return Math.round((totalAmount * 30) / Math.max(intervalCount, 1));
  }

  return totalAmount;
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

function buildDevSeedId(kind: string, stripeAccountId: string, suffix: string) {
  return `${DEV_SEED_PREFIX}:${kind}:${stripeAccountId}:${suffix}`;
}

function buildDevSeedSnapshotKey(stripeAccountId: string) {
  return `${DEV_SEED_PREFIX}:snapshot:${stripeAccountId}`;
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
  const estimatedMonthlyRevenue = estimateMonthlyRevenueFromSubscription(subscription);
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
        estimatedMonthlyRevenue: estimateMonthlyRevenueFromSubscription(subscription),
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
          estimatedMonthlyRevenue: estimateMonthlyRevenueFromSubscription(subscription),
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
          estimatedMonthlyRevenue = estimateMonthlyRevenueFromSubscription(liveSubscription);
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
        estimatedMonthlyRevenue: estimateMonthlyRevenueFromSubscription(subscription),
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

  await clearDevSeedSubscriptionHealthTestState({ stripeAccountId });

  const subscriptionRows: Array<{
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    status: string;
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

  const pushSubscription = ({
    suffix,
    status,
    unitAmount = 3900,
    estimatedMonthlyRevenue = unitAmount,
    canceledAt = null,
  }: {
    suffix: string;
    status: string;
    unitAmount?: number;
    estimatedMonthlyRevenue?: number;
    canceledAt?: Date | null;
  }) => {
    subscriptionRows.push({
      stripeSubscriptionId: buildDevSeedId("subscription", stripeAccountId, suffix),
      stripeCustomerId: buildDevSeedId("customer", stripeAccountId, suffix),
      status,
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
          ${"month"},
          ${1},
          ${1},
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
  });

  return syncSubscriptionHealthSnapshot({
    client: prisma,
    stripeAccountId,
    snapshotKey: buildDevSeedSnapshotKey(stripeAccountId),
    source: "dev",
    windowEnd: now,
  });
}
