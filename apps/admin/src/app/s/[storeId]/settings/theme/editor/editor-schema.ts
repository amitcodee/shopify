import type { HomeSection, ThemeSettings } from '@repo/contracts';
import type { IconName } from '@/components/icons';
import {
  BUTTON_OPTIONS,
  CARD_OPTIONS,
  CART_STYLE_OPTIONS,
  COLUMN_OPTIONS,
  DENSITY_OPTIONS,
  FONT_OPTIONS,
  FOOTER_OPTIONS,
  HEADER_OPTIONS,
  HEADING_CASE_OPTIONS,
  IMAGE_RATIO_OPTIONS,
  MOTION_OPTIONS,
  PRESET_OPTIONS,
  RADIUS_OPTIONS,
} from '@/lib/theme-options';

/** Keys of theme settings by value type, so each control only binds to matching fields. */
type KeysOf<V> = {
  [K in keyof ThemeSettings]: ThemeSettings[K] extends V ? K : never;
}[keyof ThemeSettings];

export type EditorField =
  | { type: 'text'; key: KeysOf<string>; label: string; max: number; placeholder?: string }
  | { type: 'textarea'; key: KeysOf<string>; label: string; max: number; placeholder?: string }
  | { type: 'toggle'; key: KeysOf<boolean>; label: string; help?: string }
  | { type: 'color'; key: KeysOf<string>; label: string }
  | {
      type: 'select';
      key: KeysOf<string>;
      label: string;
      options: { value: string; label: string }[];
    }
  | { type: 'columns'; key: 'gridColumns'; label: string }
  | { type: 'preset'; label: string };

export interface EditorSection {
  label: string;
  icon: IconName;
  /** Turns the section on and off (eye button); sections without one are always shown. */
  visibility?: KeysOf<boolean>;
  fields: EditorField[];
}

export type SectionId = 'announcement' | 'header' | 'hero' | HomeSection | 'footer';

export const SECTIONS: Record<SectionId, EditorSection> = {
  announcement: {
    label: 'Announcement bar',
    icon: 'info',
    fields: [
      {
        type: 'text',
        key: 'announcement',
        label: 'Message',
        max: 120,
        placeholder: 'Leave empty to hide the bar',
      },
    ],
  },
  header: {
    label: 'Header',
    icon: 'menu',
    fields: [
      { type: 'select', key: 'headerStyle', label: 'Layout', options: HEADER_OPTIONS },
      { type: 'toggle', key: 'stickyHeader', label: 'Stay visible while scrolling' },
      {
        type: 'select',
        key: 'cartStyle',
        label: 'Adding to cart opens',
        options: CART_STYLE_OPTIONS,
      },
    ],
  },
  hero: {
    label: 'Hero',
    icon: 'image',
    fields: [
      { type: 'preset', label: 'Homepage layout' },
      { type: 'text', key: 'heroTitle', label: 'Heading', max: 80, placeholder: 'Your store name' },
      { type: 'textarea', key: 'heroSubtitle', label: 'Text', max: 200 },
      { type: 'text', key: 'heroCta', label: 'Button label', max: 30, placeholder: 'Shop now' },
    ],
  },
  trustBar: {
    label: 'Trust bar',
    icon: 'checkCircle',
    visibility: 'showTrustBar',
    fields: [
      { type: 'text', key: 'trustItem1', label: 'First item', max: 40 },
      { type: 'text', key: 'trustItem2', label: 'Second item', max: 40 },
      { type: 'text', key: 'trustItem3', label: 'Third item', max: 40 },
    ],
  },
  collections: {
    label: 'Featured collections',
    icon: 'collections',
    visibility: 'showCollections',
    fields: [],
  },
  featuredProducts: {
    label: 'Latest products',
    icon: 'products',
    visibility: 'showFeatured',
    fields: [
      { type: 'text', key: 'featuredTitle', label: 'Heading', max: 40, placeholder: 'New in' },
      { type: 'columns', key: 'gridColumns', label: 'Products per row' },
    ],
  },
  carousels: {
    label: 'Collection carousels',
    icon: 'layers',
    visibility: 'showCollectionCarousels',
    fields: [],
  },
  brandStory: {
    label: 'Brand story',
    icon: 'pencil',
    visibility: 'showBrandStory',
    fields: [
      { type: 'text', key: 'brandStoryTitle', label: 'Heading', max: 80 },
      { type: 'textarea', key: 'brandStoryText', label: 'Story', max: 600 },
    ],
  },
  blogPosts: {
    label: 'Blog posts',
    icon: 'inbox',
    visibility: 'showBlogPosts',
    fields: [],
  },
  newsletter: {
    label: 'Newsletter sign-up',
    icon: 'inbox',
    visibility: 'showNewsletter',
    fields: [
      { type: 'text', key: 'newsletterTitle', label: 'Heading', max: 80 },
      { type: 'textarea', key: 'newsletterText', label: 'Text', max: 200 },
    ],
  },
  footer: {
    label: 'Footer',
    icon: 'menu',
    fields: [
      { type: 'select', key: 'footerStyle', label: 'Style', options: FOOTER_OPTIONS },
      {
        type: 'text',
        key: 'socialInstagram',
        label: 'Instagram',
        max: 200,
        placeholder: 'https://',
      },
      { type: 'text', key: 'socialFacebook', label: 'Facebook', max: 200, placeholder: 'https://' },
      { type: 'text', key: 'socialX', label: 'X', max: 200, placeholder: 'https://' },
      { type: 'text', key: 'socialYoutube', label: 'YouTube', max: 200, placeholder: 'https://' },
      { type: 'text', key: 'socialTiktok', label: 'TikTok', max: 200, placeholder: 'https://' },
    ],
  },
};

/** Help shown for sections whose content comes from elsewhere in the admin. */
export const SECTION_NOTES: Partial<
  Record<SectionId, { text: string; href: string; link: string }>
> = {
  collections: {
    text: 'Shows up to six of your published collections.',
    href: 'collections',
    link: 'Manage collections',
  },
  carousels: {
    text: 'A row of products for each of your first three collections.',
    href: 'collections',
    link: 'Manage collections',
  },
  blogPosts: {
    text: 'Your three latest blog posts.',
    href: 'online-store/blog',
    link: 'Write a post',
  },
  featuredProducts: {
    text: 'Your most recently published products.',
    href: 'products',
    link: 'Manage products',
  },
};

/** Global theme settings, grouped like the theme settings panel. */
export const THEME_GROUPS: { title: string; fields: EditorField[] }[] = [
  {
    title: 'Colors',
    fields: [
      { type: 'color', key: 'brandColor', label: 'Brand' },
      { type: 'color', key: 'accentColor', label: 'Accent' },
      { type: 'color', key: 'backgroundColor', label: 'Background' },
      { type: 'color', key: 'surfaceColor', label: 'Cards & panels' },
      { type: 'color', key: 'textColor', label: 'Text' },
    ],
  },
  {
    title: 'Typography',
    fields: [
      { type: 'select', key: 'font', label: 'Body font', options: FONT_OPTIONS },
      { type: 'select', key: 'headingFont', label: 'Heading font', options: FONT_OPTIONS },
      { type: 'select', key: 'headingCase', label: 'Heading case', options: HEADING_CASE_OPTIONS },
    ],
  },
  {
    title: 'Layout',
    fields: [
      { type: 'preset', label: 'Homepage layout' },
      { type: 'select', key: 'density', label: 'Spacing', options: DENSITY_OPTIONS },
      { type: 'select', key: 'radius', label: 'Corner radius', options: RADIUS_OPTIONS },
      { type: 'select', key: 'motion', label: 'Animations', options: MOTION_OPTIONS },
    ],
  },
  {
    title: 'Buttons & product cards',
    fields: [
      { type: 'select', key: 'buttonStyle', label: 'Buttons', options: BUTTON_OPTIONS },
      { type: 'select', key: 'cardStyle', label: 'Product cards', options: CARD_OPTIONS },
      { type: 'select', key: 'imageRatio', label: 'Image shape', options: IMAGE_RATIO_OPTIONS },
      { type: 'columns', key: 'gridColumns', label: 'Products per row' },
    ],
  },
];

export const PRESETS = PRESET_OPTIONS;
export const COLUMNS = COLUMN_OPTIONS;

/** Pages the preview can show. */
export const PREVIEW_PAGES = [
  { label: 'Home page', path: '/' },
  { label: 'Collection', path: '/collections/all' },
  { label: 'Cart', path: '/cart' },
] as const;

/** Ideas offered in the AI box. */
export const AI_IDEAS = [
  'Make it dark and luxurious',
  'Use a warm, earthy color palette',
  'More minimal, with more white space',
  'Write a punchier hero heading and text',
  'Make it playful and colorful for kids',
];
