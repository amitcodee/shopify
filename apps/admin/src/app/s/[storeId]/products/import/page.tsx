import { PRODUCT_CSV_COLUMNS } from '@repo/contracts';
import { Card, PageHeader } from '@/components/ui';
import { importProductsAction } from './actions';
import { ImportForm } from './import-form';

export default async function ImportProductsPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const base = `/s/${storeId}/products`;
  return (
    <>
      <PageHeader title="Import products" back={{ href: base, label: 'Products' }} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <Card
          title="Upload CSV"
          description="New products are created; products whose handle already exists are skipped, never changed."
        >
          <ImportForm action={importProductsAction.bind(null, storeId)} />
        </Card>
        <Card title="Format">
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              One row per variant. Rows with the same <strong>Handle</strong> belong to one product;
              product details go on its first row. Prices use a decimal point (12.50).
            </p>
            <p>
              Tip:{' '}
              <a href={`${base}/export`} className="text-indigo-600 hover:underline" download>
                export your products
              </a>{' '}
              to get a file in the right format.
            </p>
            <p className="text-xs text-slate-500">Columns: {PRODUCT_CSV_COLUMNS.join(', ')}.</p>
          </div>
        </Card>
      </div>
    </>
  );
}
