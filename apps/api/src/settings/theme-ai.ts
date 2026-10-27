import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import {
  HOME_SECTIONS,
  THEME_BUTTON_STYLES,
  THEME_CARD_STYLES,
  THEME_CART_STYLES,
  THEME_DENSITIES,
  THEME_MOTIONS,
  THEME_FONTS,
  THEME_FOOTER_STYLES,
  THEME_HEADER_STYLES,
  THEME_HEADING_CASES,
  THEME_IMAGE_RATIOS,
  THEME_PRESETS,
  THEME_RADII,
  type Theme,
} from '@repo/contracts';
import { z } from 'zod';

/**
 * What the model returns: a summary plus every editable setting, null meaning "leave as is".
 * Types only — values are validated against themeSettingsSchema before they are used.
 */
const str = z.string().nullable();
const bool = z.boolean().nullable();
export const themeAiOutputSchema = z.object({
  summary: z.string(),
  preset: z.enum(THEME_PRESETS).nullable(),
  changes: z.object({
    brandColor: str,
    accentColor: str,
    backgroundColor: str,
    surfaceColor: str,
    textColor: str,
    font: z.enum(THEME_FONTS).nullable(),
    headingFont: z.enum(THEME_FONTS).nullable(),
    headingCase: z.enum(THEME_HEADING_CASES).nullable(),
    radius: z.enum(THEME_RADII).nullable(),
    buttonStyle: z.enum(THEME_BUTTON_STYLES).nullable(),
    headerStyle: z.enum(THEME_HEADER_STYLES).nullable(),
    cardStyle: z.enum(THEME_CARD_STYLES).nullable(),
    imageRatio: z.enum(THEME_IMAGE_RATIOS).nullable(),
    gridColumns: z.number().int().nullable(),
    density: z.enum(THEME_DENSITIES).nullable(),
    motion: z.enum(THEME_MOTIONS).nullable(),
    footerStyle: z.enum(THEME_FOOTER_STYLES).nullable(),
    cartStyle: z.enum(THEME_CART_STYLES).nullable(),
    stickyHeader: bool,
    heroTitle: str,
    heroSubtitle: str,
    heroCta: str,
    featuredTitle: str,
    announcement: str,
    sectionOrder: z.array(z.enum(HOME_SECTIONS)).nullable(),
    showTrustBar: bool,
    showCollections: bool,
    showFeatured: bool,
    showCollectionCarousels: bool,
    showBrandStory: bool,
    showBlogPosts: bool,
    showNewsletter: bool,
    trustItem1: str,
    trustItem2: str,
    trustItem3: str,
    brandStoryTitle: str,
    brandStoryText: str,
    newsletterTitle: str,
    newsletterText: str,
  }),
});
export type ThemeAiOutput = z.output<typeof themeAiOutputSchema>;

/** The model behind "Ask AI"; injectable so tests never call the real API. */
export interface ThemeAiClient {
  suggest(prompt: string, theme: Theme, storeName: string): Promise<ThemeAiOutput | null>;
}
export const THEME_AI_CLIENT = Symbol('THEME_AI_CLIENT');

const SYSTEM_PROMPT = `You are the design assistant inside an online-store theme editor. A merchant describes a change in plain words; you return new values for the store's theme settings.

How the theme works:
- Colors are 6-digit hex values. brandColor is the main brand color (header logo, primary buttons), accentColor is used for highlights and sale prices, backgroundColor is the page, surfaceColor is cards and raised panels, textColor is body text.
- Keep text readable: textColor on backgroundColor and on surfaceColor needs a contrast ratio of at least 4.5:1. For dark themes use a dark backgroundColor with a light textColor.
- preset is the homepage layout: minimal, bold, classic, split, fullbleed, editorial, catalog, banner.
- font and headingFont are system font families: system, serif, rounded, mono, slab, humanist, geometric, condensed.
- radius: none, small, medium, large, pill. buttonStyle: solid, outline, soft. headerStyle: inline, centered, stacked. cardStyle: plain, bordered, shadow, overlay, framed. imageRatio: square, portrait, landscape. density: compact, comfortable, spacious. motion (animations): off, subtle, lively. footerStyle: simple, columns, dark. headingCase: normal, uppercase. gridColumns: 2 to 5. cartStyle: drawer or page.
- sectionOrder lists the homepage sections after the hero: trustBar, collections, featuredProducts, carousels, brandStory, blogPosts, newsletter. The show* flags hide or show them.
- Text limits: heroTitle 80 characters, heroSubtitle 200, heroCta 30, featuredTitle 40, announcement 120, trust items 40, brandStoryTitle 80, brandStoryText 600, newsletterTitle 80, newsletterText 200.

Rules:
- Change only what the request is about; return null for every setting that should stay the same.
- Write any text in the same language as the store's existing text, in the store's voice.
- Never invent facts about the business (prices, shipping terms, discounts, awards, guarantees) unless the merchant states them.
- summary: one or two short sentences telling the merchant what you changed. If the request asks for something the theme cannot do (custom code, new section types, uploading images), make the closest change you can and say what is not possible.`;

export class AnthropicThemeAiClient implements ThemeAiClient {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async suggest(prompt: string, theme: Theme, storeName: string): Promise<ThemeAiOutput | null> {
    const response = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: 16000,
      // Route a safety decline to a fallback model instead of failing the request.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(themeAiOutputSchema) },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Store: ${storeName}\n\nCurrent theme:\n${JSON.stringify(theme, null, 2)}\n\nRequest: ${prompt}`,
        },
      ],
    });
    if (response.stop_reason === 'refusal') return null;
    return response.parsed_output ?? null;
  }
}
