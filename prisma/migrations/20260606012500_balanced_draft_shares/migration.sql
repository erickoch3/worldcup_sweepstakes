-- Redefine Assignment uniqueness so a draft can assign several teams to one
-- player and split one favorite into multiple shares.
DROP INDEX "Assignment_draftId_userId_key";
DROP INDEX "Assignment_draftId_teamId_key";

ALTER TABLE "Assignment" ADD COLUMN "pickNumber" INTEGER;
ALTER TABLE "Assignment" ADD COLUMN "teamShareIndex" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Assignment" ADD COLUMN "teamShareCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Assignment" ADD COLUMN "normalizedWinProbability" REAL NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "Assignment_draftId_teamId_teamShareIndex_key" ON "Assignment"("draftId", "teamId", "teamShareIndex");
CREATE INDEX "Assignment_draftId_userId_idx" ON "Assignment"("draftId", "userId");
CREATE INDEX "Assignment_draftId_teamId_idx" ON "Assignment"("draftId", "teamId");
