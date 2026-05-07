import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveCheckoutCustomerId } from "@/lib/stripe-customer";
import {
  cancelOtherManagedSubscriptions,
  getManagedSubscriptionsForCustomer,
  syncUserPlanFromStripe,
} from "@/lib/subscription-sync";
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
      plan: true,
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

  const managedSubscriptions = await getManagedSubscriptionsForCustomer(stripeCustomerId);
  const currentManagedSubscription = managedSubscriptions[0];

  if (currentManagedSubscription) {
    const fullSubscription = await stripe.subscriptions.retrieve(
      currentManagedSubscription.id
    );
    const currentItem = fullSubscription.items.data[0];

    if (!currentItem) {
      return NextResponse.redirect(new URL("/billing?billing=customer_error", appUrl));
    }

    console.log("STARTING PRO UPGRADE ON EXISTING SUBSCRIPTION", {
      userId: user.id,
      customerId: stripeCustomerId,
      previousPlan: user.plan,
      subscriptionId: fullSubscription.id,
      previousPriceId: currentItem.price.id,
      nextPriceId: priceId,
    });

    await stripe.subscriptions.update(fullSubscription.id, {
      items: [
        {
          id: currentItem.id,
          price: priceId,
        },
      ],
      metadata: {
        userId: user.id,
        plan: "pro",
      },
      proration_behavior: "create_prorations",
    });

    await cancelOtherManagedSubscriptions(stripeCustomerId, fullSubscription.id);
    await syncUserPlanFromStripe(user.id);

    return NextResponse.redirect(new URL("/dashboard?billing=success", appUrl));
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
