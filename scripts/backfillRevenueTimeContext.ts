import { prisma } from "../src/lib/prisma";


async function backfill() {
  const rows = await prisma.revenueMetric.findMany({
    where: {
      OR: [
        { hourOfDay: null },
        { dayOfWeek: null },
      ],
    },
  });

  console.log(`Found ${rows.length} rows to backfill`);

  for (const row of rows) {
    const date = row.periodEnd ?? row.createdAt;

    await prisma.revenueMetric.update({
      where: { id: row.id },
      data: {
        hourOfDay: date.getHours(),
        dayOfWeek: date.getDay(),
      },
    });
  }

  console.log("✅ Backfill complete");
}

backfill()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
