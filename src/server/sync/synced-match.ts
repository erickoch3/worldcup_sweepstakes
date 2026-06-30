import type { MatchStatus } from '@prisma/client';

export type SyncedMatch = {
  provider: string;
  providerFixtureId: string;
  matchNumber: number | null;
  teamACode: string;
  teamBCode: string;
  kickoffAt: Date | null;
  stage: string;
  status: MatchStatus;
  teamAScore: number | null;
  teamBScore: number | null;
  winnerTeamCode: string | null;
  penaltySummary?: string | null;
};
