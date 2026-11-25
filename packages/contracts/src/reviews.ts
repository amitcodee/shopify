import { z } from 'zod';

/**
 * Product reviews: written by customers who bought the product (signed in, with a paid order
 * holding it), shown once the merchant publishes them (or at once when the store publishes
 * automatically). One review per customer and product; editing it replaces it.
 */

export const REVIEW_STATUSES = ['PENDING', 'PUBLISHED', 'REJECTED'] as const;
export const reviewStatusSchema = z.enum(REVIEW_STATUSES);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

const text = (min: number, max: number, message: string) =>
  z.string().trim().min(min, message).max(max);

export const reviewInputSchema = z.strictObject({
  rating: z.number().int().min(1, 'Choose 1 to 5 stars').max(5, 'Choose 1 to 5 stars'),
  title: z
    .string()
    .trim()
    .max(150)
    .optional()
    .transform((v) => v || null),
  body: text(10, 5000, 'Write at least a sentence (10 characters)'),
  /** Shown with the review; defaults to the first name and initial. */
  authorName: text(1, 80, 'Enter the name to show'),
});
export type ReviewInput = z.input<typeof reviewInputSchema>;

/** Average to one decimal and how many published reviews; null when there are none. */
export const ratingSchema = z.object({ average: z.number(), count: z.number().int() });
export type Rating = z.infer<typeof ratingSchema>;

/** From the counters kept on the product. */
export function ratingOf(count: number, sum: number): Rating | null {
  return count > 0 ? { average: Math.round((sum / count) * 10) / 10, count } : null;
}

/** Photos a reviewer can add; uploads larger than this are refused. */
export const MAX_REVIEW_PHOTOS = 3;
export const MAX_REVIEW_PHOTO_BYTES = 5 * 1024 * 1024;

export const reviewPhotoSchema = z.object({
  id: z.uuid(),
  /** Full size (at most 1200 px wide). */
  url: z.string(),
  /** About 600 px wide, for the list. */
  thumbUrl: z.string(),
  width: z.number().int(),
  height: z.number().int(),
});
export type ReviewPhoto = z.infer<typeof reviewPhotoSchema>;

export const publicReviewSchema = z.object({
  id: z.uuid(),
  rating: z.number().int(),
  title: z.string().nullable(),
  body: z.string(),
  authorName: z.string(),
  /** When it was published. */
  date: z.iso.datetime(),
  reply: z.string().nullable(),
  /** Signed-in customers who found it helpful. */
  helpfulCount: z.number().int(),
  photos: z.array(reviewPhotoSchema),
});
export type PublicReview = z.infer<typeof publicReviewSchema>;

export const REVIEWS_PAGE_SIZE = 10;

export const REVIEW_SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'helpful', label: 'Most helpful' },
  { value: 'highest', label: 'Highest rating' },
  { value: 'lowest', label: 'Lowest rating' },
] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number]['value'];

/** Query of GET /storefront/products/:handle/reviews; unknown values fall back to defaults. */
export const productReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).catch(1).default(1),
  sort: z.enum(['newest', 'helpful', 'highest', 'lowest']).catch('newest').default('newest'),
  /** Only reviews with this many stars. */
  stars: z.coerce.number().int().min(1).max(5).optional().catch(undefined),
});
export type ProductReviewsQuery = z.infer<typeof productReviewsQuerySchema>;

/** PUT …/reviews/:reviewId/helpful */
export const reviewHelpfulInputSchema = z.strictObject({ helpful: z.boolean() });
export const reviewHelpfulSchema = z.object({
  helpfulCount: z.number().int(),
  helpful: z.boolean(),
});
export type ReviewHelpful = z.infer<typeof reviewHelpfulSchema>;

/** GET /storefront/products/:handle/reviews */
export const productReviewsSchema = z.object({
  rating: ratingSchema.nullable(),
  /** Published reviews per star, index 0 = 5 stars … index 4 = 1 star. */
  distribution: z.array(z.number().int()).length(5),
  items: z.array(publicReviewSchema),
  page: z.number().int(),
  pageCount: z.number().int(),
  sort: z.enum(['newest', 'helpful', 'highest', 'lowest']),
  /** The star filter applied, if any. */
  stars: z.number().int().nullable(),
  /** Published reviews matching the filter. */
  total: z.number().int(),
});
export type ProductReviews = z.infer<typeof productReviewsSchema>;

/** GET /storefront/products/:handle/reviews/mine: whether the signed-in customer may review. */
export const myReviewSchema = z.object({
  canReview: z.boolean(),
  /** Why not (not signed in, not bought yet), when canReview is false. */
  reason: z.string().nullable(),
  /** Suggested public name (first name and last initial). */
  suggestedName: z.string(),
  review: z
    .object({
      id: z.uuid(),
      rating: z.number().int(),
      title: z.string().nullable(),
      body: z.string(),
      authorName: z.string(),
      status: reviewStatusSchema,
      photos: z.array(reviewPhotoSchema),
    })
    .nullable(),
  /** This product's reviews the customer marked helpful. */
  helpfulReviewIds: z.array(z.uuid()),
});
export type MyReview = z.infer<typeof myReviewSchema>;

export const adminReviewSchema = z.object({
  id: z.uuid(),
  status: reviewStatusSchema,
  rating: z.number().int(),
  title: z.string().nullable(),
  body: z.string(),
  authorName: z.string(),
  reply: z.string().nullable(),
  helpfulCount: z.number().int(),
  photos: z.array(reviewPhotoSchema),
  product: z.object({ id: z.uuid(), title: z.string(), handle: z.string() }),
  customer: z.object({ id: z.uuid(), email: z.string() }),
  order: z.object({ id: z.uuid(), number: z.number().int() }),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  publishedAt: z.iso.datetime().nullable(),
});
export type AdminReview = z.infer<typeof adminReviewSchema>;

export const adminReviewQuerySchema = z.object({
  status: reviewStatusSchema.optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export const reviewReplyInputSchema = z.strictObject({
  /** Empty removes the reply. */
  reply: z.string().trim().max(2000),
});

/** "Asha Rao" -> "Asha R."; one word stays as it is. */
export function reviewerName(name: string | null | undefined, email: string): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return email.split('@')[0]?.slice(0, 40) || 'Customer';
  const [first, ...rest] = words;
  const last = rest.at(-1);
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : (first ?? 'Customer');
}
