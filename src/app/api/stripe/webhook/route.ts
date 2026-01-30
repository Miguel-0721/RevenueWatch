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



const REVENUE_WINDOW_MINUTES = 2;   // DEBUG: 5-minute window
const BASELINE_HOURS = 14 * 24; // 14 day  // DEBUG: ~30 hours baseline



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

const FAILURE_WINDOW_MINUTES = 30;  // sustained failures, not spikes
const FAILURE_THRESHOLD = 2;        // meaningful failure volume


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
      hourOfDay: now.getHours(), // 0–23
      dayOfWeek: now.getDay(),   // 0–6
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


const nowHour = now.getHours();
const nowDay = now.getDay();
const isWeekend = nowDay === 0 || nowDay === 6;

const baselineMetrics = await prisma.revenueMetric.findMany({
  where: {
    stripeAccountId,
    periodEnd: { gte: baselineStart, lt: currentWindowStart },
    hourOfDay: nowHour,
    ...(isWeekend
      ? { dayOfWeek: { in: [0, 6] } }
      : { dayOfWeek: { in: [1, 2, 3, 4, 5] } }),
  },
  select: {
    amount: true,
  },
});



console.log("🔵 BASELINE CHECK");
console.log("Now hour:", nowHour);
console.log("Now day:", nowDay);
console.log("Baseline count:", baselineMetrics.length);


if (baselineMetrics.length < 5) {
  return NextResponse.json({ received: true });
}






const baselineTotal = baselineMetrics.reduce(
  (sum, m) => sum + m.amount,
  0
);

const baselineAveragePerWindow =
  baselineTotal / baselineMetrics.length;

    const baselineAmount = baselineAveragePerWindow;


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
  baselineCount: baselineMetrics.length,
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
Baseline (same hour & day type, last ${BASELINE_HOURS}h): €${(baselineAmount / 100).toFixed(2)}
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

  console.log("🔴 FAILURE COUNT:", failures);

  if (failures < FAILURE_THRESHOLD) {
    console.log("⏭️ BELOW FAILURE THRESHOLD");
    return NextResponse.json({ received: true });
  }

  console.log("🟠 FAILURE THRESHOLD REACHED");

  const allowed = await canTriggerAlert({
    stripeAccountId,
    type: "payment_failed",
  });

  console.log("Allowed to alert:", allowed);

  if (!allowed) {
    return NextResponse.json({ received: true });
  }

  let alert;

  try {
    alert = await prisma.alert.create({
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

