import type { Page } from '@repo/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { getStore } from '@/lib/session';
import { ConfirmButton } from '../../../confirm-button';
import { deletePageAction, savePageAction } from '../../actions';
import { PageForm } from '../page-form';

export default async function EditPagePage({
  params,
}: {
  params: Promise<{ storeId: string; pageId: string }>;
}) {
  const { storeId, pageId } = await params;
  const store = await getStore(storeId);
  let page: Page;
  try {
    page = await api<Page>(`/admin/stores/${storeId}/pages/${pageId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const canWrite = store.permissions.includes('themes:write');

  return (
    <div className="space-y-6">
      <Link
        href={`/s/${storeId}/online-store/pages`}
        className="text-sm text-slate-600 hover:text-slate-900"
      >
        ← Pages
      </Link>
      <Card title={page.title}>
        <PageForm
          key={page.updatedAt}
          page={page}
          canWrite={canWrite}
          action={savePageAction.bind(null, storeId, pageId)}
        />
      </Card>
      {canWrite ? (
        <Card title="Danger zone">
          <ConfirmButton
            action={deletePageAction.bind(null, storeId, pageId)}
            label="Delete page"
            confirmLabel="Yes, delete page"
          />
        </Card>
      ) : null}
    </div>
  );
}
