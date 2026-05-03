const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const LOCAL_TEST_ACCOUNT_ID = "test_account_local";
const PAYMENT_FAILED_TYPE = "payment_failed";
const PAYMENT_FAILED_EVENT_TYPE = "payment_intent.payment_failed";

async function resetLocalPaymentAlertTest() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "resetLocalPaymentAlertTest cannot run in production."
    );
  }

  const [deletedAlerts, deletedEvents] = await prisma.$transaction([
    prisma.alert.deleteMany({
      where: {
        stripeAccountId: LOCAL_TEST_ACCOUNT_ID,
        type: PAYMENT_FAILED_TYPE,
      },
    }),
    prisma.stripeEvent.deleteMany({
      where: {
        stripeAccountId: LOCAL_TEST_ACCOUNT_ID,
        type: PAYMENT_FAILED_EVENT_TYPE,
      },
    }),
  ]);

  console.log("Local payment failure alert test state reset:");
  console.log(
    JSON.stringify(
      {
        stripeAccountId: LOCAL_TEST_ACCOUNT_ID,
        deletedPaymentFailedAlerts: deletedAlerts.count,
        deletedPaymentFailedStripeEvents: deletedEvents.count,
      },
      null,
      2
    )
  );
}

resetLocalPaymentAlertTest()
  .catch((error) => {
    console.error("Failed to reset local payment alert test state:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
