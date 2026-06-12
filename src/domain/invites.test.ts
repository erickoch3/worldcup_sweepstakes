import { describe, expect, it } from 'vitest';
import { createInviteToken, hashInviteToken, validateInvite } from './invites';

describe('createInviteToken', () => {
  it('creates high entropy URL-safe tokens', () => {
    expect(createInviteToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('hashInviteToken', () => {
  it('hashes deterministically without containing the raw token', () => {
    const token = 'sample-invite-token';

    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
    expect(hashInviteToken(token)).not.toContain(token);
  });
});

describe('validateInvite', () => {
  const now = new Date('2026-06-04T12:00:00.000Z');
  const validInvite = {
    intendedEmail: 'Person@Example.com',
    expiresAt: new Date('2026-06-04T13:00:00.000Z'),
    usedAt: null,
    usedById: null,
    maxUses: 1,
    useCount: 0,
  };

  it('accepts unused unexpired invites for the intended email', () => {
    expect(
      validateInvite({
        invite: validInvite,
        email: ' person@example.com ',
        now,
      }),
    ).toEqual({ ok: true });
  });

  it('accepts invites with no expiry', () => {
    expect(
      validateInvite({
        invite: { ...validInvite, expiresAt: null },
        email: 'person@example.com',
        now,
      }),
    ).toEqual({ ok: true });
  });

  it('accepts invites with no intended email for any Google account', () => {
    expect(
      validateInvite({
        invite: { ...validInvite, intendedEmail: null },
        email: 'other@example.com',
        now,
      }),
    ).toEqual({ ok: true });
  });

  it('rejects expired invites', () => {
    expect(
      validateInvite({
        invite: { ...validInvite, expiresAt: new Date('2026-06-04T11:59:59.000Z') },
        email: 'person@example.com',
        now,
      }),
    ).toEqual({ ok: false, reason: 'Invite has expired.' });
  });

  it('rejects used invites', () => {
    expect(
      validateInvite({
        invite: { ...validInvite, usedAt: new Date('2026-06-04T11:30:00.000Z'), useCount: 1 },
        email: 'person@example.com',
        now,
      }),
    ).toEqual({ ok: false, reason: 'Invite has already been used.' });
  });

  it('accepts reusable unexpired invites after prior signups', () => {
    expect(
      validateInvite({
        invite: {
          ...validInvite,
          intendedEmail: null,
          usedAt: new Date('2026-06-04T11:30:00.000Z'),
          maxUses: null,
          useCount: 12,
        },
        email: 'new-person@example.com',
        now,
      }),
    ).toEqual({ ok: true });
  });

  it('rejects intended email mismatches', () => {
    expect(
      validateInvite({
        invite: validInvite,
        email: 'other@example.com',
        now,
      }),
    ).toEqual({ ok: false, reason: 'This invite is for a different Google account.' });
  });
});
