import { beforeEach, describe, expect, it, vi } from 'vitest';

import { submitPreferencesAction } from './preferences';

const { draftFindFirst, inviteFindUnique, redirect, requireUser, revalidatePath, teamFindMany, transaction } = vi.hoisted(() => ({
  draftFindFirst: vi.fn(),
  inviteFindUnique: vi.fn(),
  redirect: vi.fn(),
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  teamFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../../auth/session', () => ({
  requireUser,
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    draft: {
      findFirst: draftFindFirst,
    },
    invite: {
      findUnique: inviteFindUnique,
    },
    team: {
      findMany: teamFindMany,
    },
    $transaction: transaction,
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath,
}));

vi.mock('next/navigation', () => ({
  redirect,
}));

describe('submitPreferencesAction', () => {
  const txDraftFindFirst = vi.fn();
  const txInviteFindUnique = vi.fn();
  const txInviteUpdate = vi.fn();
  const txInviteUpdateMany = vi.fn();
  const txPreferenceSubmissionFindUnique = vi.fn();
  const txPreferenceSubmissionCreate = vi.fn();
  const txPreferenceSubmissionUpdateMany = vi.fn();
  const txPreferenceChoiceDeleteMany = vi.fn();
  const txPreferenceChoiceCreateMany = vi.fn();

  beforeEach(() => {
    draftFindFirst.mockReset();
    inviteFindUnique.mockReset();
    redirect.mockReset();
    requireUser.mockReset();
    revalidatePath.mockReset();
    teamFindMany.mockReset();
    transaction.mockReset();

    txDraftFindFirst.mockReset();
    txInviteFindUnique.mockReset();
    txInviteUpdate.mockReset();
    txInviteUpdateMany.mockReset();
    txPreferenceSubmissionFindUnique.mockReset();
    txPreferenceSubmissionCreate.mockReset();
    txPreferenceSubmissionUpdateMany.mockReset();
    txPreferenceChoiceDeleteMany.mockReset();
    txPreferenceChoiceCreateMany.mockReset();

    requireUser.mockResolvedValue({
      user: { id: 'user-1', email: 'USER@example.com', isAdmin: false },
    });
    inviteFindUnique.mockResolvedValue({
      id: 'invite-1',
      intendedEmail: 'user@example.com',
      expiresAt: null,
      maxUses: 1,
      useCount: 0,
      usedAt: null,
      usedById: null,
    });
    draftFindFirst.mockResolvedValue(null);
  });

  it('rejects preferences when any selected team is missing or inactive', async () => {
    const formData = new FormData();
    for (const teamId of ['team-1', 'team-2', 'team-3', 'team-4', 'team-5']) {
      formData.set(`team-${teamId.at(-1)}`, teamId);
    }
    teamFindMany.mockResolvedValue([
      { id: 'team-1' },
      { id: 'team-2' },
      { id: 'team-3' },
      { id: 'team-4' },
      { id: 'team-6' },
    ]);

    await expect(submitPreferencesAction('raw-token', formData)).rejects.toThrow(
      'Rank only active World Cup teams.',
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects when the invite was claimed by another request inside the transaction', async () => {
    const formData = validPreferenceFormData();
    teamFindMany.mockResolvedValue([
      { id: 'team-1' },
      { id: 'team-2' },
      { id: 'team-3' },
      { id: 'team-4' },
      { id: 'team-5' },
    ]);
    txInviteFindUnique.mockResolvedValue({
      id: 'invite-1',
      intendedEmail: 'user@example.com',
      expiresAt: null,
      maxUses: 1,
      useCount: 0,
      usedAt: null,
      usedById: null,
    });
    txInviteUpdateMany.mockResolvedValue({ count: 0 });
    txDraftFindFirst.mockResolvedValue(null);
    txPreferenceSubmissionFindUnique.mockResolvedValue(null);
    txPreferenceSubmissionCreate.mockResolvedValue({ id: 'submission-1' });

    transaction.mockImplementation(async (callback) =>
      callback({
        draft: {
          findFirst: txDraftFindFirst,
        },
        invite: {
          findUnique: txInviteFindUnique,
          update: txInviteUpdate,
          updateMany: txInviteUpdateMany,
        },
        preferenceChoice: {
          createMany: txPreferenceChoiceCreateMany,
          deleteMany: txPreferenceChoiceDeleteMany,
        },
        preferenceSubmission: {
          findUnique: txPreferenceSubmissionFindUnique,
          create: txPreferenceSubmissionCreate,
          updateMany: txPreferenceSubmissionUpdateMany,
        },
      }),
    );

    await expect(submitPreferencesAction('raw-token', formData)).rejects.toThrow(
      'Invite has already been used.',
    );

    expect(txInviteUpdateMany).toHaveBeenCalledWith({
      where: { id: 'invite-1', useCount: { lt: 1 } },
      data: {
        lastUsedAt: expect.any(Date),
        useCount: { increment: 1 },
        usedAt: expect.any(Date),
        usedById: 'user-1',
      },
    });
    expect(txPreferenceSubmissionCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
      },
      select: { id: true },
    });
    expect(txPreferenceChoiceDeleteMany).toHaveBeenCalledWith({
      where: { submissionId: 'submission-1' },
    });
    expect(txPreferenceChoiceCreateMany).toHaveBeenCalled();
    expect(txPreferenceSubmissionUpdateMany).not.toHaveBeenCalled();
    expect(txInviteUpdate).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('rejects when a draft appears inside the transaction before claiming the invite', async () => {
    const formData = validPreferenceFormData();
    teamFindMany.mockResolvedValue([
      { id: 'team-1' },
      { id: 'team-2' },
      { id: 'team-3' },
      { id: 'team-4' },
      { id: 'team-5' },
    ]);
    txDraftFindFirst.mockResolvedValue({ id: 'draft-1' });

    transaction.mockImplementation(async (callback) =>
      callback({
        draft: {
          findFirst: txDraftFindFirst,
        },
        invite: {
          findUnique: txInviteFindUnique,
          update: txInviteUpdate,
          updateMany: txInviteUpdateMany,
        },
        preferenceChoice: {
          createMany: txPreferenceChoiceCreateMany,
          deleteMany: txPreferenceChoiceDeleteMany,
        },
        preferenceSubmission: {
          findUnique: txPreferenceSubmissionFindUnique,
          create: txPreferenceSubmissionCreate,
          updateMany: txPreferenceSubmissionUpdateMany,
        },
      }),
    );

    await expect(submitPreferencesAction('raw-token', formData)).rejects.toThrow(
      'Draft has already been processed.',
    );
    expect(txDraftFindFirst).toHaveBeenCalledWith({ select: { id: true } });
    expect(txInviteFindUnique).not.toHaveBeenCalled();
    expect(txPreferenceSubmissionFindUnique).not.toHaveBeenCalled();
    expect(txPreferenceSubmissionCreate).not.toHaveBeenCalled();
    expect(txPreferenceSubmissionUpdateMany).not.toHaveBeenCalled();
    expect(txPreferenceChoiceDeleteMany).not.toHaveBeenCalled();
    expect(txPreferenceChoiceCreateMany).not.toHaveBeenCalled();
  });

  it('rejects locked existing submissions before claiming the invite', async () => {
    const formData = validPreferenceFormData();
    teamFindMany.mockResolvedValue([
      { id: 'team-1' },
      { id: 'team-2' },
      { id: 'team-3' },
      { id: 'team-4' },
      { id: 'team-5' },
    ]);
    txDraftFindFirst.mockResolvedValue(null);
    txPreferenceSubmissionFindUnique.mockResolvedValue({
      id: 'submission-1',
      lockedAt: new Date('2026-06-10T12:00:00.000Z'),
    });

    transaction.mockImplementation(async (callback) =>
      callback({
        draft: {
          findFirst: txDraftFindFirst,
        },
        invite: {
          findUnique: txInviteFindUnique,
          update: txInviteUpdate,
          updateMany: txInviteUpdateMany,
        },
        preferenceChoice: {
          createMany: txPreferenceChoiceCreateMany,
          deleteMany: txPreferenceChoiceDeleteMany,
        },
        preferenceSubmission: {
          findUnique: txPreferenceSubmissionFindUnique,
          create: txPreferenceSubmissionCreate,
          updateMany: txPreferenceSubmissionUpdateMany,
        },
      }),
    );

    await expect(submitPreferencesAction('raw-token', formData)).rejects.toThrow(
      'Draft has already been processed.',
    );
    expect(txPreferenceSubmissionFindUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: {
        id: true,
        lockedAt: true,
      },
    });
    expect(txInviteFindUnique).not.toHaveBeenCalled();
    expect(txPreferenceSubmissionCreate).not.toHaveBeenCalled();
    expect(txPreferenceSubmissionUpdateMany).not.toHaveBeenCalled();
    expect(txPreferenceChoiceDeleteMany).not.toHaveBeenCalled();
    expect(txPreferenceChoiceCreateMany).not.toHaveBeenCalled();
  });

  it('accepts an invite already claimed by the same Google account during sign-in', async () => {
    const formData = validPreferenceFormData();
    inviteFindUnique.mockResolvedValue({
      id: 'invite-1',
      intendedEmail: 'user@example.com',
      expiresAt: null,
      maxUses: 1,
      useCount: 1,
      usedAt: new Date('2026-06-04T12:00:00.000Z'),
      usedById: 'user-1',
    });
    teamFindMany.mockResolvedValue([
      { id: 'team-1' },
      { id: 'team-2' },
      { id: 'team-3' },
      { id: 'team-4' },
      { id: 'team-5' },
    ]);
    txDraftFindFirst.mockResolvedValue(null);
    txInviteFindUnique.mockResolvedValue({
      id: 'invite-1',
      intendedEmail: 'user@example.com',
      expiresAt: null,
      maxUses: 1,
      useCount: 1,
      usedAt: new Date('2026-06-04T12:00:00.000Z'),
      usedById: 'user-1',
    });
    txPreferenceSubmissionFindUnique.mockResolvedValue(null);
    txPreferenceSubmissionCreate.mockResolvedValue({ id: 'submission-1' });

    transaction.mockImplementation(async (callback) =>
      callback({
        draft: {
          findFirst: txDraftFindFirst,
        },
        invite: {
          findUnique: txInviteFindUnique,
          update: txInviteUpdate,
          updateMany: txInviteUpdateMany,
        },
        preferenceChoice: {
          createMany: txPreferenceChoiceCreateMany,
          deleteMany: txPreferenceChoiceDeleteMany,
        },
        preferenceSubmission: {
          create: txPreferenceSubmissionCreate,
          findUnique: txPreferenceSubmissionFindUnique,
          updateMany: txPreferenceSubmissionUpdateMany,
        },
      }),
    );

    await submitPreferencesAction('raw-token', formData);

    expect(txInviteUpdateMany).not.toHaveBeenCalled();
    expect(txPreferenceSubmissionCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
      },
      select: { id: true },
    });
    expect(txPreferenceChoiceCreateMany).toHaveBeenCalledWith({
      data: [
        { submissionId: 'submission-1', teamId: 'team-1', rank: 1 },
        { submissionId: 'submission-1', teamId: 'team-2', rank: 2 },
        { submissionId: 'submission-1', teamId: 'team-3', rank: 3 },
        { submissionId: 'submission-1', teamId: 'team-4', rank: 4 },
        { submissionId: 'submission-1', teamId: 'team-5', rank: 5 },
      ],
    });
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(redirect).toHaveBeenCalledWith('/account');
  });

  it('allows existing users to edit their submission from account without an invite token', async () => {
    const formData = validPreferenceFormData();
    teamFindMany.mockResolvedValue([
      { id: 'team-1' },
      { id: 'team-2' },
      { id: 'team-3' },
      { id: 'team-4' },
      { id: 'team-5' },
    ]);
    inviteFindUnique.mockResolvedValue(null);
    txDraftFindFirst.mockResolvedValue(null);
    txPreferenceSubmissionFindUnique.mockResolvedValue({
      id: 'submission-1',
      lockedAt: null,
    });
    txPreferenceSubmissionUpdateMany.mockResolvedValue({ count: 1 });
    transaction.mockImplementation(async (callback) =>
      callback({
        draft: {
          findFirst: txDraftFindFirst,
        },
        invite: {
          findUnique: txInviteFindUnique,
          update: txInviteUpdate,
          updateMany: txInviteUpdateMany,
        },
        preferenceChoice: {
          createMany: txPreferenceChoiceCreateMany,
          deleteMany: txPreferenceChoiceDeleteMany,
        },
        preferenceSubmission: {
          findUnique: txPreferenceSubmissionFindUnique,
          create: txPreferenceSubmissionCreate,
          updateMany: txPreferenceSubmissionUpdateMany,
        },
      }),
    );

    await submitPreferencesAction(null, formData);

    expect(txPreferenceSubmissionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'submission-1',
        lockedAt: null,
      },
      data: {
        updatedAt: expect.any(Date),
      },
    });
    expect(txPreferenceChoiceDeleteMany).toHaveBeenCalledWith({ where: { submissionId: 'submission-1' } });
    expect(txPreferenceChoiceCreateMany).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(redirect).toHaveBeenCalledWith('/account');
  });

  it('allows signed-in account users to create their first submission without an invite token', async () => {
    const formData = validPreferenceFormData();
    teamFindMany.mockResolvedValue([
      { id: 'team-1' },
      { id: 'team-2' },
      { id: 'team-3' },
      { id: 'team-4' },
      { id: 'team-5' },
    ]);
    inviteFindUnique.mockResolvedValue(null);
    txDraftFindFirst.mockResolvedValue(null);
    txPreferenceSubmissionFindUnique.mockResolvedValue(null);
    txPreferenceSubmissionCreate.mockResolvedValue({ id: 'submission-1' });
    transaction.mockImplementation(async (callback) =>
      callback({
        draft: {
          findFirst: txDraftFindFirst,
        },
        invite: {
          findUnique: txInviteFindUnique,
          update: txInviteUpdate,
          updateMany: txInviteUpdateMany,
        },
        preferenceChoice: {
          createMany: txPreferenceChoiceCreateMany,
          deleteMany: txPreferenceChoiceDeleteMany,
        },
        preferenceSubmission: {
          findUnique: txPreferenceSubmissionFindUnique,
          create: txPreferenceSubmissionCreate,
          updateMany: txPreferenceSubmissionUpdateMany,
        },
      }),
    );

    await submitPreferencesAction(null, formData);

    expect(txPreferenceSubmissionCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
      },
      select: { id: true },
    });
    expect(txPreferenceChoiceCreateMany).toHaveBeenCalledWith({
      data: [
        { submissionId: 'submission-1', teamId: 'team-1', rank: 1 },
        { submissionId: 'submission-1', teamId: 'team-2', rank: 2 },
        { submissionId: 'submission-1', teamId: 'team-3', rank: 3 },
        { submissionId: 'submission-1', teamId: 'team-4', rank: 4 },
        { submissionId: 'submission-1', teamId: 'team-5', rank: 5 },
      ],
    });
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(redirect).toHaveBeenCalledWith('/account');
  });
});

function validPreferenceFormData(): FormData {
  const formData = new FormData();

  for (const teamId of ['team-1', 'team-2', 'team-3', 'team-4', 'team-5']) {
    formData.set(`team-${teamId.at(-1)}`, teamId);
  }
  return formData;
}
