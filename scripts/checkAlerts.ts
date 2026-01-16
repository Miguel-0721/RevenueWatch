import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkAlerts() {
  const alerts = await prisma.alert.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  console.log(alerts);
}

checkAlerts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
