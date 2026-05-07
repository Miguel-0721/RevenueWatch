import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getStripeMode } from "@/lib/stripe-customer";
import type { UserPlan } from "@prisma/client";
import type Stripe from "stripe";

const PLAN_RANK: Record<UserPlan, number> = {
  FREE: 0,
  GROWTH: 1,
  PRO: 2,
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
  "unpaid",
]);

export type ManagedStripeSubscription = {
  id: string;
  status: Stripe.Subscription.Status;
  priceId: string | null;
  mappedPlan: Exclude<UserPlan, "FREE">;
  created: number;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
};

export function planFromPriceId(priceId: string | null | undefined): UserPlan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_GROWTH_PRICE_ID) return "GROWTH";
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "PRO";
  return null;
}

export async function getManagedSubscriptionsForCustomer(customerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });

  const managedSubscriptions: ManagedStripeSubscription[] = [];

  for (const subscription of subscriptions.data) {
    const priceId = subscription.items.data[0]?.price?.id ?? null;
    const mappedPlan = planFromPriceId(priceId);
    const periodAwareSubscription = subscription as Stripe.Subscription & {
      current_period_end?: number;
    };

    if (
      !mappedPlan ||
      mappedPlan === "FREE" ||
      !ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)
    ) {
      continue;
    }

    managedSubscriptions.push({
      id: subscription.id,
      status: subscription.status,
      priceId,
      mappedPlan,
      created: subscription.created,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: periodAwareSubscription.current_period_end ?? null,
    });
  }

  return managedSubscriptions.sort((left, right) => {
      if (left.cancelAtPeriodEnd !== right.cancelAtPeriodEnd) {
        return left.cancelAtPeriodEnd ? 1 : -1;
      }
      const rankDifference = PLAN_RANK[right.mappedPlan] - PLAN_RANK[left.mappedPlan];
      if (rankDifference !== 0) return rankDifference;
      return right.created - left.created;
    });
}

export async function cancelOtherManagedSubscriptions(
  customerId: string,
  keepSubscriptionId: string
) {
  const managedSubscriptions = await getManagedSubscriptionsForCustomer(customerId);
  const duplicates = managedSubscriptions.filter(
    (subscription) => subscription.id !== keepSubscriptionId
  );

  for (const subscription of duplicates) {
    console.log("CANCELING EXTRA MANAGED SUBSCRIPTION", {
      customerId,
      keepSubscriptionId,
      cancelSubscriptionId: subscription.id,
      cancelPlan: subscription.mappedPlan,
      cancelPriceId: subscription.priceId,
    });

    await stripe.subscriptions.cancel(subscription.id);
  }
}

export async function syncUserPlanFromStripe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      plan: true,
      stripeCustomerId: true,
      stripeTestCustomerId: true,
      stripeLiveCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
    },
  });

  if (!user) return null;

  const { field } = getStripeMode();
  const customerId = user[field] ?? user.stripeCustomerId;

  if (!customerId) {
    console.log("BILLING SYNC SKIPPED: no Stripe customer ID", {
      userId,
      modeField: field,
    });
    return user;
  }

  const managedSubscriptions = await getManagedSubscriptionsForCustomer(customerId);

  const effectiveSubscription = managedSubscriptions[0] ?? null;
  const nextPlan = effectiveSubscription?.mappedPlan ?? "FREE";
  const nextSubscriptionId = effectiveSubscription?.id ?? null;
  const nextStatus = effectiveSubscription?.status ?? "canceled";

  console.log("BILLING SYNC FROM STRIPE", {
    userId,
    customerId,
    previousPlan: user.plan,
    previousSubscriptionId: user.stripeSubscriptionId,
    newPlan: nextPlan,
    subscriptionId: nextSubscriptionId,
    priceId: effectiveSubscription?.priceId ?? null,
    managedSubscriptionCount: managedSubscriptions.length,
  });

  return prisma.user.update({
    where: { id: user.id },
    data: {
      plan: nextPlan,
      stripeCustomerId: customerId,
      stripeSubscriptionId: nextSubscriptionId,
      subscriptionStatus: nextStatus,
      [field]: customerId,
    },
  });
}
