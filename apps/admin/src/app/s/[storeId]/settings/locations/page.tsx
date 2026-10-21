import type { Location } from '@repo/contracts';
import { ActionForm, CheckboxField, Field, SubmitButton } from '@/components/form';
import { Badge, Card } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { SmallAction } from '../small-action';
import { deleteLocationAction, saveLocationAction } from './actions';

function LocationForm({
  storeId,
  location,
  disabled,
}: {
  storeId: string;
  location: Location | null;
  disabled: boolean;
}) {
  return (
    <ActionForm
      action={saveLocationAction.bind(null, storeId, location?.id ?? null)}
      className="space-y-3"
    >
      <fieldset disabled={disabled} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <Field name="name" label="Name" defaultValue={location?.name} required maxLength={100} />
          <Field
            name="priority"
            label="Priority"
            type="number"
            min={0}
            max={1000}
            defaultValue={location?.priority ?? 0}
            hint="Lower ships first."
          />
        </div>
        <Field name="address" label="Address" defaultValue={location?.address} maxLength={300} />
        <div className="flex flex-wrap gap-6">
          <CheckboxField
            name="active"
            label="Fulfils online orders"
            defaultChecked={location?.active ?? true}
          />
          <CheckboxField
            name="isDefault"
            label="Default location (new stock and restocks)"
            defaultChecked={location?.isDefault ?? false}
          />
        </div>
      </fieldset>
      {disabled ? null : (
        <SubmitButton variant="secondary">
          {location ? 'Save location' : 'Add location'}
        </SubmitButton>
      )}
    </ActionForm>
  );
}

export default async function LocationsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const [store, locations] = await Promise.all([
    getStore(storeId),
    api<Location[]>(`/admin/stores/${storeId}/locations`),
  ]);
  const canWrite = store.permissions.includes('settings:write');
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Orders take stock from active locations in priority order. Adjust or move stock per location
        on the Inventory page.
      </p>
      {locations.map((l) => (
        <Card key={l.id} title={l.name} description={`${l.unitsOnHand} unit(s) on hand`}>
          <div className="mb-3 flex gap-2">
            {l.isDefault ? <Badge tone="indigo">default</Badge> : null}
            {!l.active ? <Badge tone="gray">not fulfilling</Badge> : null}
          </div>
          <LocationForm storeId={storeId} location={l} disabled={!canWrite} />
          {canWrite && !l.isDefault ? (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <SmallAction
                action={deleteLocationAction.bind(null, storeId, l.id)}
                label="Delete location"
                danger
              />
            </div>
          ) : null}
        </Card>
      ))}
      {canWrite ? (
        <Card title="Add location">
          <LocationForm storeId={storeId} location={null} disabled={false} />
        </Card>
      ) : null}
    </div>
  );
}
