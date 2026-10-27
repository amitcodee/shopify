import { z } from 'zod';

/**
 * Shopper customizations ("personalisation"): inputs a product asks for on top of its variant,
 * such as engraving text, a gift-wrap checkbox or a choice of font. Each can add to the price.
 * Choices are stored on the cart line by customization id and resolved against the product's
 * current definitions, so the price and labels a shopper pays are always the merchant's latest.
 */

export const MAX_CUSTOMIZATIONS_PER_PRODUCT = 10;
export const MAX_CUSTOMIZATION_CHOICES = 30;

export const customizationTypeSchema = z.enum(['text', 'textarea', 'select', 'checkbox']);
export type CustomizationType = z.infer<typeof customizationTypeSchema>;

const moneyMinor = z.number().int().min(0).max(100_000_000);

export const customizationChoiceSchema = z.strictObject({
  label: z.string().trim().min(1, 'Name the choice').max(60),
  /** Added to the unit price when this choice is picked (minor units). */
  price: moneyMinor.default(0),
});
export type CustomizationChoice = z.infer<typeof customizationChoiceSchema>;

export const customizationIdSchema = z.string().regex(/^[a-z0-9-]{1,40}$/);

export const customizationInputSchema = z
  .strictObject({
    /** Keeps the field's identity across edits (carts refer to it); new fields omit it. */
    id: customizationIdSchema.optional(),
    type: customizationTypeSchema,
    label: z.string().trim().min(1, 'Name the field').max(60),
    required: z.boolean().default(false),
    helpText: z.string().trim().max(200).default(''),
    /** text/textarea: added when filled in; checkbox: added when ticked (minor units). */
    price: moneyMinor.default(0),
    /** Longest answer accepted (text and textarea; 0 means the default, 100). */
    maxLength: z.number().int().min(0).max(500).default(100),
    /** select: the options to pick from. */
    choices: z.array(customizationChoiceSchema).max(MAX_CUSTOMIZATION_CHOICES).default([]),
  })
  .superRefine((field, ctx) => {
    if (field.type === 'select') {
      if (field.choices.length < 2) {
        ctx.addIssue({ code: 'custom', path: ['choices'], message: 'Add at least two choices' });
      }
      const labels = field.choices.map((c) => c.label.toLowerCase());
      if (new Set(labels).size !== labels.length) {
        ctx.addIssue({ code: 'custom', path: ['choices'], message: 'Choices must be unique' });
      }
    }
  })
  .transform((field) => ({
    ...field,
    // Only the settings that apply to the type are kept.
    choices: field.type === 'select' ? field.choices : [],
    price: field.type === 'select' ? 0 : field.price,
    maxLength: field.type === 'text' || field.type === 'textarea' ? field.maxLength || 100 : 0,
  }));
export type CustomizationInput = z.input<typeof customizationInputSchema>;

export const customizationsInputSchema = z
  .array(customizationInputSchema)
  .max(
    MAX_CUSTOMIZATIONS_PER_PRODUCT,
    `Use at most ${MAX_CUSTOMIZATIONS_PER_PRODUCT} customization fields`,
  )
  .refine((fields) => new Set(fields.map((f) => f.label.toLowerCase())).size === fields.length, {
    message: 'Customization labels must be unique',
  })
  .refine(
    (fields) => {
      const ids = fields.flatMap((f) => (f.id ? [f.id] : []));
      return new Set(ids).size === ids.length;
    },
    { message: 'Customization ids must be unique' },
  );

export const customizationSchema = z.object({
  id: customizationIdSchema,
  type: customizationTypeSchema,
  label: z.string(),
  required: z.boolean(),
  helpText: z.string(),
  price: z.number().int(),
  maxLength: z.number().int(),
  choices: z.array(z.object({ label: z.string(), price: z.number().int() })),
});
export type Customization = z.infer<typeof customizationSchema>;

/** What a shopper entered: one value per customization id ("true" for a ticked checkbox). */
export const customizationSelectionSchema = z
  .array(z.strictObject({ id: customizationIdSchema, value: z.string().max(500) }))
  .max(MAX_CUSTOMIZATIONS_PER_PRODUCT)
  .default([]);
export type CustomizationSelection = z.input<typeof customizationSelectionSchema>;

/** A customization as sold: shown on the cart, order and packing slip. */
export const linePropertySchema = z.object({
  label: z.string(),
  value: z.string(),
  /** Added to the unit price (minor units, in the cart or order currency). */
  price: z.number().int(),
});
export type LineProperty = z.infer<typeof linePropertySchema>;

export type ResolvedCustomization =
  | {
      ok: true;
      /** Canonical choices (unknown ids and empty optional answers dropped). */
      selection: { id: string; value: string }[];
      properties: LineProperty[];
      /** Sum of the property prices. */
      extra: number;
      /** Stable key for the choices ("" for none): equal choices share a cart line. */
      key: string;
    }
  | { ok: false; error: string };

/**
 * Checks a shopper's answers against the product's customizations and prices them. Line breaks
 * are only kept for textarea answers; answers are trimmed.
 */
export function resolveCustomization(
  fields: readonly Customization[],
  selection: readonly { id: string; value: string }[],
): ResolvedCustomization {
  const answers = new Map(selection.map((s) => [s.id, s.value]));
  const canonical: { id: string; value: string }[] = [];
  const properties: LineProperty[] = [];
  for (const field of fields) {
    const raw = answers.get(field.id) ?? '';
    switch (field.type) {
      case 'text':
      case 'textarea': {
        const value =
          field.type === 'text'
            ? raw.replace(/[\r\n]+/g, ' ').trim()
            : raw.replace(/\r\n/g, '\n').trim();
        if (value === '') {
          if (field.required) return { ok: false, error: `Enter ${field.label.toLowerCase()}.` };
          continue;
        }
        if (value.length > field.maxLength) {
          return {
            ok: false,
            error: `${field.label} can be at most ${field.maxLength} characters.`,
          };
        }
        canonical.push({ id: field.id, value });
        properties.push({ label: field.label, value, price: field.price });
        break;
      }
      case 'select': {
        const value = raw.trim();
        if (value === '') {
          if (field.required) return { ok: false, error: `Choose ${field.label.toLowerCase()}.` };
          continue;
        }
        const choice = field.choices.find((c) => c.label === value);
        if (!choice) return { ok: false, error: `Choose a valid ${field.label.toLowerCase()}.` };
        canonical.push({ id: field.id, value: choice.label });
        properties.push({ label: field.label, value: choice.label, price: choice.price });
        break;
      }
      case 'checkbox': {
        const checked = raw === 'true';
        if (!checked) {
          if (field.required) return { ok: false, error: `${field.label} is required.` };
          continue;
        }
        canonical.push({ id: field.id, value: 'true' });
        properties.push({ label: field.label, value: 'Yes', price: field.price });
        break;
      }
    }
  }
  return {
    ok: true,
    selection: canonical,
    properties,
    extra: properties.reduce((sum, p) => sum + p.price, 0),
    key: canonical.length === 0 ? '' : JSON.stringify(canonical.map((c) => [c.id, c.value])),
  };
}

/** Reads stored customization definitions, skipping anything malformed. */
export function parseCustomizations(value: unknown): Customization[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = customizationSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Reads stored line properties, skipping anything malformed. */
export function parseLineProperties(value: unknown): LineProperty[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = linePropertySchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}
