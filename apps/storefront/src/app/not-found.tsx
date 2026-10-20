import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-2 text-zinc-600">The page you are looking for does not exist.</p>
      <Link href="/" className="mt-6 inline-block text-sm font-medium underline">
        Back to the store
      </Link>
    </div>
  );
}
