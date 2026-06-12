import { config as loadEnv } from 'dotenv';

import { prisma } from '../src/lib/prisma';
import { runWorldCupDataSync } from '../src/server/sync/world-cup-sync';

loadEnv({ quiet: true });

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const allowMissingKeys = process.argv.includes('--allow-missing-keys');

  const result = await runWorldCupDataSync({
    allowMissingKeys,
    dryRun,
  });

  console.log(JSON.stringify({
    dryRun,
    syncedAt: new Date().toISOString(),
    result,
  }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
