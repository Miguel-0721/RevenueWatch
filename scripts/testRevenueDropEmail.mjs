import { PrismaClient } from "@prisma/client";
import nextEnv from "@next/env";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

if (process.env.NODE_ENV === "production") {
  throw new Error("testRevenueDropEmail cannot run in production.");
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

  const context = JSON.stringify({
    currentAmount: 5800000,
    baselineAmount: 11200000,
    alertThresholdAmount: 7500000,
    dropRatio: 0.48,
    currentWindowStart: new Date().toISOString(),
  });

  await sendAlertEmail({
    type: "revenue_drop",
    severity: "critical",
    message: "Sales are 48% lower than usual for this window.",
    stripeAccountId: LOCAL_TEST_ACCOUNT_ID,
    detectedAt: new Date(),
    context,
  });

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

  console.log("Local RevenueWatch revenue-drop test email requested:");
  console.log(
    JSON.stringify(
      {
        stripeAccountId: LOCAL_TEST_ACCOUNT_ID,
        accountName: "Local Stripe CLI Test Account",
        severity: "High Severity",
        currentRevenue: "€58,000",
        usualRevenue: "€112,000",
        alertThreshold: "€75,000",
        dropPercentage: "48%",
        reviewUrl: `${appUrl}/dashboard/accounts/${LOCAL_TEST_ACCOUNT_ID}`,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("Failed to send local revenue-drop test email:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
