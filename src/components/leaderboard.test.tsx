// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { Leaderboard } from './leaderboard';

describe('Leaderboard', () => {
  it('shows team flags and total win probability without buy-in or draft odds columns', () => {
    render(
      createElement(Leaderboard, {
        rows: [
          {
            rank: 1,
            player: 'Ada',
            teams: [{ countryCode: 'BRA', label: 'Brazil' }],
            points: 3,
            normalizedWinProbability: 0.375,
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
});
