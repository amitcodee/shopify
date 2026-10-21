'use server';

import type { ProductCsvImportResult } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';

export type ImportState = { result?: ProductCsvImportResult; error?: string } | undefined;

export async function importProductsAction(
  storeId: string,
  _: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a CSV file to import.' };
  const body = new FormData();
  body.set('file', file, file.name || 'products.csv');
  try {
    const result = await api<ProductCsvImportResult>(
      `/admin/stores/${storeId}/product-csv/import`,
      { method: 'POST', body },
    );
    revalidatePath(`/s/${storeId}/products`);
    return { result };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}
