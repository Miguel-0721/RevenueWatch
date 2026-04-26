import { stripe } from "@/lib/stripe";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
]);

export async function customerHasManagedSubscription(customerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });

  return subscriptions.data.some((subscription) =>
    ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)
  );
}
