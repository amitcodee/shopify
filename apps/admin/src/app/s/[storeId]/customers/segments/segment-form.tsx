import { minorToDecimalString, SEGMENT_FIELDS, type Segment } from '@repo/contracts';
import { ActionForm, Field, InlineInput, InlineSelect, SubmitButton } from '@/components/form';
import type { FormState } from '@/lib/form';

export const segmentRows = (segment: Segment | null) =>
  Math.min(10, (segment?.conditions.length ?? 0) + 2);

const FIELD_OPTIONS = [
  { value: '', label: '— No condition —' },
  ...Object.entries(SEGMENT_FIELDS).map(([value, label]) => ({ value, label })),
];
const OP_OPTIONS = [
  { value: 'gte', label: 'at least' },
  { value: 'lte', label: 'at most' },
  { value: 'eq', label: 'exactly (orders only)' },
];

export function SegmentForm({
  segment,
  currency,
  action,
  canWrite,
}: {
  segment: Segment | null;
  currency: string;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  canWrite: boolean;
}) {
  const rows = segmentRows(segment);
  return (
    <ActionForm action={action} className="space-y-4">
      <fieldset disabled={!canWrite} className="space-y-4">
        <Field
          name="name"
          label="Segment name"
          defaultValue={segment?.name}
          required
          maxLength={100}
        />
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Customers who match all of:</p>
          {Array.from({ length: rows }, (_, i) => {
            const c = segment?.conditions[i];
            const value = !c
              ? ''
              : 'op' in c
                ? c.field === 'totalSpent'
                  ? minorToDecimalString(c.value, currency)
                  : String(c.value)
                : c.value
                  ? 'yes'
                  : 'no';
            return (
              <div key={i} className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr]">
                <InlineSelect
                  name={`field-${i}`}
                  label={`Condition ${i + 1} field`}
                  defaultValue={c?.field ?? ''}
                  groups={[{ options: FIELD_OPTIONS }]}
                />
                <InlineSelect
                  name={`op-${i}`}
                  label={`Condition ${i + 1} comparison`}
                  defaultValue={c && 'op' in c ? c.op : 'gte'}
                  groups={[{ options: OP_OPTIONS }]}
                />
                <InlineInput
                  name={`value-${i}`}
                  label={`Condition ${i + 1} value`}
                  defaultValue={value}
                  placeholder="Number, amount, or yes/no"
                />
              </div>
            );
          })}
          <p className="text-xs text-slate-500">
            Days count back from today. “Amount spent” is in {currency}. For yes/no fields the
            comparison is ignored. Save to add more conditions (up to 10).
          </p>
        </div>
      </fieldset>
      {canWrite ? <SubmitButton>{segment ? 'Save segment' : 'Create segment'}</SubmitButton> : null}
    </ActionForm>
  );
}
