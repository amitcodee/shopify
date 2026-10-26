import type { Product } from '@repo/contracts';
import { notFound } from 'next/navigation';
import { ActionForm, SubmitButton } from '@/components/form';
import { Badge, Card, formatDateTime, PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { getStore } from '@/lib/session';
import {
  deleteImageAction,
  deleteProductAction,
  duplicateProductAction,
  importImageAction,
  reorderImagesAction,
  saveProductAction,
  setVariantImageAction,
  updateImageAltAction,
  uploadImagesAction,
} from '../actions';
import { ConfirmButton } from '../../confirm-button';
import { MediaManager } from '../media-manager';
import { FlashToast } from '@/components/flash-toast';
import { ProductEditor } from '../product-editor';
import { statusTone } from '../status';

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string; productId: string }>;
  searchParams: Promise<{ created?: string; duplicated?: string; saved?: string }>;
}) {
  const { storeId, productId } = await params;
  const { created, duplicated, saved } = await searchParams;
  const store = await getStore(storeId);
  let product: Product;
  try {
    product = await api<Product>(`/admin/stores/${storeId}/products/${productId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const canWrite = store.permissions.includes('products:write');
  const facets = await api<{ vendors: string[]; productTypes: string[] }>(
    `/admin/stores/${storeId}/products/facets`,
  ).catch(() => ({ vendors: [], productTypes: [] }));

  return (
    <>
      <PageHeader
        title={product.title}
        back={{ href: `/s/${storeId}/products`, label: 'Products' }}
        meta={
          <>
            <Badge tone={statusTone(product.status)}>
              {product.status.charAt(0) + product.status.slice(1).toLowerCase()}
            </Badge>
            {product.scheduled && product.publishedAt ? (
              <Badge tone="blue">Scheduled for {formatDateTime(product.publishedAt)}</Badge>
            ) : null}
          </>
        }
      />
      {created ? <FlashToast param="created" message="Product created." /> : null}
      {saved ? <FlashToast param="saved" message="Product saved." /> : null}
      {duplicated ? (
        <FlashToast
          param="duplicated"
          message="Draft copy created. Add images, SKUs and stock, then set it to Active."
        />
      ) : null}

      <ProductEditor
        key={product.updatedAt}
        product={product}
        currency={store.currency}
        canWrite={canWrite}
        action={saveProductAction.bind(null, storeId, productId)}
        suggestions={facets}
        setVariantImage={setVariantImageAction.bind(null, storeId, productId)}
        media={
          <MediaManager
            images={product.images}
            canWrite={canWrite}
            upload={uploadImagesAction.bind(null, storeId, productId)}
            importFromUrl={importImageAction.bind(null, storeId, productId)}
            reorder={reorderImagesAction.bind(null, storeId, productId)}
            updateAlt={updateImageAltAction.bind(null, storeId, productId)}
            remove={deleteImageAction.bind(null, storeId, productId)}
          />
        }
        aside={
          canWrite ? (
            <div className="space-y-6">
              <Card title="Duplicate">
                <ActionForm action={duplicateProductAction.bind(null, storeId, productId)}>
                  <p className="text-sm text-slate-600">
                    Creates a draft copy with the same details, options, prices and custom fields.
                  </p>
                  <SubmitButton variant="secondary">Duplicate product</SubmitButton>
                </ActionForm>
              </Card>
              <Card title="Danger zone">
                <ConfirmButton
                  action={deleteProductAction.bind(null, storeId, productId)}
                  label="Delete product"
                  confirmLabel="Yes, delete permanently"
                />
              </Card>
            </div>
          ) : null
        }
      />
    </>
  );
}
