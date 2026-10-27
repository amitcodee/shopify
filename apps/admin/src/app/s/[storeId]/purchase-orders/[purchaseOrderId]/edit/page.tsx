import type { Location, PurchaseOrder, Supplier } from '@repo/contracts';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { getStore } from '@/lib/session';
import { searchVariantsAction } from '../../../products/actions';
import { reorderSuggestionsAction, savePurchaseOrderAction } from '../../actions';
import { PurchaseOrderForm } from '../../purchase-order-form';

export const metadata = { title: 'Edit purchase order · Merchant Admin' };

export default async function EditPurchaseOrderPage({
  params,
}: {
  params: Promise<{ storeId: string; purchaseOrderId: string }>;
}) {
  const { storeId, purchaseOrderId } = await params;
  const store = await getStore(storeId);
  if (!store.permissions.includes('products:write')) notFound();
  let order: PurchaseOrder;
  try {
    order = await api<PurchaseOrder>(`/admin/stores/${storeId}/purchase-orders/${purchaseOrderId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  // Only drafts can change; anything else goes back to the order.
  if (order.status !== 'DRAFT') redirect(`/s/${storeId}/purchase-orders/${purchaseOrderId}`);
  const [suppliers, locations] = await Promise.all([
    api<Supplier[]>(`/admin/stores/${storeId}/suppliers`),
    api<Location[]>(`/admin/stores/${storeId}/locations`),
  ]);
  return (
    <>
      <PageHeader
        title={`Edit ${order.name}`}
        back={{ href: `/s/${storeId}/purchase-orders/${order.id}`, label: order.name }}
      />
      <PurchaseOrderForm
        order={order}
        suppliers={suppliers}
        locations={locations}
        currency={store.currency}
        action={savePurchaseOrderAction.bind(null, storeId, order.id)}
        search={searchVariantsAction.bind(null, storeId)}
        reorder={reorderSuggestionsAction.bind(null, storeId)}
      />
    </>
  );
}
