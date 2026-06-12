'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '../../auth/session';
import { createInviteToken, hashInviteToken, normalizeEmail } from '../../domain/invites';
import { prisma } from '../../lib/prisma';

export async function createInviteAction(formData: FormData): Promise<{ token: string }> {
  await requireAdmin();

  const token = createInviteToken();
  const label = optionalString(formData.get('label'));
  const intendedEmailInput = optionalString(formData.get('intendedEmail'));
  const intendedEmail = intendedEmailInput === null ? null : normalizeEmail(intendedEmailInput);
  const expiresAt = optionalDate(formData.get('expiresAt')) ?? (intendedEmail === null ? oneDayFromNow() : null);

  await prisma.invite.create({
    data: {
      tokenHash: hashInviteToken(token),
      label,
      intendedEmail,
      expiresAt,
      maxUses: intendedEmail === null ? null : 1,
    },
  });

  revalidatePath('/admin/invites');

  return { token };
}

function optionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
}

function optionalDate(value: FormDataEntryValue | null): Date | null {
  const raw = optionalString(value);

  if (raw === null) {
    return null;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invite expiry date is invalid.');
  }

  return date;
}

function oneDayFromNow(): Date {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}
