// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { moveTeamIdToRank, PreferenceRankingForm } from './preference-ranking-form';

describe('PreferenceRankingForm', () => {
  it('does not render a participant tiebreaker number field', () => {
    render(
      createElement(PreferenceRankingForm, {
        action: async () => {},
        initialTeamIds: [],
        teams: [
          { id: 'arg', displayName: 'Argentina' },
          { id: 'bra', displayName: 'Brazil' },
        ],
        title: 'Rank the teams.',
      }),
    );

    expect(screen.getByText('Argentina')).toBeTruthy();
    expect(screen.queryByLabelText(/tie-break number/i)).toBeNull();
    expect(screen.queryByRole('spinbutton', { name: /tie-break number/i })).toBeNull();
  });
});

describe('moveTeamIdToRank', () => {
  it('moves a team to the selected one-based rank', () => {
    expect(moveTeamIdToRank(['arg', 'bra', 'eng', 'fra'], 'fra', 1)).toEqual(['fra', 'arg', 'bra', 'eng']);
    expect(moveTeamIdToRank(['arg', 'bra', 'eng', 'fra'], 'arg', 4)).toEqual(['bra', 'eng', 'fra', 'arg']);
  });

  it('leaves the ranking unchanged when the team is missing or the rank is out of range', () => {
    expect(moveTeamIdToRank(['arg', 'bra'], 'fra', 1)).toEqual(['arg', 'bra']);
    expect(moveTeamIdToRank(['arg', 'bra'], 'arg', 0)).toEqual(['arg', 'bra']);
    expect(moveTeamIdToRank(['arg', 'bra'], 'arg', 3)).toEqual(['arg', 'bra']);
  });
});
