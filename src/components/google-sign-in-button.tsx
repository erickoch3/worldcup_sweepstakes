'use client';

import { signIn } from 'next-auth/react';

type GoogleSignInButtonProps = {
  callbackUrl: string;
};

export function GoogleSignInButton({ callbackUrl }: GoogleSignInButtonProps) {
  return (
    <button className="button button-primary" onClick={() => void signIn('google', { callbackUrl })} type="button">
      <span>Sign in with Google</span>
    </button>
  );
}
