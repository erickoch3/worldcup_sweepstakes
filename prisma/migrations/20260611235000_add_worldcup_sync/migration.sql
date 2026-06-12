ALTER TABLE "Team" ADD COLUMN "oddsUpdatedAt" DATETIME;

ALTER TABLE "Match" ADD COLUMN "resultProvider" TEXT;
ALTER TABLE "Match" ADD COLUMN "resultProviderFixtureId" TEXT;
ALTER TABLE "Match" ADD COLUMN "resultSyncedAt" DATETIME;

CREATE UNIQUE INDEX "Match_resultProvider_resultProviderFixtureId_key" ON "Match"("resultProvider", "resultProviderFixtureId");

CREATE TABLE "TeamOddsSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "sourceSportKey" TEXT NOT NULL,
    "sourceLastUpdate" DATETIME,
    "sampledAt" DATETIME NOT NULL,
    "bookmakerKey" TEXT NOT NULL,
    "bookmakerTitle" TEXT NOT NULL,
    "marketKey" TEXT NOT NULL,
    "outcomeName" TEXT NOT NULL,
    "decimalOdds" REAL NOT NULL,
    "impliedProbability" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamOddsSnapshot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TeamOddsSnapshot_provider_sourceEventId_bookmakerKey_marketKey_teamId_sampledAt_key" ON "TeamOddsSnapshot"("provider", "sourceEventId", "bookmakerKey", "marketKey", "teamId", "sampledAt");
CREATE INDEX "TeamOddsSnapshot_teamId_sampledAt_idx" ON "TeamOddsSnapshot"("teamId", "sampledAt");
CREATE INDEX "TeamOddsSnapshot_provider_sampledAt_idx" ON "TeamOddsSnapshot"("provider", "sampledAt");

CREATE TABLE "DataSyncRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "appliedCount" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "DataSyncRun_provider_kind_startedAt_idx" ON "DataSyncRun"("provider", "kind", "startedAt");
CREATE INDEX "DataSyncRun_status_startedAt_idx" ON "DataSyncRun"("status", "startedAt");
