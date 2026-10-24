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
        actions={
          canWrite ? (
            <ButtonLink href={`${base}/new`} size="sm" icon="plus">
              Create collection
            </ButtonLink>
          ) : null
        }
      />
      {collections.length === 0 ? (
        <EmptyState
          icon="collections"
          title="No collections yet"
          description="Create manual collections or automated ones based on a product tag."
        />
      ) : (
        <Table head={['Title', 'Type', 'Products', 'Visibility']} numeric={[2]}>
          {collections.map((c) => (
            <tr key={c.id}>
              <Td>
                <Link
                  href={`${base}/${c.id}`}
                  className="font-medium text-slate-900 hover:text-indigo-600"
                >
                  {c.title}
                </Link>
                <p className="text-xs text-slate-500">/{c.handle}</p>
              </Td>
              <Td>
                {c.ruleTag ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Badge tone="indigo">Automated</Badge>
                    <span className="text-xs text-slate-500">Tag: {c.ruleTag}</span>
                  </span>
                ) : (
                  <span className="text-slate-500">Manual</span>
                )}
              </Td>
              <Td numeric>{c.productCount}</Td>
              <Td>
                <Badge tone={c.published ? 'green' : 'gray'}>
                  {c.published ? 'Visible' : 'Hidden'}
                </Badge>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
