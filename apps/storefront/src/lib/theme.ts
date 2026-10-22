import { contrastingText, type Theme, THEME_FONT_STACKS as FONT_STACKS } from '@repo/contracts';
import type { CSSProperties } from 'react';

/** Button corners; other corners come from the data-radius rules in globals.css. */
const BUTTON_RADII: Record<Theme['settings']['radius'], string> = {
  none: '0px',
  small: '0.25rem',
  medium: '0.375rem',
  large: '0.75rem',
  pill: '9999px',
};

/** True when light text is the readable choice on this background (a dark theme). */
export function isDarkColor(hex: string): boolean {
  return contrastingText(hex) === '#ffffff';
}

/** The midpoint of two hex colors, used to pick readable text on a brand→accent gradient. */
function midpoint(a: string, b: string): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2]
    .map((i) =>
      Math.round((channel(a, i) + channel(b, i)) / 2)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/**
 * CSS custom properties for a store's theme. Inputs are schema-validated hex colors and enums,
 * so nothing merchant-supplied is interpolated into CSS as free text.
 */
export function themeStyle(theme: Theme): CSSProperties {
  const s = theme.settings;
  const dark = isDarkColor(s.backgroundColor);
  // Dark themes use a white-ish brand; the banner then runs from the raised surface instead.
  const bannerFrom = dark ? s.surfaceColor : s.brandColor;
  const bannerText = contrastingText(midpoint(bannerFrom, s.accentColor));
  return {
    '--store-brand': s.brandColor,
    '--store-brand-contrast': contrastingText(s.brandColor),
    '--store-accent': s.accentColor,
    '--store-accent-contrast': contrastingText(s.accentColor),
    '--store-bg': s.backgroundColor,
    '--store-surface': s.surfaceColor,
    '--store-text': s.textColor,
    '--store-banner-from': bannerFrom,
    '--store-banner-to': s.accentColor,
    '--store-banner-text': bannerText,
    '--store-banner-text-contrast': contrastingText(bannerText),
    // The "dark" footer band: inverted on light themes, a raised surface on dark ones.
    '--store-band-bg': dark ? s.surfaceColor : s.textColor,
    '--store-band-text': dark ? s.textColor : s.backgroundColor,
    '--store-font': FONT_STACKS[s.font],
    '--store-heading-font': FONT_STACKS[s.headingFont],
    '--store-button-radius': BUTTON_RADII[s.radius],
  } as CSSProperties;
}

/** Layout tokens as `data-*` attributes on <body>; globals.css styles every page from them. */
export function themeAttributes(theme: Theme): Record<`data-${string}`, string | undefined> {
  const s = theme.settings;
  return {
    'data-theme': '',
    'data-card': s.cardStyle,
    'data-radius': s.radius,
    'data-buttons': s.buttonStyle,
    'data-density': s.density,
    'data-ratio': s.imageRatio,
    'data-heading-case': s.headingCase,
    'data-dark': isDarkColor(s.backgroundColor) ? '' : undefined,
  };
}
