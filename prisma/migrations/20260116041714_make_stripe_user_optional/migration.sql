-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StripeAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stripeAccountId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "StripeAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StripeAccount" ("createdAt", "id", "name", "status", "stripeAccountId", "userId") SELECT "createdAt", "id", "name", "status", "stripeAccountId", "userId" FROM "StripeAccount";
DROP TABLE "StripeAccount";
ALTER TABLE "new_StripeAccount" RENAME TO "StripeAccount";
CREATE UNIQUE INDEX "StripeAccount_stripeAccountId_key" ON "StripeAccount"("stripeAccountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
