import { auth } from "@/auth";
import { getManagedSubscriptionsForCustomer } from "@/lib/subscription-sync";
import { prisma } from "@/lib/prisma";
import { getStripeMode } from "@/lib/stripe-customer";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

function redirectToBilling(appUrl: string, search: string) {
  return NextResponse.redirect(new URL(`/billing${search}`, appUrl), {
    status: 303,
  });
}

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return redirectToBilling(appUrl, "?billing=use_billing_page");
}

export async function POST() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", appUrl), { status: 303 });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        stripeCustomerId: true,
        stripeTestCustomerId: true,
        stripeLiveCustomerId: true,
      },
    });

    if (!user) {
      return NextResponse.redirect(new URL("/login", appUrl), { status: 303 });
    }

    const { field } = getStripeMode();
    const customerId = user[field] ?? user.stripeCustomerId;

    if (!customerId) {
      return redirectToBilling(appUrl, "?billing=no_profile");
    }

    const managedSubscriptions = await getManagedSubscriptionsForCustomer(customerId);
    const currentManagedSubscription = managedSubscriptions[0];

    if (!currentManagedSubscription) {
      return redirectToBilling(appUrl, "?billing=no_profile");
    }

    const fullSubscription = await stripe.subscriptions.retrieve(
      currentManagedSubscription.id,
      { expand: ["schedule"] }
    );

    const scheduleId =
      typeof fullSubscription.schedule === "string"
        ? fullSubscription.schedule
        : fullSubscription.schedule?.id ?? null;

    if (!scheduleId) {
      return redirectToBilling(appUrl, "?billing=downgrade_cancelled");
    }

    await stripe.subscriptionSchedules.release(scheduleId);

    console.log("RELEASED SCHEDULED DOWNGRADE", {
      userId: user.id,
      customerId,
      subscriptionId: fullSubscription.id,
      scheduleId,
    });

    return redirectToBilling(appUrl, "?billing=downgrade_cancelled");
  } catch (error) {
    console.error("FAILED TO CANCEL SCHEDULED DOWNGRADE", {
      userId: session.user.id,
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
            }
          : error,
    });
    return redirectToBilling(appUrl, "?billing=downgrade_error");
  }
}
