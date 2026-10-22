import { SUPPORTED_CURRENCIES, THEME_INDUSTRIES } from '@repo/contracts';
import { redirect } from 'next/navigation';
import { ActionForm, Field, SelectField, SubmitButton } from '@/components/form';
import { TopBar } from '@/components/top-bar';
import { getCurrentUser, getStartTemplate } from '@/lib/session';
import { createStoreAction } from './actions';

export const metadata = { title: 'Create a store · Merchant Admin' };

const storefrontDomain = process.env.STOREFRONT_ROOT_DOMAIN ?? 'localhost:3200';

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user.emailVerified) redirect('/verify-email');
  const startTemplate = await getStartTemplate();
  return (
    <>
      <TopBar user={user} />
      <main className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Create your store</h1>
        <p className="mt-1 text-sm text-slate-500">
          You can change everything except the store address later.
        </p>
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <ActionForm action={createStoreAction}>
            <Field name="name" label="Store name" required maxLength={100} />
            <Field
              name="subdomain"
              label="Store address"
              required
              minLength={3}
              maxLength={40}
              pattern="[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9]"
              hint={`Your storefront will be at <address>.${storefrontDomain}`}
            />
            <Field
              name="contactEmail"
              label="Contact email"
              type="email"
              required
              defaultValue={user.email}
            />
            <SelectField
              name="currency"
              label="Currency"
              defaultValue="USD"
              options={SUPPORTED_CURRENCIES.map((code) => ({ value: code, label: code }))}
            />
            <SelectField
              name="industry"
              label="What will you sell?"
              defaultValue={startTemplate?.industry ?? ''}
              hint={
                startTemplate
                  ? `Starting with the “${startTemplate.name}” template you picked. You can change it anytime.`
                  : "We'll start your storefront with a matching template. You can change it anytime."
              }
              options={[
                { value: '', label: 'Something else' },
                ...THEME_INDUSTRIES.map((industry) => ({
                  value: industry.id,
                  label: industry.label,
                })),
              ]}
            />
            {startTemplate ? (
              <input type="hidden" name="template" value={startTemplate.id} />
            ) : null}
            <SubmitButton>Create store</SubmitButton>
          </ActionForm>
        </div>
      </main>
    </>
  );
}
