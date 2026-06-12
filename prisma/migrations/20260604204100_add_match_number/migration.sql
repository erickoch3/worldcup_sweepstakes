-- AlterTable
ALTER TABLE "Match" ADD COLUMN "matchNumber" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Match_matchNumber_key" ON "Match"("matchNumber");
