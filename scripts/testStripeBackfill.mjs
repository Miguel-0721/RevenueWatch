import { PrismaClient } from "@prisma/client";
import nextEnv from "@next/env";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import Stripe from "stripe";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

if (process.env.NODE_ENV === "production") {
  throw new Error("testStripeBackfill cannot run in production.");
}

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY.");
}

if (secretKey.startsWith("sk_live_")) {
  throw new Error("testStripeBackfill refuses to run with a live Stripe key.");
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const target = pathToFileURL(
        `${process.cwd().replace(/\\/g, "/")}/src/${specifier.slice(2)}.ts`
      ).href;

      return nextResolve(target, context);
    }

    return nextResolve(specifier, context);
  },
});

const prisma = new PrismaClient();
const stripe = new Stripe(secretKey, {
  apiVersion: "2025-12-15.clover",
});

const CONNECTED_TEST_ACCOUNT_ID = "acct_1SmJXjBxSH4LpaGs";
const TEST_CURRENCY = "eur";

function buildSyntheticEventId(type, paymentIntentId) {
  return `backfill:${type}:${paymentIntentId}`;
}

async function createSuccessfulPaymentIntent({ amount, metadata }) {
  return stripe.paymentIntents.create(
    {
      amount,
      currency: TEST_CURRENCY,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
      confirm: true,
      payment_method: "pm_card_visa",
      metadata,
    },
    {
      stripeAccount: CONNECTED_TEST_ACCOUNT_ID,
    }
  );
}

async function createFailedPaymentIntent({ amount, metadata }) {
  try {
    await stripe.paymentIntents.create(
      {
        amount,
        currency: TEST_CURRENCY,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never",
        },
        confirm: true,
        payment_method: "pm_card_chargeDeclined",
        metadata,
      },
      {
        stripeAccount: CONNECTED_TEST_ACCOUNT_ID,
      }
    );

    throw new Error("Expected declined test payment to fail.");
  } catch (error) {
    const paymentIntent = error?.raw?.payment_intent ?? error?.payment_intent;

    if (!paymentIntent?.id) {
      throw error;
    }

    return paymentIntent;
  }
}

async function fetchVerificationSnapshot(paymentIntents) {
  const successEventIds = paymentIntents.successes.map(({ id }) =>
    buildSyntheticEventId("payment_intent.succeeded", id)
  );
  const failureEventIds = paymentIntents.failures.map(({ id }) =>
    buildSyntheticEventId("payment_intent.payment_failed", id)
  );

  const [revenueMetricCount, successEvents, failureEvents] = await Promise.all([
    prisma.revenueMetric.count({
      where: {
        OR: paymentIntents.successes.map((paymentIntent) => ({
          stripeAccountId: CONNECTED_TEST_ACCOUNT_ID,
          amount: paymentIntent.amount_received,
          currency: TEST_CURRENCY.toUpperCase(),
          createdAt: new Date(paymentIntent.created * 1000),
        })),
      },
    }),
    prisma.stripeEvent.findMany({
      where: {
        stripeEventId: { in: successEventIds },
      },
      select: {
        stripeEventId: true,
        createdAt: true,
      },
    }),
    prisma.stripeEvent.findMany({
      where: {
        stripeEventId: { in: failureEventIds },
      },
      select: {
        stripeEventId: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    successEventIds,
    failureEventIds,
    revenueMetricCount,
    successEventCount: successEvents.length,
    failureEventCount: failureEvents.length,
  };
}

async function main() {
  const { backfillStripeAccountHistory } = await import("../src/lib/stripe-backfill.ts");

  await prisma.stripeAccount.upsert({
    where: { stripeAccountId: CONNECTED_TEST_ACCOUNT_ID },
    update: {
      status: "active",
      name: "Connected Stripe Sandbox Test Account",
    },
    create: {
      stripeAccountId: CONNECTED_TEST_ACCOUNT_ID,
      status: "active",
      name: "Connected Stripe Sandbox Test Account",
    },
  });

  const runId = `backfill-test-${Date.now()}`;
  const metadata = {
    revenuewatch_backfill_test: runId,
  };

  const successfulPaymentIntents = await Promise.all([
    createSuccessfulPaymentIntent({ amount: 1101, metadata }),
    createSuccessfulPaymentIntent({ amount: 2203, metadata }),
    createSuccessfulPaymentIntent({ amount: 3307, metadata }),
  ]);

  const failedPaymentIntents = [];
  failedPaymentIntents.push(
    await createFailedPaymentIntent({ amount: 1400, metadata })
  );
  failedPaymentIntents.push(
    await createFailedPaymentIntent({ amount: 2400, metadata })
  );

  const paymentIntents = {
    successes: successfulPaymentIntents.map((pi) => ({
      id: pi.id,
      amount_received: pi.amount_received,
      created: pi.created,
    })),
    failures: failedPaymentIntents.map((pi) => ({
      id: pi.id,
    })),
  };

  const beforeSnapshot = await fetchVerificationSnapshot(paymentIntents);
  const firstRun = await backfillStripeAccountHistory({
    stripeAccountId: CONNECTED_TEST_ACCOUNT_ID,
    alertSensitivity: "conservative",
  });
  const afterFirstSnapshot = await fetchVerificationSnapshot(paymentIntents);
  const secondRun = await backfillStripeAccountHistory({
    stripeAccountId: CONNECTED_TEST_ACCOUNT_ID,
    alertSensitivity: "conservative",
  });
  const afterSecondSnapshot = await fetchVerificationSnapshot(paymentIntents);

  console.log("Stripe backfill local test completed:");
  console.log(
    JSON.stringify(
      {
        stripeAccountId: CONNECTED_TEST_ACCOUNT_ID,
        runId,
        createdPaymentIntents: paymentIntents,
        firstRun,
        secondRun,
        verification: {
          before: beforeSnapshot,
          afterFirstRun: afterFirstSnapshot,
          afterSecondRun: afterSecondSnapshot,
        },
        expectations: {
          firstRunMinimumImports: {
            successfulPaymentsImportedAtLeast: 3,
            failedPaymentsImportedAtLeast: 2,
          },
          secondRunShouldNotIncreaseTrackedRows: true,
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("Failed to run local Stripe backfill test:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
