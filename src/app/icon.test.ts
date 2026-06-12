import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('site icon', () => {
  it('provides a soccer ball tab icon through the Next app icon convention', () => {
    const iconPath = join(process.cwd(), 'src/app/icon.svg');

    expect(existsSync(iconPath)).toBe(true);

    const icon = readFileSync(iconPath, 'utf8');

    expect(icon).toContain('<title>Soccer ball</title>');
    expect(icon).toContain('viewBox="0 0 512 512"');
  });
});
