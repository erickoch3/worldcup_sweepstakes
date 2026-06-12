import { NextResponse } from 'next/server';

import { REGISTER_INVITE_COOKIE } from '../../../../auth/options';
import { hashInviteToken } from '../../../../domain/invites';
import { prisma } from '../../../../lib/prisma';

type StartRegistrationRouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(request: Request, { params }: StartRegistrationRouteContext) {
  const { token } = await params;
  const tokenHash = hashInviteToken(token);
  const invite = await prisma.invite.findUnique({
    where: { tokenHash },
    select: {
      expiresAt: true,
      maxUses: true,
      useCount: true,
      usedAt: true,
    },
  });
  const baseUrl = getPublicBaseUrl(request.url);
  const registerUrl = new URL(`/register/${encodeURIComponent(token)}`, baseUrl);

  const inviteLimitReached = invite !== null && invite.maxUses !== null && invite.useCount >= invite.maxUses;

  if (
    invite === null ||
    inviteLimitReached ||
    (invite.expiresAt !== null && invite.expiresAt <= new Date())
  ) {
    return NextResponse.redirect(registerUrl);
  }

  const signInUrl = new URL('/api/auth/signin/google', baseUrl);
  signInUrl.searchParams.set('callbackUrl', registerUrl.pathname);

  const response = NextResponse.redirect(signInUrl);
  response.cookies.set(REGISTER_INVITE_COOKIE, tokenHash, {
    httpOnly: true,
    maxAge: 60 * 60,
    path: '/',
    sameSite: 'lax',
    secure: baseUrl.protocol === 'https:',
  });

  return response;
}

function getPublicBaseUrl(requestUrl: string): URL {
  return new URL(process.env.NEXTAUTH_URL ?? requestUrl);
}
