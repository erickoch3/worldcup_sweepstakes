export const STANDARD_BUY_IN_PENCE = 500;

export function computeFavoriteDecimalOdds(decimalOdds: number[]): number {
  if (decimalOdds.length === 0) {
    throw new Error('decimalOdds must not be empty');
  }

  for (const odds of decimalOdds) {
    if (!Number.isFinite(odds) || odds <= 0) {
      throw new Error('decimalOdds must be positive');
    }
  }

  return Math.min(...decimalOdds);
}

export function computeBuyInPence({
  decimalOdds,
  favoriteDecimalOdds,
}: {
  decimalOdds: number;
  favoriteDecimalOdds: number;
}): number {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 0) {
    throw new Error('decimalOdds must be positive');
  }

  if (!Number.isFinite(favoriteDecimalOdds) || favoriteDecimalOdds <= 0) {
    throw new Error('favoriteDecimalOdds must be positive');
  }

  return STANDARD_BUY_IN_PENCE;
}

export function computePlayerBuyInPence({
  normalizedWinProbability,
  targetWinProbability,
}: {
  normalizedWinProbability: number;
  targetWinProbability: number;
}): number {
  if (!Number.isFinite(normalizedWinProbability) || normalizedWinProbability < 0) {
    throw new Error('normalizedWinProbability must be non-negative');
  }

  if (!Number.isFinite(targetWinProbability) || targetWinProbability <= 0) {
    throw new Error('targetWinProbability must be positive');
  }

  if (normalizedWinProbability === 0) {
    return 0;
  }

  return STANDARD_BUY_IN_PENCE;
}

export function allocateAssignmentBuyIns({
  assignments,
  targetWinProbability,
  userTotals,
}: {
  assignments: Array<{ userId: string; normalizedWinProbability: number }>;
  targetWinProbability: number;
  userTotals: Array<{ userId: string; normalizedWinProbability: number }>;
}): number[] {
  const buyIns = Array.from({ length: assignments.length }, () => 0);
  const assignmentIndexesByUserId = new Map<string, number[]>();

  assignments.forEach((assignment, index) => {
    const indexes = assignmentIndexesByUserId.get(assignment.userId) ?? [];
    indexes.push(index);
    assignmentIndexesByUserId.set(assignment.userId, indexes);
  });

  for (const userTotal of userTotals) {
    const indexes = assignmentIndexesByUserId.get(userTotal.userId) ?? [];

    if (indexes.length === 0) {
      continue;
    }

    const userBuyInPence = computePlayerBuyInPence({
      normalizedWinProbability: userTotal.normalizedWinProbability,
      targetWinProbability,
    });

    if (userBuyInPence === 0) {
      continue;
    }

    splitEvenly({ buyIns, indexes, totalPence: userBuyInPence });
  }

  return buyIns;
}

function splitEvenly({
  buyIns,
  indexes,
  totalPence,
}: {
  buyIns: number[];
  indexes: number[];
  totalPence: number;
}): void {
  const basePence = Math.floor(totalPence / indexes.length);
  let remainingPence = totalPence - basePence * indexes.length;

  for (const index of indexes) {
    buyIns[index] = basePence;

    if (remainingPence > 0) {
      buyIns[index] += 1;
      remainingPence -= 1;
    }
  }
}
