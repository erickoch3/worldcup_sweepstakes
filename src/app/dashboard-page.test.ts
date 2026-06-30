import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('dashboard page composition', () => {
  it('keeps the bracket off the dashboard page', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/page.tsx'), 'utf8');

    expect(source).not.toContain('BracketView');
    expect(source).not.toContain('getBracketData');
  });
});
