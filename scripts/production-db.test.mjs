import { describe, expect, it } from 'vitest';

import {
  databaseFilePathFromUrl,
  defaultProductionDatabaseUrl,
  resolveDatabaseUrl,
  validateProductionDatabaseUrl,
} from './production-db.mjs';

describe('production database helpers', () => {
  it('defaults production SQLite data outside the app tree', () => {
    expect(defaultProductionDatabaseUrl({
      homeDir: '/home/app',
    })).toBe('file:/home/app/.local/share/worldcup-sweepstakes/worldcup.db');
  });

  it('resolves relative file URLs from the app directory and preserves query suffixes', () => {
    expect(resolveDatabaseUrl({
      appDir: '/srv/app',
      databaseUrl: 'file:./data/worldcup.db?connection_limit=1',
    })).toBe('file:/srv/app/data/worldcup.db?connection_limit=1');
  });

  it('rejects production SQLite data inside the app tree', () => {
    expect(() => validateProductionDatabaseUrl({
      appDir: '/srv/app',
      databaseUrl: 'file:/srv/app/data/worldcup.db',
      releaseRoot: '/srv/app/.releases',
    })).toThrow(/outside the app tree/);
  });

  it('rejects production SQLite data inside a release directory', () => {
    expect(() => validateProductionDatabaseUrl({
      appDir: '/srv/app',
      databaseUrl: 'file:/srv/app/.releases/20260611/data/worldcup.db',
      releaseRoot: '/srv/app/.releases',
    })).toThrow(/outside the release tree/);
  });

  it('accepts an absolute SQLite path outside the app and release trees', () => {
    expect(validateProductionDatabaseUrl({
      appDir: '/srv/app',
      databaseUrl: 'file:/home/app/.local/share/worldcup-sweepstakes/worldcup.db',
      releaseRoot: '/srv/app/.releases',
    })).toEqual({
      databaseUrl: 'file:/home/app/.local/share/worldcup-sweepstakes/worldcup.db',
      path: '/home/app/.local/share/worldcup-sweepstakes/worldcup.db',
    });
  });

  it('extracts the filesystem path from a file database URL', () => {
    expect(databaseFilePathFromUrl('file:/home/app/worldcup.db?connection_limit=1')).toBe('/home/app/worldcup.db');
  });
});
