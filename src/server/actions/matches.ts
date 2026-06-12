'use server';

import { MatchStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { requireAdmin } from '../../auth/session';
import { prisma } from '../../lib/prisma';

const MATCH_STATUSES = Object.values(MatchStatus);

export async function upsertMatchAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = optionalString(formData.get('id'));
  const matchNumber = parseOptionalMatchNumber(formData.get('matchNumber'));
  const teamAId = requiredString(formData.get('teamAId'), 'teamAId');
  const teamBId = requiredString(formData.get('teamBId'), 'teamBId');
  const kickoffAt = parseDate(requiredString(formData.get('kickoffAt'), 'kickoffAt'));
  const stage = requiredString(formData.get('stage'), 'stage');
  const status = parseMatchStatus(requiredString(formData.get('status'), 'status'));
  const teamAScore = parseOptionalScore(formData.get('teamAScore'));
  const teamBScore = parseOptionalScore(formData.get('teamBScore'));
  const winnerTeamId = optionalString(formData.get('winnerTeamId'));
  const penaltySummary = optionalString(formData.get('penaltySummary'));

  if (teamAId === teamBId) {
    throw new Error('Team A and Team B must be different.');
  }

  if (status === MatchStatus.FINAL && (teamAScore === null || teamBScore === null)) {
    throw new Error('Final matches require both scores.');
  }

  if (winnerTeamId !== null && winnerTeamId !== teamAId && winnerTeamId !== teamBId) {
    throw new Error('Winner must be one of the match teams.');
  }

  const activeTeamCount = await prisma.team.count({
    where: {
      id: { in: [teamAId, teamBId] },
      active: true,
    },
  });

  if (activeTeamCount !== 2) {
    throw new Error('Both teams must be active World Cup teams.');
  }

  const data = {
    matchNumber,
    teamAId,
    teamBId,
    kickoffAt,
    stage,
    status,
    teamAScore,
    teamBScore,
    winnerTeamId,
    penaltySummary,
  };

  if (id === null) {
    await prisma.match.create({ data });
  } else {
    await prisma.match.update({
      where: { id },
      data,
    });
  }

  revalidatePath('/');
  revalidatePath('/bracket');
  revalidatePath('/schedule');
  revalidatePath('/admin/matches');
}

function requiredString(value: FormDataEntryValue | null, fieldName: string): string {
  const trimmed = optionalString(value);

  if (trimmed === null) {
    throw new Error(`${fieldName} is required.`);
  }

  return trimmed;
}

function optionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
}

function parseDate(value: string): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Kickoff date is invalid.');
  }

  return date;
}

function parseMatchStatus(value: string): MatchStatus {
  if (!isMatchStatus(value)) {
    throw new Error('Match status is invalid.');
  }

  return value;
}

function isMatchStatus(value: string): value is MatchStatus {
  return MATCH_STATUSES.includes(value as MatchStatus);
}

function parseOptionalScore(value: FormDataEntryValue | null): number | null {
  const raw = optionalString(value);

  if (raw === null) {
    return null;
  }

  if (!/^\d+$/.test(raw)) {
    throw new Error('Scores must be nonnegative integers.');
  }

  return Number(raw);
}

function parseOptionalMatchNumber(value: FormDataEntryValue | null): number | null {
  const raw = optionalString(value);

  if (raw === null) {
    return null;
  }

  if (!/^\d+$/.test(raw)) {
    throw new Error('Match number must be a positive integer.');
  }

  const matchNumber = Number(raw);

  if (matchNumber < 1) {
    throw new Error('Match number must be a positive integer.');
  }

  return matchNumber;
}
