const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const LOCAL_TEST_ACCOUNT_ID = "test_account_local";
const LOCAL_TEST_ACCOUNT_NAME = "Local Stripe CLI Test Account";
const BASELINE_DAYS = 42;
const BASELINE_AMOUNT_CENTS = 160000;
const MIN_AMOUNT_CENTS = 145000;
const MAX_AMOUNT_CENTS = 175000;

function assertLocalOnly(scriptName) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${scriptName} cannot run in production.`);
  }
}

function amountForDayOffset(dayOffset) {
  const variation = ((dayOffset % 7) - 3) * 3000;
  const amount = BASELINE_AMOUNT_CENTS + variation;
  return Math.max(MIN_AMOUNT_CENTS, Math.min(MAX_AMOUNT_CENTS, amount));
}

async function ensureLocalStripeAccount() {
  return prisma.stripeAccount.upsert({
    where: { stripeAccountId: LOCAL_TEST_ACCOUNT_ID },
    update: {
      status: "active",
      name: LOCAL_TEST_ACCOUNT_NAME,
    },
    create: {
      stripeAccountId: LOCAL_TEST_ACCOUNT_ID,
      status: "active",
      name: LOCAL_TEST_ACCOUNT_NAME,
    },
  });
}

async function seedRevenueBaseline() {
  assertLocalOnly("seedRevenueBaseline");

  const account = await ensureLocalStripeAccount();
  const now = new Date();
  const currentWindowEnd = new Date(now);
  currentWindowEnd.setUTCMinutes(0, 0, 0);
  const currentUtcHour = currentWindowEnd.getUTCHours();

  const rows = Array.from({ length: BASELINE_DAYS }, (_, index) => {
    const dayOffset = index + 1;
    const periodEnd = new Date(currentWindowEnd);
    periodEnd.setUTCDate(currentWindowEnd.getUTCDate() - dayOffset);

    const periodStart = new Date(periodEnd);
    periodStart.setUTCHours(periodEnd.getUTCHours() - 1);

    return {
      stripeAccountId: LOCAL_TEST_ACCOUNT_ID,
      amount: amountForDayOffset(dayOffset),
      periodStart,
      periodEnd,
      hourOfDay: currentUtcHour,
      dayOfWeek: periodEnd.getUTCDay(),
    };
  });

  await prisma.revenueMetric.createMany({
    data: rows,
  });

  console.log("Local revenue baseline seeded:");
  console.log(
    JSON.stringify(
      {
        stripeAccountId: account.stripeAccountId,
        accountStatus: account.status,
        accountName: account.name,
        seededRevenueMetricRows: rows.length,
        seededHourUtc: currentUtcHour,
        amountRangeCents: {
          min: MIN_AMOUNT_CENTS,
          max: MAX_AMOUNT_CENTS,
        },
      },
      null,
      2
    )
  );
}

seedRevenueBaseline()
  .catch((error) => {
    console.error("Failed to seed local revenue baseline:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
