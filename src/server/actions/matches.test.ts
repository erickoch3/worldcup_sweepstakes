import { beforeEach, describe, expect, it, vi } from 'vitest';

import { upsertMatchAction } from './matches';

const { matchCreate, matchUpdate, matchUpsert, requireAdmin, teamCount } = vi.hoisted(() => ({
  matchCreate: vi.fn(),
  matchUpdate: vi.fn(),
  matchUpsert: vi.fn(),
  requireAdmin: vi.fn(),
  teamCount: vi.fn(),
}));

vi.mock('../../auth/session', () => ({
  requireAdmin,
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    match: {
      create: matchCreate,
      update: matchUpdate,
      upsert: matchUpsert,
    },
    team: {
      count: teamCount,
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('upsertMatchAction', () => {
  beforeEach(() => {
    matchCreate.mockReset();
    matchUpdate.mockReset();
    matchUpsert.mockReset();
    requireAdmin.mockReset();
    teamCount.mockReset();
    requireAdmin.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', isAdmin: true },
    });
    teamCount.mockResolvedValue(2);
  });

  it('requires both scores for final matches', async () => {
    const formData = new FormData();
    formData.set('teamAId', 'team-a');
    formData.set('teamBId', 'team-b');
    formData.set('kickoffAt', '2026-06-11T20:00:00.000Z');
    formData.set('stage', 'Group');
    formData.set('status', 'FINAL');
    formData.set('teamAScore', '2');
    formData.set('teamBScore', '');

    await expect(upsertMatchAction(formData)).rejects.toThrow('Final matches require both scores.');
    expect(matchCreate).not.toHaveBeenCalled();
    expect(matchUpdate).not.toHaveBeenCalled();
  });

  it('updates existing matches instead of upserting with a caller-supplied id', async () => {
    const formData = new FormData();
    formData.set('id', 'match-1');
    formData.set('teamAId', 'team-a');
    formData.set('teamBId', 'team-b');
    formData.set('kickoffAt', '2026-06-11T20:00:00.000Z');
    formData.set('stage', 'Group');
    formData.set('status', 'SCHEDULED');

    await upsertMatchAction(formData);

    expect(matchUpdate).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: expect.objectContaining({
        teamAId: 'team-a',
        teamBId: 'team-b',
      }),
    });
    expect(matchCreate).not.toHaveBeenCalled();
    expect(matchUpsert).not.toHaveBeenCalled();
  });

  it('preserves optional official match numbers for bracket replacement', async () => {
    const formData = new FormData();
    formData.set('matchNumber', '104');
    formData.set('teamAId', 'team-a');
    formData.set('teamBId', 'team-b');
    formData.set('kickoffAt', '2026-07-19T20:00:00.000Z');
    formData.set('stage', 'Final');
    formData.set('status', 'SCHEDULED');

    await upsertMatchAction(formData);

    expect(matchCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        matchNumber: 104,
        stage: 'Final',
      }),
    });
  });
});
