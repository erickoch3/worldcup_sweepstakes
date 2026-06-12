ALTER TABLE "Invite" ADD COLUMN "maxUses" INTEGER DEFAULT 1;
ALTER TABLE "Invite" ADD COLUMN "useCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Invite" ADD COLUMN "lastUsedAt" DATETIME;

UPDATE "Invite"
SET "useCount" = 1,
    "lastUsedAt" = "usedAt"
WHERE "usedAt" IS NOT NULL;
