import { contrastingText, type Theme } from '@repo/contracts';
import type { CSSProperties } from 'react';

const FONT_STACKS: Record<Theme['settings']['font'], string> = {
  system: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif',
};

/**
 * CSS custom properties for a store's theme. Inputs are schema-validated hex colors and enums,
 * so nothing merchant-supplied is interpolated into CSS as free text.
 */
export function themeStyle(theme: Theme): CSSProperties {
  const { brandColor, accentColor, font } = theme.settings;
  return {
    '--store-brand': brandColor,
    '--store-brand-contrast': contrastingText(brandColor),
    '--store-accent': accentColor,
    '--store-accent-contrast': contrastingText(accentColor),
    '--store-font': FONT_STACKS[font],
  } as CSSProperties;
}
