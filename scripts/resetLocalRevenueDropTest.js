const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const LOCAL_TEST_ACCOUNT_ID = "test_account_local";
const REVENUE_DROP_TYPE = "revenue_drop";

async function resetLocalRevenueDropTest() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("resetLocalRevenueDropTest cannot run in production.");
  }

  const [deletedAlerts, deletedRevenueMetrics] = await prisma.$transaction([
    prisma.alert.deleteMany({
      where: {
        stripeAccountId: LOCAL_TEST_ACCOUNT_ID,
        type: REVENUE_DROP_TYPE,
      },
    }),
    prisma.revenueMetric.deleteMany({
      where: {
        stripeAccountId: LOCAL_TEST_ACCOUNT_ID,
      },
    }),
  ]);

  console.log("Local revenue drop alert test state reset:");
  console.log(
    JSON.stringify(
      {
        stripeAccountId: LOCAL_TEST_ACCOUNT_ID,
        deletedRevenueDropAlerts: deletedAlerts.count,
        deletedRevenueMetrics: deletedRevenueMetrics.count,
      },
      null,
      2
    )
  );
}

resetLocalRevenueDropTest()
  .catch((error) => {
    console.error("Failed to reset local revenue drop test state:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
