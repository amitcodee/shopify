import type { Theme } from '@repo/contracts';
import type { ReactNode } from 'react';
import {
  ActionForm,
  CheckboxField,
  Field,
  SelectField,
  SubmitButton,
  TextAreaField,
} from '@/components/form';
import {
  BUTTON_OPTIONS,
  CARD_OPTIONS,
  CART_STYLE_OPTIONS,
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

const SOCIAL_FIELDS = [
  { name: 'socialInstagram', label: 'Instagram' },
  { name: 'socialFacebook', label: 'Facebook' },
  { name: 'socialX', label: 'X (Twitter)' },
  { name: 'socialYoutube', label: 'YouTube' },
  { name: 'socialTiktok', label: 'TikTok' },
] as const;

const colorClass =
  'h-10 w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-1 shadow-xs';

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

        <Group title="Header & cart" description="How shoppers move around and buy.">
          <CheckboxField
            name="stickyHeader"
            label="Keep the header visible while scrolling"
            defaultChecked={s.stickyHeader}
          />
          <SelectField
            name="cartStyle"
            label="Cart style"
            defaultValue={s.cartStyle}
            options={CART_STYLE_OPTIONS}
            hint="What happens when a shopper adds something to their cart."
          />
        </Group>

        <Group
          title="Homepage sections"
          description="Sections shown after the hero, in this order. Empty sections are skipped."
        >
          <CheckboxField
            name="showTrustBar"
            label="Show the trust bar"
            defaultChecked={s.showTrustBar}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(['trustItem1', 'trustItem2', 'trustItem3'] as const).map((name, i) => (
              <Field
                key={name}
                name={name}
                label={`Trust item ${i + 1}`}
                defaultValue={s[name]}
                maxLength={40}
              />
            ))}
          </div>
          <CheckboxField
            name="showCollections"
            label="Show collections on the homepage"
            defaultChecked={s.showCollections}
          />
          <CheckboxField
            name="showCollectionCarousels"
            label="Show a product row for each collection"
            defaultChecked={s.showCollectionCarousels}
          />
          <CheckboxField
            name="showBrandStory"
            label="Show the brand story"
            defaultChecked={s.showBrandStory}
          />
          <Field
            name="brandStoryTitle"
            label="Brand story title"
            defaultValue={s.brandStoryTitle}
            maxLength={80}
          />
          <TextAreaField
            name="brandStoryText"
            label="Brand story text"
            defaultValue={s.brandStoryText}
            maxLength={600}
            rows={4}
            hint="A few sentences about who you are. Blank lines start a new paragraph."
          />
          <CheckboxField
            name="showBlogPosts"
            label="Show the latest blog posts"
            defaultChecked={s.showBlogPosts}
          />
          <CheckboxField
            name="showNewsletter"
            label="Show the newsletter sign-up"
            defaultChecked={s.showNewsletter}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              name="newsletterTitle"
              label="Newsletter title"
              defaultValue={s.newsletterTitle}
              maxLength={80}
              placeholder="Join our newsletter"
            />
            <Field
              name="newsletterText"
              label="Newsletter text"
              defaultValue={s.newsletterText}
              maxLength={200}
              placeholder="New arrivals and offers, straight to your inbox."
            />
          </div>
        </Group>

        <Group title="Social links" description="Shown in the footer. Leave empty to hide.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SOCIAL_FIELDS.map(({ name, label }) => (
              <Field
                key={name}
                name={name}
                label={label}
                type="url"
                defaultValue={s[name]}
                placeholder="https://…"
              />
            ))}
          </div>
        </Group>
      </fieldset>
      {canEdit ? <SubmitButton>Save theme</SubmitButton> : null}
    </ActionForm>
  );
}
