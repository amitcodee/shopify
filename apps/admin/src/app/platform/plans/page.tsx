import { formatMoney, minorToDecimalString, type Plan } from '@repo/contracts';
import { ActionForm, CheckboxField, Field, SubmitButton } from '@/components/form';
import { Badge, Card, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';
import { savePlanAction } from '../actions';

function PlanFields({ plan }: { plan: Plan | null }) {
  return (
    <>
      <Field name="code" label="Code" required defaultValue={plan?.code} />
      <Field name="name" label="Name" required defaultValue={plan?.name} />
      <Field
        name="price"
        label="Price / month (USD)"
        required
        inputMode="decimal"
        defaultValue={plan ? minorToDecimalString(plan.priceMonthly, 'USD') : '0'}
      />
      <Field
        name="maxProducts"
        label="Max products"
        inputMode="numeric"
        defaultValue={plan?.maxProducts}
        hint="Empty = unlimited"
      />
      <Field
        name="maxStaff"
        label="Max staff"
        inputMode="numeric"
        defaultValue={plan?.maxStaff}
        hint="Empty = unlimited"
      />
      <Field
        name="maxOrdersPerMonth"
        label="Max orders / month"
        inputMode="numeric"
        defaultValue={plan?.maxOrdersPerMonth}
        hint="Empty = unlimited"
      />
      <Field
        name="feePercent"
        label="Platform fee %"
        inputMode="decimal"
        defaultValue={plan ? (plan.transactionFeeBps / 100).toString() : '0'}
      />
      <Field
        name="sortOrder"
        label="Sort order"
        inputMode="numeric"
        defaultValue={plan?.sortOrder ?? 0}
      />
      <div className="flex items-end">
        <CheckboxField
          name="active"
          label="Available to merchants"
          defaultChecked={plan?.active ?? true}
        />
      </div>
    </>
  );
}

export default async function PlansPage() {
  const [user, plans] = await Promise.all([getCurrentUser(), api<Plan[]>('/platform/plans')]);
  const canEdit = user.platformRole === 'SUPER_ADMIN';
  return (
    <>
      <PageHeader title="Plans" description="Subscription plans offered to merchants." />
      <div className="space-y-6">
        {plans.map((p) => (
          <Card
            key={p.id}
            title={`${p.name} — ${p.priceMonthly === 0 ? 'Free' : `${formatMoney(p.priceMonthly, 'USD')}/mo`}`}
            actions={
              <div className="flex gap-2">
                {p.isDefault ? <Badge tone="indigo">Default</Badge> : null}
                {!p.active ? <Badge>Hidden</Badge> : null}
              </div>
            }
          >
            <ActionForm
              action={savePlanAction.bind(null, p.id)}
              className="grid gap-3 sm:grid-cols-3"
            >
              <fieldset disabled={!canEdit} className="contents">
                <PlanFields plan={p} />
              </fieldset>
              {canEdit ? (
                <div className="sm:col-span-3">
                  <SubmitButton variant="secondary">Save plan</SubmitButton>
                </div>
              ) : null}
            </ActionForm>
          </Card>
        ))}
        {canEdit ? (
          <Card title="New plan">
            <ActionForm
              action={savePlanAction.bind(null, null)}
              className="grid gap-3 sm:grid-cols-3"
            >
              <PlanFields plan={null} />
              <div className="sm:col-span-3">
                <SubmitButton>Create plan</SubmitButton>
              </div>
            </ActionForm>
          </Card>
        ) : null}
      </div>
    </>
  );
}
