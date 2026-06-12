import { describe, expect, it } from 'vitest';
import { validatePreferenceInput } from './preferences';

describe('validatePreferenceInput', () => {
  const activeTeamIds = ['arg', 'bra', 'eng', 'fra', 'jpn', 'mex'];

  it('accepts a complete active-team ranking', () => {
    expect(
      validatePreferenceInput({
        activeTeamIds,
        teamIds: activeTeamIds,
      }),
    ).toEqual({ ok: true });

    expect(
      validatePreferenceInput({
        activeTeamIds,
        teamIds: [...activeTeamIds].reverse(),
      }),
    ).toEqual({ ok: true });
  });

  it('rejects incomplete rankings', () => {
    expect(
      validatePreferenceInput({
        activeTeamIds,
        teamIds: ['arg', 'bra', 'eng', 'fra', 'jpn'],
      }),
    ).toEqual({ ok: false, reason: 'Rank all active World Cup teams.' });
  });

  it('rejects duplicate teams', () => {
    expect(
      validatePreferenceInput({
        activeTeamIds,
        teamIds: ['arg', 'bra', 'eng', 'fra', 'jpn', 'arg'],
      }),
    ).toEqual({ ok: false, reason: 'Rank each active team once.' });
  });

  it('rejects inactive teams', () => {
    expect(
      validatePreferenceInput({
        activeTeamIds,
        teamIds: ['arg', 'bra', 'eng', 'fra', 'jpn', 'ita'],
      }),
    ).toEqual({ ok: false, reason: 'Rank only active World Cup teams.' });
  });
});
