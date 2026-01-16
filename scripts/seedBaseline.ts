import { prisma } from "../src/lib/prisma.ts";





async function seedBaseline() {
  const stripeAccountId = "test_account_local";

  const now = new Date();
  const oneHour = 60 * 60 * 1000;

  await prisma.revenueMetric.createMany({
    data: [
      {
        stripeAccountId,
        amount: 200_000,
        periodStart: new Date(now.getTime() - 26 * oneHour),
        periodEnd: new Date(now.getTime() - 25 * oneHour),
      },
      {
        stripeAccountId,
        amount: 180_000,
        periodStart: new Date(now.getTime() - 25 * oneHour),
        periodEnd: new Date(now.getTime() - 24 * oneHour),
      },
    ],
  });

  console.log("✅ Baseline revenue seeded");
}

seedBaseline()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
