import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";



const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

export async function POST(req: Request) {
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


    if (event.type === "payment_intent.payment_failed") {
  await prisma.alert.create({
    data: {
      type: "payment_failed",
      stripeAccountId: event.account ?? null,
      stripeEventId: event.id,
      message: "A payment failed in Stripe",
    },
  });
}


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


    

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("❌ Webhook verification failed:", err.message);
    return NextResponse.json({ error: "Webhook error" }, { status: 400 });
  }
}
