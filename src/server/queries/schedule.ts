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
