import { prisma } from "../src/lib/prisma";

async function main() {
  // Find rows where Phase B fields are missing
  const rows = await prisma.revenueMetric.findMany({
    where: {
      OR: [{ hourOfDay: null }, { dayOfWeek: null }],
    },
    select: {
      id: true,
      periodEnd: true,
    },
    take: 5000, // safety cap
  });

  console.log(`Found ${rows.length} rows to backfill`);

  if (rows.length === 0) {
    console.log("✅ Nothing to backfill");
    return;
  }

  // Update each row using periodEnd as the reference time
  for (const r of rows) {
    const d = new Date(r.periodEnd);

    await prisma.revenueMetric.update({
      where: { id: r.id },
      data: {
        hourOfDay: d.getHours(), // 0–23
        dayOfWeek: d.getDay(),   // 0–6 (Sun = 0)
      },
    });
  }

  console.log("✅ Backfill complete");
}

main()
  .catch((e) => {
    console.error("❌ Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
