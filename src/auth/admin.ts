export function parseAdminEmails(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(
  email: string | null | undefined,
  adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS),
): boolean {
  if (!email) return false;

  return adminEmails.includes(email.trim().toLowerCase());
}
