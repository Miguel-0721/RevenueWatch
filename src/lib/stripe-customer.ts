import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

type CheckoutUser = {
  id: string;
  email: string | null;
  name: string | null;
  stripeCustomerId: string | null;
  stripeTestCustomerId: string | null;
  stripeLiveCustomerId: string | null;
};

type StripeMode = "test" | "live";
type CustomerField = "stripeTestCustomerId" | "stripeLiveCustomerId";

function getStripeMode(): { mode: StripeMode; field: CustomerField } {
  const secretKey = process.env.STRIPE_SECRET_KEY ?? "";

  if (secretKey.startsWith("sk_live_")) {
    return { mode: "live", field: "stripeLiveCustomerId" };
  }

  return { mode: "test", field: "stripeTestCustomerId" };
}

function isMissingCustomerError(error: unknown) {
  return (
    error instanceof Stripe.errors.StripeInvalidRequestError &&
    error.code === "resource_missing"
  );
}

async function createModeCustomer(user: CheckoutUser, field: CustomerField) {
  if (!user.email) {
    throw new Error("Cannot create Stripe customer without an email");
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: {
      userId: user.id,
      mode: field === "stripeLiveCustomerId" ? "live" : "test",
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      [field]: customer.id,
    },
  });

  return customer.id;
}

export async function resolveCheckoutCustomerId(user: CheckoutUser) {
  const { field } = getStripeMode();
  const candidateIds = [
    user[field],
    user.stripeCustomerId,
  ].filter((value): value is string => Boolean(value));

  for (const customerId of candidateIds) {
    try {
      const customer = await stripe.customers.retrieve(customerId);

      if (!("deleted" in customer) || !customer.deleted) {
        if (customerId !== user[field]) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              [field]: customerId,
            },
          });
        }

        return customerId;
      }
    } catch (error) {
      if (!isMissingCustomerError(error)) {
        throw error;
      }
    }
  }

  return createModeCustomer(user, field);
}
