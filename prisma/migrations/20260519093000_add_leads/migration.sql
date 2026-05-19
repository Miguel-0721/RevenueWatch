CREATE TABLE "Lead" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "handle" TEXT,
  "profileUrl" TEXT,
  "productName" TEXT,
  "website" TEXT,
  "source" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "location" TEXT,
  "bio" TEXT,
  "postText" TEXT,
  "postUrl" TEXT,
  "pricingStatus" TEXT NOT NULL DEFAULT 'unknown',
  "likelyStripe" TEXT NOT NULL DEFAULT 'unknown',
  "painSignals" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "score" INTEGER NOT NULL DEFAULT 0,
  "scoreReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status" TEXT NOT NULL DEFAULT 'new',
  "notes" TEXT,
  "suggestedReply" TEXT,
  "lastContactedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lead_source_idx" ON "Lead"("source");
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
CREATE INDEX "Lead_score_idx" ON "Lead"("score");
