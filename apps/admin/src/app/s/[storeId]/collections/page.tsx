import type { Collection } from '@repo/contracts';
import Link from 'next/link';
import { Badge, ButtonLink, EmptyState, PageHeader, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';

export default async function CollectionsPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  const collections = await api<Collection[]>(`/admin/stores/${storeId}/collections`);
  const base = `/s/${storeId}/collections`;
  const canWrite = store.permissions.includes('products:write');

  return (
    <>
      <PageHeader
        title="Collections"
        description="Group products for your storefront navigation."
        actions={canWrite ? <ButtonLink href={`${base}/new`}>Create collection</ButtonLink> : null}
      />
      {collections.length === 0 ? (
        <EmptyState
          title="No collections yet"
          description="Create manual collections or automated ones based on a product tag."
        />
      ) : (
        <Table head={['Title', 'Type', 'Products', 'Visibility']}>
          {collections.map((c) => (
            <tr key={c.id}>
              <Td>
                <Link
                  href={`${base}/${c.id}`}
                  className="font-medium text-slate-900 hover:underline"
                >
                  {c.title}
                </Link>
                <p className="text-xs text-slate-500">/{c.handle}</p>
              </Td>
              <Td>{c.ruleTag ? `Tag: ${c.ruleTag}` : 'Manual'}</Td>
              <Td>{c.productCount}</Td>
              <Td>
                <Badge tone={c.published ? 'green' : 'gray'}>
                  {c.published ? 'visible' : 'hidden'}
                </Badge>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
