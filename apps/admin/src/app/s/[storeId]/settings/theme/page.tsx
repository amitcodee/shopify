import { contrastingText, THEME_FONTS, THEME_PRESETS, type Theme } from '@repo/contracts';
import { ActionForm, Field, SelectField, SubmitButton } from '@/components/form';
import { Card } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { saveThemeAction } from '../commerce-actions';

const PRESET_LABELS: Record<(typeof THEME_PRESETS)[number], string> = {
  minimal: 'Minimal — light and airy',
  bold: 'Bold — full-color hero',
  classic: 'Classic — centered, editorial',
};

export default async function ThemePage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const [store, theme] = await Promise.all([
    getStore(storeId),
    api<Theme>(`/admin/stores/${storeId}/theme`),
  ]);
  const canEdit = store.permissions.includes('themes:write');
  const s = theme.settings;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
      <Card
        title="Storefront theme"
        description="Pick a layout and brand your store. Changes are live on save."
      >
        <ActionForm action={saveThemeAction.bind(null, storeId)} className="max-w-xl space-y-4">
          <fieldset disabled={!canEdit} className="space-y-4">
            <SelectField
              name="preset"
              label="Layout"
              defaultValue={theme.preset}
              options={THEME_PRESETS.map((p) => ({ value: p, label: PRESET_LABELS[p] }))}
            />
            <div className="grid grid-cols-2 gap-4">
              <Field
                name="brandColor"
                label="Brand color"
                type="color"
                defaultValue={s.brandColor}
                className="h-10 w-full rounded-md border border-slate-300"
              />
              <Field
                name="accentColor"
                label="Accent color"
                type="color"
                defaultValue={s.accentColor}
                className="h-10 w-full rounded-md border border-slate-300"
              />
            </div>
            <SelectField
              name="font"
              label="Font"
              defaultValue={s.font}
              options={THEME_FONTS.map((f) => ({
                value: f,
                label: f[0]?.toUpperCase() + f.slice(1),
              }))}
            />
            <Field
              name="heroTitle"
              label="Homepage headline"
              defaultValue={s.heroTitle}
              maxLength={80}
              hint="Defaults to your store name."
            />
            <Field
              name="heroSubtitle"
              label="Homepage tagline"
              defaultValue={s.heroSubtitle}
              maxLength={200}
            />
            <Field
              name="announcement"
              label="Announcement bar"
              defaultValue={s.announcement}
              maxLength={120}
              hint="Shown at the top of every page. Leave empty to hide."
            />
          </fieldset>
          {canEdit ? <SubmitButton>Save theme</SubmitButton> : null}
        </ActionForm>
      </Card>
      <Card title="Preview">
        <div className="overflow-hidden rounded-md border border-slate-200">
          {s.announcement ? (
            <p
              className="px-3 py-1 text-center text-xs"
              style={{ background: s.accentColor, color: contrastingText(s.accentColor) }}
            >
              {s.announcement}
            </p>
          ) : null}
          <div
            className="px-4 py-8"
            style={{ background: s.brandColor, color: contrastingText(s.brandColor) }}
          >
            <p className="text-lg font-bold">{s.heroTitle || store.name}</p>
            {s.heroSubtitle ? <p className="text-sm opacity-90">{s.heroSubtitle}</p> : null}
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">Preview of saved settings.</p>
      </Card>
    </div>
  );
}
