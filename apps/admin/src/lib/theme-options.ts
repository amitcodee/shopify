import {
  THEME_BUTTON_STYLES,
  THEME_CARD_STYLES,
  THEME_DENSITIES,
  THEME_FONT_STACKS,
  THEME_FONTS,
  THEME_FOOTER_STYLES,
  THEME_HEADER_STYLES,
  THEME_HEADING_CASES,
  THEME_IMAGE_RATIOS,
  THEME_PRESETS,
  THEME_RADII,
} from '@repo/contracts';

/** System font stacks shared with the storefront (no web-font requests in the admin either). */
export const FONT_STACKS = THEME_FONT_STACKS;

type Option<T extends string> = { value: T; label: string };

function options<T extends string>(values: readonly T[], labels: Record<T, string>): Option<T>[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

export const PRESET_OPTIONS = options(THEME_PRESETS, {
  minimal: 'Minimal — light and airy',
  bold: 'Bold — full-color hero',
  classic: 'Classic — centered, editorial',
  split: 'Split — text beside a feature image',
  fullbleed: 'Full bleed — edge-to-edge hero',
  editorial: 'Editorial — big headline, magazine feel',
  catalog: 'Catalog — collections up front',
  banner: 'Banner — gradient promo band',
});

export const FONT_OPTIONS = options(THEME_FONTS, {
  system: 'System sans',
  serif: 'Serif',
  rounded: 'Rounded',
  mono: 'Monospace',
  slab: 'Slab serif',
  humanist: 'Humanist sans',
  geometric: 'Geometric sans',
  condensed: 'Condensed',
});

export const HEADING_CASE_OPTIONS = options(THEME_HEADING_CASES, {
  normal: 'As typed',
  uppercase: 'UPPERCASE',
});

export const HEADER_OPTIONS = options(THEME_HEADER_STYLES, {
  inline: 'Inline — logo left, menu right',
  centered: 'Centered — logo in the middle',
  stacked: 'Stacked — logo above the menu',
});

export const CARD_OPTIONS = options(THEME_CARD_STYLES, {
  plain: 'Plain',
  bordered: 'Bordered',
  shadow: 'Raised with shadow',
  overlay: 'Text over image',
  framed: 'Framed',
});

export const IMAGE_RATIO_OPTIONS = options(THEME_IMAGE_RATIOS, {
  square: 'Square',
  portrait: 'Portrait (3:4)',
  landscape: 'Landscape (4:3)',
});

export const DENSITY_OPTIONS = options(THEME_DENSITIES, {
  compact: 'Compact',
  comfortable: 'Comfortable',
  spacious: 'Spacious',
});

export const RADIUS_OPTIONS = options(THEME_RADII, {
  none: 'Square corners',
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  pill: 'Fully rounded',
});

export const BUTTON_OPTIONS = options(THEME_BUTTON_STYLES, {
  solid: 'Solid',
  outline: 'Outline',
  soft: 'Soft tint',
});

export const FOOTER_OPTIONS = options(THEME_FOOTER_STYLES, {
  simple: 'Simple',
  columns: 'Columns',
  dark: 'Dark',
});

export const COLUMN_OPTIONS = [2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}` }));
