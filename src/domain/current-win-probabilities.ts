export type CurrentOddsTeam = {
  id: string;
  decimalOdds: number;
};

export type AssignmentWinProbabilityInput = {
  normalizedWinProbability: number;
  teamId: string;
  teamShareCount: number;
};

export function buildCurrentTeamWinProbabilityMap<Team extends CurrentOddsTeam>(teams: Team[]): Map<string, number> {
  const impliedProbabilityTotal = teams.reduce((total, team) => {
    if (!Number.isFinite(team.decimalOdds) || team.decimalOdds <= 0) {
      return total;
    }

    return total + 1 / team.decimalOdds;
  }, 0);

  if (impliedProbabilityTotal <= 0) {
    return new Map();
  }

  return new Map(
    teams.flatMap((team) => {
      if (!Number.isFinite(team.decimalOdds) || team.decimalOdds <= 0) {
        return [];
      }

      return [[team.id, roundProbability((1 / team.decimalOdds) / impliedProbabilityTotal)]];
    }),
  );
}

export function currentAssignmentWinProbability(
  assignment: AssignmentWinProbabilityInput,
  currentTeamWinProbabilityById: Map<string, number>,
): number {
  const currentTeamProbability = currentTeamWinProbabilityById.get(assignment.teamId);

  if (currentTeamProbability === undefined) {
    return assignment.normalizedWinProbability;
  }

  return roundProbability(currentTeamProbability / Math.max(1, assignment.teamShareCount));
}

function roundProbability(value: number): number {
  return Number(value.toFixed(12));
}
