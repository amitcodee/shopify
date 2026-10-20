import { ButtonLink } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Not found</h1>
      <p className="mt-2 text-sm text-slate-500">
        This page does not exist, or you do not have access to it.
      </p>
      <div className="mt-6">
        <ButtonLink href="/stores">Back to your stores</ButtonLink>
      </div>
    </main>
  );
}
