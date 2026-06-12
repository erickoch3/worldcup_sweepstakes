import { PrismaAdapter } from '@next-auth/prisma-adapter';
import type { NextAuthOptions } from 'next-auth';
import type { Adapter, AdapterAccount, AdapterUser } from 'next-auth/adapters';
import GoogleProvider from 'next-auth/providers/google';
import { cookies } from 'next/headers';

import { validateInvite } from '../domain/invites';
import { prisma } from '../lib/prisma';
import { isAdminEmail } from './admin';

export const REGISTER_INVITE_COOKIE = 'worldcupRegisterInvite';

export const authOptions: NextAuthOptions = {
  adapter: inviteGatedAdapter(),
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: {
    strategy: 'database',
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      session.user.isAdmin = isAdminEmail(session.user.email);

      return session;
    },
  },
};

function inviteGatedAdapter(): Adapter {
  const adapter = PrismaAdapter(prisma);

  return {
    ...adapter,
    async createUser(user: Omit<AdapterUser, 'id'>) {
      if (!user.email) {
        throw new Error('A Google account email is required to create an account.');
      }

      const inviteTokenHash = await getPendingInviteTokenHash();

      if (inviteTokenHash === null) {
        if (isAdminEmail(user.email)) {
          return prisma.user.create({ data: user });
        }

        throw new Error('An invite link is required to create an account.');
      }

      return prisma.$transaction(async (tx) => {
        const invite = await tx.invite.findUnique({
          where: { tokenHash: inviteTokenHash },
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

        if (invite === null) {
          throw new Error('Invalid invite.');
        }

        const inviteValidation = validateInvite({
          invite,
          email: user.email,
          now: new Date(),
        });

        if (!inviteValidation.ok) {
          throw new Error(inviteValidation.reason);
        }

        const createdUser = await tx.user.create({ data: user });
        if (invite.maxUses === null) {
          return createdUser;
        }

        const now = new Date();
        const inviteClaim = await tx.invite.updateMany({
          where: {
            id: invite.id,
            useCount: { lt: invite.maxUses },
          },
          data: {
            usedAt: now,
            usedById: createdUser.id,
            useCount: { increment: 1 },
            lastUsedAt: now,
          },
        });

        if (inviteClaim.count !== 1) {
          throw new Error('Invite has already been used.');
        }

        return createdUser;
      });
    },
    async linkAccount(account: AdapterAccount) {
      const existingAccount = await prisma.account.findFirst({
        where: {
          userId: account.userId,
          provider: account.provider,
        },
        select: { id: true },
      });

      if (existingAccount !== null) {
        throw new Error('Only one Google account can be linked to this user.');
      }

      return adapter.linkAccount?.(account) ?? null;
    },
  };
}

async function getPendingInviteTokenHash(): Promise<string | null> {
  const cookieStore = await cookies();
  const tokenHash = cookieStore.get(REGISTER_INVITE_COOKIE)?.value.trim();

  return tokenHash === '' || tokenHash === undefined ? null : tokenHash;
}
