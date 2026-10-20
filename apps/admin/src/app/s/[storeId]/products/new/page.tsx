import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { getStore } from '@/lib/session';
import { saveProductAction } from '../actions';
import { ProductEditor } from '../product-editor';

export const metadata = { title: 'Add product · Merchant Admin' };

export default async function NewProductPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  if (!store.permissions.includes('products:write')) notFound();
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
        action={saveProductAction.bind(null, storeId, null)}
      />
    </>
  );
}
