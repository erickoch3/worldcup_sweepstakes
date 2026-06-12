import { beforeEach, describe, expect, it, vi } from 'vitest';

import { REGISTER_INVITE_COOKIE } from '../../../../auth/options';
import { hashInviteToken } from '../../../../domain/invites';
import { GET } from './route';

const { inviteFindUnique } = vi.hoisted(() => ({
  inviteFindUnique: vi.fn(),
}));

vi.mock('../../../../lib/prisma', () => ({
  prisma: {
    invite: {
      findUnique: inviteFindUnique,
    },
  },
}));

describe('registration start route', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    inviteFindUnique.mockReset();
  });

  it('starts Google sign-in for a reusable invite that already has prior uses', async () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://example.com');
    inviteFindUnique.mockResolvedValue({
      expiresAt: new Date('2999-06-09T12:00:00.000Z'),
      maxUses: null,
      useCount: 7,
      usedAt: new Date('2026-06-08T12:00:00.000Z'),
    });

    const response = await GET(new Request('http://0.0.0.0:42427/register/raw-token/start'), {
      params: Promise.resolve({ token: 'raw-token' }),
    });

    expect(inviteFindUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashInviteToken('raw-token') },
      select: {
        expiresAt: true,
        maxUses: true,
        useCount: true,
        usedAt: true,
      },
    });
    expect(response.headers.get('location')).toBe(
      'https://example.com/api/auth/signin/google?callbackUrl=%2Fregister%2Fraw-token',
    );
    expect(response.headers.get('set-cookie')).toContain(REGISTER_INVITE_COOKIE);
  });

  it('returns to the register page when a bounded invite has no remaining uses', async () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://example.com');
    inviteFindUnique.mockResolvedValue({
      expiresAt: null,
      maxUses: 1,
      useCount: 1,
      usedAt: new Date('2026-06-08T12:00:00.000Z'),
    });

    const response = await GET(new Request('https://example.com/register/raw-token/start'), {
      params: Promise.resolve({ token: 'raw-token' }),
    });

    expect(response.headers.get('location')).toBe('https://example.com/register/raw-token');
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
