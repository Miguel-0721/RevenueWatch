-- CreateTable
CREATE TABLE "RevenueMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stripeAccountId" TEXT,
    "amount" INTEGER NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "RevenueMetric_stripeAccountId_idx" ON "RevenueMetric"("stripeAccountId");

-- CreateIndex
CREATE INDEX "RevenueMetric_periodStart_idx" ON "RevenueMetric"("periodStart");
