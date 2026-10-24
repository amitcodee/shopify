import {
  type ThemeFont,
  type ThemePreset,
  type ThemeSettings,
  themeSettingsSchema,
} from './settings.js';

/**
 * The storefront template catalog: every industry crossed with every design style. Templates
 * are plain data (validated theme settings), so applying one is just saving a theme.
 */

interface Palette {
  brand: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
}

interface Industry {
  id: string;
  label: string;
  body: ThemeFont;
  heading: ThemeFont;
  /** Three palettes; each style picks one by index. */
  palettes: readonly [Palette, Palette, Palette];
  /** Safe default copy applied with the template. */
  copy: { readonly heroSubtitle: string; readonly heroCta: string; readonly featuredTitle: string };
  /** Shown only in previews (merchants write their own headline and announcement). */
  sample: { readonly heroTitle: string; readonly announcement: string };
  /** One template name per style, in THEME_STYLES order. */
  names: readonly string[];
}

const p = (brand: string, accent: string, background: string, surface: string, text: string) => ({
  brand,
  accent,
  background,
  surface,
  text,
});

export const THEME_INDUSTRIES = [
  {
    id: 'fashion',
    label: 'Fashion & apparel',
    body: 'humanist',
    heading: 'serif',
    palettes: [
      p('#111111', '#c2410c', '#ffffff', '#f5f5f4', '#1c1917'),
      p('#3f2a1e', '#b45309', '#fbf8f3', '#f1ebe1', '#2b211a'),
      p('#1e1b4b', '#db2777', '#ffffff', '#fdf2f8', '#1e1b4b'),
    ],
    copy: {
      heroSubtitle: 'New-season essentials, crafted to last and made to be lived in.',
      heroCta: 'Shop the collection',
      featuredTitle: 'New arrivals',
    },
    sample: { heroTitle: 'Wear what moves you', announcement: 'Free shipping on orders over $75' },
    names: [
      'Atelier',
      'Runway',
      'Tailor',
      'Mode',
      'Silhouette',
      'Loom',
      'Wardrobe',
      'Catwalk',
      'Couture',
    ],
  },
  {
    id: 'electronics',
    label: 'Electronics & gadgets',
    body: 'geometric',
    heading: 'geometric',
    palettes: [
      p('#0f172a', '#2563eb', '#ffffff', '#f1f5f9', '#0f172a'),
      p('#111827', '#059669', '#f9fafb', '#e5e7eb', '#111827'),
      p('#1e3a8a', '#d97706', '#ffffff', '#eff6ff', '#172554'),
    ],
    copy: {
      heroSubtitle: 'The latest gadgets, smart devices and accessories, tested and ready to ship.',
      heroCta: 'Shop gadgets',
      featuredTitle: 'Top picks',
    },
    sample: { heroTitle: 'Tech that just works', announcement: '2-year warranty on every device' },
    names: [
      'Circuit',
      'Voltage',
      'Signal',
      'Pixel',
      'Spectrum',
      'Quantum',
      'Gigabyte',
      'Neon',
      'Carbon',
    ],
  },
  {
    id: 'beauty',
    label: 'Beauty & cosmetics',
    body: 'rounded',
    heading: 'serif',
    palettes: [
      p('#831843', '#db2777', '#fffafb', '#fdf2f8', '#3b0a24'),
      p('#44403c', '#b45309', '#fffbf5', '#f5ede3', '#292524'),
      p('#4c1d95', '#9333ea', '#ffffff', '#f5f3ff', '#2e1065'),
    ],
    copy: {
      heroSubtitle: 'Clean skincare and beauty rituals made with ingredients you can trust.',
      heroCta: 'Discover the range',
      featuredTitle: 'Bestsellers',
    },
    sample: { heroTitle: 'Glow, naturally', announcement: 'Free samples with every order' },
    names: ['Bloom', 'Blush', 'Velvet', 'Petal', 'Radiance', 'Serum', 'Glow', 'Rouge', 'Orchid'],
  },
  {
    id: 'home',
    label: 'Home & decor',
    body: 'humanist',
    heading: 'serif',
    palettes: [
      p('#1f2937', '#b45309', '#fdfcfa', '#f3efe8', '#1f2937'),
      p('#14532d', '#4d7c0f', '#fbfdf8', '#ecf3e4', '#1a2e05'),
      p('#334155', '#0f766e', '#ffffff', '#f1f5f9', '#1e293b'),
    ],
    copy: {
      heroSubtitle: 'Furniture, decor and everyday objects for spaces that feel like you.',
      heroCta: 'Shop the home edit',
      featuredTitle: 'Fresh finds',
    },
    sample: {
      heroTitle: 'Make yourself at home',
      announcement: 'Free delivery on furniture over $500',
    },
    names: ['Hearth', 'Haven', 'Oak', 'Nest', 'Loft', 'Abode', 'Dwell', 'Terrace', 'Ember'],
  },
  {
    id: 'food',
    label: 'Food & grocery',
    body: 'rounded',
    heading: 'slab',
    palettes: [
      p('#14532d', '#c2410c', '#fffdf7', '#fef3c7', '#1c1917'),
      p('#7c2d12', '#15803d', '#ffffff', '#fff7ed', '#292524'),
      p('#1e293b', '#dc2626', '#ffffff', '#fef2f2', '#1e293b'),
    ],
    copy: {
      heroSubtitle: 'Small-batch pantry staples, fresh produce and treats delivered to your door.',
      heroCta: 'Start shopping',
      featuredTitle: "This week's favourites",
    },
    sample: { heroTitle: 'Fresh from the source', announcement: 'Same-day delivery before 2pm' },
    names: [
      'Harvest',
      'Pantry',
      'Orchard',
      'Market',
      'Larder',
      'Provisions',
      'Grocer',
      'Basket',
      'Truffle',
    ],
  },
  {
    id: 'jewelry',
    label: 'Jewelry & accessories',
    body: 'humanist',
    heading: 'serif',
    palettes: [
      p('#1c1917', '#a16207', '#ffffff', '#faf7f0', '#1c1917'),
      p('#312e81', '#a16207', '#fdfdfb', '#f5f3ee', '#1e1b4b'),
      p('#3f3f46', '#be185d', '#ffffff', '#fafafa', '#27272a'),
    ],
    copy: {
      heroSubtitle: 'Fine jewelry in solid gold and sterling silver, finished by hand.',
      heroCta: 'Explore jewelry',
      featuredTitle: 'New pieces',
    },
    sample: { heroTitle: 'Made to be treasured', announcement: 'Complimentary gift wrapping' },
    names: [
      'Aurum',
      'Gilded',
      'Heirloom',
      'Facet',
      'Lustre',
      'Carat',
      'Gemstone',
      'Solitaire',
      'Obsidian',
    ],
  },
  {
    id: 'sports',
    label: 'Sports & outdoors',
    body: 'geometric',
    heading: 'condensed',
    palettes: [
      p('#0f172a', '#dc2626', '#ffffff', '#f1f5f9', '#0f172a'),
      p('#1e3a8a', '#4d7c0f', '#ffffff', '#eef2ff', '#172554'),
      p('#18181b', '#ea580c', '#fafafa', '#e4e4e7', '#18181b'),
    ],
    copy: {
      heroSubtitle: 'Performance gear and apparel for training, running and the great outdoors.',
      heroCta: 'Gear up',
      featuredTitle: 'Trending now',
    },
    sample: { heroTitle: 'Built for the next rep', announcement: 'Free returns within 60 days' },
    names: [
      'Sprint',
      'Summit',
      'Endurance',
      'Stride',
      'Peak',
      'Trailhead',
      'Velocity',
      'Arena',
      'Blackout',
    ],
  },
  {
    id: 'kids',
    label: 'Kids & toys',
    body: 'rounded',
    heading: 'rounded',
    palettes: [
      p('#1d4ed8', '#d97706', '#fffef7', '#fef9c3', '#1e293b'),
      p('#be185d', '#0f766e', '#ffffff', '#fdf2f8', '#1f2937'),
      p('#15803d', '#dc2626', '#ffffff', '#ecfdf5', '#14532d'),
    ],
    copy: {
      heroSubtitle: 'Toys, clothes and gifts that spark curiosity: safe, sturdy and fun.',
      heroCta: 'Shop toys',
      featuredTitle: "Kids' favourites",
    },
    sample: { heroTitle: 'Made for play', announcement: 'Free gift wrap on every order' },
    names: [
      'Playtime',
      'Confetti',
      'Storybook',
      'Sunny',
      'Rainbow',
      'Doodle',
      'Toybox',
      'Balloon',
      'Starlight',
    ],
  },
  {
    id: 'books',
    label: 'Books & stationery',
    body: 'serif',
    heading: 'serif',
    palettes: [
      p('#3f2a1e', '#b91c1c', '#fdfaf3', '#f3ecdf', '#292017'),
      p('#1e293b', '#0369a1', '#ffffff', '#f1f5f9', '#1e293b'),
      p('#14532d', '#a16207', '#fcfcf7', '#eef2e6', '#1a2e05'),
    ],
    copy: {
      heroSubtitle: 'Books, notebooks and desk essentials for readers, writers and thinkers.',
      heroCta: 'Browse the shelves',
      featuredTitle: 'Staff picks',
    },
    sample: { heroTitle: 'Stories worth keeping', announcement: 'Free bookmark with every order' },
    names: [
      'Folio',
      'Chapter',
      'Margin',
      'Quill',
      'Paperback',
      'Ledger',
      'Inkwell',
      'Bookmark',
      'Nocturne',
    ],
  },
  {
    id: 'pets',
    label: 'Pet supplies',
    body: 'rounded',
    heading: 'rounded',
    palettes: [
      p('#78350f', '#0f766e', '#fffdf8', '#fdf4e3', '#292524'),
      p('#1e40af', '#ea580c', '#ffffff', '#eff6ff', '#1e293b'),
      p('#166534', '#e11d48', '#ffffff', '#f0fdf4', '#14532d'),
    ],
    copy: {
      heroSubtitle: 'Healthy food, cozy beds and toys your pets will actually use.',
      heroCta: 'Shop for your pet',
      featuredTitle: 'Most loved',
    },
    sample: {
      heroTitle: 'Happy pets, happy homes',
      announcement: 'Free delivery on orders over $40',
    },
    names: [
      'Pawprint',
      'Fetch',
      'Whiskers',
      'Burrow',
      'Wagtail',
      'Kennel',
      'Purr',
      'Bark',
      'Moonpaw',
    ],
  },
  {
    id: 'wellness',
    label: 'Health & wellness',
    body: 'humanist',
    heading: 'geometric',
    palettes: [
      p('#134e4a', '#047857', '#fbfdfc', '#e6f4ef', '#134e4a'),
      p('#3f3f46', '#7c3aed', '#ffffff', '#f5f3ff', '#27272a'),
      p('#44403c', '#0e7490', '#fdfcfb', '#f0ede8', '#292524'),
    ],
    copy: {
      heroSubtitle: 'Supplements, self-care and wellness essentials backed by science.',
      heroCta: 'Start your ritual',
      featuredTitle: 'Daily essentials',
    },
    sample: { heroTitle: 'Feel good, every day', announcement: 'Subscribe and save 15%' },
    names: ['Vital', 'Balance', 'Sage', 'Calm', 'Breathe', 'Aura', 'Remedy', 'Zen', 'Lunar'],
  },
  {
    id: 'art',
    label: 'Art & handmade',
    body: 'humanist',
    heading: 'geometric',
    palettes: [
      p('#1c1917', '#e11d48', '#ffffff', '#fafaf9', '#1c1917'),
      p('#312e81', '#b45309', '#fffefa', '#f4f1ea', '#1e1b4b'),
      p('#0f766e', '#db2777', '#ffffff', '#f0fdfa', '#134e4a'),
    ],
    copy: {
      heroSubtitle: 'Original prints, handmade goods and supplies for makers.',
      heroCta: 'Explore the studio',
      featuredTitle: 'Fresh from the studio',
    },
    sample: {
      heroTitle: 'Made by hand, made to inspire',
      announcement: 'Every order supports independent artists',
    },
    names: [
      'Canvas',
      'Palette',
      'Studio',
      'Easel',
      'Gallery',
      'Sketch',
      'Kiln',
      'Mosaic',
      'Charcoal',
    ],
  },
] as const satisfies readonly Industry[];

export type ThemeIndustryId = (typeof THEME_INDUSTRIES)[number]['id'];

type StyleTokens = Pick<
  ThemeSettings,
  | 'headerStyle'
  | 'cardStyle'
  | 'radius'
  | 'buttonStyle'
  | 'imageRatio'
  | 'gridColumns'
  | 'density'
  | 'footerStyle'
  | 'headingCase'
>;

interface Style {
  id: string;
  label: string;
  description: string;
  preset: ThemePreset;
  palette: 0 | 1 | 2;
  /** Overrides the industry's heading font. */
  headingFont?: ThemeFont;
  /** Light text on a near-black page. */
  dark?: boolean;
  tokens: Readonly<StyleTokens>;
}

export const THEME_STYLES = [
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Light and airy, with a soft hero panel and clean product cards',
    preset: 'minimal',
    palette: 0,
    tokens: {
      headerStyle: 'inline',
      cardStyle: 'plain',
      radius: 'medium',
      buttonStyle: 'solid',
      imageRatio: 'square',
      gridColumns: 4,
      density: 'comfortable',
      footerStyle: 'simple',
      headingCase: 'normal',
    },
  },
  {
    id: 'bold',
    label: 'Bold',
    description: 'A full-color hero, big type and punchy cards',
    preset: 'bold',
    palette: 2,
    headingFont: 'geometric',
    tokens: {
      headerStyle: 'inline',
      cardStyle: 'shadow',
      radius: 'large',
      buttonStyle: 'solid',
      imageRatio: 'square',
      gridColumns: 3,
      density: 'spacious',
      footerStyle: 'dark',
      headingCase: 'uppercase',
    },
  },
  {
    id: 'classic',
    label: 'Classic',
    description: 'Centered and editorial, with a centered logo and framed products',
    preset: 'classic',
    palette: 1,
    headingFont: 'serif',
    tokens: {
      headerStyle: 'centered',
      cardStyle: 'bordered',
      radius: 'small',
      buttonStyle: 'outline',
      imageRatio: 'portrait',
      gridColumns: 4,
      density: 'comfortable',
      footerStyle: 'columns',
      headingCase: 'normal',
    },
  },
  {
    id: 'split',
    label: 'Split',
    description: 'Headline beside a featured image, soft buttons and framed cards',
    preset: 'split',
    palette: 0,
    tokens: {
      headerStyle: 'inline',
      cardStyle: 'framed',
      radius: 'medium',
      buttonStyle: 'soft',
      imageRatio: 'portrait',
      gridColumns: 3,
      density: 'comfortable',
      footerStyle: 'columns',
      headingCase: 'normal',
    },
  },
  {
    id: 'fullbleed',
    label: 'Full bleed',
    description: 'An edge-to-edge hero, square corners and tall product images',
    preset: 'fullbleed',
    palette: 1,
    tokens: {
      headerStyle: 'stacked',
      cardStyle: 'plain',
      radius: 'none',
      buttonStyle: 'solid',
      imageRatio: 'portrait',
      gridColumns: 4,
      density: 'spacious',
      footerStyle: 'dark',
      headingCase: 'uppercase',
    },
  },
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Magazine-style typography with generous whitespace',
    preset: 'editorial',
    palette: 1,
    headingFont: 'serif',
    tokens: {
      headerStyle: 'centered',
      cardStyle: 'plain',
      radius: 'none',
      buttonStyle: 'outline',
      imageRatio: 'portrait',
      gridColumns: 3,
      density: 'spacious',
      footerStyle: 'columns',
      headingCase: 'normal',
    },
  },
  {
    id: 'catalog',
    label: 'Catalog',
    description: 'Products first: collection tiles and a dense five-column grid',
    preset: 'catalog',
    palette: 0,
    tokens: {
      headerStyle: 'inline',
      cardStyle: 'bordered',
      radius: 'small',
      buttonStyle: 'solid',
      imageRatio: 'square',
      gridColumns: 5,
      density: 'compact',
      footerStyle: 'columns',
      headingCase: 'normal',
    },
  },
  {
    id: 'banner',
    label: 'Banner',
    description: 'A gradient banner hero, rounded shapes and wide product images',
    preset: 'banner',
    palette: 2,
    tokens: {
      headerStyle: 'stacked',
      cardStyle: 'shadow',
      radius: 'large',
      buttonStyle: 'soft',
      imageRatio: 'landscape',
      gridColumns: 3,
      density: 'comfortable',
      footerStyle: 'simple',
      headingCase: 'normal',
    },
  },
  {
    id: 'noir',
    label: 'Noir',
    description: 'A dark, high-contrast look with captions over product images',
    preset: 'banner',
    palette: 0,
    dark: true,
    tokens: {
      headerStyle: 'centered',
      cardStyle: 'overlay',
      radius: 'small',
      buttonStyle: 'outline',
      imageRatio: 'portrait',
      gridColumns: 4,
      density: 'comfortable',
      footerStyle: 'dark',
      headingCase: 'uppercase',
    },
  },
] as const satisfies readonly Style[];

export type ThemeStyleId = (typeof THEME_STYLES)[number]['id'];

export interface ThemeTemplate {
  id: string;
  name: string;
  industry: ThemeIndustryId;
  industryLabel: string;
  style: ThemeStyleId;
  styleLabel: string;
  description: string;
  preset: ThemePreset;
  settings: ThemeSettings;
  /** Placeholder headline and announcement for previews only. */
  sample: { heroTitle: string; announcement: string };
}

function buildTemplate(industry: Industry, style: Style, index: number): ThemeTemplate {
  const palette = industry.palettes[style.palette];
  const dark = style.dark === true;
  const settings = themeSettingsSchema.parse({
    ...style.tokens,
    template: `${industry.id}-${style.id}`,
    brandColor: dark ? '#fafafa' : palette.brand,
    accentColor: palette.accent,
    backgroundColor: dark ? '#0b0b0e' : palette.background,
    surfaceColor: dark ? '#18181d' : palette.surface,
    textColor: dark ? '#ededf0' : palette.text,
    font: industry.body,
    headingFont: style.headingFont ?? industry.heading,
    ...industry.copy,
  });
  return {
    id: `${industry.id}-${style.id}`,
    name: industry.names[index] ?? `${industry.label} ${style.label}`,
    industry: industry.id as ThemeIndustryId,
    industryLabel: industry.label,
    style: style.id as ThemeStyleId,
    styleLabel: style.label,
    description: `${style.description}.`,
    preset: style.preset,
    settings,
    sample: industry.sample,
  };
}

/** Every template, grouped by industry then style (108 in all). */
export const THEME_TEMPLATES: readonly ThemeTemplate[] = THEME_INDUSTRIES.flatMap((industry) =>
  THEME_STYLES.map((style, index) => buildTemplate(industry, style, index)),
);

export function findThemeTemplate(id: string): ThemeTemplate | undefined {
  return THEME_TEMPLATES.find((t) => t.id === id);
}

/** The template a new store in this industry starts with. */
export function defaultTemplateFor(industry: string): ThemeTemplate | undefined {
  return findThemeTemplate(`${industry}-minimal`);
}

/** The look a template controls; everything else (sections, words, links) stays the merchant's. */
const DESIGN_FIELDS = [
  'template',
  'brandColor',
  'accentColor',
  'backgroundColor',
  'surfaceColor',
  'textColor',
  'font',
  'headingFont',
  'headingCase',
  'radius',
  'buttonStyle',
  'headerStyle',
  'cardStyle',
  'imageRatio',
  'gridColumns',
  'density',
  'footerStyle',
] as const satisfies readonly (keyof ThemeSettings)[];

/** Template copy used only where the merchant has not written their own. */
const COPY_FIELDS = ['heroSubtitle', 'heroCta', 'featuredTitle'] as const;

function isTemplateCopy(field: (typeof COPY_FIELDS)[number], value: string): boolean {
  return THEME_INDUSTRIES.some((industry) => industry.copy[field] === value);
}

/** The theme a store gets when it applies `template` over its current settings. */
export function applyThemeTemplate(
  template: ThemeTemplate,
  current: ThemeSettings,
): { preset: ThemePreset; settings: ThemeSettings } {
  const settings: ThemeSettings = { ...current };
  for (const field of DESIGN_FIELDS) {
    (settings as Record<string, unknown>)[field] = template.settings[field];
  }
  for (const field of COPY_FIELDS) {
    // Text that came from a template is not the merchant's own words, so it follows the new one.
    if (!current[field] || isTemplateCopy(field, current[field])) {
      settings[field] = template.settings[field];
    }
  }
  return { preset: template.preset, settings };
}

/**
 * Storefront query parameter that previews a template without saving it, e.g.
 * `/?theme_preview=fashion-bold` (`off` ends the preview). Only catalog ids are honoured.
 */
export const THEME_PREVIEW_PARAM = 'theme_preview';
