import { Card, PageHeader } from '@/components/ui';
import { saveCollectionAction } from '../actions';
import { CollectionForm } from '../collection-form';

export default async function NewCollectionPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  return (
    <>
      <PageHeader
        title="Create collection"
        back={{ href: `/s/${storeId}/collections`, label: 'Collections' }}
      />
      <Card>
        <CollectionForm
          collection={null}
          canWrite
          action={saveCollectionAction.bind(null, storeId, null)}
        />
      </Card>
    </>
  );
}
