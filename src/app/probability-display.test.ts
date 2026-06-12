import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('UI probability displays', () => {
  it('does not expose decimal or draft odds labels in rendered app pages', () => {
    const uiSources = [
      'src/app/page.tsx',
      'src/app/admin/page.tsx',
      'src/app/admin/teams/page.tsx',
      'src/app/admin/draft/page.tsx',
      'src/app/admin/draft/_components/test-draft-panel.tsx',
      'src/app/admin/prizes/page.tsx',
    ].map((path) => readFileSync(join(root, path), 'utf8'));

    for (const source of uiSources) {
      expect(source).not.toContain('Decimal odds');
      expect(source).not.toContain('Draft odds');
      expect(source).not.toContain('Implied decimal odds');
      expect(source).not.toContain('formatOdds(');
      expect(source).not.toContain('formatDecimalOdds(');
    }
  });
});
