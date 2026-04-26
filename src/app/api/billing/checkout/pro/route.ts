import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveCheckoutCustomerId } from "@/lib/stripe-customer";
import { customerHasManagedSubscription } from "@/lib/subscription-guard";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", appUrl));
  }

  if (!priceId) {
    return NextResponse.json(
      { error: "Missing STRIPE_PRO_PRICE_ID" },
      { status: 500 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      stripeCustomerId: true,
      stripeTestCustomerId: true,
      stripeLiveCustomerId: true,
    },
  });

  if (!user) {
    return NextResponse.redirect(new URL("/login", appUrl));
  }

  if (!user.email) {
    return NextResponse.redirect(new URL("/billing?reason=missing_email", appUrl));
  }

  let stripeCustomerId: string;

  try {
    stripeCustomerId = await resolveCheckoutCustomerId(user);
  } catch {
    return NextResponse.redirect(new URL("/billing?billing=customer_error", appUrl));
  }

  if (await customerHasManagedSubscription(stripeCustomerId)) {
    return NextResponse.redirect(new URL("/api/billing/portal", appUrl));
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/dashboard?billing=success`,
    cancel_url: `${appUrl}/billing?billing=cancelled`,
    metadata: {
      userId: user.id,
      plan: "pro",
    },
    subscription_data: {
      metadata: {
        userId: user.id,
        plan: "pro",
      },
    },
  });

  if (!checkoutSession.url) {
    return NextResponse.json(
      { error: "Stripe Checkout did not return a URL" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(checkoutSession.url);
}
