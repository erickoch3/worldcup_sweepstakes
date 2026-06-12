import { closeSync, mkdirSync, openSync } from 'node:fs';
import path from 'node:path';

try {
  process.loadEnvFile?.();
} catch (error) {
  if (error?.code !== 'ENOENT') {
    throw error;
  }
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || databaseUrl === ':memory:' || !databaseUrl.startsWith('file:')) {
  process.exit(0);
}

const dbPath = databaseUrl.replace(/^file:/, '');
const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);

mkdirSync(path.dirname(resolvedPath), { recursive: true });
closeSync(openSync(resolvedPath, 'a'));
