import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authOptions, REGISTER_INVITE_COOKIE } from './options';

const { accountCreate, accountFindFirst, cookies, inviteFindUnique, inviteUpdateMany, transaction, userCreate } = vi.hoisted(() => ({
  accountCreate: vi.fn(),
  accountFindFirst: vi.fn(),
  cookies: vi.fn(),
  inviteFindUnique: vi.fn(),
  inviteUpdateMany: vi.fn(),
  transaction: vi.fn(),
  userCreate: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies,
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    $transaction: transaction,
    account: {
      findFirst: accountFindFirst,
      findUnique: vi.fn(),
      create: accountCreate,
      delete: vi.fn(),
    },
    invite: {
      findUnique: inviteFindUnique,
      updateMany: inviteUpdateMany,
    },
    session: {
      create: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      create: userCreate,
      delete: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    verificationToken: {
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('authOptions adapter', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    accountCreate.mockReset();
    accountFindFirst.mockReset();
    cookies.mockReset();
    inviteFindUnique.mockReset();
    inviteUpdateMany.mockReset();
    transaction.mockReset();
    userCreate.mockReset();

    transaction.mockImplementation((callback) =>
      callback({
        invite: {
          findUnique: inviteFindUnique,
          updateMany: inviteUpdateMany,
        },
        user: {
          create: userCreate,
        },
      }),
    );
  });

  it('rejects first-time Google account creation without a pending invite cookie', async () => {
    cookies.mockResolvedValue({
      get: () => undefined,
    });

    await expect(createUser()).rejects.toThrow('An invite link is required to create an account.');
    expect(userCreate).not.toHaveBeenCalled();
  });

  it('allows configured admin emails to bootstrap without a pending invite cookie', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'admin@example.com');
    cookies.mockResolvedValue({
      get: () => undefined,
    });
    userCreate.mockResolvedValue({
      id: 'admin-user-1',
      name: 'Admin',
      email: 'admin@example.com',
      emailVerified: null,
      image: null,
    });

    await expect(createUser('admin@example.com')).resolves.toMatchObject({
      id: 'admin-user-1',
      email: 'admin@example.com',
    });
    expect(userCreate).toHaveBeenCalledWith({
      data: {
        name: 'Player',
        email: 'admin@example.com',
        emailVerified: null,
        image: null,
      },
    });
    expect(inviteFindUnique).not.toHaveBeenCalled();
    expect(inviteUpdateMany).not.toHaveBeenCalled();
  });

  it('creates the Google user and claims the invite atomically when the pending invite is valid', async () => {
    cookies.mockResolvedValue({
      get: (name: string) => (name === REGISTER_INVITE_COOKIE ? { value: 'invite-hash' } : undefined),
    });
    inviteFindUnique.mockResolvedValue({
      id: 'invite-1',
      intendedEmail: 'player@example.com',
      expiresAt: null,
      usedAt: null,
      usedById: null,
      maxUses: 1,
      useCount: 0,
    });
    userCreate.mockResolvedValue({
      id: 'user-1',
      name: 'Player',
      email: 'player@example.com',
      emailVerified: null,
      image: null,
    });
    inviteUpdateMany.mockResolvedValue({ count: 1 });

    await expect(createUser()).resolves.toMatchObject({
      id: 'user-1',
      email: 'player@example.com',
    });
    expect(inviteFindUnique).toHaveBeenCalledWith({
      where: { tokenHash: 'invite-hash' },
      select: {
        id: true,
        intendedEmail: true,
        expiresAt: true,
        usedAt: true,
        usedById: true,
        maxUses: true,
        useCount: true,
      },
    });
    expect(userCreate).toHaveBeenCalledWith({
      data: {
        name: 'Player',
        email: 'player@example.com',
        emailVerified: null,
        image: null,
      },
    });
    expect(inviteUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'invite-1',
        useCount: { lt: 1 },
      },
      data: {
        usedAt: expect.any(Date),
        usedById: 'user-1',
        useCount: { increment: 1 },
        lastUsedAt: expect.any(Date),
      },
    });
  });

  it('creates a Google user from a reusable invite without consuming it for later users', async () => {
    cookies.mockResolvedValue({
      get: (name: string) => (name === REGISTER_INVITE_COOKIE ? { value: 'invite-hash' } : undefined),
    });
    inviteFindUnique.mockResolvedValue({
      id: 'invite-1',
      intendedEmail: null,
      expiresAt: new Date('2999-06-09T12:00:00.000Z'),
      usedAt: null,
      usedById: null,
      maxUses: null,
      useCount: 3,
    });
    userCreate.mockResolvedValue({
      id: 'user-2',
      name: 'Player',
      email: 'other@example.com',
      emailVerified: null,
      image: null,
    });

    await expect(createUser('other@example.com')).resolves.toMatchObject({
      id: 'user-2',
      email: 'other@example.com',
    });
    expect(inviteUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects linking a second Google account to an existing invited app account', async () => {
    accountFindFirst.mockResolvedValue({ id: 'existing-account' });

    await expect(linkGoogleAccount()).rejects.toThrow('Only one Google account can be linked to this user.');
    expect(accountCreate).not.toHaveBeenCalled();
  });

  it('allows the first Google account link for a newly invited app account', async () => {
    accountFindFirst.mockResolvedValue(null);
    accountCreate.mockResolvedValue({
      id: 'account-1',
      userId: 'user-1',
      type: 'oauth',
      provider: 'google',
      providerAccountId: 'google-account-1',
    });

    await expect(linkGoogleAccount()).resolves.toMatchObject({
      userId: 'user-1',
      provider: 'google',
    });
    expect(accountCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        provider: 'google',
        providerAccountId: 'google-account-1',
      }),
    });
  });
});

describe('authOptions providers', () => {
  it('allows Google OAuth to link manually created users by matching email', () => {
    const googleProvider = authOptions.providers.find((provider) => provider.id === 'google');

    expect(googleProvider).toMatchObject({
      options: expect.objectContaining({
        allowDangerousEmailAccountLinking: true,
      }),
    });
  });
});

function createUser(email = 'player@example.com') {
  const createUserFn = authOptions.adapter?.createUser;

  if (!createUserFn) {
    throw new Error('Adapter createUser is not configured.');
  }

  return createUserFn({
    name: 'Player',
    email,
    emailVerified: null,
    image: null,
  });
}

function linkGoogleAccount() {
  const linkAccountFn = authOptions.adapter?.linkAccount;

  if (!linkAccountFn) {
    throw new Error('Adapter linkAccount is not configured.');
  }

  return linkAccountFn({
    userId: 'user-1',
    type: 'oauth',
    provider: 'google',
    providerAccountId: 'google-account-1',
    access_token: 'access-token',
    expires_at: 123,
    id_token: 'id-token',
    scope: 'openid email profile',
    token_type: 'Bearer',
  });
}
