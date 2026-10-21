import { redirect } from 'next/navigation';

export default async function OnlineStoreIndex({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  redirect(`/s/${(await params).storeId}/online-store/pages`);
}
