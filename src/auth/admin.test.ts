import { describe, expect, it } from 'vitest';
import { isAdminEmail, parseAdminEmails } from './admin';

describe('parseAdminEmails', () => {
  it('normalizes comma-separated admin emails', () => {
    expect(parseAdminEmails(' A@Example.com, b@example.com ,,')).toEqual([
      'a@example.com',
      'b@example.com',
    ]);
  });
});

describe('isAdminEmail', () => {
  it('matches admin emails case-insensitively', () => {
    expect(isAdminEmail('A@Example.com', ['a@example.com'])).toBe(true);
  });

  it('rejects non-admin emails', () => {
    expect(isAdminEmail('c@example.com', ['a@example.com'])).toBe(false);
  });

  it('rejects missing emails', () => {
    expect(isAdminEmail(null, ['a@example.com'])).toBe(false);
  });
});
