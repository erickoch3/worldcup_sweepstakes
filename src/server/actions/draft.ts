'use server';

import crypto from 'node:crypto';

import { DraftStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { requireAdmin } from '../../auth/session';
import { allocateAssignmentBuyIns } from '../../domain/buy-ins';
import { computeDraftAssignments } from '../../domain/draft';
import { prisma } from '../../lib/prisma';

export async function deleteSubmissionAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();

  const submissionId = requiredString(formData.get('submissionId'), 'submissionId');

  await prisma.$transaction(async (tx) => {
    const draft = await tx.draft.findFirst({
      select: { id: true },
    });

    if (draft !== null) {
      throw new Error('Draft has already been processed.');
    }

    const submission = await tx.preferenceSubmission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        userId: true,
        lockedAt: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
        choices: {
          orderBy: { rank: 'asc' },
          select: {
            rank: true,
            teamId: true,
            team: {
              select: {
                countryCode: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (submission === null) {
      throw new Error('Preference submission not found.');
    }

    if (submission.lockedAt !== null && submission.lockedAt !== undefined) {
      throw new Error('Draft has already been processed.');
    }

    await tx.preferenceSubmissionArchive.create({
      data: {
        originalSubmissionId: submission.id,
        userId: submission.userId,
        userEmail: submission.user.email,
        userName: submission.user.name,
        choicesJson: JSON.stringify(
          submission.choices.map((choice) => ({
            rank: choice.rank,
            teamId: choice.teamId,
            countryCode: choice.team.countryCode,
            displayName: choice.team.displayName,
          })),
        ),
        lockedAt: submission.lockedAt,
        submittedAt: submission.createdAt,
        deletedById: session.user.id,
      },
    });

    await tx.preferenceSubmission.delete({
      where: { id: submission.id },
    });
  });

  revalidatePath('/admin/draft');
}

export async function processDraftAction(): Promise<void> {
  const session = await requireAdmin();
  const existingDraft = await prisma.draft.findFirst({
    select: { id: true },
  });

  if (existingDraft !== null) {
    throw new Error('Draft has already been processed.');
  }

  const [teams, submissions] = await Promise.all([
    prisma.team.findMany({
      where: { active: true },
      select: {
        id: true,
        decimalOdds: true,
      },
    }),
    prisma.preferenceSubmission.findMany({
      select: {
        id: true,
        userId: true,
        createdAt: true,
        choices: {
          orderBy: { rank: 'asc' },
          select: {
            teamId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  if (submissions.length === 0) {
    throw new Error('No preference submissions exist.');
  }

  const draftResult = computeDraftAssignments({
    rng: () => crypto.randomInt(0, 1_000_000) / 1_000_000,
    teams,
    submissions: submissions.map((submission) => ({
      userId: submission.userId,
      submittedAt: submission.createdAt,
      teamIdsByRank: submission.choices.map((choice) => choice.teamId),
    })),
  });
  const assignmentBuyIns = allocateAssignmentBuyIns({
    assignments: draftResult.assignments,
    targetWinProbability: draftResult.targetWinProbability,
    userTotals: draftResult.userTotals,
  });
  const lockedAt = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const draft = await tx.draft.create({
        data: {
          status: DraftStatus.LOCKED,
          processedById: session.user.id,
        },
        select: { id: true },
      });

      await tx.assignment.createMany({
        data: draftResult.assignments.map((assignment, index) => ({
            draftId: draft.id,
            userId: assignment.userId,
            teamId: assignment.teamId,
            preferenceRankWon: assignment.preferenceRankWon,
            pickNumber: assignment.pickNumber,
            teamShareIndex: assignment.teamShareIndex,
            teamShareCount: assignment.teamShareCount,
            normalizedWinProbability: assignment.normalizedWinProbability,
            buyInPence: assignmentBuyIns[index] ?? 0,
          })),
      });

      await tx.preferenceSubmission.updateMany({
        where: {
          id: { in: submissions.map((submission) => submission.id) },
        },
        data: { lockedAt },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error('Draft has already been processed.');
    }

    throw error;
  }

  revalidatePath('/');
  revalidatePath('/admin/draft');
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

function requiredString(value: FormDataEntryValue | null, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${fieldName} is required.`);
  }

  return value.trim();
}
