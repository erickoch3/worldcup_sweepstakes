import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const appRoot = join(process.cwd(), 'src', 'app');

describe('mobile responsive shell', () => {
  it('exports viewport metadata for device-width mobile rendering', () => {
    const layoutSource = readFileSync(join(appRoot, 'layout.tsx'), 'utf8');

    expect(layoutSource).toContain('export const viewport');
    expect(layoutSource).toMatch(/width:\s*['"]device-width['"]/);
    expect(layoutSource).toContain('initialScale: 1');
  });

  it('keeps core screens usable at phone width', () => {
    const css = readFileSync(join(appRoot, 'globals.css'), 'utf8');

    expect(css).toContain('@media (max-width: 560px)');
    expect(css).toContain('width: min(100% - 16px, 1180px)');
    expect(css).toContain('-webkit-overflow-scrolling: touch');
    expect(css).toContain('.preference-list-item');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(css).toContain('.button {');
    expect(css).toContain('width: 100%');
  });
});
