import { describe, expect, it } from 'vitest';
import { safeRelativePath } from './redirects.js';

describe('safeRelativePath', () => {
  it('keeps same-origin paths', () => {
    expect(safeRelativePath('/s/abc/orders?page=2#top', '/x')).toBe('/s/abc/orders?page=2#top');
  });

  it.each([
    null,
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/\\/evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    'javascript:alert(1)',
    'stores',
    `/${'a'.repeat(3000)}`,
  ])('rejects %j', (value) => {
    expect(safeRelativePath(value, '/stores')).toBe('/stores');
  });
});
