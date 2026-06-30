import { MatchStatus } from '@prisma/client';

import { WORLD_CUP_KNOCKOUT_SLOTS } from '../../data/world-cup-knockout';
import { prisma } from '../../lib/prisma';
import { getLatestDraftTeamPlayerMap } from './team-owners';

type KnockoutPlaceholderMatch = {
  id: string;
  matchNumber: number;
  resultProvider: null;
  resultProviderFixtureId: null;
  teamAId: null;
  teamBId: null;
  kickoffAt: Date;
  stage: string;
  status: MatchStatus;
  teamAScore: null;
  teamBScore: null;
  winnerTeamId: null;
  penaltySummary: null;
  resultSyncedAt: null;
  createdAt: Date;
  updatedAt: Date;
  teamA: null;
  teamB: null;
  winnerTeam: null;
  teamASlot: string;
  teamBSlot: string;
};

export async function getScheduleData(now = new Date()) {
  const [matches, teamPlayerMap] = await Promise.all([
    prisma.match.findMany({
      orderBy: { kickoffAt: 'asc' },
      include: {
        teamA: true,
        teamB: true,
        winnerTeam: true,
      },
    }),
    getLatestDraftTeamPlayerMap(),
  ]);
  const scheduleMatches = addKnockoutPlaceholders(matches);
  const nextScheduledMatch = scheduleMatches.find(
    (match) => match.status === MatchStatus.SCHEDULED && match.kickoffAt >= now,
  );

  return {
    matches: scheduleMatches,
    teamPlayerMap,
    nextMatchId: nextScheduledMatch?.id ?? null,
    nextScheduledMatchId: nextScheduledMatch?.id ?? null,
  };
}

function addKnockoutPlaceholders<Match extends { kickoffAt: Date; matchNumber: number | null }>(
  matches: Match[],
): Array<Match | KnockoutPlaceholderMatch> {
  const persistedMatchNumbers = new Set(matches.map((match) => match.matchNumber).filter(isNumber));
  const placeholders = WORLD_CUP_KNOCKOUT_SLOTS.flatMap<KnockoutPlaceholderMatch>((slot) => {
    if (persistedMatchNumbers.has(slot.matchNumber)) {
      return [];
    }

    const kickoffAt = new Date(slot.kickoffAt);

    return [
      {
        id: `match-${slot.matchNumber}`,
        matchNumber: slot.matchNumber,
        resultProvider: null,
        resultProviderFixtureId: null,
        teamAId: null,
        teamBId: null,
        kickoffAt,
        stage: slot.stage,
        status: MatchStatus.SCHEDULED,
        teamAScore: null,
        teamBScore: null,
        winnerTeamId: null,
        penaltySummary: null,
        resultSyncedAt: null,
        createdAt: kickoffAt,
        updatedAt: kickoffAt,
        teamA: null,
        teamB: null,
        winnerTeam: null,
        teamASlot: slot.teamASlot,
        teamBSlot: slot.teamBSlot,
      },
    ];
  });

  return [...matches, ...placeholders].sort(compareScheduleMatches);
}

function compareScheduleMatches(
  left: { kickoffAt: Date; matchNumber: number | null },
  right: { kickoffAt: Date; matchNumber: number | null },
): number {
  const kickoffDifference = left.kickoffAt.getTime() - right.kickoffAt.getTime();

  if (kickoffDifference !== 0) {
    return kickoffDifference;
  }

  return (left.matchNumber ?? Number.MAX_SAFE_INTEGER) - (right.matchNumber ?? Number.MAX_SAFE_INTEGER);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

export async function getScoresData() {
  const [matches, teamPlayerMap] = await Promise.all([
    prisma.match.findMany({
      where: { status: { in: [MatchStatus.LIVE, MatchStatus.FINAL] } },
      orderBy: { kickoffAt: 'desc' },
      include: {
        teamA: true,
        teamB: true,
        winnerTeam: true,
      },
    }),
    getLatestDraftTeamPlayerMap(),
  ]);

  return {
    matches: [...matches].sort(compareScoreMatches),
    teamPlayerMap,
  };
}

function compareScoreMatches(
  left: { kickoffAt: Date; status: MatchStatus },
  right: { kickoffAt: Date; status: MatchStatus },
): number {
  if (left.status === MatchStatus.LIVE && right.status !== MatchStatus.LIVE) {
    return -1;
  }

  if (right.status === MatchStatus.LIVE && left.status !== MatchStatus.LIVE) {
    return 1;
  }

  return right.kickoffAt.getTime() - left.kickoffAt.getTime();
}
