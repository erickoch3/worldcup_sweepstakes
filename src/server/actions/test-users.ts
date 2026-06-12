'use server';

import crypto from 'node:crypto';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { requireAdmin } from '../../auth/session';
import { createInviteToken, hashInviteToken, normalizeEmail } from '../../domain/invites';
import { prisma } from '../../lib/prisma';

const TEST_SESSION_DURATION_MS = 60 * 60 * 1000;
const TEST_INVITE_DURATION_MS = 24 * 60 * 60 * 1000;

export async function createTestUserSessionAction(formData: FormData): Promise<void> {
  await requireAdmin();

  if (process.env.ENABLE_TEST_USER_ACTION !== 'true') {
    throw new Error('Test user creation is disabled.');
  }

  const email = normalizeEmail(requiredString(formData.get('email'), 'email'));
  const name = optionalString(formData.get('name')) ?? 'Test Player';
  const now = new Date();
  const expires = new Date(now.getTime() + TEST_SESSION_DURATION_MS);
  const inviteToken = createInviteToken();
  const inviteTokenHash = hashInviteToken(inviteToken);
  const inviteExpiresAt = new Date(now.getTime() + TEST_INVITE_DURATION_MS);
  const sessionToken = crypto.randomBytes(32).toString('base64url');

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        emailVerified: now,
        name,
      },
      select: { id: true },
    });

    await tx.invite.create({
      data: {
        intendedEmail: email,
        tokenHash: inviteTokenHash,
        expiresAt: inviteExpiresAt,
        label: `Test user onboarding for ${name}`,
        maxUses: 1,
      },
    });

    await tx.session.create({
      data: {
        expires,
        sessionToken,
        userId: user.id,
      },
    });
  });

  const cookieStore = await cookies();
  const secure = isSecureNextAuthUrl();

  cookieStore.set(secure ? '__Secure-next-auth.session-token' : 'next-auth.session-token', sessionToken, {
    expires,
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure,
  });

  redirect(`/register/${encodeURIComponent(inviteToken)}`);
}

function requiredString(value: FormDataEntryValue | null, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${fieldName} is required.`);
  }

  return value.trim();
}

function optionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
}

function isSecureNextAuthUrl(): boolean {
  return process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;
}
