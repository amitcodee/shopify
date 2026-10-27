import { formatMoney, minorToDecimalString, type OrderDetail } from '@repo/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm, CheckboxField, Field, SubmitButton } from '@/components/form';
import { DisputeSummary } from '@/components/disputes';
import { Icon } from '@/components/icons';
import {
  Alert,
  buttonClass,
  Card,
  formatDateTime,
  inputClass,
  PageHeader,
  Table,
  Td,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { getStore } from '@/lib/session';
import { ConfirmButton } from '../../confirm-button';
import { SmallAction } from '../../settings/small-action';
import { cancelOrderAction, fulfillAction, refundAction, sandboxDisputeAction } from '../actions';
import { FinancialBadge, FulfillmentBadge, OrderStatusBadge } from '../badges';
import { ReturnsCard } from '../returns-card';

const countryName = new Intl.DisplayNames(['en'], { type: 'region' });

export default async function OrderPage({
  params,
}: {
  params: Promise<{ storeId: string; orderId: string }>;
}) {
  const { storeId, orderId } = await params;
  const store = await getStore(storeId);
  let order: OrderDetail;
  try {
    order = await api<OrderDetail>(`/admin/stores/${storeId}/orders/${orderId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const money = (n: number) => formatMoney(n, order.currency);
  const canWrite = store.permissions.includes('orders:write');
  const sandboxPaid = order.payments.some((p) => p.provider === 'mock' && p.status === 'SUCCEEDED');
  const a = order.shippingAddress;

  return (
    <>
      <PageHeader
        title={`Order #${order.number}`}
        description={formatDateTime(order.createdAt)}
        back={{ href: `/s/${storeId}/orders`, label: 'Orders' }}
        meta={
          <>
            <OrderStatusBadge status={order.status} />
            <FinancialBadge status={order.financialStatus} />
            <FulfillmentBadge status={order.fulfillmentStatus} />
          </>
        }
        actions={
          <Link
            href={`/packing-slip/${storeId}/${orderId}`}
            className={buttonClass('secondary', 'sm')}
          >
            <Icon name="orders" className="-ml-0.5 h-4 w-4 text-slate-500" />
            Print packing slip
          </Link>
        }
      />
      {order.disputes.some((d) => d.status === 'NEEDS_RESPONSE') ? (
        <div className="mb-6">
          <Alert tone="error">
            The customer&apos;s bank opened a chargeback on this order. Submit evidence in your
            payment provider&apos;s dashboard before the deadline, or the funds are returned to the
            customer.
          </Alert>
        </div>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card title="Items" flush>
            <Table head={['Product', 'SKU', 'Price', 'Qty', 'Total']} numeric={[2, 3, 4]} bare>
              {order.lines.map((l) => (
                <tr key={l.id}>
                  <Td>
                    {l.productId ? (
                      <Link
                        href={`/s/${storeId}/products/${l.productId}`}
                        className="font-medium text-slate-900 hover:text-indigo-600"
                      >
                        {l.title}
                      </Link>
                    ) : (
                      l.title
                    )}
                    {l.variantTitle !== 'Default' ? (
                      <p className="text-xs text-slate-500">{l.variantTitle}</p>
                    ) : null}
                    {l.properties.length > 0 ? (
                      <dl className="mt-1 space-y-0.5 text-xs text-slate-600">
                        {l.properties.map((p) => (
                          <div key={p.label} className="flex gap-1">
                            <dt className="text-slate-500">{p.label}:</dt>
                            <dd className="font-medium [overflow-wrap:anywhere] whitespace-pre-line text-slate-800">
                              {p.value}
                              {p.price > 0 ? (
                                <span className="font-normal text-slate-500">
                                  {' '}
                                  (+{money(p.price)})
                                </span>
                              ) : null}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    {l.components.length > 0 ? (
                      <div className="mt-1 text-xs text-slate-600">
                        <p className="text-slate-500">Bundle contains, per unit:</p>
                        <ul className="list-disc pl-4">
                          {l.components.map((c) => (
                            <li key={`${c.title}-${c.sku}`}>
                              {c.quantity} × {c.title}
                              {c.sku ? <span className="text-slate-400"> · {c.sku}</span> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {l.restockedQuantity > 0 ? (
                      <p className="text-xs text-slate-500">{l.restockedQuantity} restocked</p>
                    ) : null}
                  </Td>
                  <Td className="text-slate-500">{l.sku ?? '—'}</Td>
                  <Td numeric>{money(l.unitPrice)}</Td>
                  <Td numeric>× {l.quantity}</Td>
                  <Td numeric className="font-medium text-slate-900">
                    {money(l.total)}
                  </Td>
                </tr>
              ))}
            </Table>
            <dl className="space-y-1.5 border-t border-slate-100 bg-slate-50/60 px-5 py-4 text-sm text-slate-600 tabular-nums sm:pl-[45%]">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{money(order.subtotal)}</dd>
              </div>
              {order.discountTotal > 0 ? (
                <div className="flex justify-between">
                  <dt>Discount {order.discountCode ? `(${order.discountCode})` : ''}</dt>
                  <dd>−{money(order.discountTotal)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt>Shipping {order.shippingMethod ? `(${order.shippingMethod})` : ''}</dt>
                <dd>{money(order.shippingTotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Tax</dt>
                <dd>{money(order.taxTotal)}</dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2.5 text-[15px] font-semibold text-slate-900">
                <dt>Total</dt>
                <dd>{money(order.total)}</dd>
              </div>
              {order.giftCardAmount > 0 ? (
                <div className="flex justify-between text-slate-500">
                  <dt>Paid with gift card</dt>
                  <dd>{money(order.giftCardAmount)}</dd>
                </div>
              ) : null}
              {order.refunds.length > 0 ? (
                <div className="flex justify-between text-slate-500">
                  <dt>Refunded</dt>
                  <dd>
                    −
                    {money(
                      order.refunds
                        .filter((r) => r.status === 'SUCCEEDED')
                        .reduce((s, r) => s + r.amount, 0),
                    )}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>

          {canWrite && order.status === 'OPEN' && order.fulfillmentStatus === 'UNFULFILLED' ? (
            <Card
              title="Fulfill order"
              description="Mark items as shipped and optionally add tracking."
            >
              <ActionForm
                action={fulfillAction.bind(null, storeId, orderId)}
                className="grid gap-4 sm:grid-cols-3"
              >
                <Field name="trackingCompany" label="Carrier" placeholder="UPS" />
                <Field name="trackingNumber" label="Tracking number" />
                <Field name="trackingUrl" label="Tracking URL" type="url" />
                <div className="sm:col-span-3">
                  <CheckboxField name="notifyCustomer" label="Email the customer" defaultChecked />
                </div>
                <div className="sm:col-span-3">
                  <SubmitButton>Mark as fulfilled</SubmitButton>
                </div>
              </ActionForm>
            </Card>
          ) : null}

          {canWrite && order.refundableAmount > 0 ? (
            <Card
              title="Refund"
              description={`Up to ${money(order.refundableAmount)} can be refunded to the original payment.`}
            >
              <ActionForm
                action={refundAction.bind(null, storeId, orderId, order.currency)}
                className="space-y-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    name="amount"
                    label={`Amount (${order.currency})`}
                    inputMode="decimal"
                    required
                    defaultValue={minorToDecimalString(order.refundableAmount, order.currency)}
                  />
                  <Field name="reason" label="Reason (optional)" maxLength={200} />
                </div>
                {order.lines.some((l) => l.restockable > 0) ? (
                  <fieldset className="space-y-2">
                    <legend className="mb-1 text-[13px] font-medium text-slate-800">
                      Return items to stock
                    </legend>
                    {order.lines
                      .filter((l) => l.restockable > 0)
                      .map((l) => (
                        <div key={l.id} className="flex items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            id={`rs-${l.id}`}
                            name="restockLine"
                            value={l.id}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <label htmlFor={`rs-${l.id}`} className="flex-1">
                            {l.title} {l.variantTitle !== 'Default' ? `(${l.variantTitle})` : ''}
                          </label>
                          <label htmlFor={`rq-${l.id}`} className="sr-only">
                            Quantity to restock for {l.title}
                          </label>
                          <input
                            id={`rq-${l.id}`}
                            name={`restockQty-${l.id}`}
                            type="number"
                            min={1}
                            max={l.restockable}
                            defaultValue={l.restockable}
                            className={`${inputClass} w-20`}
                          />
                        </div>
                      ))}
                  </fieldset>
                ) : null}
                <SubmitButton variant="danger">Refund</SubmitButton>
              </ActionForm>
            </Card>
          ) : null}

          <ReturnsCard order={order} storeId={storeId} canWrite={canWrite} money={money} />

          <Card title="Timeline">
            <ol className="relative text-sm">
              {order.events.map((e, i) => (
                <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < order.events.length - 1 ? (
                    <span
                      aria-hidden
                      className="absolute top-4 bottom-0 left-[5px] w-px bg-slate-200"
                    />
                  ) : null}
                  <span
                    aria-hidden
                    className={`relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-white ${
                      i === order.events.length - 1 ? 'bg-indigo-500' : 'bg-slate-300'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-800 [overflow-wrap:anywhere]">{e.message}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(e.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Customer">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600"
              >
                {(order.customer?.name ?? order.email).trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                {order.customer ? (
                  <Link
                    href={`/s/${storeId}/customers/${order.customer.id}`}
                    className="block truncate text-sm font-medium text-slate-900 hover:text-indigo-600"
                  >
                    {order.customer.name ?? order.customer.email}
                  </Link>
                ) : null}
                <p className="truncate text-sm text-slate-500">{order.email}</p>
              </div>
            </div>
            <h3 className="mt-5 text-xs font-medium text-slate-500">Shipping address</h3>
            <address className="mt-1 text-sm leading-6 text-slate-700 not-italic">
              {a.name}
              <br />
              {a.line1}
              {a.line2 ? (
                <>
                  <br />
                  {a.line2}
                </>
              ) : null}
              <br />
              {a.city}
              {a.region ? `, ${a.region}` : ''} {a.postalCode}
              <br />
              {countryName.of(a.country) ?? a.country}
              {a.phone ? (
                <>
                  <br />
                  {a.phone}
                </>
              ) : null}
            </address>
            {order.note ? (
              <>
                <h3 className="mt-5 text-xs font-medium text-slate-500">Note</h3>
                <p className="mt-1 text-sm text-slate-700">{order.note}</p>
              </>
            ) : null}
          </Card>
          {order.fulfillments.length > 0 ? (
            <Card title="Shipments">
              {order.fulfillments.map((f) => (
                <p key={f.id} className="text-sm text-slate-700">
                  {f.trackingCompany ?? 'Shipped'} {f.trackingNumber ?? ''}
                  {f.trackingUrl ? (
                    <>
                      {' '}
                      ·{' '}
                      <a
                        href={f.trackingUrl}
                        className="text-indigo-600 underline"
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        track
                      </a>
                    </>
                  ) : null}
                </p>
              ))}
            </Card>
          ) : null}
          <Card title="Payments">
            {order.payments.length === 0 ? (
              <p className="text-sm text-slate-500">No payment yet.</p>
            ) : null}
            {order.payments.map((p) => (
              <p key={p.id} className="text-sm text-slate-700">
                {money(p.amount)} via {p.provider} · {p.status.toLowerCase()}
              </p>
            ))}
            {order.refunds.map((r) => (
              <p key={r.id} className="text-sm text-slate-500">
                Refund {money(r.amount)} · {r.status.toLowerCase()}{' '}
                {r.reason ? `· ${r.reason}` : ''}
              </p>
            ))}
            {order.disputes.map((d) => (
              <p key={d.id} className="text-sm text-slate-700">
                Chargeback <DisputeSummary dispute={d} />
              </p>
            ))}
            {canWrite && sandboxPaid ? (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5">
                <span className="text-xs font-medium text-slate-500">Sandbox:</span>
                {(['NEEDS_RESPONSE', 'WON', 'LOST'] as const).map((status) => (
                  <SmallAction
                    key={status}
                    action={sandboxDisputeAction.bind(null, storeId, orderId, status)}
                    label={
                      status === 'NEEDS_RESPONSE'
                        ? 'Simulate chargeback'
                        : status === 'WON'
                          ? 'Win chargeback'
                          : 'Lose chargeback'
                    }
                  />
                ))}
              </div>
            ) : null}
          </Card>
          {canWrite && order.status !== 'CANCELLED' && order.fulfillmentStatus !== 'FULFILLED' ? (
            <Card title="Cancel order">
              <p className="mb-3 text-sm text-slate-600">
                Refunds any payment and returns items to stock.
              </p>
              <ConfirmButton
                action={cancelOrderAction.bind(null, storeId, orderId)}
                label="Cancel order"
                confirmLabel="Yes, cancel order"
              />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
