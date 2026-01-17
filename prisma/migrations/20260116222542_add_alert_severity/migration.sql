-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "stripeAccountId" TEXT,
    "stripeEventId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "windowStart" DATETIME NOT NULL,
    "windowEnd" DATETIME NOT NULL,
    "cooldownUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Alert" ("cooldownUntil", "createdAt", "id", "message", "stripeAccountId", "stripeEventId", "type", "windowEnd", "windowStart") SELECT "cooldownUntil", "createdAt", "id", "message", "stripeAccountId", "stripeEventId", "type", "windowEnd", "windowStart" FROM "Alert";
DROP TABLE "Alert";
ALTER TABLE "new_Alert" RENAME TO "Alert";
CREATE UNIQUE INDEX "Alert_stripeEventId_key" ON "Alert"("stripeEventId");
CREATE INDEX "Alert_type_idx" ON "Alert"("type");
CREATE INDEX "Alert_severity_idx" ON "Alert"("severity");
CREATE INDEX "Alert_stripeAccountId_idx" ON "Alert"("stripeAccountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
