import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { sendAlertEmail } from "@/lib/notify";
import { canTriggerAlert } from "@/lib/alert-guard";
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
      select: { id: true },
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
    select: { id: true },
  });
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



const REVENUE_WINDOW_MINUTES = 60;
const BASELINE_HOURS = 6 * 7 * 24; // 6 weeks



/**
 * Revenue drop threshold.
 *
 * The threshold represents a meaningful deviation,
 * not a normal fluctuation.
 *
 * We intentionally avoid reacting to small or brief changes.
 */



const DROP_THRESHOLD = 0.5;             // 50% sustained drop


/**
 * Minimum revenue guards.
 *
 * These thresholds prevent alerts when:
 * - The account is new
 * - Traffic is extremely low
 * - Random variance would dominate the signal
 *
 * Alerts below these levels are more likely noise than risk.
 */



const MIN_BASELINE_REVENUE = 50000; // €500
const MIN_CURRENT_REVENUE = 10000;  // €100







// Payment failure alert (production-safe defaults)

const FAILURE_WINDOW_MINUTES = 60;
const FAILURE_LOOKBACK_DAYS = 14;
const FAILURE_MIN_CURRENT = 5;
const FAILURE_BASELINE_FLOOR = 3;
const FAILURE_SPIKE_MULTIPLIER = 2;
const FAILURE_CRITICAL_MULTIPLIER = 4;
const FAILURE_MIN_SAMPLES = 5;
const MIN_SAMPLES = 5;


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

    const { field } = getStripeMode();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan,
        stripeCustomerId: customerId ?? undefined,
        stripeSubscriptionId: subscriptionId ?? undefined,
        subscriptionStatus: "active",
        [field]: customerId ?? undefined,
      },
    });

    console.log("Updated user plan from checkout webhook", {
      userId: user.id,
      nextPlan: plan,
      customerId,
      subscriptionId,
      modeField: field,
    });

    return NextResponse.json({ received: true });
  }

  if (event.type === "customer.subscription.updated") {
    console.log("Customer subscription updated webhook received", event.id);

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
      console.error("Unable to resolve user for subscription update", {
        subscriptionId: subscription.id,
        customerId,
      });
      return NextResponse.json({ received: true });
    }

    const activeItem = subscription.items.data[0];
    const nextPlan = planFromPriceId(activeItem?.price?.id);
    const { field } = getStripeMode();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: nextPlan ?? undefined,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        [field]: customerId,
      },
    });

    console.log("Updated user from subscription update", {
      userId: user.id,
      nextPlan,
      subscriptionId: subscription.id,
      status: subscription.status,
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
});

if (!account || account.status !== "active") {
  console.log(
    "⚠️ Ignoring event for inactive or disconnected Stripe account:",
    stripeAccountId
  );
  return NextResponse.json({ received: true });
}




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



  const now = new Date();




  const SKIP_REVENUE_WRITE = process.env.SKIP_REVENUE_WRITE === "1";

// 🔒 Idempotency guard: never write revenue twice for the same Stripe event
if (!isFirstProcessing) {
  console.log("🔁 Retry detected — skipping revenueMetric creation");
} else if (SKIP_REVENUE_WRITE) {
  console.log("🧪 TEST MODE — skipping revenueMetric write for separation testing");
} else {
  await prisma.revenueMetric.create({
    data: {
      stripeAccountId,
      amount: pi.amount_received,
      periodStart: new Date(now.getTime() - REVENUE_WINDOW_MINUTES * 60 * 1000),
      periodEnd: now,
      hourOfDay: now.getUTCHours(), // 0-23 UTC
      dayOfWeek: now.getUTCDay(),   // 0-6 UTC
    },
  });
}





    const currentWindowStart = new Date(
      now.getTime() - REVENUE_WINDOW_MINUTES * 60 * 1000
    );

    const baselineStart = new Date(
      now.getTime() - BASELINE_HOURS * 60 * 60 * 1000
    );

    const currentRevenue = await prisma.revenueMetric.aggregate({
      _sum: { amount: true },
    where: {
  stripeAccountId,
  periodEnd: { gte: currentWindowStart },
},

    });


const currentAmount = currentRevenue._sum.amount ?? 0;


console.log("🟡 CURRENT WINDOW CHECK");
console.log("Window start:", currentWindowStart.toISOString());
console.log("Current amount:", currentAmount);


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

  console.log("BASELINE CHECK", {
    level: candidate.level,
    nowHour,
    nowDay,
    sampleCount: summary.sampleCount,
    average: summary.average,
  });

  if (summary.sampleCount >= MIN_SAMPLES) {
    selectedBaseline = {
      level: candidate.level,
      amount: summary.average,
      sampleCount: summary.sampleCount,
    };
    break;
  }
}



console.log("🔵 BASELINE CHECK");
console.log("Now hour:", nowHour);
console.log("Now day:", nowDay);


if (!selectedBaseline) {
  return NextResponse.json({ received: true });
}






    const baselineAmount = selectedBaseline.amount;


    if (
      baselineAmount < MIN_BASELINE_REVENUE ||
      currentAmount < MIN_CURRENT_REVENUE
    ) {
      return NextResponse.json({ received: true });
    }

    const dropRatio = 1 - currentAmount / baselineAmount;

console.log("🧪 DEBUG DROP STATE", {
  baselineAmount,
  currentAmount,
  dropRatio,
  baselineCount: selectedBaseline.sampleCount,
  baselineLevel: selectedBaseline.level,
  nowHour,
  nowDay,
});



console.log("🔴 DROP MATH");
console.log("Baseline amount:", baselineAmount);
console.log("Current amount:", currentAmount);
console.log("Drop ratio:", dropRatio);



let severity: "warning" | "critical" = "warning";

if (dropRatio >= 0.8) {
  severity = "critical";
}


    if (dropRatio < DROP_THRESHOLD) {
      return NextResponse.json({ received: true });
    }

console.log("🟠 CHECKING COOLDOWN");

const allowed = await canTriggerAlert({
  stripeAccountId,
  type: "revenue_drop",
});

console.log("Allowed to alert:", allowed);



    if (!allowed) {
      return NextResponse.json({ received: true });
    }

let alert;

try {
  alert = await prisma.alert.create({
    data: {
      type: "revenue_drop",
      severity,
      stripeEventId: event.id,
      stripeAccountId,
      message: `Revenue dropped by ${(dropRatio * 100).toFixed(0)}% compared to baseline.
Baseline (${revenueBaselineLabel(selectedBaseline.level)}, last ${BASELINE_HOURS}h): €${(baselineAmount / 100).toFixed(2)}
Current (${REVENUE_WINDOW_MINUTES} min): €${(currentAmount / 100).toFixed(2)}`,
      context: JSON.stringify({
        dropRatio,
        baselineHours: BASELINE_HOURS,
        baselineAmount,
        baselineLevel: selectedBaseline.level,
        baselineLabel: revenueBaselineLabel(selectedBaseline.level),
        baselineSampleCount: selectedBaseline.sampleCount,
        currentWindowMinutes: REVENUE_WINDOW_MINUTES,
        currentAmount,
        threshold: DROP_THRESHOLD,
        alertThresholdAmount: Math.round(baselineAmount * (1 - DROP_THRESHOLD)),
        amountUnit: "cents",
        currency: "EUR",
        dayOfWeek: nowDay,
        hourOfDay: nowHour,
      }),
      windowStart: currentWindowStart,
      windowEnd: new Date(now.getTime() + REVENUE_WINDOW_MINUTES * 60 * 1000),
      cooldownUntil: getCooldownUntil("revenue_drop"),
    },
  });
} catch (err) {
  console.error("❌ Alert DB write failed (non-fatal):", err);
  return NextResponse.json({ received: true });
}




void sendAlertEmail({
  type: alert.type,
  message: alert.message,
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
  console.log("🔴 PAYMENT FAILED EVENT RECEIVED");

  const now = new Date();
  const currentWindowStart = new Date(
    now.getTime() - FAILURE_WINDOW_MINUTES * 60 * 1000
  );

  const failures = await prisma.stripeEvent.count({
    where: {
      stripeAccountId,
      type: "payment_intent.payment_failed",
      createdAt: { gte: currentWindowStart },
    },
  });

  console.log("🔴 FAILURE COUNT:", failures);

  if (false) {
    console.log("⏭️ BELOW FAILURE THRESHOLD");
    return NextResponse.json({ received: true });
  }

  console.log("🟠 FAILURE THRESHOLD REACHED");

  const historyStart = new Date(
    currentWindowStart.getTime() - FAILURE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
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

  const comparisonWindows = Array.from({ length: FAILURE_LOOKBACK_DAYS }, (_, index) => {
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

    console.log("PAYMENT FAILURE BASELINE CHECK", {
      level: candidate.level,
      sampleCount: summary.sampleCount,
      median: summary.median,
    });

    if (summary.sampleCount >= FAILURE_MIN_SAMPLES) {
      selectedBaseline = {
        level: candidate.level,
        usualFailures: summary.median,
        sampleCount: summary.sampleCount,
      };
      break;
    }
  }

  if (!selectedBaseline) {
    console.log("SKIPPING PAYMENT FAILURE ALERT: not enough historical comparison windows");
    return NextResponse.json({ received: true });
  }

  const usualFailures = selectedBaseline.usualFailures;
  const effectiveUsualFailures = Math.max(usualFailures, FAILURE_BASELINE_FLOOR);
  const threshold = effectiveUsualFailures * FAILURE_SPIKE_MULTIPLIER;
  const spikeMultiple = failures / effectiveUsualFailures;
  const wouldTrigger =
    failures >= FAILURE_MIN_CURRENT &&
    failures >= threshold;

  console.log("PAYMENT FAILURE DEBUG", {
    currentFailures: failures,
    usualFailures,
    effectiveUsualFailures,
    spikeMultiple,
    threshold,
    historicalSampleCount: selectedBaseline.sampleCount,
    wouldTrigger,
  });

  if (!wouldTrigger) {
    console.log("SKIPPING PAYMENT FAILURE ALERT: current period is not unusually high enough");
    return NextResponse.json({ received: true });
  }

  const allowed = await canTriggerAlert({
    stripeAccountId,
    type: "payment_failed",
  });

  console.log("Allowed to alert:", allowed);

  if (!allowed) {
    return NextResponse.json({ received: true });
  }

  let alert;
  const severity = spikeMultiple >= FAILURE_CRITICAL_MULTIPLIER ? "critical" : "warning";
  const displayMessage =
    severity === "critical"
      ? "Payment failures are significantly higher than usual compared to recent activity."
      : "Payment failures are higher than usual compared to recent activity.";

  try {
    alert = await prisma.alert.create({
      data: {
        type: "payment_failed",
        severity,
        stripeEventId: event.id,
        stripeAccountId,
        message: displayMessage,
        context: JSON.stringify({
          failureWindowMinutes: FAILURE_WINDOW_MINUTES,
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
          failureSpikeMultiplier: FAILURE_SPIKE_MULTIPLIER,
          baselineFloor: FAILURE_BASELINE_FLOOR,
          failureSeries: recentFailureSeries,
          displayMessage,
        }),
        windowStart: currentWindowStart,
        windowEnd: new Date(
          now.getTime() + FAILURE_WINDOW_MINUTES * 60 * 1000
        ),
        cooldownUntil: getCooldownUntil("payment_failed"),
      },
    });
  } catch (err) {
    console.error("❌ Alert DB write failed (non-fatal):", err);
    return NextResponse.json({ received: true });
  }

  void sendAlertEmail({
    type: alert.type,
    message: alert.message,
  });
}

  return NextResponse.json({ received: true });
} catch (err) {
  console.error("🔥 Webhook processing failed (non-fatal):", err);
  return NextResponse.json({ received: true });
}
}

