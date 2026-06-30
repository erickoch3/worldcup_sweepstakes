import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('production seed script', () => {
  it('does not overwrite live odds or elimination state for existing teams', () => {
    const source = readFileSync(join(process.cwd(), 'prisma/seed.ts'), 'utf8');
    const updateBlock = source.match(/update:\s*{([\s\S]*?)},\n\s*create:/)?.[1] ?? '';

    expect(updateBlock).not.toContain('decimalOdds');
    expect(updateBlock).not.toContain('active');
  });
});
