import { MatchStatus } from '@prisma/client';

import { prisma } from '../../lib/prisma';
import { getLatestDraftTeamPlayerMap } from './team-owners';

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
  const nextScheduledMatch = matches.find(
    (match) => match.status === MatchStatus.SCHEDULED && match.kickoffAt >= now,
  );

  return {
    matches,
    teamPlayerMap,
    nextMatchId: nextScheduledMatch?.id ?? null,
    nextScheduledMatchId: nextScheduledMatch?.id ?? null,
  };
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
