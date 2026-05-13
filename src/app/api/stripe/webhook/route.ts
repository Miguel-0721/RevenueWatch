import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { sendAlertEmail } from "@/lib/notify";
import { canTriggerAlert } from "@/lib/alert-guard";
import { getAlertSensitivityConfig } from "@/lib/alert-sensitivity";
import { normalizeCurrencyCode } from "@/lib/currency";
import { evaluateRevenueDropForAccount } from "@/lib/revenue-drop";
import { getStripeMode } from "@/lib/stripe-customer";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

function normalizePlan(plan: string | null | undefined) {
  if (plan === "pro") return "PRO";
  if (plan === "growth") return "GROWTH";
  if (plan === "free") return "FREE";
  return null;
}

function planFromPriceId(priceId: string | null | undefined) {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_GROWTH_PRICE_ID) return "GROWTH";
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "PRO";
  return null;
}

const BILLING_PLAN_RANK = {
  FREE: 0,
  GROWTH: 1,
  PRO: 2,
} as const;

const ACTIVE_BILLING_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
]);

type ManagedSubscriptionPlan = "GROWTH" | "PRO";

type ManagedSubscriptionSummary = {
  id: string;
  status: Stripe.Subscription.Status;
  priceId: string | null;
  mappedPlan: ManagedSubscriptionPlan;
  created: number;
};

async function findUserForBillingEvent({
  userId,
  customerId,
}: {
  userId?: string;
  customerId?: string | null;
}) {
  if (userId) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        plan: true,
        stripeSubscriptionId: true,
      },
    });
  }

  if (!customerId) {
    return null;
  }

  const { field } = getStripeMode();

  return prisma.user.findFirst({
    where: {
      OR: [
        { stripeCustomerId: customerId },
        { [field]: customerId },
      ],
    },
    select: {
      id: true,
      plan: true,
      stripeSubscriptionId: true,
    },
  });
}

async function listManagedSubscriptions(customerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });

  const managedSubscriptions: ManagedSubscriptionSummary[] = [];

  for (const subscription of subscriptions.data) {
    const activeItem = subscription.items.data[0];
    const priceId = activeItem?.price?.id ?? null;
    const mappedPlan = planFromPriceId(priceId);

    if (!mappedPlan || !ACTIVE_BILLING_STATUSES.has(subscription.status)) {
      continue;
    }

    managedSubscriptions.push({
      id: subscription.id,
      status: subscription.status,
      priceId,
      mappedPlan,
      created: subscription.created,
    });
  }

  return managedSubscriptions.sort((left, right) => {
    const rankDifference =
      BILLING_PLAN_RANK[right.mappedPlan] - BILLING_PLAN_RANK[left.mappedPlan];

    if (rankDifference !== 0) return rankDifference;
    return right.created - left.created;
  });
}

async function syncUserPlanFromManagedSubscriptions({
  userId,
  customerId,
  currentPlan,
  currentSubscriptionId,
  source,
  fallbackPlan,
  fallbackSubscriptionId,
}: {
  userId: string;
  customerId: string;
  currentPlan: "FREE" | "GROWTH" | "PRO";
  currentSubscriptionId?: string | null;
  source: string;
  fallbackPlan?: "FREE" | "GROWTH" | "PRO" | null;
  fallbackSubscriptionId?: string | null;
}) {
  const managedSubscriptions = await listManagedSubscriptions(customerId);
  const effectiveSubscription = managedSubscriptions[0] ?? null;
  const fallbackManagedPlan =
    fallbackPlan && fallbackPlan !== "FREE" ? fallbackPlan : null;
  const nextPlan: "FREE" | ManagedSubscriptionPlan =
    effectiveSubscription?.mappedPlan ?? fallbackManagedPlan ?? "FREE";
  const hasManagedPlan = nextPlan === "GROWTH" || nextPlan === "PRO";
  const nextSubscriptionId =
    effectiveSubscription?.id ?? (hasManagedPlan ? (fallbackSubscriptionId ?? null) : null);
  const nextStatus =
    effectiveSubscription?.status ?? (hasManagedPlan ? "active" : "canceled");
  const { field } = getStripeMode();

  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: nextPlan,
      stripeCustomerId: customerId,
      stripeSubscriptionId: nextSubscriptionId,
      subscriptionStatus: nextStatus,
      [field]: customerId,
    },
  });

  console.log("SYNCED USER BILLING PLAN", {
    source,
    customerId,
    userId,
    previousPlan: currentPlan,
    previousSubscriptionId: currentSubscriptionId,
    newPlan: nextPlan,
    subscriptionId: nextSubscriptionId,
    priceId: effectiveSubscription?.priceId ?? null,
    managedSubscriptionCount: managedSubscriptions.length,
  });

  return {
    nextPlan,
    nextSubscriptionId,
    managedSubscriptions,
  };
}

async function cancelManagedDuplicates({
  customerId,
  keepSubscriptionId,
}: {
  customerId: string;
  keepSubscriptionId: string;
}) {
  const managedSubscriptions = await listManagedSubscriptions(customerId);
  const duplicates = managedSubscriptions.filter(
    (subscription) => subscription.id !== keepSubscriptionId
  );

  for (const subscription of duplicates) {
    console.log("CANCELING DUPLICATE MANAGED SUBSCRIPTION", {
      customerId,
      keepSubscriptionId,
      cancelSubscriptionId: subscription.id,
      cancelPlan: subscription.mappedPlan,
      cancelPriceId: subscription.priceId,
    });

    await stripe.subscriptions.cancel(subscription.id);
  }
}



/**
 * ALERTING PHILOSOPHY
 *
 * RevenueWatch is an insurance-style monitoring system.
 * It is intentionally conservative by design.
 *
 * Design principles:
 * - Prefer false negatives over false positives
 * - Alert only on sustained or meaningful anomalies
 * - Avoid alert fatigue at all costs
 * - Never react to single events in isolation
 *
 * This system does NOT:
 * - Predict revenue
 * - Optimize performance
 * - Recommend actions
 * - Provide analytics or insights
 */




/**
 * PRODUCTION DEFAULTS — DECISION NOTE (PRE-KVK)
 *
 * The values below represent the intended initial production defaults.
 * They are chosen to be conservative and boring by design.
 *
 * Goals:
 * - Catch meaningful, sustained issues
 * - Avoid alert fatigue
 * - Prefer false negatives over false positives
 *
 * These values MUST NOT be tuned reactively.
 * Any future changes should be deliberate and data-informed.
 *
 * Intended defaults:
 *
 * Revenue drop detection:
 * - BASELINE_HOURS:        6 weeks
 *   Rationale: gives exact day/hour matching enough samples before fallback.
 *
 * - REVENUE_WINDOW_MINUTES: 60 minutes
 *   Rationale: ignores brief volatility; detects sustained drops.
 *
 * - DROP_THRESHOLD:        50%
 *   Rationale: large deviation required to avoid noise.
 *
 * - MIN_BASELINE_REVENUE:  €500
 *   Rationale: prevents alerts on very low-volume accounts.
 *
 * - MIN_CURRENT_REVENUE:   €100
 *   Rationale: ensures meaningful current activity before comparison.
 *
 * Payment failure detection:
 * - FAILURE_WINDOW_MINUTES: 30 minutes
 *   Rationale: clusters indicate systemic issues, not random failures.
 *
 * - FAILURE_THRESHOLD:      5 failures
 *   Rationale: meaningful volume required before alerting.
 *
 * Cooldowns:
 * - revenue_drop:   12 hours
 * - payment_failed: 6 hours
 *   Rationale: prevent repeated alerts for the same underlying issue.
 *
 * NOTE:
 * These defaults are intentionally conservative.
 * It is acceptable to miss minor issues; it is not acceptable to spam alerts.
 */



// ---------------- CONFIG ----------------

// Revenue drop alert (production-safe defaults)


/**
 * Baseline vs current window comparison.
 *
 * The baseline represents "normal" recent behavior.
 * The current window is intentionally shorter to detect sustained drops.
 *
 * Short-term spikes or dips are ignored by design.
 */



// Thresholds are resolved per-account through alert sensitivity presets.
// Conservative matches current production behavior exactly.


// ---------------- HELPERS ----------------


/**
 * Cooldowns & deduplication.
 *
 * Once an alert is triggered, further alerts of the same type
 * are suppressed for a fixed cooldown period.
 *
 * This prevents:
 * - Alert storms
 * - Repeated notifications for the same issue
 * - Operator fatigue
 */




function getCooldownUntil(type: string) {
  const hours =
    type === "revenue_drop" ? 12 :
      type === "payment_failed" ? 6 :
        6;

  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

type RevenueBaselineLevel =
  | "same_day_and_hour"
  | "same_day_type_and_hour"
  | "same_hour";

type FailureBaselineLevel = RevenueBaselineLevel;

type RevenueMetricSample = {
  amount: number;
  periodEnd: Date;
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
  return dayOfWeek === 0 || dayOfWeek === 6
    ? [0, 6]
    : [1, 2, 3, 4, 5];
}

function revenueBaselineLabel(level: RevenueBaselineLevel) {
  if (level === "same_day_and_hour") return "same day and same hour";
  if (level === "same_day_type_and_hour") return "same weekday/weekend type and same hour";
  return "same hour";
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

// ---------------- WEBHOOK ----------------

export async function POST(req: Request) {
  console.log("🔥 WEBHOOK HIT", new Date().toISOString());

  try {
    const sig = req.headers.get("stripe-signature");

    if (!sig) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const body = Buffer.from(await req.arrayBuffer());

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown webhook verification error";
      console.error("❌ Webhook verification failed:", message);
      return NextResponse.json({ error: "Webhook error" }, { status: 400 });
    }


    if (event.type === "checkout.session.completed") {
      console.log("Checkout session completed webhook received", event.id);

      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const plan = normalizePlan(session.metadata?.plan);
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      const user = await findUserForBillingEvent({ userId, customerId });

      if (!user) {
        console.error("Unable to resolve user for checkout session", {
          sessionId: session.id,
          userId,
          customerId,
        });
        return NextResponse.json({ received: true });
      }

      if (!plan) {
        console.error("Invalid plan in checkout session metadata", {
          sessionId: session.id,
          plan: session.metadata?.plan,
        });
        return NextResponse.json({ received: true });
      }

      if (!customerId) {
        console.error("Checkout session missing customer ID", {
          sessionId: session.id,
          userId: user.id,
          subscriptionId,
        });
        return NextResponse.json({ received: true });
      }

      if (subscriptionId) {
        await cancelManagedDuplicates({
          customerId,
          keepSubscriptionId: subscriptionId,
        });
      }

      await syncUserPlanFromManagedSubscriptions({
        userId: user.id,
        customerId,
        currentPlan: user.plan,
        currentSubscriptionId: user.stripeSubscriptionId,
        source: "checkout.session.completed",
        fallbackPlan: plan,
        fallbackSubscriptionId: subscriptionId,
      });

      return NextResponse.json({ received: true });
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      console.log("Customer subscription billing webhook received", {
        eventType: event.type,
        eventId: event.id,
      });

      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;
      const user = await findUserForBillingEvent({
        userId: subscription.metadata?.userId,
        customerId,
      });

      if (!user) {
        console.error("Unable to resolve user for subscription billing event", {
          eventType: event.type,
          subscriptionId: subscription.id,
          customerId,
        });
        return NextResponse.json({ received: true });
      }

      const activeItem = subscription.items.data[0];
      const mappedPlan = planFromPriceId(activeItem?.price?.id);

      console.log("SUBSCRIPTION EVENT DETAILS", {
        eventType: event.type,
        customerId,
        subscriptionId: subscription.id,
        priceId: activeItem?.price?.id ?? null,
        mappedPlan,
        userId: user.id,
        previousPlan: user.plan,
        previousSubscriptionId: user.stripeSubscriptionId,
        subscriptionStatus: subscription.status,
      });

      await syncUserPlanFromManagedSubscriptions({
        userId: user.id,
        customerId,
        currentPlan: user.plan,
        currentSubscriptionId: user.stripeSubscriptionId,
        source: event.type,
        fallbackPlan: mappedPlan,
        fallbackSubscriptionId: subscription.id,
      });

      return NextResponse.json({ received: true });
    }

    if (event.type === "invoice.paid") {
      console.log("Invoice paid webhook received", event.id);

      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;
      const user = await findUserForBillingEvent({
        userId: invoice.parent?.subscription_details?.metadata?.userId,
        customerId,
      });

      if (!user) {
        console.error("Unable to resolve user for invoice paid", {
          invoiceId: invoice.id,
          customerId,
        });
        return NextResponse.json({ received: true });
      }

      const { field } = getStripeMode();

      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeCustomerId: customerId ?? undefined,
          subscriptionStatus: "active",
          [field]: customerId ?? undefined,
        },
      });

      console.log("Confirmed active subscription from invoice", {
        userId: user.id,
        invoiceId: invoice.id,
      });

      return NextResponse.json({ received: true });
    }

    /**
     * Stripe Connect events include `event.account`.
     * In local development (Stripe CLI), this may be missing.
     * 
     * - In development: allow a safe dev-only fallback
     * - In production: missing account is a hard error
     */
    let stripeAccountId: string;

    if (event.account) {
      stripeAccountId = event.account;
    } else {
      if (process.env.NODE_ENV === "production") {
        console.error("Missing Stripe account on event", event.id);
        return NextResponse.json(
          { error: "Missing Stripe account context" },
          { status: 400 }
        );
      }

      // Dev-only fallback for Stripe CLI
      stripeAccountId = "test_account_local";
    }


    // 🔒 Guard: ignore events for disconnected / inactive accounts
    const account = await prisma.stripeAccount.findUnique({
      where: { stripeAccountId },
      select: {
        id: true,
        stripeAccountId: true,
        status: true,
        name: true,
        userId: true,
        alertSensitivity: true,
      },
    });

    if (!account || account.status !== "active") {
      console.log(
        "⚠️ Ignoring event for inactive or disconnected Stripe account:",
        stripeAccountId
      );
      return NextResponse.json({ received: true });
    }

    const alertConfig = getAlertSensitivityConfig(account.alertSensitivity);




    // 1️⃣ Store every event (audit trail) + idempotency guard (retry-safe)
    const existing = await prisma.stripeEvent.findUnique({
      where: { stripeEventId: event.id },
      select: { id: true },
    });

    const isFirstProcessing = !existing;

    if (isFirstProcessing) {
      await prisma.stripeEvent.create({
        data: {
          stripeEventId: event.id,
          type: event.type,
          stripeAccountId,
          payload: JSON.stringify(event),
        },
      });
    } else {
      // Keep audit trail intact (optional: update payload/type if you ever want)
      // We intentionally do NOT re-run side effects on retries.
    }



    // Ignore unrelated events
    if (
      event.type !== "payment_intent.succeeded" &&
      event.type !== "payment_intent.payment_failed"
    ) {
      return NextResponse.json({ received: true });
    }

    // ---------------- REVENUE DROP ----------------

    if (event.type === "payment_intent.succeeded") {



      const pi = event.data.object as Stripe.PaymentIntent;
      if (!pi.amount_received || pi.amount_received <= 0) {
        return NextResponse.json({ received: true });
      }
      const metricCurrency = normalizeCurrencyCode(pi.currency);



      const now = new Date();




      const shouldSkipRevenueWrite =
        process.env.NODE_ENV !== "production" &&
        process.env.SKIP_REVENUE_WRITE === "1";

      if (process.env.SKIP_REVENUE_WRITE === "1" && process.env.NODE_ENV === "production") {
        console.error("SKIP_REVENUE_WRITE ignored in production", {
          stripeEventId: event.id,
          stripeAccountId,
        });
      }

      // 🔒 Idempotency guard: never write revenue twice for the same Stripe event
      if (!isFirstProcessing) {
        console.log("Retry detected; skipping duplicate revenue metric creation", {
          stripeEventId: event.id,
          stripeAccountId,
        });
      } else if (shouldSkipRevenueWrite) {
        console.log("Skipping revenue metric write for local separation testing", {
          stripeEventId: event.id,
          stripeAccountId,
        });
      } else {
        await prisma.revenueMetric.create({
          data: {
            stripeAccountId,
            amount: pi.amount_received,
            currency: metricCurrency,
            periodStart: new Date(
              now.getTime() - alertConfig.revenueWindowMinutes * 60 * 1000
            ),
            periodEnd: now,
            hourOfDay: now.getUTCHours(), // 0-23 UTC
            dayOfWeek: now.getUTCDay(),   // 0-6 UTC
          },
        });
      }




      await evaluateRevenueDropForAccount({
        stripeAccountId,
        alertSensitivity: account.alertSensitivity,
        now,
        source: "webhook",
        triggerEventId: event.id,
      });


    }// ✅ closes payment_intent.succeeded

    // ---------------- PAYMENT FAILURES ----------------


    /**
     * Payment failure spike detection.
     *
     * Individual payment failures are expected and normal.
     * Alerts are triggered only when failures cluster within
     * a short time window, indicating a systemic issue.
     */



    if (event.type === "payment_intent.payment_failed") {

      const now = new Date();
      const currentWindowStart = new Date(
        now.getTime() - alertConfig.failureWindowMinutes * 60 * 1000
      );

      const failures = await prisma.stripeEvent.count({
        where: {
          stripeAccountId,
          type: "payment_intent.payment_failed",
          createdAt: { gte: currentWindowStart },
        },
      });

      const activeFailureAlerts = await prisma.alert.findMany({
        where: {
          stripeAccountId,
          type: "payment_failed",
          status: "active",
        },
        select: {
          id: true,
          context: true,
        },
      });

      const recoveredFailureAlertIds = activeFailureAlerts
        .filter((alert) => {
          const parsed = safeParseAlertContext(alert.context);
          return (
            parsed &&
            typeof parsed.failureThreshold === "number" &&
            failures < parsed.failureThreshold
          );
        })
        .map((alert) => alert.id);

      if (recoveredFailureAlertIds.length > 0) {
        await prisma.alert.updateMany({
          where: {
            id: { in: recoveredFailureAlertIds },
          },
          data: {
            status: "resolved",
          },
        });
      }

      const historyStart = new Date(
        currentWindowStart.getTime() -
          alertConfig.failureLookbackDays * 24 * 60 * 60 * 1000
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
      const currentDay = currentWindowStart.getUTCDay();

      const comparisonWindows = Array.from(
        { length: alertConfig.failureLookbackDays },
        (_, index) => {
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

        if (summary.sampleCount >= alertConfig.failureMinSamples) {
          selectedBaseline = {
            level: candidate.level,
            usualFailures: summary.median,
            sampleCount: summary.sampleCount,
          };
          break;
        }
      }

      if (!selectedBaseline) {
        if (failures < alertConfig.failureFallbackMinCurrent) {
          return NextResponse.json({ received: true });
        }

        const allowed = await canTriggerAlert({
          stripeAccountId,
          type: "payment_failed",
        });

        if (!allowed) {
          return NextResponse.json({ received: true });
        }

        let alert;
        const displayMessage =
          "Payment failures are unusually high for this account, but there is not enough history yet for a normal comparison.";

        try {
          alert = await prisma.alert.create({
            data: {
              type: "payment_failed",
              severity: "warning",
              status: "active",
              stripeEventId: event.id,
              stripeAccountId,
              message: displayMessage,
              context: JSON.stringify({
                failureWindowMinutes: alertConfig.failureWindowMinutes,
                currentWindowStart: currentWindowStart.toISOString(),
                currentWindowEnd: now.toISOString(),
                currentFailures: failures,
                failuresCounted: failures,
                usualFailures: null,
                normalFailures: null,
                baseline: null,
                effectiveUsualFailures: null,
                spikeMultiple: null,
                failureThreshold: alertConfig.failureFallbackMinCurrent,
                comparisonWindowCount: comparisonWindows.length,
                comparisonLevel: "insufficient_history",
                fallbackUsed: true,
                fallbackReason:
                  "Not enough historical comparison data; current failures exceeded conservative fallback threshold.",
                window: "current monitoring window",
                failureSeries: recentFailureSeries,
                displayMessage,
              }),
              windowStart: currentWindowStart,
              windowEnd: new Date(
                now.getTime() + alertConfig.failureWindowMinutes * 60 * 1000
              ),
              cooldownUntil: getCooldownUntil("payment_failed"),
            },
          });
        } catch (err) {
          console.error("❌ Alert DB write failed (non-fatal):", err);
          return NextResponse.json({ received: true });
        }

        await sendAlertEmail({
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          stripeAccountId: alert.stripeAccountId,
          detectedAt: alert.createdAt,
          context: alert.context,
        });

        return NextResponse.json({ received: true });
      }

      const usualFailures = selectedBaseline.usualFailures;
      const effectiveUsualFailures = Math.max(
        usualFailures,
        alertConfig.failureBaselineFloor
      );
      const threshold = effectiveUsualFailures * alertConfig.failureSpikeMultiplier;
      const spikeMultiple = failures / effectiveUsualFailures;
      const wouldTrigger =
        failures >= alertConfig.failureMinCurrent &&
        failures >= threshold;

      if (!wouldTrigger) {
        return NextResponse.json({ received: true });
      }

      const allowed = await canTriggerAlert({
        stripeAccountId,
        type: "payment_failed",
      });

      if (!allowed) {
        return NextResponse.json({ received: true });
      }

      let alert;
      const severity =
        spikeMultiple >= alertConfig.failureCriticalMultiplier
          ? "critical"
          : "warning";
      const displayMessage =
        severity === "critical"
          ? "Payment failures are significantly higher than usual compared to recent activity."
          : "Payment failures are higher than usual compared to recent activity.";

      try {
        alert = await prisma.alert.create({
          data: {
            type: "payment_failed",
            severity,
            status: "active",
            stripeEventId: event.id,
            stripeAccountId,
            message: displayMessage,
            context: JSON.stringify({
              failureWindowMinutes: alertConfig.failureWindowMinutes,
              currentWindowStart: currentWindowStart.toISOString(),
              currentWindowEnd: now.toISOString(),
              currentFailures: failures,
              failuresCounted: failures,
              usualFailures,
              normalFailures: usualFailures,
              baseline: usualFailures,
              effectiveUsualFailures,
              spikeMultiple,
              failureThreshold: threshold,
              comparisonWindowCount: selectedBaseline.sampleCount,
              comparisonLevel: selectedBaseline.level,
              failureSpikeMultiplier: alertConfig.failureSpikeMultiplier,
              baselineFloor: alertConfig.failureBaselineFloor,
              failureSeries: recentFailureSeries,
              displayMessage,
            }),
            windowStart: currentWindowStart,
            windowEnd: new Date(
              now.getTime() + alertConfig.failureWindowMinutes * 60 * 1000
            ),
            cooldownUntil: getCooldownUntil("payment_failed"),
          },
        });
      } catch (err) {
        console.error("❌ Alert DB write failed (non-fatal):", err);
        return NextResponse.json({ received: true });
      }

      await sendAlertEmail({
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        stripeAccountId: alert.stripeAccountId,
        detectedAt: alert.createdAt,
        context: alert.context,
      });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("🔥 Webhook processing failed (non-fatal):", err);
    return NextResponse.json({ received: true });
  }
}


