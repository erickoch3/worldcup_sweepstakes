// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { Leaderboard } from './leaderboard';

describe('Leaderboard', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows team flags and total win probability without buy-in or draft odds columns', () => {
    render(
      createElement(Leaderboard, {
        rows: [
          {
            rank: 1,
            player: 'Ada',
            teams: [{ countryCode: 'BRA', label: 'Brazil', isEliminated: false }],
            points: 3,
            normalizedWinProbability: 0.375,
            isEliminated: false,
          },
        ],
      }),
    );

    expect(screen.getByRole('columnheader', { name: 'Total win probability' })).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Draft odds' })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Buy-in' })).toBeNull();
    expect(screen.getByLabelText('Brazil flag')).toBeTruthy();
    expect(screen.getByText('37.5%')).toBeTruthy();
  });

  it('marks fully eliminated players with the eliminated row style', () => {
    render(
      createElement(Leaderboard, {
        rows: [
          {
            rank: 4,
            player: 'Ada',
            teams: [{ countryCode: 'BRA', label: 'Brazil', isEliminated: true }],
            points: 0,
            normalizedWinProbability: 0,
            isEliminated: true,
          },
        ],
      }),
    );

    expect(screen.getByText('Ada').closest('tr')?.className).toContain('leaderboard-row-eliminated');
  });

  it('marks eliminated teams without eliminating a player who still has live teams', () => {
    render(
      createElement(Leaderboard, {
        rows: [
          {
            rank: 2,
            player: 'Ada',
            teams: [
              { countryCode: 'BRA', label: 'Brazil', isEliminated: false },
              { countryCode: 'GER', label: 'Germany', isEliminated: true },
            ],
            points: 3,
            normalizedWinProbability: 0.24,
            isEliminated: false,
          },
        ],
      }),
    );

    expect(screen.getByText('Ada').closest('tr')?.className).not.toContain('leaderboard-row-eliminated');
    expect(screen.getByText('Brazil').closest('.leaderboard-team')?.className).not.toContain(
      'leaderboard-team-eliminated',
    );
    expect(screen.getByText('Germany').closest('.leaderboard-team')?.className).toContain(
      'leaderboard-team-eliminated',
    );
  });
});
