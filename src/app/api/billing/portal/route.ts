import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getStripeMode } from "@/lib/stripe-customer";
import Stripe from "stripe";
import { NextResponse } from "next/server";

function isMissingCustomerError(error: unknown) {
  return (
    error instanceof Stripe.errors.StripeInvalidRequestError &&
    error.code === "resource_missing"
  );
}

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", appUrl));
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      stripeCustomerId: true,
      stripeTestCustomerId: true,
      stripeLiveCustomerId: true,
    },
  });

  if (!user) {
    return NextResponse.redirect(new URL("/login", appUrl));
  }

  const { field } = getStripeMode();
  const stripeCustomerId = user[field] ?? user.stripeCustomerId;

  if (!stripeCustomerId) {
    return NextResponse.redirect(new URL("/billing?billing=no_profile", appUrl));
  }

  try {
    const customer = await stripe.customers.retrieve(stripeCustomerId);

    if ("deleted" in customer && customer.deleted) {
      return NextResponse.redirect(new URL("/billing?billing=no_profile", appUrl));
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${appUrl}/dashboard`,
    });

    return NextResponse.redirect(portalSession.url);
  } catch (error) {
    if (isMissingCustomerError(error)) {
      return NextResponse.redirect(new URL("/billing?billing=no_profile", appUrl));
    }

    return NextResponse.redirect(new URL("/billing?billing=customer_error", appUrl));
  }
}
