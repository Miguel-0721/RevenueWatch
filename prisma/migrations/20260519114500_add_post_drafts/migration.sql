CREATE TABLE "PostDraft" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "postType" TEXT NOT NULL,
  "postText" TEXT,
  "screenshotUrl" TEXT,
  "screenshotNotes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PostDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PostDraft_postType_idx" ON "PostDraft"("postType");
CREATE INDEX "PostDraft_status_idx" ON "PostDraft"("status");
CREATE INDEX "PostDraft_updatedAt_idx" ON "PostDraft"("updatedAt");
