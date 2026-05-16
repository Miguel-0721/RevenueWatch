ALTER TABLE "StripeAccount"
ADD COLUMN "backfillStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "lastBackfilledAt" TIMESTAMP(3),
ADD COLUMN "backfillStartedAt" TIMESTAMP(3),
ADD COLUMN "backfillError" TEXT;
