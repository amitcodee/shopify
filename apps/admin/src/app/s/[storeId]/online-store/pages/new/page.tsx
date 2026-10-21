import { Card } from '@/components/ui';
import { savePageAction } from '../../actions';
import { PageForm } from '../page-form';

export default async function NewPagePage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  return (
    <Card title="Add page">
      <PageForm page={null} canWrite action={savePageAction.bind(null, storeId, null)} />
    </Card>
  );
}
