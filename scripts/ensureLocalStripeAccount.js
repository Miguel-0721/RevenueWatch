const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const LOCAL_TEST_ACCOUNT_ID = "test_account_local";

async function ensureLocalStripeAccount() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("ensureLocalStripeAccount cannot run in production.");
  }

  const account = await prisma.stripeAccount.upsert({
    where: { stripeAccountId: LOCAL_TEST_ACCOUNT_ID },
    update: {
      status: "active",
      name: "Local Stripe CLI Test Account",
    },
    create: {
      stripeAccountId: LOCAL_TEST_ACCOUNT_ID,
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
