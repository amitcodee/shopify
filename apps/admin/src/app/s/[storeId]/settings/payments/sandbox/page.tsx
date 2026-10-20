import type { PaymentsOverview } from '@repo/contracts';
import { notFound } from 'next/navigation';
import { Alert, Card } from '@/components/ui';
import { api } from '@/lib/api';
import { SmallAction } from '../../small-action';
import { sandboxOnboardingAction } from '../actions';

export const metadata = { title: 'Sandbox payments onboarding · Merchant Admin' };

/** Stands in for Stripe's hosted onboarding when the sandbox payment provider is active. */
export default async function SandboxOnboardingPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const payments = await api<PaymentsOverview>(`/admin/stores/${storeId}/payments`);
  if (!payments.sandbox || !payments.account) notFound();
  return (
    <Card
      title="Sandbox onboarding"
      description="In production this step happens on Stripe: business details, identity verification and a bank account for payouts."
    >
      <div className="space-y-4">
        <Alert tone="info">
          Account <code>{payments.account.accountId}</code>. Choose how the simulated verification
          ends.
        </Alert>
        <div className="flex flex-wrap gap-6">
          <SmallAction
            action={sandboxOnboardingAction.bind(null, storeId, 'complete')}
            label="Complete onboarding"
          />
          <SmallAction
            action={sandboxOnboardingAction.bind(null, storeId, 'restricted')}
            label="Finish with missing bank details"
          />
        </div>
      </div>
    </Card>
  );
}
