import { NextResponse } from "next/server";
import { backfillStripeAccountHistory } from "@/lib/stripe-backfill";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../auth";

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { stripeAccountId?: string } | null = null;

  try {
    body = (await req.json()) as { stripeAccountId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const stripeAccountId = body?.stripeAccountId?.trim();

  if (!stripeAccountId) {
    return NextResponse.json(
      { error: "Missing stripeAccountId" },
      { status: 400 }
    );
  }

  const stripeAccount = await prisma.stripeAccount.findFirst({
    where: {
      stripeAccountId,
      userId: session.user.id,
      status: "active",
    },
    select: {
      stripeAccountId: true,
      alertSensitivity: true,
    },
  });

  if (!stripeAccount) {
    return NextResponse.json(
      { error: "Stripe account not found" },
      { status: 404 }
    );
  }

  const result = await backfillStripeAccountHistory({
    stripeAccountId: stripeAccount.stripeAccountId,
    alertSensitivity: stripeAccount.alertSensitivity,
  });

  return NextResponse.json({
    ok: true,
    stripeAccountId: stripeAccount.stripeAccountId,
    processedPaymentIntents: result.processedPaymentIntents,
    successfulPaymentsImported: result.insertedRevenueMetrics,
    failedPaymentsImported: result.insertedFailureEvents,
    skippedDuplicates: result.skippedDuplicates,
    backfillIncomplete: result.backfillIncomplete,
  });
}
