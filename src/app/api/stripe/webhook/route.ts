import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { sendAlertEmail } from "@/lib/notify";
import { Resend } from "resend";
import "@/lib/notify";
const resend = new Resend(process.env.RESEND_API_KEY!);



const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});


// ---- Alert configuration (safe defaults) ----

// Revenue drop detection
const REVENUE_WINDOW_MINUTES = 60;
const BASELINE_HOURS = 24;
const DROP_THRESHOLD = 0.4; // 40%
const MIN_BASELINE_REVENUE = 10_000; // €100 in cents

// Payment failure aggregation
const FAILURE_WINDOW_MINUTES = 15;
const FAILURE_THRESHOLD = 3;



export async function POST(req: Request) {
  console.log("🧠 WEBHOOK ROUTE HIT");
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await req.arrayBuffer();
  const buffer = Buffer.from(body);

  try {
    const event = stripe.webhooks.constructEvent(
      buffer,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    console.log("✅ Webhook verified:", event.type);

// 1️⃣ Store every Stripe event (audit trail)
    await prisma.stripeEvent.upsert({
      where: { stripeEventId: event.id },
      update: {},
      create: {
        stripeEventId: event.id,
        type: event.type,
        stripeAccountId: event.account ?? null,
        payload: JSON.stringify(event),
      },
    });


// Ignore events we don't care about for alerts
if (
  event.type !== "payment_intent.succeeded" &&
  event.type !== "payment_intent.payment_failed"
) {
  return NextResponse.json({ received: true });
}



    

// 2️⃣ Record revenue for successful payments (facts only)
if (event.type === "payment_intent.succeeded") {
  const pi = event.data.object as Stripe.PaymentIntent;

  if (pi.amount_received && pi.amount_received > 0) {
    const now = new Date();

    await prisma.revenueMetric.create({
      data: {
        stripeAccountId: event.account ?? null,
        amount: pi.amount_received,
        periodStart: new Date(now.getTime() - 60 * 60 * 1000),
        periodEnd: now,
      },
    });

// 3️⃣ Revenue drop detection (after revenue is recorded)


    const currentWindowStart = new Date(
      now.getTime() - REVENUE_WINDOW_MINUTES * 60 * 1000
    );
    const baselineStart = new Date(
      now.getTime() - BASELINE_HOURS * 60 * 60 * 1000
    );

    const currentRevenue = await prisma.revenueMetric.aggregate({
      _sum: { amount: true },
      where: {
        stripeAccountId: event.account ?? null,
        periodEnd: { gte: currentWindowStart },
      },
    });

    const baselineRevenue = await prisma.revenueMetric.aggregate({
      _sum: { amount: true },
      where: {
        stripeAccountId: event.account ?? null,
        periodEnd: {
          gte: baselineStart,
          lt: currentWindowStart,
        },
      },
    });

    const currentAmount = currentRevenue._sum.amount ?? 0;
    const baselineAmount = baselineRevenue._sum.amount ?? 0;

    if (baselineAmount > MIN_BASELINE_REVENUE) {
      const dropRatio = 1 - currentAmount / baselineAmount;

      if (dropRatio >= DROP_THRESHOLD) {
        const existingAlert = await prisma.alert.findFirst({
          where: {
            type: "revenue_drop",
            stripeAccountId: event.account ?? null,
            windowEnd: { gte: now },
          },
        });

        if (!existingAlert) {
     const alert = await prisma.alert.create({
  data: {
    type: "revenue_drop",
    stripeEventId: event.id,
    stripeAccountId: event.account ?? null,
    message: `Revenue dropped by ${(dropRatio * 100).toFixed(0)}% compared to baseline`,
    windowStart: currentWindowStart,
    windowEnd: new Date(now.getTime() + REVENUE_WINDOW_MINUTES * 60 * 1000),
  },
});

await sendAlertEmail({
  type: alert.type,
  message: alert.message,
});

        }
      }
    }
  }
}




// 4️⃣ Aggregated payment failure detection
    if (event.type === "payment_intent.payment_failed") {


 const windowStart = new Date(
  Date.now() - FAILURE_WINDOW_MINUTES * 60 * 1000
);


  const recentFailures = await prisma.stripeEvent.count({
    where: {
      type: "payment_intent.payment_failed",
      createdAt: {
        gte: windowStart,
      },
      stripeAccountId: event.account ?? null,
    },
  });

 if (recentFailures >= FAILURE_THRESHOLD) {
    const existingAlert = await prisma.alert.findFirst({
      where: {
        type: "payment_failed",
        stripeAccountId: event.account ?? null,
        windowEnd: {
          gte: new Date(),
        },
      },
    });

    if (!existingAlert) {
  const alert = await prisma.alert.create({
  data: {
    type: "payment_failed",
    stripeEventId: event.id,
    stripeAccountId: event.account ?? null,
    message: `Multiple payment failures detected within ${FAILURE_WINDOW_MINUTES} minutes`,
    windowStart,
    windowEnd: new Date(Date.now() + FAILURE_WINDOW_MINUTES * 60 * 1000),
  },
});

await sendAlertEmail({
  type: alert.type,
  message: alert.message,
});

    }
  }
}


    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("❌ Webhook verification failed:", err.message);
    return NextResponse.json({ error: "Webhook error" }, { status: 400 });
  }
}
