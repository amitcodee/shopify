import { TopBar } from '@/components/top-bar';
import { Badge, Card, PageHeader } from '@/components/ui';
import { getCurrentUser } from '@/lib/session';
import { TwoFactor } from './two-factor';

export const metadata = { title: 'Security · Merchant Admin' };

export default async function SecurityPage() {
  const user = await getCurrentUser();
  return (
    <>
      <TopBar user={user} />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <PageHeader title="Account security" back={{ href: '/stores', label: 'Your stores' }} />
        <Card
          title="Two-factor authentication"
          description="Require a code from an authenticator app when you sign in."
          actions={user.twoFactorEnabled ? <Badge tone="green">On</Badge> : <Badge>Off</Badge>}
        >
          {user.platformRole !== 'NONE' && !user.twoFactorEnabled ? (
            <p className="mb-4 text-sm text-amber-800">
              Platform staff must enable two-factor authentication.
            </p>
          ) : null}
          <TwoFactor key={String(user.twoFactorEnabled)} enabled={user.twoFactorEnabled} />
        </Card>
      </main>
    </>
  );
}
