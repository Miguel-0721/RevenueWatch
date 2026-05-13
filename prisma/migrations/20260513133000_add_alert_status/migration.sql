ALTER TABLE "Alert"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';

UPDATE "Alert"
SET "status" = CASE
  WHEN "windowEnd" > NOW() THEN 'active'
  ELSE 'resolved'
END;
