import type { Supplier } from '@repo/contracts';
import Link from 'next/link';
import { Badge, ButtonLink, EmptyState, PageHeader, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { PurchasingTabs } from '../shared';

export const metadata = { title: 'Suppliers · Merchant Admin' };

export default async function SuppliersPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const [store, suppliers] = await Promise.all([
    getStore(storeId),
    api<Supplier[]>(`/admin/stores/${storeId}/suppliers`),
  ]);
  const canWrite = store.permissions.includes('products:write');
  return (
    <>
      <PageHeader
        title="Purchase orders"
        description="Order stock from suppliers and receive it into a location."
        actions={
          canWrite ? (
            <ButtonLink href={`/s/${storeId}/purchase-orders/suppliers/new`} icon="plus">
              Add supplier
            </ButtonLink>
          ) : null
        }
      />
      <PurchasingTabs storeId={storeId} active="suppliers" />
      {suppliers.length === 0 ? (
        <EmptyState
          icon="truck"
          title="No suppliers yet"
          description="Add the companies you buy stock from. You can then link products to them, see what to reorder and send purchase orders."
          action={
            canWrite ? (
              <ButtonLink href={`/s/${storeId}/purchase-orders/suppliers/new`} icon="plus">
                Add supplier
              </ButtonLink>
            ) : null
          }
        />
      ) : (
        <Table
          head={['Supplier', 'Contact', 'Products', 'Open orders', 'Lead time']}
          numeric={[2, 3]}
        >
          {suppliers.map((s) => (
            <tr key={s.id}>
              <Td>
                <Link
                  href={`/s/${storeId}/purchase-orders/suppliers/${s.id}`}
                  className="font-medium text-slate-900 hover:text-indigo-600"
                >
                  {s.name}
                </Link>
                {!s.active ? (
                  <span className="ml-2">
                    <Badge>Inactive</Badge>
                  </span>
                ) : null}
              </Td>
              <Td className="text-slate-500">
                {s.contactName || s.email || s.phone ? (
                  <span className="flex flex-col">
                    {s.contactName ? <span className="text-slate-700">{s.contactName}</span> : null}
                    {s.email ? <span>{s.email}</span> : null}
                    {!s.email && s.phone ? <span>{s.phone}</span> : null}
                  </span>
                ) : (
                  '—'
                )}
              </Td>
              <Td numeric>{s.productCount}</Td>
              <Td numeric>{s.openPurchaseOrders}</Td>
              <Td className="text-slate-500">
                {s.leadTimeDays == null
                  ? '—'
                  : `${s.leadTimeDays} ${s.leadTimeDays === 1 ? 'day' : 'days'}`}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
