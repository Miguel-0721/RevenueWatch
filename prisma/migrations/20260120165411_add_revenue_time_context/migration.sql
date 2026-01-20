-- AlterTable
ALTER TABLE "RevenueMetric" ADD COLUMN "dayOfWeek" INTEGER;
ALTER TABLE "RevenueMetric" ADD COLUMN "hourOfDay" INTEGER;

-- CreateIndex
CREATE INDEX "RevenueMetric_dayOfWeek_hourOfDay_idx" ON "RevenueMetric"("dayOfWeek", "hourOfDay");
