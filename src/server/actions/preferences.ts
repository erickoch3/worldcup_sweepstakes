'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireUser } from '../../auth/session';
import { hashInviteToken, validateInvite } from '../../domain/invites';
import { validatePreferenceInput } from '../../domain/preferences';
import { prisma } from '../../lib/prisma';

export async function submitPreferencesAction(token: string | null, formData: FormData): Promise<void> {
  const session = await requireUser();
  const email = session.user.email;
  const isAdmin = Boolean(session.user.isAdmin);

  if (!email) {
    throw new Error('A signed-in Google account email is required.');
  }

  const activeTeams = await prisma.team.findMany({
    where: { active: true },
    select: { id: true },
    orderBy: { displayName: 'asc' },
  });
  const teamIds = rankedTeamIdsFromFormData(formData);
  const preferenceValidation = validatePreferenceInput({
    activeTeamIds: activeTeams.map((team) => team.id),
    teamIds,
  });

  if (!preferenceValidation.ok) {
    throw new Error(preferenceValidation.reason);
  }

  const normalizedToken = token?.trim() ?? '';
  const hasInvite = normalizedToken !== '';
  const invite = hasInvite
    ? await prisma.invite.findUnique({
        where: { tokenHash: hashInviteToken(normalizedToken) },
        select: {
          id: true,
          intendedEmail: true,
          expiresAt: true,
          maxUses: true,
          useCount: true,
          usedAt: true,
          usedById: true,
        },
      })
    : null;

  if (hasInvite && !isAdmin && invite === null) {
    throw new Error('Invalid invite.');
  }

  const existingDraft = await prisma.draft.findFirst({
    select: { id: true },
  });

  if (existingDraft !== null) {
    throw new Error('Draft has already been processed.');
  }

  await prisma.$transaction(async (tx) => {
    const draftInTransaction = await tx.draft.findFirst({
      select: { id: true },
    });

    if (draftInTransaction !== null) {
      throw new Error('Draft has already been processed.');
    }

    const existingSubmission = await tx.preferenceSubmission.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        lockedAt: true,
      },
    });

    if (existingSubmission?.lockedAt !== null && existingSubmission?.lockedAt !== undefined) {
      throw new Error('Draft has already been processed.');
    }

    let inviteInTransaction: {
      id: string;
      intendedEmail: string | null;
      expiresAt: Date | null;
      maxUses: number | null;
      useCount: number;
      usedAt: Date | null;
      usedById: string | null;
    } | null = null;
    if (!isAdmin && hasInvite && invite !== null) {
      inviteInTransaction = await tx.invite.findUnique({
        where: { id: invite.id },
        select: {
          id: true,
          intendedEmail: true,
          expiresAt: true,
          maxUses: true,
          useCount: true,
          usedAt: true,
          usedById: true,
        },
      });

      if (inviteInTransaction === null) {
        throw new Error('Invalid invite.');
      }

      const transactionInviteValidation = validateInvite({
        invite: inviteInTransaction,
        email,
        now: new Date(),
        allowUsedById: session.user.id,
      });

      if (!transactionInviteValidation.ok) {
        throw new Error(transactionInviteValidation.reason);
      }
    }

    const submission =
      existingSubmission === null
        ? await tx.preferenceSubmission.create({
            data: {
              userId: session.user.id,
            },
            select: { id: true },
          })
        : existingSubmission;

    if (existingSubmission !== null) {
      const submissionUpdate = await tx.preferenceSubmission.updateMany({
        where: {
          id: existingSubmission.id,
          lockedAt: null,
        },
        data: {
          updatedAt: new Date(),
        },
      });

      if (submissionUpdate.count !== 1) {
        throw new Error('Draft has already been processed.');
      }
    }

    await tx.preferenceChoice.deleteMany({
      where: { submissionId: submission.id },
    });

    await tx.preferenceChoice.createMany({
      data: teamIds.map((teamId, index) => ({
        submissionId: submission.id,
        teamId,
        rank: index + 1,
      })),
    });

    if (!isAdmin && hasInvite && inviteInTransaction !== null && invite !== null) {
      if (inviteInTransaction.maxUses !== null && inviteInTransaction.usedById !== session.user.id) {
        const now = new Date();
        const inviteClaim = await tx.invite.updateMany({
          where: {
            id: invite.id,
            useCount: { lt: inviteInTransaction.maxUses },
          },
          data: {
            usedAt: now,
            usedById: session.user.id,
            useCount: { increment: 1 },
            lastUsedAt: now,
          },
        });

        if (inviteClaim.count !== 1) {
          throw new Error('Invite has already been used.');
        }
      }

      if (inviteInTransaction.maxUses === null && existingSubmission === null) {
        await tx.invite.update({
          where: { id: invite.id },
          data: {
            lastUsedAt: new Date(),
            useCount: { increment: 1 },
          },
        });
      }
    }
  });

  revalidatePath('/');
  redirect('/account');
}

function requiredString(value: FormDataEntryValue | null, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${fieldName} is required.`);
  }

  return value.trim();
}

function rankedTeamIdsFromFormData(formData: FormData): string[] {
  const rankedEntries = [...formData.entries()]
    .filter(([fieldName]) => /^team-\d+$/.test(fieldName))
    .map(([fieldName, value]) => ({
      fieldName,
      rank: Number(fieldName.slice('team-'.length)),
      teamId: requiredString(value, fieldName),
    }))
    .sort((left, right) => left.rank - right.rank);

  if (rankedEntries.length > 0) {
    rankedEntries.forEach((entry, index) => {
      if (entry.rank !== index + 1) {
        throw new Error('Rank all active World Cup teams.');
      }
    });

    return rankedEntries.map((entry) => entry.teamId);
  }

  const rankedTeamIds = formData.get('rankedTeamIds');

  if (typeof rankedTeamIds !== 'string' || rankedTeamIds.trim() === '') {
    throw new Error('Rank all active World Cup teams.');
  }

  let parsedTeamIds: unknown;

  try {
    parsedTeamIds = JSON.parse(rankedTeamIds);
  } catch {
    throw new Error('Rank all active World Cup teams.');
  }

  if (!Array.isArray(parsedTeamIds)) {
    throw new Error('Rank all active World Cup teams.');
  }

  return parsedTeamIds.map((value) => requiredString(String(value), 'team'));
}
