import { NextResponse } from "next/server";
import { backfillStripeAccountHistory } from "@/lib/stripe-backfill";
import { prisma } from "@/lib/prisma";
import {
  backfillStripeAccountSubscriptions,
  getLatestSubscriptionHealthSnapshotCounts,
} from "@/lib/subscription-health-store";
import { auth } from "../../../../auth";

type BackfillStatus = "pending" | "running" | "completed" | "failed";

type StripeAccountBackfillState = {
  stripeAccountId: string;
  alertSensitivity: string;
  backfillStatus: BackfillStatus;
};

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    let body:
      | {
          stripeAccountId?: string;
          runSubscriptionHealthBackfill?: boolean;
          forceSubscriptionHealthBackfill?: boolean;
        }
      | null = null;

    try {
      body = (await req.json()) as { stripeAccountId?: string };
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const stripeAccountId = body?.stripeAccountId?.trim();
    const shouldRunSubscriptionHealthBackfill = Boolean(
      body?.runSubscriptionHealthBackfill || body?.forceSubscriptionHealthBackfill
    );

    if (!stripeAccountId) {
      return NextResponse.json(
        { ok: false, error: "Missing stripeAccountId" },
        { status: 400 }
      );
    }

    const stripeAccount = (await (prisma as any).stripeAccount.findFirst({
      where: {
        stripeAccountId,
        userId: session.user.id,
        status: "active",
      },
      select: {
        stripeAccountId: true,
        alertSensitivity: true,
        backfillStatus: true,
      },
    })) as StripeAccountBackfillState | null;

    if (!stripeAccount) {
      return NextResponse.json(
        { ok: false, stripeAccountId, error: "Stripe account not found" },
        { status: 404 }
      );
    }

    const existingSubscriptionSnapshotCounts =
      await getLatestSubscriptionHealthSnapshotCounts({
        stripeAccountId: stripeAccount.stripeAccountId,
      });
    const subscriptionSnapshotMissing = !existingSubscriptionSnapshotCounts;

    if (stripeAccount.backfillStatus === "completed") {
      if (shouldRunSubscriptionHealthBackfill || subscriptionSnapshotMissing) {
        const result = await backfillStripeAccountSubscriptions({
          stripeAccountId: stripeAccount.stripeAccountId,
        });

        return NextResponse.json({
          ok: true,
          stripeAccountId: stripeAccount.stripeAccountId,
          backfillStatus: "completed",
          alreadyCompleted: true,
          paymentBackfillSkipped: true,
          subscriptionBackfillRan: true,
          successfulPaymentsImported: 0,
          failedPaymentsImported: 0,
          skippedDuplicates: 0,
          processedPaymentIntents: 0,
          processedSubscriptions: result.processedSubscriptions,
          backfillIncomplete: result.backfillIncomplete,
          importedSubscriptions: result.importedSubscriptions,
          updatedSubscriptions: result.updatedSubscriptions,
          subscriptionSnapshotCounts: result.snapshotCounts,
        });
      }

      return NextResponse.json({
        ok: true,
        stripeAccountId: stripeAccount.stripeAccountId,
        backfillStatus: "completed",
        alreadyCompleted: true,
        paymentBackfillSkipped: true,
        subscriptionBackfillRan: false,
        successfulPaymentsImported: 0,
        failedPaymentsImported: 0,
        skippedDuplicates: 0,
        processedPaymentIntents: 0,
        processedSubscriptions: 0,
        backfillIncomplete: false,
        importedSubscriptions: 0,
        updatedSubscriptions: 0,
        subscriptionSnapshotCounts: existingSubscriptionSnapshotCounts,
      });
    }

    if (stripeAccount.backfillStatus === "running") {
      return NextResponse.json({
        ok: true,
        stripeAccountId: stripeAccount.stripeAccountId,
        backfillStatus: "running",
        alreadyRunning: true,
        paymentBackfillSkipped: true,
        subscriptionBackfillRan: false,
        successfulPaymentsImported: 0,
        failedPaymentsImported: 0,
        skippedDuplicates: 0,
        processedPaymentIntents: 0,
        processedSubscriptions: 0,
        backfillIncomplete: false,
        importedSubscriptions: 0,
        updatedSubscriptions: 0,
        subscriptionSnapshotCounts: existingSubscriptionSnapshotCounts,
      });
    }

    const startedAt = new Date();
    const startResult = await (prisma as any).stripeAccount.updateMany({
      where: {
        stripeAccountId: stripeAccount.stripeAccountId,
        userId: session.user.id,
        status: "active",
        backfillStatus: {
          in: ["pending", "failed"],
        },
      },
      data: {
        backfillStatus: "running",
        backfillStartedAt: startedAt,
        backfillError: null,
      },
    });

    if (startResult.count === 0) {
      const currentState = (await (prisma as any).stripeAccount.findFirst({
        where: {
          stripeAccountId,
          userId: session.user.id,
        },
        select: {
          stripeAccountId: true,
          backfillStatus: true,
        },
      })) as Pick<StripeAccountBackfillState, "stripeAccountId" | "backfillStatus"> | null;

      return NextResponse.json({
        ok: true,
        stripeAccountId,
        backfillStatus: currentState?.backfillStatus ?? "unknown",
        alreadyRunning: currentState?.backfillStatus === "running",
        alreadyCompleted: currentState?.backfillStatus === "completed",
        paymentBackfillSkipped: true,
        subscriptionBackfillRan: false,
        successfulPaymentsImported: 0,
        failedPaymentsImported: 0,
        skippedDuplicates: 0,
        processedPaymentIntents: 0,
        processedSubscriptions: 0,
        backfillIncomplete: false,
        importedSubscriptions: 0,
        updatedSubscriptions: 0,
        subscriptionSnapshotCounts: existingSubscriptionSnapshotCounts,
      });
    }

    try {
      const result = await backfillStripeAccountHistory({
        stripeAccountId: stripeAccount.stripeAccountId,
        alertSensitivity: stripeAccount.alertSensitivity,
      });

      const completedAt = new Date();

      await (prisma as any).stripeAccount.update({
        where: {
          stripeAccountId: stripeAccount.stripeAccountId,
        },
        data: {
          backfillStatus: "completed",
          lastBackfilledAt: completedAt,
          backfillError: null,
        },
      });

      return NextResponse.json({
        ok: true,
        stripeAccountId: stripeAccount.stripeAccountId,
        backfillStatus: "completed",
        paymentBackfillSkipped: false,
        subscriptionBackfillRan: true,
        processedPaymentIntents: result.processedPaymentIntents,
        processedSubscriptions: result.processedSubscriptions,
        successfulPaymentsImported: result.insertedRevenueMetrics,
        failedPaymentsImported: result.insertedFailureEvents,
        importedSubscriptions: result.importedSubscriptions,
        updatedSubscriptions: result.updatedSubscriptions,
        subscriptionSnapshotCounts: result.subscriptionSnapshotCounts,
        skippedDuplicates: result.skippedDuplicates,
        backfillIncomplete: result.backfillIncomplete,
      });
    } catch (error) {
      console.error("Stripe backfill failed", {
        stripeAccountId: stripeAccount.stripeAccountId,
        error: String(error),
      });

      await (prisma as any).stripeAccount.update({
        where: {
          stripeAccountId: stripeAccount.stripeAccountId,
        },
        data: {
          backfillStatus: "failed",
          backfillError: String(error).slice(0, 1000),
        },
      });

      return NextResponse.json(
        {
          ok: false,
          stripeAccountId: stripeAccount.stripeAccountId,
          backfillStatus: "failed",
          error: "Backfill failed",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Stripe backfill route error", {
      error: String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: "Unable to process backfill request",
      },
      { status: 500 }
    );
  }
}
