CREATE TABLE "SubscriptionHealthSubscription" (
  "id" TEXT NOT NULL,
  "stripeSubscriptionId" TEXT NOT NULL,
  "stripeAccountId" TEXT NOT NULL,
  "stripeCustomerId" TEXT,
  "status" TEXT NOT NULL,
  "priceId" TEXT,
  "currency" TEXT,
  "interval" TEXT,
  "intervalCount" INTEGER,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitAmount" INTEGER,
  "estimatedMonthlyRevenue" INTEGER NOT NULL DEFAULT 0,
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "trialStart" TIMESTAMP(3),
  "trialEnd" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "lastEventCreatedAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SubscriptionHealthSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionHealthSubscription_stripeSubscriptionId_key"
  ON "SubscriptionHealthSubscription"("stripeSubscriptionId");
CREATE INDEX "SubscriptionHealthSubscription_stripeAccountId_idx"
  ON "SubscriptionHealthSubscription"("stripeAccountId");
CREATE INDEX "SubscriptionHealthSubscription_status_idx"
  ON "SubscriptionHealthSubscription"("status");
CREATE INDEX "SubscriptionHealthSubscription_currentPeriodEnd_idx"
  ON "SubscriptionHealthSubscription"("currentPeriodEnd");

CREATE TABLE "SubscriptionHealthEvent" (
  "id" TEXT NOT NULL,
  "stripeEventId" TEXT NOT NULL,
  "stripeAccountId" TEXT NOT NULL,
  "stripeSubscriptionId" TEXT,
  "stripeCustomerId" TEXT,
  "type" TEXT NOT NULL,
  "subscriptionStatus" TEXT,
  "billingReason" TEXT,
  "currency" TEXT,
  "amountDue" INTEGER,
  "amountPaid" INTEGER,
  "estimatedMonthlyRevenue" INTEGER NOT NULL DEFAULT 0,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SubscriptionHealthEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionHealthEvent_stripeEventId_key"
  ON "SubscriptionHealthEvent"("stripeEventId");
CREATE INDEX "SubscriptionHealthEvent_stripeAccountId_idx"
  ON "SubscriptionHealthEvent"("stripeAccountId");
CREATE INDEX "SubscriptionHealthEvent_type_idx"
  ON "SubscriptionHealthEvent"("type");
CREATE INDEX "SubscriptionHealthEvent_occurredAt_idx"
  ON "SubscriptionHealthEvent"("occurredAt");

CREATE TABLE "SubscriptionHealthSnapshot" (
  "id" TEXT NOT NULL,
  "snapshotKey" TEXT NOT NULL,
  "stripeAccountId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "activeSubscriptions" INTEGER NOT NULL DEFAULT 0,
  "trialingSubscriptions" INTEGER NOT NULL DEFAULT 0,
  "pastDueSubscriptions" INTEGER NOT NULL DEFAULT 0,
  "unpaidSubscriptions" INTEGER NOT NULL DEFAULT 0,
  "canceledSubscriptions" INTEGER NOT NULL DEFAULT 0,
  "newSubscriptions" INTEGER NOT NULL DEFAULT 0,
  "cancellations" INTEGER NOT NULL DEFAULT 0,
  "failedRenewalPayments" INTEGER NOT NULL DEFAULT 0,
  "estimatedMonthlyRevenue" INTEGER NOT NULL DEFAULT 0,
  "netSubscriptionMovement" INTEGER NOT NULL DEFAULT 0,
  "windowStart" TIMESTAMP(3),
  "windowEnd" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SubscriptionHealthSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionHealthSnapshot_snapshotKey_key"
  ON "SubscriptionHealthSnapshot"("snapshotKey");
CREATE INDEX "SubscriptionHealthSnapshot_stripeAccountId_idx"
  ON "SubscriptionHealthSnapshot"("stripeAccountId");
CREATE INDEX "SubscriptionHealthSnapshot_source_idx"
  ON "SubscriptionHealthSnapshot"("source");
CREATE INDEX "SubscriptionHealthSnapshot_createdAt_idx"
  ON "SubscriptionHealthSnapshot"("createdAt");
