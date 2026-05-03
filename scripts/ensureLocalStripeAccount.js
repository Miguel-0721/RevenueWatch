const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function ensureLocalStripeAccount() {
  const stripeAccountId = "test_account_local";

  const account = await prisma.stripeAccount.upsert({
    where: { stripeAccountId },
    update: {
      status: "active",
      name: "Local Stripe CLI Test Account",
    },
    create: {
      stripeAccountId,
      status: "active",
      name: "Local Stripe CLI Test Account",
    },
  });

  console.log("Local Stripe CLI fallback account is ready:");
  console.log(
    JSON.stringify(
      {
        stripeAccountId: account.stripeAccountId,
        status: account.status,
        name: account.name,
      },
      null,
      2
    )
  );
}

ensureLocalStripeAccount()
  .catch((error) => {
    console.error("Failed to ensure local Stripe CLI fallback account:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
