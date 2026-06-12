#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function defaultProductionDatabaseUrl({
  homeDir = process.env.HOME,
  dataDir = process.env.PRODUCTION_DATA_DIR,
} = {}) {
  const resolvedDataDir = dataDir || path.join(requiredString(homeDir, 'HOME'), '.local', 'share', 'worldcup-sweepstakes');

  return `file:${path.join(resolvedDataDir, 'worldcup.db')}`;
}

export function resolveDatabaseUrl({ appDir, databaseUrl }) {
  const resolvedAppDir = path.resolve(requiredString(appDir, 'appDir'));
  const rawDatabaseUrl = requiredString(databaseUrl, 'databaseUrl');

  if (!rawDatabaseUrl.startsWith('file:')) {
    return rawDatabaseUrl;
  }

  const { rawPath, suffix } = splitFileDatabaseUrl(rawDatabaseUrl);

  if (rawPath === ':memory:' || path.isAbsolute(rawPath)) {
    return rawDatabaseUrl;
  }

  return `file:${path.resolve(resolvedAppDir, rawPath)}${suffix}`;
}

export function databaseFilePathFromUrl(databaseUrl) {
  const rawDatabaseUrl = requiredString(databaseUrl, 'databaseUrl');

  if (!rawDatabaseUrl.startsWith('file:')) {
    throw new Error('Production SQLite DATABASE_URL must use a file: URL.');
  }

  const { rawPath } = splitFileDatabaseUrl(rawDatabaseUrl);

  if (rawPath === ':memory:') {
    throw new Error('Production SQLite DATABASE_URL cannot use :memory:.');
  }

  if (!path.isAbsolute(rawPath)) {
    throw new Error('Production SQLite DATABASE_URL must resolve to an absolute path.');
  }

  return rawPath;
}

export function validateProductionDatabaseUrl({ appDir, databaseUrl, releaseRoot }) {
  const resolvedDatabaseUrl = resolveDatabaseUrl({ appDir, databaseUrl });
  const dbPath = databaseFilePathFromUrl(resolvedDatabaseUrl);
  const resolvedAppDir = path.resolve(requiredString(appDir, 'appDir'));
  const resolvedReleaseRoot = path.resolve(requiredString(releaseRoot, 'releaseRoot'));

  if (isPathInside(dbPath, resolvedReleaseRoot)) {
    throw new Error(`Production SQLite database must live outside the release tree: ${resolvedReleaseRoot}`);
  }

  if (isPathInside(dbPath, resolvedAppDir)) {
    throw new Error(`Production SQLite database must live outside the app tree: ${resolvedAppDir}`);
  }

  const tmpDir = path.resolve('/tmp');
  const varTmpDir = path.resolve('/var/tmp');
  if (isPathInside(dbPath, tmpDir) || isPathInside(dbPath, varTmpDir)) {
    throw new Error('Production SQLite database must not live in a temporary directory.');
  }

  return {
    databaseUrl: resolvedDatabaseUrl,
    path: dbPath,
  };
}

function splitFileDatabaseUrl(databaseUrl) {
  const rawPathAndSuffix = databaseUrl.slice('file:'.length);
  const queryStart = rawPathAndSuffix.indexOf('?');

  if (queryStart === -1) {
    return { rawPath: rawPathAndSuffix, suffix: '' };
  }

  return {
    rawPath: rawPathAndSuffix.slice(0, queryStart),
    suffix: rawPathAndSuffix.slice(queryStart),
  };
}

function isPathInside(candidatePath, parentPath) {
  const relativePath = path.relative(path.resolve(parentPath), path.resolve(candidatePath));

  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function optionValue(args, name) {
  const index = args.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${name} requires a value.`);
  }

  return value;
}

function runCli() {
  const [command, ...args] = process.argv.slice(2);
  const appDir = optionValue(args, '--app-dir') || process.env.APP_DIR || process.cwd();
  const releaseRoot = optionValue(args, '--release-root') || process.env.BLUE_GREEN_RELEASE_ROOT || path.join(appDir, '.releases');
  const databaseUrl = optionValue(args, '--database-url') || process.env.DATABASE_URL || defaultProductionDatabaseUrl();

  if (command === 'default-url') {
    console.log(defaultProductionDatabaseUrl());
    return;
  }

  if (command === 'resolve') {
    console.log(resolveDatabaseUrl({ appDir, databaseUrl }));
    return;
  }

  if (command === 'path') {
    console.log(databaseFilePathFromUrl(resolveDatabaseUrl({ appDir, databaseUrl })));
    return;
  }

  if (command === 'assert-safe') {
    validateProductionDatabaseUrl({ appDir, databaseUrl, releaseRoot });
    return;
  }

  throw new Error('Usage: production-db.mjs default-url|resolve|path|assert-safe [--app-dir DIR] [--release-root DIR] [--database-url URL]');
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
