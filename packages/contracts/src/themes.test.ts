import { describe, expect, it } from 'vitest';
import { themeInputSchema } from './settings.js';
import {
  applyThemeTemplate,
  defaultTemplateFor,
  findThemeTemplate,
  THEME_INDUSTRIES,
  THEME_STYLES,
  THEME_TEMPLATES,
} from './themes.js';

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('theme templates', () => {
  it('offers every industry in every style, with unique ids and names', () => {
    expect(THEME_TEMPLATES).toHaveLength(THEME_INDUSTRIES.length * THEME_STYLES.length);
    expect(THEME_TEMPLATES.length).toBeGreaterThanOrEqual(100);
    expect(new Set(THEME_TEMPLATES.map((t) => t.id)).size).toBe(THEME_TEMPLATES.length);
    expect(new Set(THEME_TEMPLATES.map((t) => t.name)).size).toBe(THEME_TEMPLATES.length);
  });

  it('every template is a valid theme with readable colors', () => {
    for (const t of THEME_TEMPLATES) {
      expect(themeInputSchema.safeParse({ preset: t.preset, settings: t.settings }).success).toBe(
        true,
      );
      const { textColor, backgroundColor, surfaceColor, brandColor } = t.settings;
      expect(contrast(textColor, backgroundColor), `${t.id} text`).toBeGreaterThanOrEqual(7);
      expect(contrast(textColor, surfaceColor), `${t.id} text on surface`).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contrast(brandColor, backgroundColor), `${t.id} brand`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('applying a template keeps the merchant’s own words', () => {
    const template = findThemeTemplate('beauty-classic');
    expect(template?.name).toBe('Velvet');
    const current = { ...THEME_TEMPLATES[0]!.settings, heroTitle: 'My shop', announcement: '' };
    const applied = applyThemeTemplate(template!, current);
    expect(applied.preset).toBe('classic');
    expect(applied.settings.heroTitle).toBe('My shop');
    expect(applied.settings.template).toBe('beauty-classic');
    expect(applied.settings.headerStyle).toBe('centered');
    expect(applied.settings.announcement).toBe('');

    // Sections, words and links stay the merchant's.
    const custom = {
      ...current,
      showNewsletter: false,
      trustItem1: 'Ships in 24h',
      socialInstagram: 'https://instagram.com/shop',
      heroCta: 'Browse',
    };
    const restyled = applyThemeTemplate(findThemeTemplate('pets-noir')!, custom).settings;
    expect(restyled).toMatchObject({
      showNewsletter: false,
      trustItem1: 'Ships in 24h',
      socialInstagram: 'https://instagram.com/shop',
      heroCta: 'Browse',
      cardStyle: 'overlay',
      template: 'pets-noir',
    });
    expect(defaultTemplateFor('pets')?.id).toBe('pets-minimal');
    expect(defaultTemplateFor('nope')).toBeUndefined();
  });
});

describe('template copy', () => {
  it('replaces text that came from another template but keeps the merchant’s own', () => {
    const electronics = findThemeTemplate('electronics-minimal')!;
    const books = findThemeTemplate('books-noir')!;
    const fromElectronics = applyThemeTemplate(electronics, THEME_TEMPLATES[0]!.settings).settings;
    const restyled = applyThemeTemplate(books, {
      ...fromElectronics,
      heroCta: 'Visit us',
    }).settings;
    expect(restyled.heroSubtitle).toBe(books.settings.heroSubtitle);
    expect(restyled.featuredTitle).toBe(books.settings.featuredTitle);
    expect(restyled.heroCta).toBe('Visit us');
  });
});

describe('theme settings', () => {
  it('accepts https social links only', () => {
    const parse = (socialInstagram: string) =>
      themeInputSchema.safeParse({ preset: 'minimal', settings: { socialInstagram } }).success;
    expect(parse('https://instagram.com/shop')).toBe(true);
    expect(parse('')).toBe(true);
    expect(parse('javascript:alert(1)')).toBe(false);
    expect(parse('http://instagram.com/shop')).toBe(false);
    expect(parse('https://')).toBe(false);
  });
});
