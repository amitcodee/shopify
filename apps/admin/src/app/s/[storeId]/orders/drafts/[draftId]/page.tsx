import type { DraftOrder, InventoryItem, Paginated } from '@repo/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm, SubmitButton, TextAreaField } from '@/components/form';
import { Alert, Card, formatDateTime, PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { getStore } from '@/lib/session';
import { ConfirmButton } from '../../../confirm-button';
import {
  completeDraftAction,
  deleteDraftAction,
  saveDraftAction,
  sendInvoiceAction,
} from '../actions';
import { DraftForm, draftRows, DraftSummary } from '../draft-form';
import { DraftStatusBadge } from '../status';

export default async function DraftPage({
  params,
}: {
  params: Promise<{ storeId: string; draftId: string }>;
}) {
  const { storeId, draftId } = await params;
  let draft: DraftOrder;
  try {
    draft = await api<DraftOrder>(`/admin/stores/${storeId}/draft-orders/${draftId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const [store, variants] = await Promise.all([
    getStore(storeId),
    api<Paginated<InventoryItem>>(`/admin/stores/${storeId}/inventory`, {
      query: { pageSize: 100 },
    }),
  ]);
  const completed = draft.status === 'COMPLETED';
  const canWrite = store.permissions.includes('orders:write') && !completed;

  return (
    <>
      <PageHeader
        title={`Draft #D${draft.number}`}
        description={`Created ${formatDateTime(draft.createdAt)}`}
        back={{ href: `/s/${storeId}/orders/drafts`, label: 'Draft orders' }}
        actions={<DraftStatusBadge status={draft.status} />}
      />
      {completed && draft.order ? (
        <div className="mb-6">
          <Alert tone="success">
            Completed as{' '}
            <Link href={`/s/${storeId}/orders/${draft.order.id}`} className="underline">
              order #{draft.order.number}
            </Link>
            .
          </Alert>
        </div>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <DraftForm
          key={draft.updatedAt}
          draft={draft}
          variants={variants.items}
          currency={draft.currency}
          canWrite={canWrite}
          action={saveDraftAction.bind(null, storeId, draftId, draftRows(draft), draft.currency)}
        />
        <div className="space-y-6">
          <Card title="Summary">
            <DraftSummary draft={draft} />
          </Card>
          {canWrite ? (
            <>
              <Card
                title="Send invoice"
                description={
                  draft.invoiceSentAt
                    ? `Last sent ${formatDateTime(draft.invoiceSentAt)}. Sending again emails a fresh copy.`
                    : 'Email the customer a secure link to pay online.'
                }
              >
                <ActionForm action={sendInvoiceAction.bind(null, storeId, draftId)}>
                  <TextAreaField
                    name="message"
                    label="Message (optional)"
                    rows={3}
                    maxLength={1000}
                  />
                  <SubmitButton variant="secondary">Send invoice</SubmitButton>
                </ActionForm>
              </Card>
              <Card
                title="Mark as paid"
                description="Payment collected another way (cash, bank transfer). Creates the order and reserves stock."
              >
                <ActionForm action={completeDraftAction.bind(null, storeId, draftId)}>
                  <SubmitButton>Mark as paid</SubmitButton>
                </ActionForm>
              </Card>
              <Card title="Danger zone">
                <ConfirmButton
                  action={deleteDraftAction.bind(null, storeId, draftId)}
                  label="Delete draft"
                  confirmLabel="Yes, delete draft"
                />
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
