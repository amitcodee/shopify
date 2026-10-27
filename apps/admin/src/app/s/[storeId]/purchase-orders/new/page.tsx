import type { Location, Supplier } from '@repo/contracts';
import { notFound } from 'next/navigation';
import { ButtonLink, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { searchVariantsAction } from '../../products/actions';
import { reorderSuggestionsAction, savePurchaseOrderAction } from '../actions';
import { PurchaseOrderForm } from '../purchase-order-form';

export const metadata = { title: 'Create purchase order · Merchant Admin' };

export default async function NewPurchaseOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ supplier?: string }>;
}) {
  const { storeId } = await params;
  const { supplier } = await searchParams;
  const store = await getStore(storeId);
  if (!store.permissions.includes('products:write')) notFound();
  const [suppliers, locations] = await Promise.all([
    api<Supplier[]>(`/admin/stores/${storeId}/suppliers`),
    api<Location[]>(`/admin/stores/${storeId}/locations`),
  ]);
  return (
    <>
      <PageHeader
        title="Create purchase order"
        back={{ href: `/s/${storeId}/purchase-orders`, label: 'Purchase orders' }}
        actions={
          suppliers.length === 0 ? (
            <ButtonLink href={`/s/${storeId}/purchase-orders/suppliers/new`} icon="plus">
              Add supplier
            </ButtonLink>
          ) : null
        }
      />
      <PurchaseOrderForm
        order={null}
        suppliers={suppliers}
        locations={locations}
        currency={store.currency}
        initialSupplierId={suppliers.some((s) => s.id === supplier) ? supplier : undefined}
        action={savePurchaseOrderAction.bind(null, storeId, null)}
        search={searchVariantsAction.bind(null, storeId)}
        reorder={reorderSuggestionsAction.bind(null, storeId)}
      />
    </>
  );
}
