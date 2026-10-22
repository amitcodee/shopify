import type { Product } from '@repo/contracts';
import { notFound } from 'next/navigation';
import { ActionForm, Field, SubmitButton } from '@/components/form';
import { Alert, Badge, Card, PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { getStore } from '@/lib/session';
import {
  deleteImageAction,
  deleteProductAction,
  duplicateProductAction,
  saveProductAction,
  uploadImageAction,
} from '../actions';
import { ConfirmButton } from '../../confirm-button';
import { ProductEditor } from '../product-editor';
import { statusTone } from '../status';

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string; productId: string }>;
  searchParams: Promise<{ created?: string; duplicated?: string }>;
}) {
  const { storeId, productId } = await params;
  const { created, duplicated } = await searchParams;
  const store = await getStore(storeId);
  let product: Product;
  try {
    product = await api<Product>(`/admin/stores/${storeId}/products/${productId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const canWrite = store.permissions.includes('products:write');

  return (
    <>
      <PageHeader
        title={product.title}
        back={{ href: `/s/${storeId}/products`, label: 'Products' }}
        actions={<Badge tone={statusTone(product.status)}>{product.status.toLowerCase()}</Badge>}
      />
      {created ? (
        <div className="mb-6">
          <Alert tone="success">Product created.</Alert>
        </div>
      ) : null}
      {duplicated ? (
        <div className="mb-6">
          <Alert tone="success">
            Draft copy created. Add images, SKUs and stock, then set it to Active.
          </Alert>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <ProductEditor
          key={product.updatedAt}
          product={product}
          currency={store.currency}
          canWrite={canWrite}
          action={saveProductAction.bind(null, storeId, productId)}
        />

        <div className="space-y-6">
          <Card title="Media">
            {product.images.length === 0 ? (
              <p className="text-sm text-slate-500">No images yet.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3">
                {product.images.map((image) => (
                  <li key={image.id} className="space-y-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt={image.alt}
                      className="aspect-square w-full rounded-md border border-slate-200 object-cover"
                    />
                    {canWrite ? (
                      <form action={deleteImageAction.bind(null, storeId, productId)}>
                        <input type="hidden" name="imageId" value={image.id} />
                        <button type="submit" className="text-xs text-red-600 hover:underline">
                          Remove
                        </button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {canWrite ? (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <ActionForm action={uploadImageAction.bind(null, storeId, productId)}>
                  <div className="space-y-1">
                    <label
                      htmlFor="image-file"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Upload image
                    </label>
                    <input
                      id="image-file"
                      name="file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                      required
                      className="block w-full text-sm"
                    />
                    <p className="text-xs text-slate-500">
                      JPEG, PNG, WebP, GIF or AVIF up to 5 MB.
                    </p>
                  </div>
                  <Field
                    name="alt"
                    label="Alt text"
                    maxLength={200}
                    hint="Describe the image for screen readers."
                  />
                  <SubmitButton variant="secondary">Upload</SubmitButton>
                </ActionForm>
              </div>
            ) : null}
          </Card>

          {canWrite ? (
            <Card title="Duplicate">
              <ActionForm action={duplicateProductAction.bind(null, storeId, productId)}>
                <p className="text-sm text-slate-600">
                  Creates a draft copy with the same details, options and prices.
                </p>
                <SubmitButton variant="secondary">Duplicate product</SubmitButton>
              </ActionForm>
            </Card>
          ) : null}

          {canWrite ? (
            <Card title="Danger zone">
              <ConfirmButton
                action={deleteProductAction.bind(null, storeId, productId)}
                label="Delete product"
                confirmLabel="Yes, delete permanently"
              />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
