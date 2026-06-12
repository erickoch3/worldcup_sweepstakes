export type StandingsTeam = {
  id: string;
  displayName: string;
};

export type StandingsMatch = {
  teamAId: string;
  teamBId: string;
  status: string;
  teamAScore: number | null;
  teamBScore: number | null;
};

export type StandingRow = {
  teamId: string;
  displayName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

export function computeStandings({
  teams,
  matches,
}: {
  teams: StandingsTeam[];
  matches: StandingsMatch[];
}): StandingRow[] {
  const rowsByTeamId = new Map<string, StandingRow>(
    teams.map((team) => [
      team.id,
      {
        teamId: team.id,
        displayName: team.displayName,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      },
    ]),
  );

  for (const match of matches) {
    const teamARow = rowsByTeamId.get(match.teamAId);
    const teamBRow = rowsByTeamId.get(match.teamBId);

    if (
      match.status !== 'FINAL' ||
      teamARow === undefined ||
      teamBRow === undefined ||
      typeof match.teamAScore !== 'number' ||
      typeof match.teamBScore !== 'number'
    ) {
      continue;
    }

    applyResult(teamARow, match.teamAScore, match.teamBScore);
    applyResult(teamBRow, match.teamBScore, match.teamAScore);
  }

  return Array.from(rowsByTeamId.values()).sort((left, right) => {
    if (left.points !== right.points) {
      return right.points - left.points;
    }

    if (left.goalDifference !== right.goalDifference) {
      return right.goalDifference - left.goalDifference;
    }

    if (left.goalsFor !== right.goalsFor) {
      return right.goalsFor - left.goalsFor;
    }

    return left.displayName.localeCompare(right.displayName);
  });
}

function applyResult(row: StandingRow, goalsFor: number, goalsAgainst: number): void {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  row.goalDifference = row.goalsFor - row.goalsAgainst;

  if (goalsFor > goalsAgainst) {
    row.won += 1;
    row.points += 3;
  } else if (goalsFor === goalsAgainst) {
    row.drawn += 1;
    row.points += 1;
  } else {
    row.lost += 1;
  }
}
