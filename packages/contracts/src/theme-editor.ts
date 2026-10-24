import { z } from 'zod';
import { themeInputSchema } from './settings.js';

/** The unpublished theme being edited in the theme editor (null when there is none). */
export const themeDraftSchema = z.object({
  preset: themeInputSchema.shape.preset,
  settings: themeInputSchema.shape.settings,
  updatedAt: z.iso.datetime(),
});
export type ThemeDraft = z.output<typeof themeDraftSchema>;

/** A short-lived signed token that lets the editor's preview frame render the draft. */
export const themePreviewTokenSchema = z.object({
  token: z.string(),
  expiresAt: z.iso.datetime(),
});
export type ThemePreviewToken = z.output<typeof themePreviewTokenSchema>;

/** Query parameter (and cookie) carrying a preview token to the storefront. */
export const THEME_DRAFT_PARAM = 'theme_draft';
/** Request header the storefront forwards the preview token to the API in. */
export const THEME_DRAFT_HEADER = 'x-theme-draft';

/** "Ask AI" in the theme editor: a request in plain words, applied to the current draft. */
export const themeAiInputSchema = z.strictObject({
  prompt: z.string().trim().min(3).max(500),
  theme: themeInputSchema,
});
export type ThemeAiInput = z.input<typeof themeAiInputSchema>;

export const themeAiResultSchema = z.object({
  /** What was changed, in a sentence or two, for the merchant. */
  summary: z.string(),
  theme: themeInputSchema,
  /** Setting keys that changed (plus "preset"). */
  changed: z.array(z.string()),
});
export type ThemeAiResult = z.output<typeof themeAiResultSchema>;

/** Messages between the theme editor and the storefront preview frame (postMessage). */
export type PreviewMessage =
  | { source: 'cp-editor'; type: 'refresh' }
  | { source: 'cp-editor'; type: 'select'; section: string }
  | { source: 'cp-preview'; type: 'ready' }
  | { source: 'cp-preview'; type: 'section'; section: string };
