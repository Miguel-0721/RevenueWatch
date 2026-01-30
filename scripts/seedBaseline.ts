// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require("../src/lib/prisma");

async function seedBaseline() {
  const stripeAccountId = "test_account_local";
  const now = new Date();

const HOURS = 168;            // how many hours back
const SAMPLES_PER_HOUR = 6;  // MUST be >= 5
const intervalMinutes = 60;
const amountPerHour = 2000;  // €20.00 per hour (in cents)

const rows = [];

for (let h = HOURS; h > 0; h--) {
  for (let s = 0; s < SAMPLES_PER_HOUR; s++) {
    const periodEnd = new Date(
      now.getTime()
      - (h - 1) * 60 * 60 * 1000
      - s * 24 * 60 * 60 * 1000
    );

    const periodStart = new Date(
      periodEnd.getTime() - intervalMinutes * 60 * 1000
    );

    rows.push({
      stripeAccountId,
      amount: amountPerHour,
      periodStart,
      periodEnd,
      hourOfDay: periodEnd.getHours(),
      dayOfWeek: periodEnd.getDay(),
    });
  }
}

await prisma.revenueMetric.createMany({
  data: rows,
});



  console.log("✅ Seeded baseline revenue metrics");
}

seedBaseline()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
