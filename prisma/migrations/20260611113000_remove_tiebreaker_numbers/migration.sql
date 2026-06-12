PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS "PreferenceSubmissionTieBreakArchive" (
    "submissionId" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tieBreakNumber" INTEGER NOT NULL,
    "archivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO "PreferenceSubmissionTieBreakArchive" ("submissionId", "userId", "tieBreakNumber")
SELECT "id", "userId", "tieBreakNumber"
FROM "PreferenceSubmission";

CREATE TABLE IF NOT EXISTS "DraftRandomNumberArchive" (
    "draftId" TEXT NOT NULL PRIMARY KEY,
    "randomNumber" INTEGER NOT NULL,
    "archivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO "DraftRandomNumberArchive" ("draftId", "randomNumber")
SELECT "id", "randomNumber"
FROM "Draft";

CREATE TABLE "PreferenceSubmissionArchive" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalSubmissionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT,
    "userName" TEXT,
    "choicesJson" TEXT NOT NULL,
    "lockedAt" DATETIME,
    "submittedAt" DATETIME NOT NULL,
    "deletedById" TEXT,
    "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "PreferenceSubmissionArchive_originalSubmissionId_idx" ON "PreferenceSubmissionArchive"("originalSubmissionId");
CREATE INDEX "PreferenceSubmissionArchive_userId_idx" ON "PreferenceSubmissionArchive"("userId");
CREATE INDEX "PreferenceSubmissionArchive_deletedAt_idx" ON "PreferenceSubmissionArchive"("deletedAt");

CREATE TABLE "new_PreferenceSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lockedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PreferenceSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_PreferenceSubmission" ("createdAt", "id", "lockedAt", "updatedAt", "userId")
SELECT "createdAt", "id", "lockedAt", "updatedAt", "userId"
FROM "PreferenceSubmission";

DROP TABLE "PreferenceSubmission";
ALTER TABLE "new_PreferenceSubmission" RENAME TO "PreferenceSubmission";
CREATE UNIQUE INDEX "PreferenceSubmission_userId_key" ON "PreferenceSubmission"("userId");

CREATE TABLE "new_Draft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'LOCKED',
    "processedById" TEXT,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Draft_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Draft" ("createdAt", "id", "processedAt", "processedById", "status")
SELECT "createdAt", "id", "processedAt", "processedById", "status"
FROM "Draft";

DROP TABLE "Draft";
ALTER TABLE "new_Draft" RENAME TO "Draft";
CREATE UNIQUE INDEX "Draft_status_key" ON "Draft"("status");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
