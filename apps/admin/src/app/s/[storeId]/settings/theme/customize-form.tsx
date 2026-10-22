import type { Theme } from '@repo/contracts';
import type { ReactNode } from 'react';
import { ActionForm, CheckboxField, Field, SelectField, SubmitButton } from '@/components/form';
import {
  BUTTON_OPTIONS,
  CARD_OPTIONS,
  COLUMN_OPTIONS,
  DENSITY_OPTIONS,
  FONT_OPTIONS,
  FOOTER_OPTIONS,
  HEADER_OPTIONS,
  HEADING_CASE_OPTIONS,
  IMAGE_RATIO_OPTIONS,
  PRESET_OPTIONS,
  RADIUS_OPTIONS,
} from '@/lib/theme-options';
import { saveThemeAction } from '../commerce-actions';

const colorClass = 'h-10 w-full cursor-pointer rounded-md border border-slate-300 bg-white p-1';

function Group({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

/** Every theme setting, grouped. Field labels are relied on by end-to-end tests. */
export function CustomizeForm({
  storeId,
  theme,
  canEdit,
}: {
  storeId: string;
  theme: Theme;
  canEdit: boolean;
}) {
  const s = theme.settings;
  return (
    <ActionForm action={saveThemeAction.bind(null, storeId)} className="space-y-6">
      <fieldset disabled={!canEdit} className="space-y-6">
        <input type="hidden" name="template" value={s.template} />
        <Group title="Colors" description="Your brand palette across the storefront.">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field
              name="brandColor"
              label="Brand color"
              type="color"
              defaultValue={s.brandColor}
              className={colorClass}
            />
            <Field
              name="accentColor"
              label="Accent color"
              type="color"
              defaultValue={s.accentColor}
              className={colorClass}
            />
            <Field
              name="backgroundColor"
              label="Background color"
              type="color"
              defaultValue={s.backgroundColor}
              className={colorClass}
            />
            <Field
              name="surfaceColor"
              label="Surface color"
              type="color"
              defaultValue={s.surfaceColor}
              className={colorClass}
              hint="Hero panels and cards."
            />
            <Field
              name="textColor"
              label="Text color"
              type="color"
              defaultValue={s.textColor}
              className={colorClass}
            />
          </div>
        </Group>

        <Group title="Typography" description="System fonts load instantly on every device.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SelectField
              name="font"
              label="Body font"
              defaultValue={s.font}
              options={FONT_OPTIONS}
            />
            <SelectField
              name="headingFont"
              label="Heading font"
              defaultValue={s.headingFont}
              options={FONT_OPTIONS}
            />
            <SelectField
              name="headingCase"
              label="Heading case"
              defaultValue={s.headingCase}
              options={HEADING_CASE_OPTIONS}
            />
          </div>
        </Group>

        <Group
          title="Page structure"
          description="How the homepage, header and product grid are arranged."
        >
          <SelectField
            name="preset"
            label="Layout"
            defaultValue={theme.preset}
            options={PRESET_OPTIONS}
            hint="The homepage hero and what follows it."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              name="headerStyle"
              label="Header style"
              defaultValue={s.headerStyle}
              options={HEADER_OPTIONS}
            />
            <SelectField
              name="cardStyle"
              label="Product card style"
              defaultValue={s.cardStyle}
              options={CARD_OPTIONS}
            />
            <SelectField
              name="imageRatio"
              label="Image shape"
              defaultValue={s.imageRatio}
              options={IMAGE_RATIO_OPTIONS}
            />
            <SelectField
              name="gridColumns"
              label="Product columns"
              defaultValue={String(s.gridColumns)}
              options={COLUMN_OPTIONS}
              hint="On wide screens; phones show fewer."
            />
            <SelectField
              name="density"
              label="Spacing"
              defaultValue={s.density}
              options={DENSITY_OPTIONS}
            />
            <SelectField
              name="radius"
              label="Corner radius"
              defaultValue={s.radius}
              options={RADIUS_OPTIONS}
            />
            <SelectField
              name="buttonStyle"
              label="Button style"
              defaultValue={s.buttonStyle}
              options={BUTTON_OPTIONS}
            />
            <SelectField
              name="footerStyle"
              label="Footer style"
              defaultValue={s.footerStyle}
              options={FOOTER_OPTIONS}
            />
          </div>
          <CheckboxField
            name="showCollections"
            label="Show collections on the homepage"
            defaultChecked={s.showCollections}
          />
        </Group>

        <Group title="Content" description="Applying a template keeps any text you have set here.">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              name="heroCta"
              label="Button label"
              defaultValue={s.heroCta}
              maxLength={30}
              hint="Leave empty for the default."
            />
            <Field
              name="featuredTitle"
              label="Featured products title"
              defaultValue={s.featuredTitle}
              maxLength={40}
            />
          </div>
          <Field
            name="announcement"
            label="Announcement bar"
            defaultValue={s.announcement}
            maxLength={120}
            hint="Shown at the top of every page. Leave empty to hide."
          />
        </Group>
      </fieldset>
      {canEdit ? <SubmitButton>Save theme</SubmitButton> : null}
    </ActionForm>
  );
}
