import { Card } from '@/components/ui';
import { savePostAction } from '../../actions';
import { PostForm } from '../post-form';

export default async function NewPostPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  return (
    <Card title="Write post">
      <PostForm post={null} canWrite action={savePostAction.bind(null, storeId, null)} />
    </Card>
  );
}
