import { auth } from "@/auth";
import {
  getManagedSubscriptionsForCustomer,
} from "@/lib/subscription-sync";
import { prisma } from "@/lib/prisma";
import { resolveCheckoutCustomerId } from "@/lib/stripe-customer";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const GROWTH_LIMIT = 10;

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
  const growthPriceId = process.env.STRIPE_GROWTH_PRICE_ID;
  const session = await auth();
  let debugContext: Record<string, unknown> = {
    userId: session?.user?.id ?? null,
    targetGrowthPriceId: growthPriceId ?? null,
  };

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", appUrl), { status: 303 });
  }

  if (!growthPriceId) {
    console.error("Missing STRIPE_GROWTH_PRICE_ID for scheduled downgrade", {
      userId: session.user.id,
    });
    return redirectToBilling(appUrl, "?billing=missing_growth_price");
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        stripeCustomerId: true,
        stripeTestCustomerId: true,
        stripeLiveCustomerId: true,
        plan: true,
        stripeAccounts: {
          where: { status: "active" },
          select: { id: true },
        },
      },
    });

    if (!user) {
      return NextResponse.redirect(new URL("/login", appUrl), { status: 303 });
    }

    const connectedAccountCount = user.stripeAccounts.length;
    debugContext = {
      ...debugContext,
      accountCount: connectedAccountCount,
      previousPlan: user.plan,
    };

    if (connectedAccountCount > GROWTH_LIMIT) {
      return redirectToBilling(
        appUrl,
        `?billing=downgrade_blocked&connected=${connectedAccountCount}`
      );
    }

    const stripeCustomerId = await resolveCheckoutCustomerId(user);
    debugContext = {
      ...debugContext,
      stripeCustomerId,
    };
    const managedSubscriptions = await getManagedSubscriptionsForCustomer(
      stripeCustomerId
    );
    const currentManagedSubscription = managedSubscriptions[0];
    debugContext = {
      ...debugContext,
      managedSubscriptionCount: managedSubscriptions.length,
      selectedManagedSubscriptionId: currentManagedSubscription?.id ?? null,
      selectedManagedSubscriptionStatus: currentManagedSubscription?.status ?? null,
      selectedManagedSubscriptionCancelAtPeriodEnd:
        currentManagedSubscription?.cancelAtPeriodEnd ?? null,
      selectedManagedSubscriptionCurrentPeriodEnd:
        currentManagedSubscription?.currentPeriodEnd ?? null,
      selectedManagedSubscriptionPriceId: currentManagedSubscription?.priceId ?? null,
    };

    if (!currentManagedSubscription) {
      return redirectToBilling(appUrl, "?billing=no_profile");
    }

    const fullSubscription = (await stripe.subscriptions.retrieve(
      currentManagedSubscription.id
    )) as Stripe.Subscription;
    const currentItem = fullSubscription.items.data[0];
    const subscriptionWindow = fullSubscription as Stripe.Subscription & {
      current_period_start: number;
      current_period_end: number;
    };
    debugContext = {
      ...debugContext,
      subscriptionId: fullSubscription.id,
      subscriptionStatus: fullSubscription.status,
      cancelAtPeriodEnd: fullSubscription.cancel_at_period_end,
      currentPeriodEnd: subscriptionWindow.current_period_end,
      currentPriceId: currentItem?.price?.id ?? null,
      existingScheduleId:
        typeof fullSubscription.schedule === "string"
          ? fullSubscription.schedule
          : fullSubscription.schedule?.id ?? null,
    };

    if (!currentItem) {
      console.error("Managed subscription missing item during growth downgrade", {
        userId: user.id,
        customerId: stripeCustomerId,
        subscriptionId: fullSubscription.id,
        targetGrowthPriceId: growthPriceId,
        connectedAccountCount,
      });
      return redirectToBilling(appUrl, "?billing=downgrade_error");
    }

    console.log("STARTING GROWTH DOWNGRADE", {
      ...debugContext,
    });

    if (fullSubscription.cancel_at_period_end) {
      await stripe.subscriptions.update(fullSubscription.id, {
        cancel_at_period_end: false,
      });
      debugContext = {
        ...debugContext,
        cancelAtPeriodEnd: false,
      };
    }

    const existingScheduleId =
      typeof fullSubscription.schedule === "string"
        ? fullSubscription.schedule
        : fullSubscription.schedule?.id ?? null;

    let schedule: Stripe.SubscriptionSchedule;

    if (existingScheduleId) {
      const existingSchedule = await stripe.subscriptionSchedules.retrieve(
        existingScheduleId
      );

      if (
        existingSchedule.status === "active" ||
        existingSchedule.status === "not_started"
      ) {
        schedule = existingSchedule;
      } else {
        schedule = await stripe.subscriptionSchedules.create({
          from_subscription: fullSubscription.id,
        });
      }
    } else {
      schedule = await stripe.subscriptionSchedules.create({
        from_subscription: fullSubscription.id,
      });
    }

    debugContext = {
      ...debugContext,
      scheduleId: schedule.id,
      scheduleStatus: schedule.status,
      scheduleCurrentPhaseStart: schedule.current_phase?.start_date ?? null,
      scheduleCurrentPhaseEnd: schedule.current_phase?.end_date ?? null,
    };

    const currentPhaseStart =
      schedule.current_phase?.start_date ??
      schedule.phases[0]?.start_date ??
      subscriptionWindow.current_period_start ??
      Math.floor(Date.now() / 1000);
    const currentPhaseEnd =
      schedule.current_phase?.end_date ??
      schedule.phases[0]?.end_date ??
      subscriptionWindow.current_period_end ??
      currentManagedSubscription.currentPeriodEnd ??
      null;

    debugContext = {
      ...debugContext,
      resolvedPhaseStart: currentPhaseStart,
      resolvedPhaseEnd: currentPhaseEnd,
    };

    if (!currentPhaseEnd) {
      console.error("Missing current phase end for scheduled growth downgrade", {
        ...debugContext,
      });
      return redirectToBilling(appUrl, "?billing=downgrade_error");
    }

    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      phases: [
        {
          start_date: currentPhaseStart,
          end_date: currentPhaseEnd,
          items: [
            {
              price: currentItem.price.id,
              quantity: currentItem.quantity ?? 1,
            },
          ],
          metadata: {
            userId: user.id,
            plan: "pro",
          },
        },
        {
          start_date: currentPhaseEnd,
          items: [
            {
              price: growthPriceId,
              quantity: currentItem.quantity ?? 1,
            },
          ],
          metadata: {
            userId: user.id,
            plan: "growth",
          },
        },
      ],
    });

    console.log("SCHEDULED GROWTH DOWNGRADE", {
      userId: user.id,
      customerId: stripeCustomerId,
      subscriptionId: fullSubscription.id,
      scheduleId: schedule.id,
      effectiveAt: currentPhaseEnd,
    });

    return redirectToBilling(appUrl, "?billing=downgrade_scheduled");
  } catch (error) {
    console.error("FAILED TO SCHEDULE GROWTH DOWNGRADE", {
      ...debugContext,
      error:
        error instanceof Stripe.errors.StripeError
          ? {
              message: error.message,
              type: error.type,
              code: error.code,
              decline_code: error.decline_code,
              param: error.param,
              statusCode: error.statusCode,
              requestId: error.requestId,
              stack: error.stack,
            }
          : error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
            }
          : error,
    });
    return redirectToBilling(appUrl, "?billing=downgrade_error");
  }
}
