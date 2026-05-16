import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function isProductionLike() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function formatList(items) {
  if (!items.length) return "(none)";
  return items.map((item) => `- ${item}`).join("\n");
}

async function main() {
  const userEmail = getRequiredEnv("CLEAN_USER_EMAIL");
  const confirm = process.env.CONFIRM_CLEAN_TEST_DATA === "true";
  const allowProd = process.env.DEV_ONLY_CLEAN_TEST_DATA === "true";

  if (isProductionLike() && !allowProd) {
    throw new Error(
      "Refusing to run in production-like environment without DEV_ONLY_CLEAN_TEST_DATA=true",
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: {
      id: true,
      email: true,
      stripeAccounts: {
        select: {
          id: true,
          stripeAccountId: true,
          status: true,
          name: true,
          backfillStatus: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error(`No user found for email: ${userEmail}`);
  }

  const stripeAccountIds = user.stripeAccounts.map((account) => account.stripeAccountId);

  const [alertCount, revenueMetricCount, stripeEventCount] = stripeAccountIds.length
    ? await Promise.all([
        prisma.alert.count({
          where: { stripeAccountId: { in: stripeAccountIds } },
        }),
        prisma.revenueMetric.count({
          where: { stripeAccountId: { in: stripeAccountIds } },
        }),
        prisma.stripeEvent.count({
          where: { stripeAccountId: { in: stripeAccountIds } },
        }),
      ])
    : [0, 0, 0];

  const summary = {
    userEmail: user.email,
    userId: user.id,
    stripeAccountsFound: user.stripeAccounts.length,
    stripeAccountIds,
    alertCount,
    revenueMetricCount,
    stripeEventCount,
    authUserWillBeDeleted: false,
    billingFieldsWillBeDeleted: false,
  };

  console.log("Parveil test-data cleanup preview");
  console.log(JSON.stringify(summary, null, 2));
  console.log("\nStripe accounts targeted:");
  console.log(
    formatList(
      user.stripeAccounts.map((account) => {
        const label = account.name ? `${account.name} (${account.stripeAccountId})` : account.stripeAccountId;
        return `${label} | status=${account.status} | backfill=${account.backfillStatus}`;
      }),
    ),
  );

  if (!confirm) {
    console.log(
      "\nNo deletion performed. Set CONFIRM_CLEAN_TEST_DATA=true to execute this cleanup.",
    );
    return;
  }

  if (!stripeAccountIds.length) {
    console.log("\nNo StripeAccount rows found for this user. Nothing deleted.");
    return;
  }

  const deleteResult = await prisma.$transaction(async (tx) => {
    const alertsDeleted = await tx.alert.deleteMany({
      where: { stripeAccountId: { in: stripeAccountIds } },
    });

    const revenueMetricsDeleted = await tx.revenueMetric.deleteMany({
      where: { stripeAccountId: { in: stripeAccountIds } },
    });

    const stripeEventsDeleted = await tx.stripeEvent.deleteMany({
      where: { stripeAccountId: { in: stripeAccountIds } },
    });

    const stripeAccountsDeleted = await tx.stripeAccount.deleteMany({
      where: { userId: user.id },
    });

    return {
      stripeAccountsDeleted: stripeAccountsDeleted.count,
      alertsDeleted: alertsDeleted.count,
      revenueMetricsDeleted: revenueMetricsDeleted.count,
      stripeEventsDeleted: stripeEventsDeleted.count,
      skipped: 0,
    };
  });

  console.log("\nCleanup complete");
  console.log(JSON.stringify(deleteResult, null, 2));
  console.log(
    "\nKept intact: User row, auth accounts/sessions, billing/customer/subscription fields, schema, migrations, Stripe data.",
  );
}

main()
  .catch((error) => {
    console.error("clean:test-data failed");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
