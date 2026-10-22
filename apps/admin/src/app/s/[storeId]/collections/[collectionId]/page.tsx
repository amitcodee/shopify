import type { Collection, Paginated, ProductListItem } from '@repo/contracts';
import { notFound } from 'next/navigation';
import { ActionForm, SubmitButton } from '@/components/form';
import { Card, PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { getStore } from '@/lib/session';
import { ConfirmButton } from '../../confirm-button';
import {
  deleteCollectionAction,
  saveCollectionAction,
  setCollectionProductsAction,
} from '../actions';
import { CollectionForm } from '../collection-form';

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ storeId: string; collectionId: string }>;
}) {
  const { storeId, collectionId } = await params;
  const store = await getStore(storeId);
  let collection: Collection;
  try {
    collection = await api<Collection>(`/admin/stores/${storeId}/collections/${collectionId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const canWrite = store.permissions.includes('products:write');
  const products = collection.ruleTag
    ? null
    : await api<Paginated<ProductListItem>>(`/admin/stores/${storeId}/products`, {
        query: { pageSize: 100 },
      });
  const selected = new Set(collection.productIds);

  return (
    <>
      <PageHeader
        title={collection.title}
        back={{ href: `/s/${storeId}/collections`, label: 'Collections' }}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Details">
          <CollectionForm
            key={collection.updatedAt}
            collection={collection}
            canWrite={canWrite}
            action={saveCollectionAction.bind(null, storeId, collectionId)}
          />
        </Card>
        <Card
          title="Products"
          description={
            collection.ruleTag
              ? `Automatically includes active products tagged “${collection.ruleTag}” (${collection.productCount}).`
              : 'Choose which products appear in this collection.'
          }
        >
          {products ? (
            <ActionForm action={setCollectionProductsAction.bind(null, storeId, collectionId)}>
              <fieldset disabled={!canWrite} className="max-h-96 space-y-2 overflow-y-auto">
                <legend className="sr-only">Products in collection</legend>
                {products.items.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="productIds"
                      value={p.id}
                      defaultChecked={selected.has(p.id)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {p.title}
                    <span className="text-xs text-slate-400">{p.status.toLowerCase()}</span>
                  </label>
                ))}
                {products.items.length === 0 ? (
                  <p className="text-sm text-slate-500">Add products first.</p>
                ) : null}
              </fieldset>
              {canWrite ? <SubmitButton variant="secondary">Save products</SubmitButton> : null}
            </ActionForm>
          ) : null}
        </Card>
      </div>
      {canWrite ? (
        <div className="mt-6">
          <Card title="Danger zone">
            <ConfirmButton
              action={deleteCollectionAction.bind(null, storeId, collectionId)}
              label="Delete collection"
              confirmLabel="Yes, delete collection"
            />
          </Card>
        </div>
      ) : null}
    </>
  );
}
