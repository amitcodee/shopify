import { notFound } from 'next/navigation';
import { Card, PageHeader } from '@/components/ui';
import { getStore } from '@/lib/session';
import { saveSupplierAction } from '../../actions';
import { SupplierForm } from '../supplier-form';

export const metadata = { title: 'Add supplier · Merchant Admin' };

export default async function NewSupplierPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  if (!store.permissions.includes('products:write')) notFound();
  return (
    <>
      <PageHeader
        title="Add supplier"
        back={{ href: `/s/${storeId}/purchase-orders/suppliers`, label: 'Suppliers' }}
      />
      <div className="max-w-3xl">
        <Card>
          <SupplierForm
            supplier={null}
            disabled={false}
            action={saveSupplierAction.bind(null, storeId, null)}
          />
        </Card>
      </div>
    </>
  );
}
