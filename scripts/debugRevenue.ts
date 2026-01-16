import { prisma } from "../src/lib/prisma";

async function debugRevenue() {
  const stripeAccountId = "test_account_local";

  const REVENUE_WINDOW_MINUTES = 60;
  const BASELINE_HOURS = 30;

  const now = new Date();

  const currentWindowStart = new Date(
    now.getTime() - REVENUE_WINDOW_MINUTES * 60 * 1000
  );

  const baselineStart = new Date(
    now.getTime() - BASELINE_HOURS * 60 * 60 * 1000
  );

  const currentRevenue = await prisma.revenueMetric.aggregate({
    _sum: { amount: true },
    where: {
      stripeAccountId,
      periodEnd: { gte: currentWindowStart },
    },
  });

  const baselineRevenue = await prisma.revenueMetric.aggregate({
    _sum: { amount: true },
    where: {
      stripeAccountId,
      periodEnd: {
        gte: baselineStart,
        lt: currentWindowStart,
      },
    },
  });

  const currentAmount = currentRevenue._sum.amount ?? 0;
  const baselineAmount = baselineRevenue._sum.amount ?? 0;

  const dropRatio =
    baselineAmount === 0 ? 0 : 1 - currentAmount / baselineAmount;

  console.log("──────── REVENUE DEBUG ────────");
  console.log("Baseline amount:", baselineAmount);
  console.log("Current amount:", currentAmount);
  console.log("Drop ratio:", dropRatio);
  console.log("Drop %:", (dropRatio * 100).toFixed(2) + "%");
  console.log("Would trigger alert:", dropRatio >= 0.4);
  console.log("──────────────────────────────");
}

debugRevenue()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
