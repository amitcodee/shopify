import type { Page } from '@repo/contracts';
import Link from 'next/link';
import { Badge, ButtonLink, EmptyState, formatDateTime, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';

export default async function PagesPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const [store, pages] = await Promise.all([
    getStore(storeId),
    api<Page[]>(`/admin/stores/${storeId}/pages`),
  ]);
  const base = `/s/${storeId}/online-store/pages`;
  const canWrite = store.permissions.includes('themes:write');

  return (
    <>
      {canWrite ? (
        <div className="mb-4 flex justify-end">
          <ButtonLink href={`${base}/new`}>Add page</ButtonLink>
        </div>
      ) : null}
      {pages.length === 0 ? (
        <EmptyState
          title="No pages yet"
          description="Add pages like About us or FAQ, then link them from your navigation."
        />
      ) : (
        <Table head={['Title', 'Visibility', 'Updated']}>
          {pages.map((p) => (
            <tr key={p.id}>
              <Td>
                <Link
                  href={`${base}/${p.id}`}
                  className="font-medium text-slate-900 hover:underline"
                >
                  {p.title}
                </Link>
                <p className="text-xs text-slate-500">/pages/{p.handle}</p>
              </Td>
              <Td>
                <Badge tone={p.published ? 'green' : 'gray'}>
                  {p.published ? 'visible' : 'hidden'}
                </Badge>
              </Td>
              <Td>{formatDateTime(p.updatedAt)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
