import { formatMoney, type PurchaseOrder } from '@repo/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm, CheckboxField, InlineInput, SubmitButton } from '@/components/form';
import {
  Alert,
  ButtonLink,
  Card,
  DescriptionList,
  formatDateTime,
  PageHeader,
  Table,
  Td,
  Thumbnail,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { getStore } from '@/lib/session';
import {
  deletePurchaseOrderAction,
  purchaseOrderAction,
  receivePurchaseOrderAction,
} from '../actions';
import { ActionButton } from '../action-button';
import { formatDay, PurchaseOrderStatusBadge } from '../shared';

export const metadata = { title: 'Purchase order · Merchant Admin' };

function itemName(l: { productTitle: string; variantTitle: string }) {
  return l.variantTitle === 'Default' ? l.productTitle : `${l.productTitle} — ${l.variantTitle}`;
}

/** The confirmation for the action that redirected here, if any. */
function notice(
  saved: string | undefined,
  done: string | undefined,
  received: string | undefined,
  location: string,
): string | null {
  const units = Number(received);
  if (Number.isInteger(units) && units > 0) {
    return `${units} ${units === 1 ? 'unit' : 'units'} added to stock at ${location}.`;
  }
  if (done === 'mark_ordered') return 'Marked as ordered. Receive stock here when it arrives.';
  if (done === 'cancel') return 'Purchase order cancelled.';
  if (done === 'close') return 'Purchase order closed.';
  return saved ? 'Purchase order saved.' : null;
}

export default async function PurchaseOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string; purchaseOrderId: string }>;
  searchParams: Promise<{ saved?: string; done?: string; received?: string }>;
}) {
  const { storeId, purchaseOrderId } = await params;
  const { saved, done, received } = await searchParams;
  const store = await getStore(storeId);
  let order: PurchaseOrder;
  try {
    order = await api<PurchaseOrder>(`/admin/stores/${storeId}/purchase-orders/${purchaseOrderId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const canWrite = store.permissions.includes('products:write');
  const money = (amount: number) => formatMoney(amount, store.currency);
  const receiving = order.status === 'ORDERED' || order.status === 'PARTIALLY_RECEIVED';
  const remaining = order.lines.filter((l) => l.receivedQuantity < l.quantity);
  const act = (action: 'mark_ordered' | 'cancel' | 'close') =>
    purchaseOrderAction.bind(null, storeId, order.id, action);

  return (
    <>
      <PageHeader
        title={order.name}
        back={{ href: `/s/${storeId}/purchase-orders`, label: 'Purchase orders' }}
        meta={<PurchaseOrderStatusBadge status={order.status} overdue={order.overdue} />}
        description={`${order.supplier.name} → ${order.location.name}`}
        actions={
          canWrite && order.status === 'DRAFT' ? (
            <ButtonLink
              variant="secondary"
              href={`/s/${storeId}/purchase-orders/${order.id}/edit`}
              icon="pencil"
            >
              Edit
            </ButtonLink>
          ) : null
        }
      />
      {notice(saved, done, received, order.location.name) ? (
        <div className="mb-6">
          <Alert tone="success">{notice(saved, done, received, order.location.name)}</Alert>
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {canWrite && order.status === 'DRAFT' ? (
            <Card
              title="Ready to send?"
              description="Once you have sent this order to the supplier, mark it as ordered. Its items are then fixed and you can receive stock against it."
            >
              <ActionButton
                action={act('mark_ordered')}
                label="Mark as ordered"
                variant="primary"
              />
            </Card>
          ) : null}

          {canWrite && receiving && remaining.length > 0 ? (
            <Card
              title="Receive stock"
              description={`Enter what arrived. Units are added to ${order.location.name} straight away; you can receive the rest later.`}
              flush
            >
              <ActionForm
                action={receivePurchaseOrderAction.bind(null, storeId, order.id)}
                className="space-y-0 [&>[role=alert]]:m-4 [&>[role=status]]:m-4"
              >
                <Table bare head={['Item', 'Ordered', 'Received', 'Arrived now']} numeric={[1, 2]}>
                  {remaining.map((l) => (
                    <tr key={l.id}>
                      <Td>
                        <p className="font-medium text-slate-900">{itemName(l)}</p>
                        <p className="text-xs text-slate-500">{l.sku ?? 'No SKU'}</p>
                      </Td>
                      <Td numeric>{l.quantity}</Td>
                      <Td numeric>{l.receivedQuantity}</Td>
                      <Td>
                        <InlineInput
                          name={`receive-${l.id}`}
                          label={`Units of ${itemName(l)} that arrived`}
                          type="number"
                          min={0}
                          max={l.quantity - l.receivedQuantity}
                          defaultValue={l.quantity - l.receivedQuantity}
                          className="block h-8 w-24 rounded-lg border border-slate-300 px-2.5 text-sm"
                        />
                      </Td>
                    </tr>
                  ))}
                </Table>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
                  <CheckboxField
                    name="updateCost"
                    label="Update each product's cost per item to this order's unit cost"
                  />
                  <SubmitButton>Receive stock</SubmitButton>
                </div>
              </ActionForm>
            </Card>
          ) : null}

          <Card title="Items" flush>
            <Table
              bare
              head={['Item', 'Supplier SKU', 'Received', 'Unit cost', 'Total']}
              numeric={[2, 3, 4]}
            >
              {order.lines.map((l) => (
                <tr key={l.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Thumbnail src={l.imageUrl} />
                      <div className="min-w-0">
                        {l.productId ? (
                          <Link
                            href={`/s/${storeId}/products/${l.productId}`}
                            className="font-medium text-slate-900 hover:text-indigo-600"
                          >
                            {itemName(l)}
                          </Link>
                        ) : (
                          <span className="font-medium text-slate-900">
                            {itemName(l)} <span className="text-slate-400">(deleted)</span>
                          </span>
                        )}
                        <p className="text-xs text-slate-500">{l.sku ?? 'No SKU'}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="text-slate-500">{l.supplierSku || '—'}</Td>
                  <Td numeric>
                    <span
                      className={
                        l.receivedQuantity >= l.quantity ? 'text-emerald-700' : 'text-slate-700'
                      }
                    >
                      {l.receivedQuantity} / {l.quantity}
                    </span>
                  </Td>
                  <Td numeric>{money(l.unitCost)}</Td>
                  <Td numeric className="font-medium text-slate-900">
                    {money(l.total)}
                  </Td>
                </tr>
              ))}
            </Table>
            <dl className="space-y-1.5 border-t border-slate-100 px-5 py-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="tabular-nums">{money(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Shipping</dt>
                <dd className="tabular-nums">{money(order.shippingCost)}</dd>
              </div>
              <div className="flex justify-between font-semibold text-slate-900">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(order.total)}</dd>
              </div>
            </dl>
          </Card>

          {order.notes ? (
            <Card title="Notes">
              <p className="text-sm whitespace-pre-line text-slate-700">{order.notes}</p>
            </Card>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="Details">
            <DescriptionList
              items={[
                {
                  term: 'Supplier',
                  detail: (
                    <Link
                      href={`/s/${storeId}/purchase-orders/suppliers/${order.supplier.id}`}
                      className="font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      {order.supplier.name}
                    </Link>
                  ),
                },
                { term: 'Destination', detail: order.location.name },
                {
                  term: 'Expected',
                  detail: order.expectedAt ? formatDay(order.expectedAt) : '—',
                },
                { term: 'Reference', detail: order.supplierReference || '—' },
                {
                  term: 'Progress',
                  detail: `${order.unitsReceived} of ${order.unitsOrdered} units received`,
                },
              ]}
            />
          </Card>
          <Card title="Timeline">
            <ol className="space-y-2 text-sm text-slate-700">
              <li>Created {formatDateTime(order.createdAt)}</li>
              {order.orderedAt ? <li>Ordered {formatDateTime(order.orderedAt)}</li> : null}
              {order.receivedAt ? (
                <li>
                  {order.unitsReceived < order.unitsOrdered ? 'Closed' : 'Received in full'}{' '}
                  {formatDateTime(order.receivedAt)}
                </li>
              ) : null}
              {order.cancelledAt ? <li>Cancelled {formatDateTime(order.cancelledAt)}</li> : null}
            </ol>
          </Card>
          {canWrite ? (
            <Card title="More actions">
              <div className="space-y-3">
                {order.status === 'PARTIALLY_RECEIVED' || order.status === 'ORDERED' ? (
                  <ActionButton
                    action={act('close')}
                    label="Close order"
                    confirm={
                      order.unitsReceived < order.unitsOrdered
                        ? 'Close without the missing units'
                        : undefined
                    }
                  />
                ) : null}
                {order.status === 'DRAFT' || order.status === 'ORDERED' ? (
                  <ActionButton
                    action={act('cancel')}
                    label="Cancel order"
                    confirm="Yes, cancel it"
                  />
                ) : null}
                {order.status === 'DRAFT' || order.status === 'CANCELLED' ? (
                  <ActionButton
                    action={deletePurchaseOrderAction.bind(null, storeId, order.id)}
                    label="Delete"
                    confirm="Delete permanently"
                  />
                ) : null}
                {order.status === 'RECEIVED' ? (
                  <p className="text-sm text-slate-500">
                    This order is complete. Its stock movements stay in each product&apos;s
                    inventory history.
                  </p>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
