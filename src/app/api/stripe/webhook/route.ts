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


function getCooldownUntil(type: string) {
  const now = Date.now();

  const hours =
    type === "revenue_drop" ? 12 :
    type === "payment_failed" ? 6 :
    6;

  return new Date(now + hours * 60 * 60 * 1000);
}



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


// Low-volume guard: ignore tiny current windows
const MIN_CURRENT_REVENUE = 2_000; // €20 in cents

if (currentAmount < MIN_CURRENT_REVENUE) {
  console.log(
    "[NO ALERT] Current revenue too low for meaningful drop detection"
  );
  return NextResponse.json({ received: true });
}



      if (dropRatio >= DROP_THRESHOLD) {


// Sustained condition: require drop in previous window too
const previousWindowStart = new Date(
  currentWindowStart.getTime() - REVENUE_WINDOW_MINUTES * 60 * 1000
);

const previousRevenue = await prisma.revenueMetric.aggregate({
  _sum: { amount: true },
  where: {
    stripeAccountId: event.account ?? null,
    periodEnd: {
      gte: previousWindowStart,
      lt: currentWindowStart,
    },
  },
});

const previousAmount = previousRevenue._sum.amount ?? 0;

const previousDropRatio =
  baselineAmount > 0 ? 1 - previousAmount / baselineAmount : 0;

if (previousDropRatio < DROP_THRESHOLD) {
  console.log(
    "[NO ALERT] Revenue drop not sustained across multiple windows"
  );
  return NextResponse.json({ received: true });
}



        const existingAlert = await prisma.alert.findFirst({
          where: {
            type: "revenue_drop",
            stripeAccountId: event.account ?? null,
            windowEnd: { gte: now },
          },
        });

    if (!existingAlert) {

  const cooldownActive = await prisma.alert.findFirst({
    where: {
      type: "revenue_drop",
      stripeAccountId: event.account ?? null,
      cooldownUntil: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (cooldownActive) {
    console.log(
      `[ALERT SKIPPED] revenue_drop still in cooldown until ${cooldownActive.cooldownUntil}`
    );
    return NextResponse.json({ received: true });
  }

const alert = await prisma.alert.create({
  data: {
    type: "revenue_drop",
    stripeEventId: event.id,
    stripeAccountId: event.account ?? null,
    message: `Revenue dropped by ${(dropRatio * 100).toFixed(0)}% compared to baseline`,
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

// Low-volume guard: require enough activity
const MIN_FAILURE_EVENTS = 5;

if (recentFailures < MIN_FAILURE_EVENTS) {
  console.log(
    "[NO ALERT] Not enough payment failures to be statistically meaningful"
  );
  return NextResponse.json({ received: true });
}



// Sustained condition: check previous failure window
const previousFailureWindowStart = new Date(
  windowStart.getTime() - FAILURE_WINDOW_MINUTES * 60 * 1000
);

const previousFailures = await prisma.stripeEvent.count({
  where: {
    type: "payment_intent.payment_failed",
    createdAt: {
      gte: previousFailureWindowStart,
      lt: windowStart,
    },
    stripeAccountId: event.account ?? null,
  },
});

if (previousFailures < FAILURE_THRESHOLD) {
  console.log(
    "[NO ALERT] Payment failures not sustained across windows"
  );
  return NextResponse.json({ received: true });
}



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

  const cooldownActive = await prisma.alert.findFirst({
    where: {
      type: "payment_failed",
      stripeAccountId: event.account ?? null,
      cooldownUntil: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (cooldownActive) {
    console.log(
      `[ALERT SKIPPED] payment_failed still in cooldown until ${cooldownActive.cooldownUntil}`
    );
    return NextResponse.json({ received: true });
  }

const alert = await prisma.alert.create({
  data: {
    type: "payment_failed",
    stripeEventId: event.id,
    stripeAccountId: event.account ?? null,
    message: `Multiple payment failures detected within ${FAILURE_WINDOW_MINUTES} minutes`,
    windowStart,
    windowEnd: new Date(Date.now() + FAILURE_WINDOW_MINUTES * 60 * 1000),
    cooldownUntil: getCooldownUntil("payment_failed"),
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
