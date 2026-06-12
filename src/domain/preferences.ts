export type PreferenceValidationInput = {
  activeTeamIds: string[];
  teamIds: string[];
};

export type PreferenceValidationResult = { ok: true } | { ok: false; reason: string };

export function validatePreferenceInput({
  activeTeamIds,
  teamIds,
}: PreferenceValidationInput): PreferenceValidationResult {
  if (activeTeamIds.length === 0) {
    return { ok: false, reason: 'No active World Cup teams are available.' };
  }

  if (teamIds.length !== activeTeamIds.length) {
    return { ok: false, reason: 'Rank all active World Cup teams.' };
  }

  if (new Set(teamIds).size !== teamIds.length) {
    return { ok: false, reason: 'Rank each active team once.' };
  }

  const activeTeamIdSet = new Set(activeTeamIds);

  if (teamIds.some((teamId) => !activeTeamIdSet.has(teamId))) {
    return { ok: false, reason: 'Rank only active World Cup teams.' };
  }

  return { ok: true };
}
