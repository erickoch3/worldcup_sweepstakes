import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestUserSessionAction } from './test-users';

const {
  cookies,
  createInviteHashToken,
  createInviteToken,
  redirect,
  requireAdmin,
  sessionCreate,
  transaction,
  userCreate,
  inviteCreate,
} = vi.hoisted(() => ({
  cookies: vi.fn(),
  createInviteHashToken: vi.fn(),
  createInviteToken: vi.fn(),
  redirect: vi.fn(),
  requireAdmin: vi.fn(),
  sessionCreate: vi.fn(),
  transaction: vi.fn(),
  userCreate: vi.fn(),
  inviteCreate: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies,
}));

vi.mock('next/navigation', () => ({
  redirect,
}));

vi.mock('../../auth/session', () => ({
  requireAdmin,
}));

vi.mock('../../domain/invites', async () => {
  const actual = await vi.importActual<typeof import('../../domain/invites')>('../../domain/invites');

  return {
    ...actual,
    createInviteToken,
    hashInviteToken: createInviteHashToken,
  };
});

vi.mock('../../lib/prisma', () => ({
  prisma: {
    $transaction: transaction,
  },
}));

describe('createTestUserSessionAction', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.stubEnv('ENABLE_TEST_USER_ACTION', 'true');
    cookies.mockReset();
    redirect.mockReset();
    createInviteHashToken.mockReset();
    createInviteToken.mockReset();
    requireAdmin.mockReset();
    sessionCreate.mockReset();
    transaction.mockReset();
    userCreate.mockReset();
    inviteCreate.mockReset();

    requireAdmin.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', isAdmin: true },
    });
    cookies.mockResolvedValue({
      set: vi.fn(),
    });
    transaction.mockImplementation((callback) =>
      callback({
        session: { create: sessionCreate },
        user: { create: userCreate },
        invite: { create: inviteCreate },
      }),
    );
  });

  it('creates a throwaway user and signs the browser into that user', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T12:00:00.000Z'));
    vi.stubEnv('NEXTAUTH_URL', 'https://example.com');
    createInviteToken.mockReturnValue('onboarding-token');
    createInviteHashToken.mockReturnValue('hashed-onboarding-token');
    userCreate.mockResolvedValue({ id: 'test-user-1' });
    const cookieStore = { set: vi.fn() };
    cookies.mockResolvedValue(cookieStore);
    const formData = new FormData();
    formData.set('name', ' Test Player 1 ');
    formData.set('email', ' ERIC+wc-test-1@example.com ');

    await createTestUserSessionAction(formData);

    expect(userCreate).toHaveBeenCalledWith({
      data: {
        email: 'eric+wc-test-1@example.com',
        emailVerified: new Date('2026-06-08T12:00:00.000Z'),
        name: 'Test Player 1',
      },
      select: { id: true },
    });
    expect(sessionCreate).toHaveBeenCalledWith({
      data: {
        expires: new Date('2026-06-08T13:00:00.000Z'),
        sessionToken: expect.any(String),
        userId: 'test-user-1',
      },
    });
    expect(inviteCreate).toHaveBeenCalledWith({
      data: {
        intendedEmail: 'eric+wc-test-1@example.com',
        tokenHash: 'hashed-onboarding-token',
        expiresAt: new Date('2026-06-09T12:00:00.000Z'),
        label: 'Test user onboarding for Test Player 1',
        maxUses: 1,
      },
    });
    expect(cookieStore.set).toHaveBeenCalledWith('__Secure-next-auth.session-token', expect.any(String), {
      expires: new Date('2026-06-08T13:00:00.000Z'),
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: true,
    });
    expect(redirect).toHaveBeenCalledWith('/register/onboarding-token');
  });
});
