import { describe, expect, it } from 'vitest';
import { computeDraftAssignments } from './draft';

const submittedAt = new Date('2026-06-04T09:00:00.000Z');

describe('computeDraftAssignments', () => {
  it('assigns each team as a whole team while balancing total win probability', () => {
    const result = computeDraftAssignments({
      rng: () => 0,
      teams: [
        { id: 'a', decimalOdds: 2.5 },
        { id: 'b', decimalOdds: 10 / 3 },
        { id: 'c', decimalOdds: 5 },
        { id: 'd', decimalOdds: 10 },
      ],
      submissions: [
        {
          userId: 'u1',
          submittedAt,
          teamIdsByRank: ['a', 'd', 'c', 'b'],
        },
        {
          userId: 'u2',
          submittedAt,
          teamIdsByRank: ['b', 'c', 'd', 'a'],
        },
      ],
    });

    expect(result.assignments.map(({ userId, teamId, preferenceRankWon, pickNumber }) => ({ userId, teamId, preferenceRankWon, pickNumber }))).toEqual([
      { userId: 'u1', teamId: 'a', preferenceRankWon: 1, pickNumber: 1 },
      { userId: 'u2', teamId: 'b', preferenceRankWon: 1, pickNumber: 2 },
      { userId: 'u2', teamId: 'c', preferenceRankWon: 2, pickNumber: 3 },
      { userId: 'u1', teamId: 'd', preferenceRankWon: 2, pickNumber: 4 },
    ]);
    expect(result.assignments.every((assignment) => assignment.teamShareIndex === 1 && assignment.teamShareCount === 1)).toBe(true);
    expect(new Set(result.assignments.map((assignment) => assignment.teamId))).toEqual(new Set(['a', 'b', 'c', 'd']));
    expect(result.userTotals).toEqual([
      { userId: 'u1', normalizedWinProbability: 0.5 },
      { userId: 'u2', normalizedWinProbability: 0.5 },
    ]);
  });

  it('does not split teams whose normalized probability is above the fair target', () => {
    const result = computeDraftAssignments({
      rng: () => 0,
      teams: [
        { id: 'favorite', decimalOdds: 1.5 },
        { id: 'outsider-a', decimalOdds: 6 },
        { id: 'outsider-b', decimalOdds: 6 },
      ],
      submissions: [
        {
          userId: 'u1',
          submittedAt,
          teamIdsByRank: ['favorite', 'outsider-a', 'outsider-b'],
        },
        {
          userId: 'u2',
          submittedAt,
          teamIdsByRank: ['favorite', 'outsider-b', 'outsider-a'],
        },
      ],
    });

    expect(result.assignments).toHaveLength(3);
    expect(result.assignments.every((assignment) => assignment.teamShareIndex === 1 && assignment.teamShareCount === 1)).toBe(true);
    expect(result.assignments.find((assignment) => assignment.teamId === 'favorite')).toMatchObject({
      normalizedWinProbability: 0.666666666667,
      teamShareCount: 1,
      teamShareIndex: 1,
    });
    expect(result.userTotals).toEqual([
      { userId: 'u1', normalizedWinProbability: 0.666666666667 },
      { userId: 'u2', normalizedWinProbability: 0.333333333334 },
    ]);
  });

  it('reserves an uncontested first choice until that player receives the team', () => {
    const result = computeDraftAssignments({
      rng: () => 0,
      teams: [
        { id: 'contested-low', decimalOdds: 20 },
        { id: 'middle', decimalOdds: 10 / 3 },
        { id: 'unique-low', decimalOdds: 20 },
        { id: 'favorite', decimalOdds: 5 / 3 },
      ],
      submissions: [
        {
          userId: 'u1',
          submittedAt,
          teamIdsByRank: ['contested-low', 'middle', 'unique-low', 'favorite'],
        },
        {
          userId: 'u2',
          submittedAt,
          teamIdsByRank: ['contested-low', 'unique-low', 'middle', 'favorite'],
        },
        {
          userId: 'u3',
          submittedAt,
          teamIdsByRank: ['unique-low', 'middle', 'contested-low', 'favorite'],
        },
      ],
    });

    const uniqueFirstChoiceAssignment = result.assignments.find(
      (assignment) => assignment.userId === 'u3' && assignment.teamId === 'unique-low',
    );

    expect(uniqueFirstChoiceAssignment).toMatchObject({
      preferenceRankWon: 1,
      teamId: 'unique-low',
      teamShareCount: 1,
      teamShareIndex: 1,
      userId: 'u3',
    });
  });

  it('resolves contested first-choice teams before lower-ranked stronger teams', () => {
    const result = computeDraftAssignments({
      rng: () => 0,
      teams: [
        { id: 'contested-first', decimalOdds: 20 },
        { id: 'strong-second', decimalOdds: 2 },
      ],
      submissions: [
        {
          userId: 'u1',
          submittedAt,
          teamIdsByRank: ['contested-first', 'strong-second'],
        },
        {
          userId: 'u2',
          submittedAt,
          teamIdsByRank: ['contested-first', 'strong-second'],
        },
      ],
    });

    expect(result.assignments[0]).toMatchObject({
      preferenceRankWon: 1,
      teamId: 'contested-first',
      userId: 'u1',
    });
  });

  it('gives every player an available top-three team before general balancing', () => {
    const result = computeDraftAssignments({
      rng: () => 0,
      teams: [
        { id: 'contested-first', decimalOdds: 20 },
        { id: 'top-three-fallback', decimalOdds: 30 },
        { id: 'unique-first', decimalOdds: 25 },
        { id: 'strong-fourth', decimalOdds: 2 },
      ],
      submissions: [
        {
          userId: 'u1',
          submittedAt,
          teamIdsByRank: ['contested-first', 'unique-first', 'top-three-fallback', 'strong-fourth'],
        },
        {
          userId: 'u2',
          submittedAt,
          teamIdsByRank: ['contested-first', 'top-three-fallback', 'unique-first', 'strong-fourth'],
        },
        {
          userId: 'u3',
          submittedAt,
          teamIdsByRank: ['unique-first', 'strong-fourth', 'top-three-fallback', 'contested-first'],
        },
      ],
    });

    expect(
      result.assignments.some(
        (assignment) =>
          assignment.userId === 'u2' &&
          assignment.preferenceRankWon !== null &&
          assignment.preferenceRankWon <= 3,
      ),
    ).toBe(true);
    expect(result.assignments.find((assignment) => assignment.userId === 'u2')).toMatchObject({
      preferenceRankWon: 2,
      teamId: 'top-three-fallback',
    });
  });

  it('uses a fresh random pick when players are tied for the same whole team', () => {
    const result = computeDraftAssignments({
      rng: () => 0.5,
      teams: [
        { id: 'a', decimalOdds: 4 },
        { id: 'b', decimalOdds: 4 },
      ],
      submissions: [
        {
          userId: 'u1',
          submittedAt,
          teamIdsByRank: ['a', 'b'],
        },
        {
          userId: 'u2',
          submittedAt,
          teamIdsByRank: ['a', 'b'],
        },
      ],
    });

    expect(result.assignments[0]).toMatchObject({
      pickNumber: 1,
      teamId: 'a',
      userId: 'u2',
    });
  });
});
