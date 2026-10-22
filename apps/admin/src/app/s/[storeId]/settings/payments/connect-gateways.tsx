import { type GatewayInfo, PAYOUT_COUNTRIES, RAZORPAY_BUSINESS_TYPES } from '@repo/contracts';
import { ActionForm, Field, SelectField, SubmitButton } from '@/components/form';
import { connectPaymentsAction } from './actions';

const countryName = new Intl.DisplayNames(['en'], { type: 'region' });

const DESCRIPTIONS: Record<GatewayInfo['provider'], string> = {
  mock: 'Simulated payments and onboarding for development. No money moves.',
  stripe:
    'Cards and wallets in 40+ countries. You verify your business on Stripe and get an Express dashboard for payouts.',
  razorpay:
    'Cards, UPI, netbanking and wallets for stores in India (INR). Payouts go to your Indian bank account through Razorpay Route.',
};

/** One card per gateway the platform offers; gateways that cannot settle the store's currency are disabled. */
export function ConnectGateways({
  storeId,
  gateways,
  currency,
}: {
  storeId: string;
  gateways: GatewayInfo[];
  currency: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {gateways.map((gateway) => {
        const supported = !gateway.currencies || gateway.currencies.includes(currency);
        return (
          <section
            key={gateway.provider}
            aria-labelledby={`gateway-${gateway.provider}`}
            className="rounded-lg border border-slate-200 p-4"
          >
            <h3 id={`gateway-${gateway.provider}`} className="font-semibold text-slate-900">
              {gateway.label}
            </h3>
            <p className="mt-1 text-sm text-slate-500">{DESCRIPTIONS[gateway.provider]}</p>
            {!supported ? (
              <p className="mt-3 text-sm text-amber-800">
                Available for stores selling in {gateway.currencies?.join(', ')}. This store sells
                in {currency}.
              </p>
            ) : gateway.onboarding === 'hosted' ? (
              <ActionForm
                action={connectPaymentsAction.bind(null, storeId, gateway.provider)}
                className="mt-4 space-y-4"
              >
                <SelectField
                  name="country"
                  label="Country of your business"
                  defaultValue="US"
                  hint="This cannot be changed later."
                  options={(gateway.countries.length
                    ? gateway.countries
                    : [...PAYOUT_COUNTRIES]
                  ).map((code) => ({ value: code, label: countryName.of(code) ?? code }))}
                />
                <SubmitButton>{`Set up ${gateway.label}`}</SubmitButton>
              </ActionForm>
            ) : (
              <ActionForm
                action={connectPaymentsAction.bind(null, storeId, gateway.provider)}
                className="mt-4 space-y-4"
              >
                <p className="text-xs text-slate-500">
                  These details go directly to {gateway.label} to verify your business and pay you
                  out. We don&apos;t store your bank details.
                </p>
                <Field name="business.legalBusinessName" label="Legal business name" required />
                <SelectField
                  name="business.businessType"
                  label="Business type"
                  defaultValue="proprietorship"
                  options={RAZORPAY_BUSINESS_TYPES.map((t) => ({
                    value: t,
                    label: t.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase()),
                  }))}
                />
                <Field name="business.contactName" label="Contact name" required />
                <Field
                  name="business.phone"
                  label="Mobile number"
                  inputMode="numeric"
                  pattern="[6-9][0-9]{9}"
                  maxLength={10}
                  required
                />
                <Field name="business.pan" label="PAN" maxLength={10} required />
                <Field name="business.street1" label="Registered address" required />
                <Field name="business.street2" label="Address line 2 (optional)" />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field name="business.city" label="City" required />
                  <Field name="business.state" label="State" required />
                  <Field
                    name="business.postalCode"
                    label="PIN code"
                    inputMode="numeric"
                    maxLength={6}
                    required
                  />
                </div>
                <Field
                  name="business.accountNumber"
                  label="Bank account number"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="business.ifsc" label="IFSC" maxLength={11} required />
                  <Field name="business.beneficiaryName" label="Account holder name" required />
                </div>
                <SubmitButton>{`Set up ${gateway.label}`}</SubmitButton>
              </ActionForm>
            )}
          </section>
        );
      })}
    </div>
  );
}
