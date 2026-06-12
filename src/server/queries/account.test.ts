import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAccountData } from './account';

const { userFindUnique } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: userFindUnique,
    },
  },
}));

describe('getAccountData', () => {
  beforeEach(() => {
    userFindUnique.mockReset();
  });

  it('returns the Prisma user result with account-page includes and draft pick order', async () => {
    const user = {
      id: 'user-1',
      preferenceSubmission: {
        choices: [{ rank: 1, team: { id: 'team-1' } }],
      },
      assignments: [{ id: 'assignment-latest' }],
    };
    userFindUnique.mockResolvedValue(user);

    const data = await getAccountData('user-1');

    expect(data).toBe(user);
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      include: {
        preferenceSubmission: {
          include: {
            choices: {
              orderBy: { rank: 'asc' },
              include: { team: true },
            },
          },
        },
        assignments: {
          orderBy: [{ pickNumber: 'asc' }, { createdAt: 'asc' }],
          include: {
            team: true,
            draft: true,
          },
        },
      },
    });
  });
});
