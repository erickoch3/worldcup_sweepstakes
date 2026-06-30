import { formatPlayerLabelForTeam, type TeamPlayerMap } from '@/server/queries/team-owners';

type DashboardSourceMatch = {
  id: string;
  kickoffAt: Date;
  stage: string;
  status: string;
  teamAScore: number | null;
  teamBScore: number | null;
  teamAId: string | null;
  teamBId: string | null;
  teamASlot?: string;
  teamBSlot?: string;
  teamA: {
    countryCode: string | null;
    displayName: string;
  } | null;
  teamB: {
    countryCode: string | null;
    displayName: string;
  } | null;
};

export type DashboardMatch = {
  id: string;
  isLive: boolean;
  kickoff: Date;
  players: string;
  score: string | null;
  stage: string;
  statusLabel: string;
  teamA: {
    countryCode: string | null;
    name: string;
  };
  teamB: {
    countryCode: string | null;
    name: string;
  };
};

export function selectDashboardMatches(
  matches: DashboardSourceMatch[],
  teamPlayerMap: TeamPlayerMap,
  now = new Date(),
): DashboardMatch[] {
  const referenceTime = now.getTime();

  return matches
    .filter((match) => match.status === 'LIVE' || (match.status === 'SCHEDULED' && match.kickoffAt.getTime() >= referenceTime))
    .sort(compareDashboardMatches)
    .slice(0, 5)
    .map((match) => ({
      id: match.id,
      isLive: match.status === 'LIVE',
      teamA: {
        countryCode: match.teamA?.countryCode ?? null,
        name: match.teamA?.displayName ?? 'TBD',
      },
      teamB: {
        countryCode: match.teamB?.countryCode ?? null,
        name: match.teamB?.displayName ?? 'TBD',
      },
      kickoff: match.kickoffAt,
      players: `${formatDashboardTeamDetail(match.teamAId, match.teamASlot, teamPlayerMap)} vs ${formatDashboardTeamDetail(
        match.teamBId,
        match.teamBSlot,
        teamPlayerMap,
      )}`,
      score: formatDashboardScore(match),
      stage: match.stage,
      statusLabel: match.status === 'LIVE' ? 'Live' : match.stage,
    }));
}

function formatDashboardTeamDetail(
  teamId: string | null,
  slotLabel: string | undefined,
  teamPlayerMap: TeamPlayerMap,
): string {
  return teamId === null ? slotLabel ?? 'TBD' : formatPlayerLabelForTeam(teamId, teamPlayerMap);
}

function compareDashboardMatches(left: DashboardSourceMatch, right: DashboardSourceMatch): number {
  if (left.status === 'LIVE' && right.status !== 'LIVE') {
    return -1;
  }

  if (right.status === 'LIVE' && left.status !== 'LIVE') {
    return 1;
  }

  return left.kickoffAt.getTime() - right.kickoffAt.getTime();
}

function formatDashboardScore(match: DashboardSourceMatch): string | null {
  if (match.teamAScore === null || match.teamBScore === null) {
    return null;
  }

  return `${match.teamAScore}-${match.teamBScore}`;
}
