-- CreateIndex
CREATE UNIQUE INDEX "Match_teamAId_teamBId_kickoffAt_key" ON "Match"("teamAId", "teamBId", "kickoffAt");
