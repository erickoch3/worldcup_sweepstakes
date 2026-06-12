import { computePrizeSummary } from '../../domain/prizes';
import { buildCurrentTeamWinProbabilityMap, currentAssignmentWinProbability } from '../../domain/current-win-probabilities';
import { computeStandings } from '../../domain/standings';
import { prisma } from '../../lib/prisma';

export async function getDashboardData() {
  const [draft, assignments, activeTeams] = await Promise.all([
    prisma.draft.findFirst({
      orderBy: { processedAt: 'desc' },
    }),
    prisma.assignment.findMany({
      include: {
        user: true,
        team: true,
        draft: true,
      },
    }),
    prisma.team.findMany({
      where: { active: true },
      orderBy: [{ groupName: 'asc' }, { decimalOdds: 'asc' }, { displayName: 'asc' }],
      select: {
        id: true,
        countryCode: true,
        displayName: true,
        groupName: true,
        decimalOdds: true,
      },
    }),
  ]);
  const activeTeamIds = activeTeams.map((team) => team.id);
  const representedTeams = Array.from(
    new Map(
      assignments.map((assignment) => [
        assignment.teamId,
        {
          id: assignment.team.id,
          countryCode: assignment.team.countryCode,
          displayName: assignment.team.displayName,
        },
      ]),
    ).values(),
  );
  const representedTeamIds = representedTeams.map((team) => team.id);
  const matches =
    representedTeamIds.length < 2
      ? []
      : await prisma.match.findMany({
          where: {
            teamAId: { in: representedTeamIds },
            teamBId: { in: representedTeamIds },
          },
          orderBy: { kickoffAt: 'asc' },
          include: {
            teamA: true,
            teamB: true,
            winnerTeam: true,
          },
        });
  const activeMatches =
    activeTeamIds.length < 2
      ? []
      : await prisma.match.findMany({
          where: {
            teamAId: { in: activeTeamIds },
            teamBId: { in: activeTeamIds },
          },
          orderBy: { kickoffAt: 'asc' },
          include: {
            teamA: true,
            teamB: true,
            winnerTeam: true,
          },
        });

  const standings = computeStandings({
    teams: representedTeams,
    matches: matches.map((match) => ({
      teamAId: match.teamAId,
      teamBId: match.teamBId,
      status: match.status,
      teamAScore: match.teamAScore,
      teamBScore: match.teamBScore,
    })),
  });
  const activeStandings = computeStandings({
    teams: activeTeams,
    matches: activeMatches.map((match) => ({
      teamAId: match.teamAId,
      teamBId: match.teamBId,
      status: match.status,
      teamAScore: match.teamAScore,
      teamBScore: match.teamBScore,
    })),
  });
  const standingsByTeamId = new Map(standings.map((row) => [row.teamId, row]));
  const activeStandingsByTeamId = new Map(activeStandings.map((row) => [row.teamId, row]));
  const currentTeamWinProbabilityById = buildCurrentTeamWinProbabilityMap(activeTeams);
  const ownersByTeamId = buildTeamOwners(assignments);
  const activeTeamsWithDashboardData = enrichActiveTeams({
    activeTeams,
    ownersByTeamId,
    standingsByTeamId: activeStandingsByTeamId,
  });
  const leaderboard = buildPlayerLeaderboard(assignments, standingsByTeamId, currentTeamWinProbabilityById);
  const prizeSummary = computePrizeSummary(
    assignments.map((assignment) => ({
      userId: assignment.userId,
      buyInPence: assignment.buyInPence,
    })),
  );

  return {
    teams: representedTeams,
    activeTeams: activeTeamsWithDashboardData,
    matches,
    draft,
    assignments,
    leaderboard,
    standings,
    prizeSummary,
  };
}

function enrichActiveTeams<
  Team extends {
    decimalOdds: number;
    id: string;
  },
>({
  activeTeams,
  ownersByTeamId,
  standingsByTeamId,
}: {
  activeTeams: Team[];
  ownersByTeamId: Map<string, string[]>;
  standingsByTeamId: Map<string, { points: number }>;
}) {
  const impliedProbabilityTotal = activeTeams.reduce((total, team) => total + 1 / team.decimalOdds, 0);

  return activeTeams.map((team) => ({
    ...team,
    currentPoints: standingsByTeamId.get(team.id)?.points ?? 0,
    normalizedWinProbability:
      impliedProbabilityTotal === 0 ? 0 : roundScore((1 / team.decimalOdds) / impliedProbabilityTotal),
    owners: ownersByTeamId.get(team.id) ?? [],
  }));
}

function buildTeamOwners<
  Assignment extends {
    teamId: string;
    user: { email: string | null; name: string | null };
  },
>(assignments: Assignment[]) {
  const ownersByTeamId = new Map<string, string[]>();

  for (const assignment of assignments) {
    const owner = formatPlayerName(assignment.user);
    const owners = ownersByTeamId.get(assignment.teamId) ?? [];

    if (!owners.includes(owner)) {
      owners.push(owner);
      ownersByTeamId.set(assignment.teamId, owners);
    }
  }

  return ownersByTeamId;
}

function buildPlayerLeaderboard<
  Assignment extends {
    buyInPence: number;
    normalizedWinProbability: number;
    pickNumber: number | null;
    teamId: string;
    teamShareCount: number;
    teamShareIndex: number;
    userId: string;
    team: { id: string; countryCode: string; displayName: string };
    user: { id: string; email: string | null; name: string | null };
  },
>(
  assignments: Assignment[],
  standingsByTeamId: Map<
    string,
    {
      goalsFor: number;
      goalDifference: number;
      points: number;
      teamId: string;
    }
  >,
  currentTeamWinProbabilityById: Map<string, number>,
) {
  const rowsByUserId = new Map<
    string,
    {
      userId: string;
      playerName: string | null;
      playerEmail: string | null;
      buyInPence: number;
      goalsFor: number;
      goalDifference: number;
      normalizedWinProbability: number;
      points: number;
      teams: Array<{
        id: string;
        countryCode: string;
        label: string;
        pickNumber: number | null;
        shareCount: number;
        shareIndex: number;
      }>;
    }
  >();

  for (const assignment of assignments) {
    const row =
      rowsByUserId.get(assignment.userId) ??
      {
        userId: assignment.userId,
        playerName: assignment.user.name,
        playerEmail: assignment.user.email,
        buyInPence: 0,
        goalsFor: 0,
        goalDifference: 0,
        normalizedWinProbability: 0,
        points: 0,
        teams: [],
      };
    const standing = standingsByTeamId.get(assignment.teamId);
    const shareCount = Math.max(1, assignment.teamShareCount);
    const standingWeight = 1 / shareCount;

    row.buyInPence += assignment.buyInPence;
    row.normalizedWinProbability = roundScore(
      row.normalizedWinProbability + currentAssignmentWinProbability(assignment, currentTeamWinProbabilityById),
    );
    row.points = roundScore(row.points + (standing?.points ?? 0) * standingWeight);
    row.goalDifference = roundScore(row.goalDifference + (standing?.goalDifference ?? 0) * standingWeight);
    row.goalsFor = roundScore(row.goalsFor + (standing?.goalsFor ?? 0) * standingWeight);
    row.teams.push({
      id: assignment.team.id,
      countryCode: assignment.team.countryCode,
      label:
        shareCount > 1
          ? `${assignment.team.displayName} (share ${assignment.teamShareIndex}/${shareCount})`
          : assignment.team.displayName,
      pickNumber: assignment.pickNumber,
      shareCount,
      shareIndex: assignment.teamShareIndex,
    });
    rowsByUserId.set(assignment.userId, row);
  }

  return [...rowsByUserId.values()]
    .map((row) => ({
      ...row,
      teams: row.teams.sort((left, right) => {
        const pickDifference = (left.pickNumber ?? Number.MAX_SAFE_INTEGER) - (right.pickNumber ?? Number.MAX_SAFE_INTEGER);

        if (pickDifference !== 0) {
          return pickDifference;
        }

        return left.label.localeCompare(right.label);
      }),
    }))
    .sort((left, right) => {
      if (left.points !== right.points) {
        return right.points - left.points;
      }

      if (left.normalizedWinProbability !== right.normalizedWinProbability) {
        return right.normalizedWinProbability - left.normalizedWinProbability;
      }

      if (left.goalDifference !== right.goalDifference) {
        return right.goalDifference - left.goalDifference;
      }

      if (left.goalsFor !== right.goalsFor) {
        return right.goalsFor - left.goalsFor;
      }

      return (left.playerName ?? left.playerEmail ?? left.userId).localeCompare(
        right.playerName ?? right.playerEmail ?? right.userId,
      );
    });
}

function roundScore(value: number): number {
  return Number(value.toFixed(12));
}

function formatPlayerName(user: { name: string | null; email: string | null }) {
  const name = user.name?.trim();

  if (name) {
    return name;
  }

  const email = user.email?.trim();

  if (!email) {
    return 'Unknown player';
  }

  const localPart = email.split('@')[0] ?? '';
  const formattedName = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return formattedName || email;
}
