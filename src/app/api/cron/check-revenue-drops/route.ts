import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateRevenueDropForAccount } from "@/lib/revenue-drop";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest, secret: string) {
  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("Cron secret missing for revenue drop checks");
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  if (!isAuthorized(request, cronSecret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const activeAccounts = await prisma.stripeAccount.findMany({
    where: { status: "active" },
    select: {
      stripeAccountId: true,
      alertSensitivity: true,
    },
  });

  let checkedAccounts = 0;
  let alertsCreated = 0;
  let alertsResolved = 0;
  let skipped = 0;

  for (const account of activeAccounts) {
    checkedAccounts += 1;

    try {
      const result = await evaluateRevenueDropForAccount({
        stripeAccountId: account.stripeAccountId,
        alertSensitivity: account.alertSensitivity,
        source: "cron",
        triggerEventId: null,
      });

      alertsCreated += result.alertsCreated;
      alertsResolved += result.alertsResolved;
      if (result.skipped) {
        skipped += 1;
      }
    } catch (error) {
      console.error("Revenue drop cron evaluation failed for account", {
        stripeAccountId: account.stripeAccountId,
        error,
      });
      skipped += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    checkedAccounts,
    alertsCreated,
    alertsResolved,
    skipped,
  });
}
