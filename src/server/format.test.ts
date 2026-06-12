import { describe, expect, it } from 'vitest';

import { formatPounds } from './format';

describe('formatPounds', () => {
  it('formats pence as GBP pounds', () => {
    expect(formatPounds(1050)).toBe('£10.50');
  });
});
