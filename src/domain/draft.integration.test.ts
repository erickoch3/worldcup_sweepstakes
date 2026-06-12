import { describe, expect, it } from 'vitest';

import { WORLD_CUP_TEAMS } from '../data/world-cup-teams';
import { allocateAssignmentBuyIns, computePlayerBuyInPence, STANDARD_BUY_IN_PENCE } from './buy-ins';
import { computeDraftAssignments } from './draft';

describe('balanced draft integration', () => {
  it('allocates the full odds snapshot across test users with standard player buy-ins', () => {
    const teams = WORLD_CUP_TEAMS.filter((team) => team.active).map((team) => ({
      id: team.countryCode,
      decimalOdds: team.decimalOdds,
    }));
    const teamIdsByOdds = [...teams].sort((left, right) => left.decimalOdds - right.decimalOdds).map((team) => team.id);
    const submissions = ['ada', 'ben', 'cam', 'dee', 'eli', 'flo', 'gus'].map((userId, index) => ({
      userId,
      submittedAt: new Date(`2026-06-05T09:0${index}:00.000Z`),
      teamIdsByRank: rotate(teamIdsByOdds, index * 5),
    }));

    const result = computeDraftAssignments({
      rng: () => 0,
      submissions,
      teams,
    });
    const buyIns = allocateAssignmentBuyIns({
      assignments: result.assignments,
      targetWinProbability: result.targetWinProbability,
      userTotals: result.userTotals,
    });
    const shareKeys = new Set(
      result.assignments.map((assignment) => `${assignment.teamId}:${assignment.teamShareIndex}/${assignment.teamShareCount}`),
    );
    const assignmentsByTeamId = new Map<string, typeof result.assignments>();

    for (const assignment of result.assignments) {
      const assignments = assignmentsByTeamId.get(assignment.teamId) ?? [];
      assignments.push(assignment);
      assignmentsByTeamId.set(assignment.teamId, assignments);
    }

    expect(result.unassignedUserIds).toEqual([]);
    expect(shareKeys.size).toBe(result.assignments.length);
    expect([...assignmentsByTeamId.keys()].sort()).toEqual(teams.map((team) => team.id).sort());
    expect(result.assignments.every((assignment) => assignment.preferenceRankWon !== null)).toBe(true);

    for (const assignments of assignmentsByTeamId.values()) {
      const shareCount = assignments[0]?.teamShareCount ?? 0;

      expect(assignments).toHaveLength(shareCount);
      expect(assignments.map((assignment) => assignment.teamShareIndex).sort((left, right) => left - right)).toEqual(
        Array.from({ length: shareCount }, (_, index) => index + 1),
      );
    }

    const totals = result.userTotals.map((total) => total.normalizedWinProbability);
    const maxTotal = Math.max(...totals);
    const minTotal = Math.min(...totals);
    const largestShare = Math.max(...result.assignments.map((assignment) => assignment.normalizedWinProbability));

    expect(maxTotal - minTotal).toBeLessThanOrEqual(largestShare + 1e-12);

    for (const userTotal of result.userTotals) {
      const userBuyIn = buyIns.reduce((total, buyIn, index) => {
        return total + (result.assignments[index]?.userId === userTotal.userId ? buyIn : 0);
      }, 0);

      expect(userBuyIn).toBe(
        computePlayerBuyInPence({
          normalizedWinProbability: userTotal.normalizedWinProbability,
          targetWinProbability: result.targetWinProbability,
        }),
      );
      expect(userBuyIn).toBe(STANDARD_BUY_IN_PENCE);
    }
  });
});

function rotate<T>(items: T[], offset: number): T[] {
  const normalizedOffset = offset % items.length;

  return [...items.slice(normalizedOffset), ...items.slice(0, normalizedOffset)];
}
