import type { BlogPost } from '@repo/contracts';
import Link from 'next/link';
import { Badge, ButtonLink, EmptyState, formatDateTime, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';

const TONES = { draft: 'gray', scheduled: 'blue', published: 'green' } as const;

export default async function BlogPostsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const [store, posts] = await Promise.all([
    getStore(storeId),
    api<BlogPost[]>(`/admin/stores/${storeId}/blog-posts`),
  ]);
  const base = `/s/${storeId}/online-store/blog`;
  return (
    <>
      {store.permissions.includes('themes:write') ? (
        <div className="mb-4 flex justify-end">
          <ButtonLink href={`${base}/new`}>Write post</ButtonLink>
        </div>
      ) : null}
      {posts.length === 0 ? (
        <EmptyState
          title="No blog posts yet"
          description="Share news, guides and stories at /blog."
        />
      ) : (
        <Table head={['Title', 'Status', 'Published']}>
          {posts.map((p) => (
            <tr key={p.id}>
              <Td>
                <Link
                  href={`${base}/${p.id}`}
                  className="font-medium text-slate-900 hover:underline"
                >
                  {p.title}
                </Link>
                <p className="text-xs text-slate-500">/blog/{p.handle}</p>
              </Td>
              <Td>
                <Badge tone={TONES[p.status]}>{p.status}</Badge>
              </Td>
              <Td>{p.publishedAt ? formatDateTime(p.publishedAt) : '—'}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
