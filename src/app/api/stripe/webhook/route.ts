import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { sendAlertEmail } from "@/lib/notify";
import { canTriggerAlert } from "@/lib/alert-guard";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});



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
 * - BASELINE_HOURS:        14 days
 *   Rationale: captures a stable recent norm while adapting over time.
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



const REVENUE_WINDOW_MINUTES = 60;      // 1 hour sustained window
const BASELINE_HOURS = 14 * 24;         // 14 days baseline


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



const MIN_BASELINE_REVENUE = 500_00;    // €500 baseline required
const MIN_CURRENT_REVENUE = 100_00;     // €100 current activity required





// Payment failure alert (production-safe defaults)

const FAILURE_WINDOW_MINUTES = 30;  // sustained failures, not spikes
const FAILURE_THRESHOLD = 5;        // meaningful failure volume


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

// ---------------- WEBHOOK ----------------

export async function POST(req: Request) {
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
  } catch (err: any) {
    console.error("❌ Webhook verification failed:", err.message);
    return NextResponse.json({ error: "Webhook error" }, { status: 400 });
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
  stripeAccountId = "dev_test_account";
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


  // 1️⃣ Store every event (audit trail)
  await prisma.stripeEvent.upsert({
    where: { stripeEventId: event.id },
    update: {},
create: {
  stripeEventId: event.id,
  type: event.type,
  stripeAccountId,
  payload: JSON.stringify(event),
},


  });

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

    await prisma.revenueMetric.create({
      data: {
        stripeAccountId,

        amount: pi.amount_received,
        periodStart: new Date(now.getTime() - REVENUE_WINDOW_MINUTES * 60 * 1000),
        periodEnd: now,
      },
    });

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

    const baselineRevenue = await prisma.revenueMetric.aggregate({
      _sum: { amount: true },
     where: {
  stripeAccountId,
  periodEnd: { gte: baselineStart, lt: currentWindowStart },
},

    });

    const currentAmount = currentRevenue._sum.amount ?? 0;
    const baselineAmount = baselineRevenue._sum.amount ?? 0;

    if (
      baselineAmount < MIN_BASELINE_REVENUE ||
      currentAmount < MIN_CURRENT_REVENUE
    ) {
      return NextResponse.json({ received: true });
    }

    const dropRatio = 1 - currentAmount / baselineAmount;

let severity: "warning" | "critical" = "warning";

if (dropRatio >= 0.8) {
  severity = "critical";
}


    if (dropRatio < DROP_THRESHOLD) {
      return NextResponse.json({ received: true });
    }

 const allowed = await canTriggerAlert({
  stripeAccountId,
  type: "revenue_drop",
});


    if (!allowed) {
      return NextResponse.json({ received: true });
    }

const alert = await prisma.alert.create({
  data: {
    type: "revenue_drop",
    severity,
    stripeEventId: event.id,
    stripeAccountId,
    message: `Revenue dropped by ${(dropRatio * 100).toFixed(0)}% compared to baseline.
Baseline (${BASELINE_HOURS}h): €${(baselineAmount / 100).toFixed(2)}
Current (${REVENUE_WINDOW_MINUTES} min): €${(currentAmount / 100).toFixed(2)}`,
context: JSON.stringify({
  dropRatio,
  baselineHours: BASELINE_HOURS,
  baselineAmount,
  currentWindowMinutes: REVENUE_WINDOW_MINUTES,
  currentAmount,
  threshold: DROP_THRESHOLD,
}),


    windowStart: currentWindowStart,
    windowEnd: new Date(now.getTime() + REVENUE_WINDOW_MINUTES * 60 * 1000),
    cooldownUntil: getCooldownUntil("revenue_drop"),
  },
});




    await sendAlertEmail({
      type: alert.type,
      message: alert.message,
    });
  }

  // ---------------- PAYMENT FAILURES ----------------


/**
 * Payment failure spike detection.
 *
 * Individual payment failures are expected and normal.
 * Alerts are triggered only when failures cluster within
 * a short time window, indicating a systemic issue.
 */



  if (event.type === "payment_intent.payment_failed") {


    const windowStart = new Date(
      Date.now() - FAILURE_WINDOW_MINUTES * 60 * 1000
    );

    const failures = await prisma.stripeEvent.count({
      where: {
        stripeAccountId,
        type: "payment_intent.payment_failed",
        createdAt: { gte: windowStart },
      },
    });

   if (failures < FAILURE_THRESHOLD) {
  return NextResponse.json({ received: true });
}


    const allowed = await canTriggerAlert({
      stripeAccountId,
      type: "payment_failed",
    });

    if (!allowed) {
      return NextResponse.json({ received: true });
    }

const alert = await prisma.alert.create({
  data: {
    type: "payment_failed",
    severity: "warning",
    stripeEventId: event.id,
    stripeAccountId,
    message: `Multiple payment failures detected in the last ${FAILURE_WINDOW_MINUTES} minutes`,
 context: JSON.stringify({
  failureWindowMinutes: FAILURE_WINDOW_MINUTES,
  failureThreshold: FAILURE_THRESHOLD,
  failuresCounted: failures,
}),


    windowStart,
    windowEnd: new Date(
      Date.now() + FAILURE_WINDOW_MINUTES * 60 * 1000
    ),
    cooldownUntil: getCooldownUntil("payment_failed"),
  },
});


    await sendAlertEmail({
      type: alert.type,
      message: alert.message,
    });
  }

  return NextResponse.json({ received: true });
}
