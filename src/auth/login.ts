export const INVITE_REQUIRED_LOGIN_MESSAGE = 'Use your invite link to create an account before signing in.';

export function normalizeCallbackUrl(value: string | string[] | undefined, fallback = '/'): string {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback;
  }

  return candidate;
}

export function getLoginErrorMessage(error: string | string[] | undefined): string | null {
  const errorCode = Array.isArray(error) ? error[0] : error;

  switch (errorCode) {
    case 'OAuthCreateAccount':
    case 'CreateUser':
    case 'AccessDenied':
      return INVITE_REQUIRED_LOGIN_MESSAGE;
    default:
      return null;
  }
}
