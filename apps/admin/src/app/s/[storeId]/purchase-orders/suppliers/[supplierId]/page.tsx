import {
  formatMoney,
  type Paginated,
  type ProductListItem,
  type PurchaseOrderListItem,
  type ReorderSuggestion,
  type Supplier,
} from '@repo/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Badge, ButtonLink, Card, PageHeader, Table, Td } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { getStore } from '@/lib/session';
import { deleteSupplierAction, saveSupplierAction } from '../../actions';
import { ActionButton } from '../../action-button';
import { PurchaseOrderStatusBadge } from '../../shared';
import { SupplierForm } from '../supplier-form';

export const metadata = { title: 'Supplier · Merchant Admin' };

export default async function SupplierPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string; supplierId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { storeId, supplierId } = await params;
  const { created } = await searchParams;
  const store = await getStore(storeId);
  let supplier: Supplier;
  try {
    supplier = await api<Supplier>(`/admin/stores/${storeId}/suppliers/${supplierId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const [reorder, orders, products] = await Promise.all([
    api<ReorderSuggestion[]>(`/admin/stores/${storeId}/suppliers/${supplierId}/reorder`),
    api<Paginated<PurchaseOrderListItem>>(
      `/admin/stores/${storeId}/purchase-orders?supplierId=${supplierId}&pageSize=10`,
    ),
    api<Paginated<ProductListItem>>(
      `/admin/stores/${storeId}/products?supplierId=${supplierId}&pageSize=10&sort=title`,
    ),
  ]);
  const canWrite = store.permissions.includes('products:write');

  return (
    <>
      <PageHeader
        title={supplier.name}
        back={{ href: `/s/${storeId}/purchase-orders/suppliers`, label: 'Suppliers' }}
        meta={supplier.active ? null : <Badge>Inactive</Badge>}
        actions={
          canWrite && supplier.active ? (
            <ButtonLink
              href={`/s/${storeId}/purchase-orders/new?supplier=${supplier.id}`}
              icon="plus"
            >
              Create purchase order
            </ButtonLink>
          ) : null
        }
      />
      {created ? (
        <div className="mb-6">
          <Alert tone="success">
            Supplier added. Choose it under Product organization on each product you buy from them.
          </Alert>
        </div>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card
            title="To reorder"
            description="This supplier's tracked products at or below 5 units, after what is already on order."
            flush
          >
            {reorder.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">Nothing is running low.</p>
            ) : (
              <Table bare head={['Item', 'In stock', 'On order', 'Suggested']} numeric={[1, 2, 3]}>
                {reorder.map((r) => (
                  <tr key={r.variantId}>
                    <Td>
                      <Link
                        href={`/s/${storeId}/products/${r.productId}`}
                        className="font-medium text-slate-900 hover:text-indigo-600"
                      >
                        {r.productTitle}
                      </Link>
                      {r.variantTitle !== 'Default' ? (
                        <p className="text-xs text-slate-500">{r.variantTitle}</p>
                      ) : null}
                    </Td>
                    <Td numeric>
                      <span
                        className={r.inventoryQuantity <= 0 ? 'text-red-600' : 'text-amber-700'}
                      >
                        {r.inventoryQuantity}
                      </span>
                    </Td>
                    <Td numeric>{r.incoming}</Td>
                    <Td numeric className="font-medium text-slate-900">
                      {r.suggestedQuantity}
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card
            title="Purchase orders"
            flush
            actions={
              orders.total > orders.items.length ? (
                <Link
                  href={`/s/${storeId}/purchase-orders`}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  View all
                </Link>
              ) : null
            }
          >
            {orders.items.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">No purchase orders yet.</p>
            ) : (
              <Table bare head={['Order', 'Status', 'Received', 'Total']} numeric={[2, 3]}>
                {orders.items.map((o) => (
                  <tr key={o.id}>
                    <Td>
                      <Link
                        href={`/s/${storeId}/purchase-orders/${o.id}`}
                        className="font-medium text-slate-900 hover:text-indigo-600"
                      >
                        {o.name}
                      </Link>
                    </Td>
                    <Td>
                      <PurchaseOrderStatusBadge status={o.status} overdue={o.overdue} />
                    </Td>
                    <Td numeric>
                      {o.unitsReceived} / {o.unitsOrdered}
                    </Td>
                    <Td numeric>{formatMoney(o.total, store.currency)}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card
            title={`Products (${supplier.productCount})`}
            flush
            actions={
              supplier.productCount > 0 ? (
                <Link
                  href={`/s/${storeId}/products?supplierId=${supplier.id}`}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  View in products
                </Link>
              ) : null
            }
          >
            {products.items.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">
                No products yet. Pick this supplier under Product organization on a product.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {products.items.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <Link
                      href={`/s/${storeId}/products/${p.id}`}
                      className="text-sm font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {p.title}
                    </Link>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {p.totalInventory} in stock
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="Details">
            <SupplierForm
              supplier={supplier}
              disabled={!canWrite}
              action={saveSupplierAction.bind(null, storeId, supplier.id)}
            />
          </Card>
          {canWrite ? (
            <Card title="Delete supplier">
              <p className="mb-3 text-sm text-slate-600">
                {orders.total > 0
                  ? 'Suppliers with purchase orders are kept for your records. Mark it inactive instead.'
                  : 'Its products keep their details but no longer name a supplier.'}
              </p>
              {orders.total === 0 ? (
                <ActionButton
                  action={deleteSupplierAction.bind(null, storeId, supplier.id)}
                  label="Delete supplier"
                  confirm="Delete permanently"
                />
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
