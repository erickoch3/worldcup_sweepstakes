export type DraftTeam = {
  id: string;
  decimalOdds: number;
};

export type DraftSubmission = {
  userId: string;
  submittedAt: Date;
  teamIdsByRank: string[];
};

export type DraftAssignment = {
  userId: string;
  teamId: string;
  preferenceRankWon: number | null;
  pickNumber: number;
  teamShareIndex: number;
  teamShareCount: number;
  normalizedWinProbability: number;
};

export type DraftUserTotal = {
  userId: string;
  normalizedWinProbability: number;
};

export type DraftResult = {
  assignments: DraftAssignment[];
  unassignedUserIds: string[];
  userTotals: DraftUserTotal[];
  targetWinProbability: number;
};

type DraftUnit = {
  teamId: string;
  teamShareIndex: number;
  teamShareCount: number;
  normalizedWinProbability: number;
};

type TopThreeMatch = {
  preferenceRankWon: number;
  teamId: string;
  userId: string;
};

export function computeDraftAssignments({
  rng = Math.random,
  teams,
  submissions,
}: {
  rng?: () => number;
  teams: DraftTeam[];
  submissions: DraftSubmission[];
}): DraftResult {
  if (submissions.length === 0) {
    return {
      assignments: [],
      unassignedUserIds: [],
      userTotals: [],
      targetWinProbability: 0,
    };
  }

  if (teams.length === 0) {
    return {
      assignments: [],
      unassignedUserIds: submissions.map((submission) => submission.userId).sort((left, right) => left.localeCompare(right)),
      userTotals: submissions
        .map((submission) => ({ userId: submission.userId, normalizedWinProbability: 0 }))
        .sort((left, right) => left.userId.localeCompare(right.userId)),
      targetWinProbability: roundProbability(1 / submissions.length),
    };
  }

  const impliedTotal = teams.reduce((total, team) => {
    if (!Number.isFinite(team.decimalOdds) || team.decimalOdds <= 0) {
      throw new Error(`Team ${team.id} must have positive decimal odds.`);
    }

    return total + 1 / team.decimalOdds;
  }, 0);

  if (impliedTotal <= 0) {
    throw new Error('Draft teams must include at least one positive implied probability.');
  }

  const targetWinProbability = roundProbability(1 / submissions.length);
  const remainingUnits: DraftUnit[] = teams.map((team) => ({
    teamId: team.id,
    teamShareIndex: 1,
    teamShareCount: 1,
    normalizedWinProbability: roundProbability((1 / team.decimalOdds) / impliedTotal),
  }));
  const submissionByUserId = new Map(submissions.map((submission) => [submission.userId, submission]));
  const userTotals = new Map(submissions.map((submission) => [submission.userId, 0]));
  const assignments: DraftAssignment[] = [];

  function assignUnit(userId: string, unitIndex: number, preferenceRankWon: number | null) {
    const [unit] = remainingUnits.splice(unitIndex, 1);

    if (unit === undefined) {
      throw new Error('Cannot assign a missing draft team.');
    }

    assignments.push({
      userId,
      teamId: unit.teamId,
      preferenceRankWon,
      pickNumber: assignments.length + 1,
      teamShareIndex: unit.teamShareIndex,
      teamShareCount: unit.teamShareCount,
      normalizedWinProbability: unit.normalizedWinProbability,
    });
    userTotals.set(userId, roundProbability((userTotals.get(userId) ?? 0) + unit.normalizedWinProbability));
  }

  const firstChoiceContenders = buildFirstChoiceContenders(submissions);
  for (const [teamId, contenders] of firstChoiceContenders) {
    const unitIndex = remainingUnits.findIndex((unit) => unit.teamId === teamId);

    if (unitIndex === -1) {
      continue;
    }

    const selectedUserId = pickRandom(contenders, rng);

    assignUnit(selectedUserId, unitIndex, 1);
  }

  const topThreeMatches = findTopThreeMatches({ assignments, remainingUnits, submissions, userTotals });
  for (const match of topThreeMatches) {
    const unitIndex = remainingUnits.findIndex((unit) => unit.teamId === match.teamId);

    if (unitIndex !== -1) {
      assignUnit(match.userId, unitIndex, match.preferenceRankWon);
    }
  }

  remainingUnits.sort((left, right) => {
    const probabilityDifference = right.normalizedWinProbability - left.normalizedWinProbability;

    if (probabilityDifference !== 0) {
      return probabilityDifference;
    }

    return left.teamId.localeCompare(right.teamId);
  });

  while (remainingUnits.length > 0) {
    const unit = remainingUnits[0]!;
    const selectedUserId = selectUserForUnit({ rng, submissions, unit, userTotals });
    const selectedSubmission = submissionByUserId.get(selectedUserId);
    const preferenceRankWon = selectedSubmission === undefined ? null : getPreferenceRank(selectedSubmission, unit.teamId);

    assignUnit(selectedUserId, 0, preferenceRankWon);
  }

  const assignedUserIds = new Set(assignments.map((assignment) => assignment.userId));
  const unassignedUserIds = submissions
    .filter((submission) => !assignedUserIds.has(submission.userId))
    .map((submission) => submission.userId)
    .sort((left, right) => left.localeCompare(right));

  return {
    assignments,
    unassignedUserIds,
    userTotals: [...userTotals]
      .map(([userId, normalizedWinProbability]) => ({ userId, normalizedWinProbability: roundProbability(normalizedWinProbability) }))
      .sort((left, right) => left.userId.localeCompare(right.userId)),
    targetWinProbability,
  };
}

function buildFirstChoiceContenders(submissions: DraftSubmission[]): Map<string, string[]> {
  const userIdsByTeamId = new Map<string, string[]>();

  for (const submission of submissions) {
    const firstChoiceTeamId = submission.teamIdsByRank[0];

    if (firstChoiceTeamId === undefined) {
      continue;
    }

    const userIds = userIdsByTeamId.get(firstChoiceTeamId) ?? [];
    userIds.push(submission.userId);
    userIdsByTeamId.set(firstChoiceTeamId, userIds);
  }

  return userIdsByTeamId;
}

function findTopThreeMatches({
  assignments,
  remainingUnits,
  submissions,
  userTotals,
}: {
  assignments: DraftAssignment[];
  remainingUnits: DraftUnit[];
  submissions: DraftSubmission[];
  userTotals: Map<string, number>;
}): TopThreeMatch[] {
  const pendingSubmissions = submissions.filter((submission) => !hasTopThreeAssignment(submission.userId, assignments));
  const remainingTeamIds = new Set(remainingUnits.map((unit) => unit.teamId));
  const unitByTeamId = new Map(remainingUnits.map((unit) => [unit.teamId, unit]));
  const optionsByUserId = new Map<string, TopThreeMatch[]>();

  for (const submission of pendingSubmissions) {
    const options = submission.teamIdsByRank
      .slice(0, 3)
      .flatMap((teamId, index) =>
        remainingTeamIds.has(teamId)
          ? [{
              userId: submission.userId,
              teamId,
              preferenceRankWon: index + 1,
            }]
          : [],
      );
    optionsByUserId.set(submission.userId, options);
  }

  const orderedSubmissions = [...pendingSubmissions].sort((left, right) => {
    const optionDifference = (optionsByUserId.get(left.userId)?.length ?? 0) - (optionsByUserId.get(right.userId)?.length ?? 0);

    if (optionDifference !== 0) {
      return optionDifference;
    }

    return left.userId.localeCompare(right.userId);
  });
  let bestMatches: TopThreeMatch[] = [];

  function isCandidateBetter(candidateMatches: TopThreeMatch[], incumbentMatches: TopThreeMatch[]): boolean {
    if (candidateMatches.length !== incumbentMatches.length) {
      return candidateMatches.length > incumbentMatches.length;
    }

    const candidateRankTotal = candidateMatches.reduce((total, match) => total + match.preferenceRankWon, 0);
    const incumbentRankTotal = incumbentMatches.reduce((total, match) => total + match.preferenceRankWon, 0);

    if (candidateRankTotal !== incumbentRankTotal) {
      return candidateRankTotal < incumbentRankTotal;
    }

    return projectedSpread(candidateMatches, userTotals, unitByTeamId) < projectedSpread(incumbentMatches, userTotals, unitByTeamId);
  }

  function search(index: number, usedTeamIds: Set<string>, matches: TopThreeMatch[]) {
    if (matches.length + (orderedSubmissions.length - index) < bestMatches.length) {
      return;
    }

    if (index >= orderedSubmissions.length) {
      if (isCandidateBetter(matches, bestMatches)) {
        bestMatches = [...matches];
      }

      return;
    }

    const submission = orderedSubmissions[index]!;
    const options = optionsByUserId.get(submission.userId) ?? [];

    for (const option of options) {
      if (usedTeamIds.has(option.teamId)) {
        continue;
      }

      usedTeamIds.add(option.teamId);
      matches.push(option);
      search(index + 1, usedTeamIds, matches);
      matches.pop();
      usedTeamIds.delete(option.teamId);
    }

    search(index + 1, usedTeamIds, matches);
  }

  search(0, new Set(), []);

  return bestMatches.sort((left, right) => {
    const leftIndex = submissions.findIndex((submission) => submission.userId === left.userId);
    const rightIndex = submissions.findIndex((submission) => submission.userId === right.userId);

    return leftIndex - rightIndex;
  });
}

function hasTopThreeAssignment(userId: string, assignments: DraftAssignment[]): boolean {
  return assignments.some(
    (assignment) =>
      assignment.userId === userId &&
      assignment.preferenceRankWon !== null &&
      assignment.preferenceRankWon <= 3,
  );
}

function projectedSpread(matches: TopThreeMatch[], userTotals: Map<string, number>, unitByTeamId: Map<string, DraftUnit>): number {
  const projectedTotals = new Map(userTotals);

  for (const match of matches) {
    const unit = unitByTeamId.get(match.teamId);

    if (unit === undefined) {
      continue;
    }

    projectedTotals.set(match.userId, (projectedTotals.get(match.userId) ?? 0) + unit.normalizedWinProbability);
  }

  const totals = [...projectedTotals.values()];

  return Math.max(...totals) - Math.min(...totals);
}

function selectUserForUnit({
  rng,
  submissions,
  unit,
  userTotals,
}: {
  rng: () => number;
  submissions: DraftSubmission[];
  unit: DraftUnit;
  userTotals: Map<string, number>;
}): string {
  const candidates = submissions.map((submission) => ({
    userId: submission.userId,
    preferenceRank: getPreferenceRank(submission, unit.teamId) ?? Number.MAX_SAFE_INTEGER,
    total: userTotals.get(submission.userId) ?? 0,
  }));
  const lowestTotal = Math.min(...candidates.map((candidate) => candidate.total));
  const lowestTotalCandidates = candidates.filter((candidate) => Math.abs(candidate.total - lowestTotal) < 1e-12);
  const bestPreferenceRank = Math.min(...lowestTotalCandidates.map((candidate) => candidate.preferenceRank));
  const contenders = lowestTotalCandidates.filter((candidate) => candidate.preferenceRank === bestPreferenceRank);

  if (contenders.length === 0) {
    throw new Error('Cannot select a draft user from an empty tied-player pool.');
  }

  const winnerIndex = Math.min(contenders.length - 1, Math.floor(rng() * contenders.length));

  return contenders[winnerIndex]!.userId;
}

function pickRandom<T>(items: T[], rng: () => number): T {
  if (items.length === 0) {
    throw new Error('Cannot select from an empty draft pool.');
  }

  const winnerIndex = Math.min(items.length - 1, Math.floor(rng() * items.length));

  return items[winnerIndex]!;
}

function getPreferenceRank(submission: DraftSubmission, teamId: string): number | null {
  const rankIndex = submission.teamIdsByRank.indexOf(teamId);

  return rankIndex === -1 ? null : rankIndex + 1;
}

function roundProbability(value: number): number {
  return Number(value.toFixed(12));
}
