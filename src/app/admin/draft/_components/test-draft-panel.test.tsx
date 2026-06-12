// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TestDraftPanel } from './test-draft-panel';

describe('TestDraftPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows each simulated player roster with their total chance to win', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    render(
      createElement(TestDraftPanel, {
        submissions: [
          {
            userId: 'ada',
            userName: 'Ada Lovelace',
            createdAt: '2026-06-01T00:00:00.000Z',
            choices: [
              { teamId: 'arg', teamName: 'Argentina', decimalOdds: 4 },
              { teamId: 'fra', teamName: 'France', decimalOdds: 4 },
              { teamId: 'ger', teamName: 'Germany', decimalOdds: 4 },
              { teamId: 'bra', teamName: 'Brazil', decimalOdds: 4 },
            ],
          },
          {
            userId: 'bob',
            userName: 'Bob Stone',
            createdAt: '2026-06-01T00:01:00.000Z',
            choices: [
              { teamId: 'bra', teamName: 'Brazil', decimalOdds: 4 },
              { teamId: 'ger', teamName: 'Germany', decimalOdds: 4 },
              { teamId: 'fra', teamName: 'France', decimalOdds: 4 },
              { teamId: 'arg', teamName: 'Argentina', decimalOdds: 4 },
            ],
          },
        ],
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /test draft/i }));

    expect(screen.getByRole('columnheader', { name: 'Roster' })).toBeTruthy();

    const adaRow = screen
      .getAllByRole('row', { name: /Ada Lovelace/ })
      .find((row) => within(row).queryByText('France') !== null && within(row).queryByText('50.00%') !== null);

    expect(adaRow).toBeTruthy();

    expect(within(adaRow!).getByText('Argentina')).toBeTruthy();
    expect(within(adaRow!).getByText('France')).toBeTruthy();
    expect(within(adaRow!).getByText('50.00%')).toBeTruthy();
  });
});
