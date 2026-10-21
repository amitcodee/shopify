import type { InventoryItem, Paginated } from '@repo/contracts';
import { PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { saveDraftAction } from '../actions';
import { DraftForm, draftRows } from '../draft-form';

export default async function NewDraftPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const [store, variants] = await Promise.all([
    getStore(storeId),
    api<Paginated<InventoryItem>>(`/admin/stores/${storeId}/inventory`, {
      query: { pageSize: 100 },
    }),
  ]);
  return (
    <>
      <PageHeader
        title="Create order"
        back={{ href: `/s/${storeId}/orders/drafts`, label: 'Draft orders' }}
      />
      <DraftForm
        draft={null}
        variants={variants.items}
        currency={store.currency}
        canWrite
        action={saveDraftAction.bind(null, storeId, null, draftRows(null), store.currency)}
      />
    </>
  );
}
