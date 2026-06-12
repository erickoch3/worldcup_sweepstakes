import crypto from 'node:crypto';

export type InviteValidationInput = {
  invite: {
    intendedEmail: string | null;
    expiresAt: Date | null;
    usedAt: Date | null;
    maxUses?: number | null;
    useCount?: number;
    usedById?: string | null;
  };
  email: string;
  now: Date;
  allowUsedById?: string;
};

export type InviteValidationResult = { ok: true } | { ok: false; reason: string };

export function createInviteToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateInvite({
  invite,
  email,
  now,
  allowUsedById,
}: InviteValidationInput): InviteValidationResult {
  const maxUses = invite.maxUses === undefined ? 1 : invite.maxUses;
  const useCount = invite.useCount ?? (invite.usedAt === null ? 0 : 1);
  const inviteLimitReached = maxUses !== null && useCount >= maxUses;

  if (inviteLimitReached && (allowUsedById === undefined || invite.usedById !== allowUsedById)) {
    return { ok: false, reason: 'Invite has already been used.' };
  }

  if (invite.expiresAt !== null && invite.expiresAt <= now) {
    return { ok: false, reason: 'Invite has expired.' };
  }

  if (invite.intendedEmail !== null && normalizeEmail(invite.intendedEmail) !== normalizeEmail(email)) {
    return { ok: false, reason: 'This invite is for a different Google account.' };
  }

  return { ok: true };
}
