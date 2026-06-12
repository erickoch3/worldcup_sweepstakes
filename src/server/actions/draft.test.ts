import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteSubmissionAction, processDraftAction } from './draft';

const {
  assignmentCreateMany,
  cryptoRandomInt,
  draftCreate,
  draftFindFirst,
  preferenceSubmissionArchiveCreate,
  preferenceSubmissionDelete,
  preferenceSubmissionFindUnique,
  preferenceSubmissionFindMany,
  preferenceSubmissionUpdateMany,
  requireAdmin,
  teamFindMany,
  transaction,
} = vi.hoisted(() => ({
  assignmentCreateMany: vi.fn(),
  cryptoRandomInt: vi.fn(),
  draftCreate: vi.fn(),
  draftFindFirst: vi.fn(),
  preferenceSubmissionArchiveCreate: vi.fn(),
  preferenceSubmissionDelete: vi.fn(),
  preferenceSubmissionFindUnique: vi.fn(),
  preferenceSubmissionFindMany: vi.fn(),
  preferenceSubmissionUpdateMany: vi.fn(),
  requireAdmin: vi.fn(),
  teamFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('node:crypto', () => ({
  default: {
    randomInt: cryptoRandomInt,
  },
}));

vi.mock('../../auth/session', () => ({
  requireAdmin,
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    assignment: {
      createMany: assignmentCreateMany,
    },
    draft: {
      create: draftCreate,
      findFirst: draftFindFirst,
    },
    preferenceSubmissionArchive: {
      create: preferenceSubmissionArchiveCreate,
    },
    preferenceSubmission: {
      delete: preferenceSubmissionDelete,
      findUnique: preferenceSubmissionFindUnique,
      findMany: preferenceSubmissionFindMany,
      updateMany: preferenceSubmissionUpdateMany,
    },
    team: {
      findMany: teamFindMany,
    },
    $transaction: transaction,
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('deleteSubmissionAction', () => {
  beforeEach(() => {
    draftFindFirst.mockReset();
    preferenceSubmissionArchiveCreate.mockReset();
    preferenceSubmissionDelete.mockReset();
    preferenceSubmissionFindUnique.mockReset();
    requireAdmin.mockReset();
    transaction.mockReset();

    requireAdmin.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', isAdmin: true },
    });
    draftFindFirst.mockResolvedValue(null);
    preferenceSubmissionFindUnique.mockResolvedValue({
      id: 'submission-1',
      userId: 'user-1',
      lockedAt: null,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      user: {
        email: 'player@example.com',
        name: 'Player One',
      },
      choices: [
        {
          rank: 1,
          teamId: 'team-1',
          team: {
            countryCode: 'ARG',
            displayName: 'Argentina',
          },
        },
      ],
    });
    transaction.mockImplementation(async (callback) =>
      callback({
        draft: {
          findFirst: draftFindFirst,
        },
        preferenceSubmission: {
          delete: preferenceSubmissionDelete,
          findUnique: preferenceSubmissionFindUnique,
        },
        preferenceSubmissionArchive: {
          create: preferenceSubmissionArchiveCreate,
        },
      }),
    );
  });

  it('archives a preference submission before deleting it', async () => {
    const formData = new FormData();
    formData.set('submissionId', 'submission-1');

    await deleteSubmissionAction(formData);

    expect(preferenceSubmissionArchiveCreate).toHaveBeenCalledWith({
      data: {
        originalSubmissionId: 'submission-1',
        userId: 'user-1',
        userEmail: 'player@example.com',
        userName: 'Player One',
        choicesJson: JSON.stringify([
          {
            rank: 1,
            teamId: 'team-1',
            countryCode: 'ARG',
            displayName: 'Argentina',
          },
        ]),
        lockedAt: null,
        submittedAt: new Date('2026-06-01T00:00:00.000Z'),
        deletedById: 'admin-1',
      },
    });
    expect(preferenceSubmissionDelete).toHaveBeenCalledWith({
      where: { id: 'submission-1' },
    });
  });
});

describe('processDraftAction', () => {
  beforeEach(() => {
    assignmentCreateMany.mockReset();
    draftCreate.mockReset();
    draftFindFirst.mockReset();
    preferenceSubmissionArchiveCreate.mockReset();
    preferenceSubmissionDelete.mockReset();
    preferenceSubmissionFindUnique.mockReset();
    preferenceSubmissionFindMany.mockReset();
    preferenceSubmissionUpdateMany.mockReset();
    requireAdmin.mockReset();
    cryptoRandomInt.mockReset();
    teamFindMany.mockReset();
    transaction.mockReset();

    cryptoRandomInt.mockReturnValue(500);
    requireAdmin.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', isAdmin: true },
    });
    draftFindFirst.mockResolvedValue(null);
    teamFindMany.mockResolvedValue([{ id: 'team-1', decimalOdds: 2 }]);
    preferenceSubmissionFindMany.mockResolvedValue([
      {
        id: 'submission-1',
        userId: 'user-1',
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        choices: [{ teamId: 'team-1' }],
      },
    ]);
  });

  it('reports an already processed draft when the singleton create loses a race', async () => {
    draftCreate.mockRejectedValue({ code: 'P2002' });
    transaction.mockImplementation(async (callback) =>
      callback({
        assignment: {
          createMany: assignmentCreateMany,
        },
        draft: {
          create: draftCreate,
        },
        preferenceSubmission: {
          updateMany: preferenceSubmissionUpdateMany,
        },
      }),
    );

    await expect(processDraftAction()).rejects.toThrow('Draft has already been processed.');
    expect(assignmentCreateMany).not.toHaveBeenCalled();
    expect(preferenceSubmissionUpdateMany).not.toHaveBeenCalled();
  });

  it('does not persist a draft-level random deciding number', async () => {
    cryptoRandomInt.mockReturnValue(0);
    draftCreate.mockResolvedValue({ id: 'draft-1' });
    transaction.mockImplementation(async (callback) =>
      callback({
        assignment: {
          createMany: assignmentCreateMany,
        },
        draft: {
          create: draftCreate,
        },
        preferenceSubmission: {
          updateMany: preferenceSubmissionUpdateMany,
        },
      }),
    );

    await processDraftAction();

    expect(draftCreate).toHaveBeenCalledWith({
      data: {
        status: 'LOCKED',
        processedById: 'admin-1',
      },
      select: { id: true },
    });
    expect(cryptoRandomInt).not.toHaveBeenCalledWith(0, 1001);
  });

  it('persists balanced whole-team assignments with a standard five pound buy-in per player', async () => {
    cryptoRandomInt.mockReturnValue(0);
    draftCreate.mockResolvedValue({ id: 'draft-1' });
    teamFindMany.mockResolvedValue([
      { id: 'favorite', decimalOdds: 1.5 },
      { id: 'outsider-a', decimalOdds: 6 },
      { id: 'outsider-b', decimalOdds: 6 },
    ]);
    preferenceSubmissionFindMany.mockResolvedValue([
      {
        id: 'submission-1',
        userId: 'user-1',
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        choices: [{ teamId: 'favorite' }, { teamId: 'outsider-a' }, { teamId: 'outsider-b' }],
      },
      {
        id: 'submission-2',
        userId: 'user-2',
        createdAt: new Date('2026-06-01T00:01:00.000Z'),
        choices: [{ teamId: 'favorite' }, { teamId: 'outsider-b' }, { teamId: 'outsider-a' }],
      },
    ]);
    transaction.mockImplementation(async (callback) =>
      callback({
        assignment: {
          createMany: assignmentCreateMany,
        },
        draft: {
          create: draftCreate,
        },
        preferenceSubmission: {
          updateMany: preferenceSubmissionUpdateMany,
        },
      }),
    );

    await processDraftAction();

    expect(assignmentCreateMany).toHaveBeenCalledWith({
      data: [
        {
          draftId: 'draft-1',
          userId: 'user-1',
          teamId: 'favorite',
          preferenceRankWon: 1,
          pickNumber: 1,
          teamShareIndex: 1,
          teamShareCount: 1,
          normalizedWinProbability: 0.666666666667,
          buyInPence: 500,
        },
        {
          draftId: 'draft-1',
          userId: 'user-2',
          teamId: 'outsider-b',
          preferenceRankWon: 2,
          pickNumber: 2,
          teamShareIndex: 1,
          teamShareCount: 1,
          normalizedWinProbability: 0.166666666667,
          buyInPence: 250,
        },
        {
          draftId: 'draft-1',
          userId: 'user-2',
          teamId: 'outsider-a',
          preferenceRankWon: 3,
          pickNumber: 3,
          teamShareIndex: 1,
          teamShareCount: 1,
          normalizedWinProbability: 0.166666666667,
          buyInPence: 250,
        },
      ],
    });
  });
});
