import { PrismaClient } from "@prisma/client";
import nextEnv from "@next/env";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

if (process.env.NODE_ENV === "production") {
  throw new Error("testPaymentFailureEmail cannot run in production.");
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const target = pathToFileURL(
        `${process.cwd().replace(/\\/g, "/")}/src/${specifier.slice(2)}.ts`
      ).href;

      return nextResolve(target, context);
    }

    return nextResolve(specifier, context);
  },
});

const prisma = new PrismaClient();
const LOCAL_TEST_ACCOUNT_ID = "test_account_local";

async function main() {
  await prisma.stripeAccount.upsert({
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

  const { sendAlertEmail } = await import("../src/lib/notify.ts");
  const now = new Date();
  const currentWindowStart = new Date(now.getTime() - 60 * 60 * 1000);

  const context = JSON.stringify({
    currentFailures: 15,
    failuresCounted: 15,
    usualFailures: 5,
    normalFailures: 5,
    baseline: 5,
    effectiveUsualFailures: 5,
    spikeMultiple: 3,
    failureThreshold: 10,
    comparisonWindowCount: 5,
    comparisonLevel: "same_day_type_and_hour",
    failureSpikeMultiplier: 2,
    baselineFloor: 3,
    failureWindowMinutes: 60,
    currentWindowStart: currentWindowStart.toISOString(),
    currentWindowEnd: now.toISOString(),
    displayMessage: "Payment failures are higher than usual compared to recent activity.",
  });

  await sendAlertEmail({
    type: "payment_failed",
    severity: "warning",
    message: "Payment failures are higher than usual compared to recent activity.",
    stripeAccountId: LOCAL_TEST_ACCOUNT_ID,
    detectedAt: now,
    context,
  });

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

  console.log("Local Parveil payment-failure test email requested:");
  console.log(
    JSON.stringify(
      {
        stripeAccountId: LOCAL_TEST_ACCOUNT_ID,
        accountName: "Local Stripe CLI Test Account",
        severity: "Review Needed",
        currentFailures: 15,
        usualFailures: 5,
        alertThreshold: 10,
        spikeMultiple: 3,
        reviewUrl: `${appUrl}/dashboard/accounts/${LOCAL_TEST_ACCOUNT_ID}`,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("Failed to send local payment-failure test email:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
