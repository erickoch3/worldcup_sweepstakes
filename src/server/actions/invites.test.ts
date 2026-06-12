import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hashInviteToken } from '../../domain/invites';
import { createInviteAction } from './invites';

const { inviteCreate, requireAdmin, revalidatePath } = vi.hoisted(() => ({
  inviteCreate: vi.fn(),
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('../../auth/session', () => ({
  requireAdmin,
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    invite: {
      create: inviteCreate,
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath,
}));

describe('createInviteAction', () => {
  beforeEach(() => {
    vi.useRealTimers();
    inviteCreate.mockReset();
    requireAdmin.mockReset();
    revalidatePath.mockReset();
    requireAdmin.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', isAdmin: true },
    });
  });

  it('stores only a hashed invite token with normalized optional fields', async () => {
    const formData = new FormData();
    formData.set('label', ' Launch Pool ');
    formData.set('intendedEmail', ' PLAYER@Example.COM ');
    formData.set('expiresAt', '2026-07-01T12:00:00.000Z');

    const result = await createInviteAction(formData);

    expect(result.token).toEqual(expect.any(String));
    expect(result.token).not.toHaveLength(0);
    expect(inviteCreate).toHaveBeenCalledWith({
      data: {
        tokenHash: hashInviteToken(result.token),
        label: 'Launch Pool',
        intendedEmail: 'player@example.com',
        expiresAt: new Date('2026-07-01T12:00:00.000Z'),
        maxUses: 1,
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/invites');
  });

  it('creates a reusable one-day invite when no intended email is supplied', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T10:30:00.000Z'));
    const formData = new FormData();
    formData.set('label', ' Open signup ');

    const result = await createInviteAction(formData);

    expect(inviteCreate).toHaveBeenCalledWith({
      data: {
        tokenHash: hashInviteToken(result.token),
        label: 'Open signup',
        intendedEmail: null,
        expiresAt: new Date('2026-06-09T10:30:00.000Z'),
        maxUses: null,
      },
    });
  });
});
