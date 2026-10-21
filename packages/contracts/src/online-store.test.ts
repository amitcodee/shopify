import { describe, expect, it } from 'vitest';
import { menuItemSchema, paragraphs } from './online-store.js';

const url = (value: string) =>
  menuItemSchema.safeParse({ title: 'Link', link: { type: 'url', url: value } }).success;

describe('menu links', () => {
  it('accepts same-site paths and http(s) URLs', () => {
    expect(url('/pages/about')).toBe(true);
    expect(url('/search?q=mug')).toBe(true);
    expect(url('https://example.com/size-guide')).toBe(true);
    expect(url('http://example.com')).toBe(true);
  });

  it('rejects script, protocol-relative and other schemes', () => {
    expect(url('javascript:alert(1)')).toBe(false);
    expect(url('JaVaScRiPt:alert(1)')).toBe(false);
    expect(url('data:text/html,<script>')).toBe(false);
    expect(url('//evil.example')).toBe(false);
    expect(url('/\\evil.example')).toBe(false);
    expect(url('pages/about')).toBe(false);
    expect(url('/has space')).toBe(false);
  });

  it('only knows the listed link types', () => {
    expect(menuItemSchema.safeParse({ title: 'x', link: { type: 'script' } }).success).toBe(false);
    expect(
      menuItemSchema.safeParse({ title: 'x', link: { type: 'policy', kind: 'cookies' } }).success,
    ).toBe(false);
  });
});

describe('paragraphs', () => {
  it('splits on blank lines and trims', () => {
    expect(paragraphs('One\nline two\r\n\r\n  Two  \n\n\n')).toEqual(['One\nline two', 'Two']);
    expect(paragraphs('   ')).toEqual([]);
  });
});
