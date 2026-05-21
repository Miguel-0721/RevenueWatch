import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  clearDevSeedSubscriptionHealthTestState,
  getLatestSubscriptionHealthSnapshotCounts,
  seedSubscriptionHealthTestState,
  syncSubscriptionHealthSnapshot,
  type SubscriptionHealthTestScenario,
} from "@/lib/subscription-health-store";

const SUPPORTED_SCENARIOS = new Set<SubscriptionHealthTestScenario>([
  "basic-active",
  "multiple-active",
  "mixed-health",
  "empty",
]);

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
        scenario?: SubscriptionHealthTestScenario;
      }
    | null;

  const stripeAccountId = body?.stripeAccountId?.trim();
  const scenario = body?.scenario;

  if (!stripeAccountId) {
    return NextResponse.json({ error: "stripeAccountId is required" }, { status: 400 });
  }

  if (!scenario || !SUPPORTED_SCENARIOS.has(scenario)) {
    return NextResponse.json(
      { error: "scenario must be one of basic-active, multiple-active, mixed-health, empty" },
      { status: 400 }
    );
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

  let subscriptionSnapshotCounts = null;

  if (scenario === "empty") {
    await clearDevSeedSubscriptionHealthTestState({ stripeAccountId });

    await syncSubscriptionHealthSnapshot({
      client: prisma,
      stripeAccountId,
      snapshotKey: `dev_seed:reset:${stripeAccountId}`,
      source: "dev",
      windowEnd: new Date(),
    });

    subscriptionSnapshotCounts = await getLatestSubscriptionHealthSnapshotCounts({
      stripeAccountId,
    });
  } else {
    subscriptionSnapshotCounts = await seedSubscriptionHealthTestState({
      stripeAccountId,
      scenario,
    });
  }

  return NextResponse.json({
    ok: true,
    scenario,
    stripeAccountId,
    subscriptionSnapshotCounts,
  });
}
