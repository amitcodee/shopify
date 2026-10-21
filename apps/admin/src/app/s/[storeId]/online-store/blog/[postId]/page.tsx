import type { BlogPost } from '@repo/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { getStore } from '@/lib/session';
import { ConfirmButton } from '../../../confirm-button';
import { deletePostAction, savePostAction } from '../../actions';
import { PostForm } from '../post-form';

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ storeId: string; postId: string }>;
}) {
  const { storeId, postId } = await params;
  const store = await getStore(storeId);
  let post: BlogPost;
  try {
    post = await api<BlogPost>(`/admin/stores/${storeId}/blog-posts/${postId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const canWrite = store.permissions.includes('themes:write');
  return (
    <div className="space-y-6">
      <Link
        href={`/s/${storeId}/online-store/blog`}
        className="text-sm text-slate-600 hover:text-slate-900"
      >
        ← Blog
      </Link>
      <Card title={post.title}>
        <PostForm
          key={post.updatedAt}
          post={post}
          canWrite={canWrite}
          action={savePostAction.bind(null, storeId, postId)}
        />
      </Card>
      {canWrite ? (
        <Card title="Danger zone">
          <ConfirmButton
            action={deletePostAction.bind(null, storeId, postId)}
            label="Delete post"
            confirmLabel="Yes, delete post"
          />
        </Card>
      ) : null}
    </div>
  );
}
