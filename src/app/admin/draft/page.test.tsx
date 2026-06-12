import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('AdminDraftPage', () => {
  it('groups the process and test draft controls together', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/admin/draft/page.tsx'), 'utf8');

    expect(source).toContain('className="draft-action-panel empty-state"');
    expect(source).toContain('role="group"');
    expect(source).toContain('aria-label="Draft actions"');
    expect(source).not.toContain("style={{ display: 'flex', gap: '0.75rem'");
  });
});
