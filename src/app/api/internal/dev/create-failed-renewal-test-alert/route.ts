import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  recordSubscriptionHealthEvent,
  syncSubscriptionHealthSnapshot,
  upsertFailedRenewalAlert,
} from "@/lib/subscription-health-store";

function normalizeCurrency(value?: string | null) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || "eur";
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        stripeAccountId?: string;
        amountDue?: number;
        currency?: string;
        testId?: string;
      }
    | null;

  const stripeAccountId = body?.stripeAccountId?.trim();
  const amountDue =
    typeof body?.amountDue === "number" && Number.isFinite(body.amountDue)
      ? Math.max(0, Math.round(body.amountDue))
      : 3900;
  const currency = normalizeCurrency(body?.currency);
  const uniqueTestId = body?.testId?.trim() || null;

  if (!stripeAccountId) {
    return NextResponse.json({ error: "stripeAccountId is required" }, { status: 400 });
  }

  const account = await prisma.stripeAccount.findFirst({
    where: {
      stripeAccountId,
      userId: session.user.id,
      status: "active",
    },
    select: {
      stripeAccountId: true,
    },
  });

  if (!account) {
    return NextResponse.json({ error: "Connected Stripe account not found" }, { status: 404 });
  }

  const syntheticSuffix = uniqueTestId ?? `${stripeAccountId}:${amountDue}:${currency}`;
  const stripeInvoiceId = `dev_failed_renewal_invoice:${syntheticSuffix}`;
  const stripeSubscriptionId = `dev_failed_renewal_subscription:${syntheticSuffix}`;
  const stripeEventId = `dev_failed_renewal_event:${syntheticSuffix}`;
  const stripeCustomerId = `dev_failed_renewal_customer:${syntheticSuffix}`;
  const occurredAt = new Date();

  const existingEvent = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "SubscriptionHealthEvent"
    WHERE "stripeEventId" = ${stripeEventId}
    LIMIT 1
  `;

  const alertKey = `failed_renewal:${stripeInvoiceId}`;
  const existingAlert = await prisma.alert.findUnique({
    where: { stripeEventId: alertKey },
    select: { id: true },
  });

  await recordSubscriptionHealthEvent(prisma, {
    stripeEventId,
    stripeAccountId,
    stripeSubscriptionId,
    stripeCustomerId,
    type: "invoice.payment_failed",
    billingReason: "subscription_cycle",
    currency,
    amountDue,
    amountPaid: 0,
    estimatedMonthlyRevenue: amountDue,
    occurredAt,
  });

  await upsertFailedRenewalAlert({
    client: prisma,
    stripeAccountId,
    stripeInvoiceId,
    stripeSubscriptionId,
    stripeCustomerId,
    amountDue,
    amountPaid: 0,
    currency,
    billingReason: "subscription_cycle",
    occurredAt,
    source: "dev",
  });

  const snapshotCounts = await syncSubscriptionHealthSnapshot({
    client: prisma,
    stripeAccountId,
    snapshotKey: `dev:${stripeAccountId}:failed-renewal`,
    source: "dev",
    windowEnd: occurredAt,
  });

  return NextResponse.json({
    ok: true,
    alertUpserted: true,
    alertCreated: !existingAlert,
    eventUpserted: true,
    eventCreated: existingEvent.length === 0,
    stripeAccountId,
    amountDue,
    currency,
    subscriptionSnapshotCounts: snapshotCounts,
  });
}
