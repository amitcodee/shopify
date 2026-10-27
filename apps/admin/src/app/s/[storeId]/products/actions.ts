'use server';

import type { InventoryItem, Product } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { type FormState, toFormState } from '@/lib/form';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export async function saveProductAction(
  storeId: string,
  productId: string | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get('payload') ?? '{}'));
  } catch {
    return { error: 'Could not read the form. Reload and try again.' };
  }

  let saved: Product;
  try {
    saved = productId
      ? await api<Product>(`/admin/stores/${storeId}/products/${productId}`, {
          method: 'PUT',
          body: payload,
        })
      : await api<Product>(`/admin/stores/${storeId}/products`, { method: 'POST', body: payload });
  } catch (error) {
    return toFormState(error);
  }

  revalidatePath(`/s/${storeId}/products`);
  if (!productId) redirect(`/s/${storeId}/products/${saved.id}?created=1`);
  // The editor remounts with the saved product, so confirm through the URL.
  redirect(`/s/${storeId}/products/${productId}?saved=1`);
}

export async function deleteProductAction(storeId: string, productId: string): Promise<void> {
  await api(`/admin/stores/${storeId}/products/${productId}`, { method: 'DELETE' });
  revalidatePath(`/s/${storeId}/products`);
  redirect(`/s/${storeId}/products`);
}

/** Result of a media or bulk action called directly from a client component. */
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

/** Turns an API failure into a sentence a merchant can act on. */
function failure(error: unknown, fallback = 'Something went wrong. Try again.'): ActionResult {
  if (!(error instanceof ApiError)) throw error;
  const detail = error.problem.errors?.[0]?.message ?? error.problem.detail;
  switch (error.status) {
    case 409:
      return { ok: false, error: detail ?? 'A product can have at most 50 images.' };
    case 413:
      return {
        ok: false,
        error: 'That image is too large. Use files up to 20 MB and 50 megapixels.',
      };
    case 415:
      return {
        ok: false,
        error: 'That file type is not supported. Use JPEG, PNG, WebP, GIF or AVIF.',
      };
    case 422:
      return {
        ok: false,
        error: 'An image could not be read. It may be damaged; try exporting it again.',
      };
    default:
      return { ok: false, error: detail ?? fallback };
  }
}

const productPath = (storeId: string, productId: string) =>
  `/admin/stores/${storeId}/products/${productId}`;

/**
 * Uploads up to 10 images in one request (all-or-nothing). Accepts `files` (multiple) and the
 * older single `file` field, plus optional `alt` applied to every image.
 */
export async function uploadImagesAction(
  storeId: string,
  productId: string,
  formData: FormData,
): Promise<ActionResult> {
  const files = [...formData.getAll('files'), ...formData.getAll('file')].filter(
    (f): f is File => f instanceof File && f.size > 0,
  );
  if (files.length === 0) return { ok: false, error: 'Choose at least one image.' };
  if (files.length > 10) return { ok: false, error: 'Upload at most 10 images at a time.' };
  const tooBig = files.find((f) => f.size > MAX_IMAGE_BYTES);
  if (tooBig) return { ok: false, error: `${tooBig.name} is larger than 20 MB.` };

  const body = new FormData();
  for (const file of files) body.append('files', file, file.name);
  const alt = String(formData.get('alt') ?? '').trim();
  if (alt) body.set('alt', alt);
  try {
    await api(`${productPath(storeId, productId)}/images`, { method: 'POST', body });
  } catch (error) {
    return failure(error, 'The images could not be uploaded.');
  }
  revalidatePath(`/s/${storeId}/products/${productId}`);
  return {
    ok: true,
    message: files.length === 1 ? 'Image uploaded.' : `${files.length} images uploaded.`,
  };
}

export async function importImageAction(
  storeId: string,
  productId: string,
  url: string,
  alt: string,
): Promise<ActionResult> {
  const trimmed = url.trim();
  if (!/^https:\/\//i.test(trimmed)) {
    return { ok: false, error: 'Enter a full https:// link to an image.' };
  }
  try {
    await api(`${productPath(storeId, productId)}/images/import`, {
      method: 'POST',
      body: { url: trimmed, alt: alt.trim() || undefined },
    });
  } catch (error) {
    return failure(error, 'The image could not be imported.');
  }
  revalidatePath(`/s/${storeId}/products/${productId}`);
  return { ok: true, message: 'Image added.' };
}

export async function reorderImagesAction(
  storeId: string,
  productId: string,
  imageIds: string[],
): Promise<ActionResult> {
  try {
    await api(`${productPath(storeId, productId)}/images/order`, {
      method: 'PUT',
      body: { imageIds },
    });
  } catch (error) {
    return failure(error, 'The new order could not be saved.');
  }
  revalidatePath(`/s/${storeId}/products/${productId}`);
  return { ok: true, message: 'Order saved.' };
}

export async function updateImageAltAction(
  storeId: string,
  productId: string,
  imageId: string,
  alt: string,
): Promise<ActionResult> {
  try {
    await api(`${productPath(storeId, productId)}/images/${imageId}`, {
      method: 'PATCH',
      body: { alt: alt.trim() },
    });
  } catch (error) {
    return failure(error, 'The alt text could not be saved.');
  }
  revalidatePath(`/s/${storeId}/products/${productId}`);
  return { ok: true, message: 'Alt text saved.' };
}

export async function deleteImageAction(
  storeId: string,
  productId: string,
  imageId: string,
): Promise<ActionResult> {
  try {
    await api(`${productPath(storeId, productId)}/images/${imageId}`, { method: 'DELETE' });
  } catch (error) {
    return failure(error, 'The image could not be deleted.');
  }
  revalidatePath(`/s/${storeId}/products/${productId}`);
  return { ok: true, message: 'Image deleted.' };
}

export async function setVariantImageAction(
  storeId: string,
  productId: string,
  variantId: string,
  imageId: string | null,
): Promise<ActionResult> {
  try {
    await api(`${productPath(storeId, productId)}/variants/${variantId}`, {
      method: 'PATCH',
      body: { imageId },
    });
  } catch (error) {
    return failure(error, 'The variant image could not be changed.');
  }
  revalidatePath(`/s/${storeId}/products/${productId}`);
  return { ok: true };
}

export type BulkProductAction =
  'activate' | 'draft' | 'archive' | 'delete' | 'add_tags' | 'remove_tags';

const BULK_DONE: Record<BulkProductAction, string> = {
  activate: 'set as active',
  draft: 'set as draft',
  archive: 'archived',
  delete: 'deleted',
  add_tags: 'tagged',
  remove_tags: 'untagged',
};

export async function bulkProductsAction(
  storeId: string,
  productIds: string[],
  action: BulkProductAction,
  tags?: string[],
): Promise<ActionResult> {
  if (productIds.length === 0) return { ok: false, error: 'Select at least one product.' };
  if (productIds.length > 100) return { ok: false, error: 'Select at most 100 products.' };
  if ((action === 'add_tags' || action === 'remove_tags') && !tags?.length) {
    return { ok: false, error: 'Enter at least one tag.' };
  }
  let count: number;
  try {
    ({ count } = await api<{ count: number }>(`/admin/stores/${storeId}/products/bulk`, {
      method: 'POST',
      body: { productIds, action, tags },
    }));
  } catch (error) {
    return failure(error, 'The bulk action failed. Nothing was changed.');
  }
  revalidatePath(`/s/${storeId}/products`);
  return {
    ok: true,
    message: `${count} product${count === 1 ? '' : 's'} ${BULK_DONE[action]}.`,
  };
}

/**
 * Copies a product as a new draft: same details, options, variants and prices. SKUs must stay
 * unique and stock belongs to the original, so the copy starts with no SKUs and no stock.
 * Costs, customs details and custom fields carry over; images do not.
 */
export async function duplicateProductAction(
  storeId: string,
  productId: string,
  _: FormState,
): Promise<FormState> {
  let copy: Product;
  try {
    const p = await api<Product>(`/admin/stores/${storeId}/products/${productId}`);
    copy = await api<Product>(`/admin/stores/${storeId}/products`, {
      method: 'POST',
      body: {
        title: `Copy of ${p.title}`.slice(0, 200),
        description: p.description,
        status: 'DRAFT',
        vendor: p.vendor,
        productType: p.productType,
        tags: p.tags,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        isGiftCard: p.isGiftCard,
        isBundle: p.isBundle,
        supplierId: p.supplierId,
        // New field ids: carts of the original refer to its own.
        customizations: p.customizations.map(({ id: _id, ...field }) => field),
        options: p.options,
        variants: p.variants.map((v) => ({
          options: v.options,
          barcode: v.barcode,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          costPerItem: v.costPerItem,
          countryOfOrigin: v.countryOfOrigin,
          hsCode: v.hsCode,
          weightGrams: v.weightGrams,
          requiresShipping: v.requiresShipping,
          taxable: v.taxable,
          trackInventory: v.trackInventory,
          allowBackorder: v.allowBackorder,
          ...(p.isBundle && {
            components: v.components.map((c) => ({ variantId: c.variantId, quantity: c.quantity })),
          }),
        })),
        metafields: p.metafields.map((m) => ({
          namespace: m.namespace,
          key: m.key,
          type: m.type,
          value: m.value,
          showOnStorefront: m.showOnStorefront,
        })),
      },
    });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(`/s/${storeId}/products`);
  redirect(`/s/${storeId}/products/${copy.id}?duplicated=1`);
}

/** A variant a bundle can contain (picked in the product editor). */
export interface VariantPick {
  variantId: string;
  productId: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  price: number;
  costPerItem: number | null;
  inventoryQuantity: number;
  trackInventory: boolean;
}

/** Searches the store's sellable variants by product title or SKU (bundles excluded). */
export async function searchVariantsAction(storeId: string, query: string): Promise<VariantPick[]> {
  const params = new URLSearchParams({ pageSize: '20' });
  if (query.trim()) params.set('q', query.trim().slice(0, 100));
  const page = await api<{ items: InventoryItem[] }>(
    `/admin/stores/${storeId}/inventory?${params}`,
  );
  return page.items.map((i) => ({
    variantId: i.variantId,
    productId: i.productId,
    productTitle: i.productTitle,
    variantTitle: i.variantTitle,
    sku: i.sku,
    price: i.price,
    costPerItem: i.costPerItem,
    inventoryQuantity: i.inventoryQuantity,
    trackInventory: i.trackInventory,
  }));
}
