import { Card, PageHeader } from '@/components/ui';
import { getStore } from '@/lib/session';
import { saveSegmentAction } from '../actions';
import { SegmentForm, segmentRows } from '../segment-form';

export default async function NewSegmentPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  return (
    <>
      <PageHeader
        title="Create segment"
        back={{ href: `/s/${storeId}/customers/segments`, label: 'Segments' }}
      />
      <Card>
        <SegmentForm
          segment={null}
          currency={store.currency}
          canWrite
          action={saveSegmentAction.bind(null, storeId, null, segmentRows(null), store.currency)}
        />
      </Card>
    </>
  );
}
