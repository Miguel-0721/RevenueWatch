// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require("../src/lib/prisma");

async function seedBaseline() {
  const stripeAccountId = "test_account_local";
  const now = new Date();

  const hours = 30;
  const intervalMinutes = 60;
  const amountPerHour = 2000; // €20.00 per hour (in cents)

  const rows = [];

  for (let i = hours; i > 0; i--) {
    const periodEnd = new Date(now.getTime() - (i - 1) * 60 * 60 * 1000);
    const periodStart = new Date(
      periodEnd.getTime() - intervalMinutes * 60 * 1000
    );

    rows.push({
      stripeAccountId,
      amount: amountPerHour,
      periodStart,
      periodEnd,
    });
  }

  await prisma.revenueMetric.createMany({
    data: rows,
  });

  console.log("✅ Seeded baseline revenue metrics");
}

seedBaseline()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
