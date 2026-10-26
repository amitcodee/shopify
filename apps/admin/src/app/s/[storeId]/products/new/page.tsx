import { notFound } from 'next/navigation';
import { Icon } from '@/components/icons';
import { Card, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { saveProductAction } from '../actions';
import { ProductEditor } from '../product-editor';

export const metadata = { title: 'Add product · Merchant Admin' };

export default async function NewProductPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  if (!store.permissions.includes('products:write')) notFound();
  const facets = await api<{ vendors: string[]; productTypes: string[] }>(
    `/admin/stores/${storeId}/products/facets`,
  ).catch(() => ({ vendors: [], productTypes: [] }));
  return (
    <>
      <PageHeader
        title="Add product"
        back={{ href: `/s/${storeId}/products`, label: 'Products' }}
      />
      <ProductEditor
        product={null}
        currency={store.currency}
        canWrite
        suggestions={facets}
        action={saveProductAction.bind(null, storeId, null)}
        media={
          <Card title="Media">
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 shadow-xs ring-1 ring-slate-200">
                <Icon name="image" className="h-4.5 w-4.5" />
              </span>
              <p className="text-sm text-slate-500">
                Create the product first, then upload images or add them from a URL.
              </p>
            </div>
          </Card>
        }
      />
    </>
  );
}
