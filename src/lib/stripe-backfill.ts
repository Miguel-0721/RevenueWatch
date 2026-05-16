import Stripe from "stripe";
import { getAlertSensitivityConfig } from "@/lib/alert-sensitivity";
import { normalizeCurrencyCode } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

const BACKFILL_DAYS = 90;
const BACKFILL_PAGE_SIZE = 100;
const BACKFILL_MAX_PAYMENT_INTENTS = 2000;
const SUCCESS_EVENT_TYPE = "payment_intent.succeeded";
const FAILURE_EVENT_TYPE = "payment_intent.payment_failed";

function buildBackfillEventId(type: string, paymentIntentId: string) {
  return `backfill:${type}:${paymentIntentId}`;
}

function getBackfillWindowStartUnix() {
  return Math.floor(
    (Date.now() - BACKFILL_DAYS * 24 * 60 * 60 * 1000) / 1000
  );
}

function paymentIntentTimestamp(paymentIntent: Stripe.PaymentIntent) {
  return new Date(paymentIntent.created * 1000);
}

function isBackfillableSuccessfulPaymentIntent(paymentIntent: Stripe.PaymentIntent) {
  return (
    paymentIntent.status === "succeeded" &&
    typeof paymentIntent.amount_received === "number" &&
    paymentIntent.amount_received > 0
  );
}

function isBackfillableFailedPaymentIntent(paymentIntent: Stripe.PaymentIntent) {
  return Boolean(paymentIntent.last_payment_error);
}

function buildBackfillPayload({
  paymentIntent,
  sourceType,
}: {
  paymentIntent: Stripe.PaymentIntent;
  sourceType: string;
}) {
  return JSON.stringify({
    source: "historical_backfill",
    sourceType,
    paymentIntentId: paymentIntent.id,
    created: paymentIntent.created,
    status: paymentIntent.status,
    amount: paymentIntent.amount,
    amountReceived: paymentIntent.amount_received,
    currency: normalizeCurrencyCode(paymentIntent.currency),
    lastPaymentError: paymentIntent.last_payment_error
      ? {
          code: paymentIntent.last_payment_error.code ?? null,
          declineCode: paymentIntent.last_payment_error.decline_code ?? null,
          message: paymentIntent.last_payment_error.message ?? null,
          type: paymentIntent.last_payment_error.type ?? null,
        }
      : null,
  });
}

export async function backfillStripeAccountHistory({
  stripeAccountId,
  alertSensitivity,
}: {
  stripeAccountId: string;
  alertSensitivity?: string | null;
}) {
  const config = getAlertSensitivityConfig(alertSensitivity);
  const createdGte = getBackfillWindowStartUnix();

  let insertedRevenueMetrics = 0;
  let insertedFailureEvents = 0;
  let skippedDuplicates = 0;
  let processedPaymentIntents = 0;
  let backfillIncomplete = false;

  const paymentIntents = stripe.paymentIntents.list(
    {
      created: { gte: createdGte },
      limit: BACKFILL_PAGE_SIZE,
    },
    {
      stripeAccount: stripeAccountId,
    }
  );

  for await (const paymentIntent of paymentIntents) {
    processedPaymentIntents += 1;

    if (processedPaymentIntents > BACKFILL_MAX_PAYMENT_INTENTS) {
      backfillIncomplete = true;
      break;
    }

    const eventTime = paymentIntentTimestamp(paymentIntent);

    if (isBackfillableSuccessfulPaymentIntent(paymentIntent)) {
      const inserted = await prisma.$transaction(async (tx) => {
        const stripeEventId = buildBackfillEventId(
          SUCCESS_EVENT_TYPE,
          paymentIntent.id
        );
        const existing = await tx.stripeEvent.findUnique({
          where: { stripeEventId },
          select: { id: true },
        });

        if (existing) {
          return false;
        }

        await tx.stripeEvent.create({
          data: {
            stripeEventId,
            type: SUCCESS_EVENT_TYPE,
            stripeAccountId,
            payload: buildBackfillPayload({
              paymentIntent,
              sourceType: SUCCESS_EVENT_TYPE,
            }),
            createdAt: eventTime,
          },
        });

        await tx.revenueMetric.create({
          data: {
            stripeAccountId,
            amount: paymentIntent.amount_received,
            currency: normalizeCurrencyCode(paymentIntent.currency),
            periodStart: new Date(
              eventTime.getTime() - config.revenueWindowMinutes * 60 * 1000
            ),
            periodEnd: eventTime,
            hourOfDay: eventTime.getUTCHours(),
            dayOfWeek: eventTime.getUTCDay(),
            createdAt: eventTime,
          },
        });

        return true;
      });

      if (inserted) {
        insertedRevenueMetrics += 1;
      } else {
        skippedDuplicates += 1;
      }

      continue;
    }

    if (isBackfillableFailedPaymentIntent(paymentIntent)) {
      const stripeEventId = buildBackfillEventId(
        FAILURE_EVENT_TYPE,
        paymentIntent.id
      );
      const existing = await prisma.stripeEvent.findUnique({
        where: { stripeEventId },
        select: { id: true },
      });

      if (existing) {
        skippedDuplicates += 1;
        continue;
      }

      await prisma.stripeEvent.create({
        data: {
          stripeEventId,
          type: FAILURE_EVENT_TYPE,
          stripeAccountId,
          payload: buildBackfillPayload({
            paymentIntent,
            sourceType: FAILURE_EVENT_TYPE,
          }),
          createdAt: eventTime,
        },
      });

      insertedFailureEvents += 1;
    }
  }

  return {
    processedPaymentIntents,
    insertedRevenueMetrics,
    insertedFailureEvents,
    skippedDuplicates,
    backfillIncomplete,
  };
}
