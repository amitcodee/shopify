'use server';

import type { Product } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { type FormState, toFormState } from '@/lib/form';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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
  return { success: 'Product saved.' };
}

export async function deleteProductAction(storeId: string, productId: string): Promise<void> {
  await api(`/admin/stores/${storeId}/products/${productId}`, { method: 'DELETE' });
  revalidatePath(`/s/${storeId}/products`);
  redirect(`/s/${storeId}/products`);
}

export async function uploadImageAction(
  storeId: string,
  productId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose an image to upload.' };
  if (file.size > MAX_IMAGE_BYTES) return { error: 'Images must be 5 MB or smaller.' };

  const body = new FormData();
  body.set('file', file, file.name);
  body.set('alt', String(formData.get('alt') ?? ''));
  try {
    await api(`/admin/stores/${storeId}/products/${productId}/images`, { method: 'POST', body });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(`/s/${storeId}/products/${productId}`);
  return { success: 'Image uploaded.' };
}

export async function deleteImageAction(
  storeId: string,
  productId: string,
  formData: FormData,
): Promise<void> {
  const imageId = String(formData.get('imageId') ?? '');
  await api(`/admin/stores/${storeId}/products/${productId}/images/${imageId}`, {
    method: 'DELETE',
  });
  revalidatePath(`/s/${storeId}/products/${productId}`);
}

/**
 * Copies a product as a new draft: same details, options, variants and prices. SKUs must stay
 * unique and stock belongs to the original, so the copy starts with no SKUs and no stock.
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
        options: p.options,
        variants: p.variants.map((v) => ({
          options: v.options,
          barcode: v.barcode,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          weightGrams: v.weightGrams,
          requiresShipping: v.requiresShipping,
          taxable: v.taxable,
          trackInventory: v.trackInventory,
          allowBackorder: v.allowBackorder,
        })),
      },
    });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(`/s/${storeId}/products`);
  redirect(`/s/${storeId}/products/${copy.id}?duplicated=1`);
}
