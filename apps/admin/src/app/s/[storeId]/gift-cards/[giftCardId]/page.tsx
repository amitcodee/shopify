import { formatMoney, type GiftCardDetail } from '@repo/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm, Field, SubmitButton } from '@/components/form';
import { Card, DescriptionList, formatDateTime, PageHeader, Table, Td } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { getStore } from '@/lib/session';
import { adjustGiftCardAction, setGiftCardDisabledAction, updateGiftCardAction } from '../actions';
import { GiftCardStatusBadge } from '../status';

const KIND_LABELS: Record<GiftCardDetail['transactions'][number]['kind'], string> = {
  ISSUED: 'Issued',
  REDEEMED: 'Spent',
  RESTORED: 'Returned (order not paid)',
  REFUNDED: 'Refunded',
  ADJUSTED: 'Adjusted',
};

export default async function GiftCardPage({
  params,
}: {
  params: Promise<{ storeId: string; giftCardId: string }>;
}) {
  const { storeId, giftCardId } = await params;
  let card: GiftCardDetail;
  try {
    card = await api<GiftCardDetail>(`/admin/stores/${storeId}/gift-cards/${giftCardId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const store = await getStore(storeId);
  const canWrite = store.permissions.includes('orders:write');
  const money = (amount: number) => formatMoney(amount, card.currency);
  const disabled = card.status === 'disabled';

  return (
    <>
      <PageHeader
        title={`Gift card •••• ${card.lastCharacters}`}
        back={{ href: `/s/${storeId}/gift-cards`, label: 'Gift cards' }}
        actions={<GiftCardStatusBadge status={card.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Details">
          <DescriptionList
            items={[
              { term: 'Balance', detail: money(card.balance) },
              { term: 'Initial value', detail: money(card.initialValue) },
              { term: 'Customer', detail: card.customerEmail ?? '—' },
              { term: 'Expires', detail: card.expiresOn ?? 'Never' },
              { term: 'Issued', detail: formatDateTime(card.createdAt) },
            ]}
          />
          {canWrite ? (
            <ActionForm
              action={updateGiftCardAction.bind(null, storeId, giftCardId)}
              className="mt-6 space-y-4"
            >
              <Field
                name="expiresOn"
                label="Expires on"
                type="date"
                defaultValue={card.expiresOn}
              />
              <Field name="note" label="Internal note" defaultValue={card.note} maxLength={500} />
              <SubmitButton variant="secondary">Save</SubmitButton>
            </ActionForm>
          ) : null}
        </Card>
        {canWrite ? (
          <div className="space-y-6">
            <Card
              title="Adjust balance"
              description="Add credit (10.00) or remove it (-5.00). The reason is kept in the history."
            >
              <ActionForm
                action={adjustGiftCardAction.bind(null, storeId, giftCardId, card.currency)}
              >
                <Field
                  name="amount"
                  label={`Change (${card.currency})`}
                  inputMode="decimal"
                  required
                />
                <Field name="note" label="Reason" required maxLength={500} />
                <SubmitButton variant="secondary">Update balance</SubmitButton>
              </ActionForm>
            </Card>
            <Card
              title={disabled ? 'Enable gift card' : 'Disable gift card'}
              description={
                disabled
                  ? 'Customers can spend the balance again.'
                  : 'The code stops working at checkout. Orders already paid are not affected.'
              }
            >
              <ActionForm
                action={setGiftCardDisabledAction.bind(null, storeId, giftCardId, !disabled)}
              >
                <SubmitButton variant={disabled ? 'secondary' : 'danger'}>
                  {disabled ? 'Enable' : 'Disable'}
                </SubmitButton>
              </ActionForm>
            </Card>
          </div>
        ) : null}
      </div>
      <div className="mt-6">
        <Card title="History">
          <Table head={['Date', 'Activity', 'Order', 'Change', 'Balance']}>
            {card.transactions.map((t) => (
              <tr key={t.id}>
                <Td>{formatDateTime(t.createdAt)}</Td>
                <Td>
                  {KIND_LABELS[t.kind]}
                  {t.note ? <p className="text-xs text-slate-500">{t.note}</p> : null}
                </Td>
                <Td>
                  {t.order ? (
                    <Link href={`/s/${storeId}/orders/${t.order.id}`} className="hover:underline">
                      #{t.order.number}
                    </Link>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td className={t.amount < 0 ? 'text-red-700' : 'text-emerald-700'}>
                  {t.amount > 0 ? '+' : ''}
                  {money(t.amount)}
                </Td>
                <Td>{money(t.balanceAfter)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
