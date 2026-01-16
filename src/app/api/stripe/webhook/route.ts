import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { sendAlertEmail } from "@/lib/notify";
import { canTriggerAlert } from "@/lib/alert-guard";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

// ---------------- CONFIG ----------------

const REVENUE_WINDOW_MINUTES = 60;
const BASELINE_HOURS = 30;
const DROP_THRESHOLD = 0.4;
const MIN_BASELINE_REVENUE = 1; // €100+
const MIN_CURRENT_REVENUE = 1;   // €20+



const FAILURE_WINDOW_MINUTES = 15;
const FAILURE_THRESHOLD = 3;

// ---------------- HELPERS ----------------

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


const stripeAccountId =
  event.account ?? "test_account_local";



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
    stripeEventId: event.id,
    stripeAccountId,
    message: `Revenue dropped by ${(dropRatio * 100).toFixed(0)}% compared to baseline.
Baseline (${BASELINE_HOURS}h): €${(baselineAmount / 100).toFixed(2)}
Current (${REVENUE_WINDOW_MINUTES} min): €${(currentAmount / 100).toFixed(2)}`,
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
        stripeEventId: event.id,
        stripeAccountId,
      message: `Multiple payment failures detected in the last ${FAILURE_WINDOW_MINUTES} minutes`,

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
