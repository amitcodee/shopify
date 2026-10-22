import { THEME_PREVIEW_PARAM, THEME_TEMPLATES, type ThemeTemplate } from '@repo/contracts';
import {
  buttonGhostDark,
  buttonLight,
  container,
  CtaBand,
  PageHero,
  SectionHeading,
} from './page-parts';
import { TemplateThumb } from './template-thumb';
import { demoStoreUrl, signupUrl } from './urls';

const FONT_NAMES: Record<string, string> = {
  system: 'System sans-serif',
  serif: 'Classic serif',
  rounded: 'Rounded sans-serif',
  mono: 'Monospace',
  slab: 'Slab serif',
  humanist: 'Humanist sans-serif',
  geometric: 'Geometric sans-serif',
  condensed: 'Condensed sans-serif',
};

const LAYOUTS: Record<string, string> = {
  minimal: 'Minimal — headline on the page, products first',
  bold: 'Bold — a full-color hero block',
  classic: 'Classic — centered hero panel',
  split: 'Split — headline beside a featured image',
  fullbleed: 'Full bleed — edge-to-edge hero image',
  editorial: 'Editorial — centered, magazine-style',
  catalog: 'Catalog — collections and a dense grid',
  banner: 'Banner — a gradient banner hero',
};

const words = {
  radius: {
    none: 'Square',
    small: 'Slightly rounded',
    medium: 'Rounded',
    large: 'Very rounded',
    pill: 'Pill-shaped',
  },
  buttonStyle: { solid: 'Solid', outline: 'Outlined', soft: 'Soft tint' },
  headerStyle: {
    inline: 'Logo and menu on one row',
    centered: 'Centered logo',
    stacked: 'Logo above the menu',
  },
  cardStyle: {
    plain: 'Plain',
    bordered: 'Bordered',
    shadow: 'Raised with a shadow',
    overlay: 'Captions over the image',
    framed: 'Framed on a tinted panel',
  },
  imageRatio: { square: 'Square', portrait: 'Portrait (4:5)', landscape: 'Landscape (4:3)' },
  density: { compact: 'Compact', comfortable: 'Comfortable', spacious: 'Spacious' },
  footerStyle: { simple: 'Simple', columns: 'Columns', dark: 'Dark band' },
} as const;

function Row({
  template,
  title,
  id,
  items,
}: {
  template: ThemeTemplate;
  title: string;
  id: string;
  items: ThemeTemplate[];
}) {
  return (
    <section aria-labelledby={id} className="py-16 sm:py-20">
      <div className={container}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading id={id} title={title} />
          <a
            href={
              id === 'more-industry'
                ? `/templates?industry=${template.industry}`
                : `/templates?style=${template.style}`
            }
            className="rounded text-sm font-semibold text-indigo-600 hover:text-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            See all →
          </a>
        </div>
        <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-6 lg:grid-cols-4">
          {items.map((t) => (
            <li key={t.id}>
              <a
                href={`/templates/${t.id}`}
                className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600"
              >
                <div className="overflow-hidden rounded-xl shadow-sm ring-1 ring-slate-200 transition group-hover:shadow-lg">
                  <TemplateThumb template={t} tiles={3} className="h-40 sm:h-48" />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900 sm:text-base">{t.name}</p>
                <p className="text-xs text-slate-500 sm:text-sm">
                  {t.industryLabel} · {t.styleLabel}
                </p>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** `/templates/[id]`: one template with its design choices and related templates. */
export function TemplateDetail({ template }: { template: ThemeTemplate }) {
  const s = template.settings;
  const sameIndustry = THEME_TEMPLATES.filter(
    (t) => t.industry === template.industry && t.id !== template.id,
  ).slice(0, 4);
  const sameStyle = THEME_TEMPLATES.filter(
    (t) => t.style === template.style && t.id !== template.id,
  ).slice(0, 4);
  const swatches: [string, string][] = [
    ['Brand', s.brandColor],
    ['Accent', s.accentColor],
    ['Background', s.backgroundColor],
    ['Surface', s.surfaceColor],
    ['Text', s.textColor],
  ];
  const tokens: [string, string][] = [
    ['Homepage layout', LAYOUTS[template.preset] ?? template.preset],
    ['Body font', FONT_NAMES[s.font] ?? s.font],
    [
      'Heading font',
      `${FONT_NAMES[s.headingFont] ?? s.headingFont}${s.headingCase === 'uppercase' ? ', uppercase' : ''}`,
    ],
    ['Header', words.headerStyle[s.headerStyle]],
    ['Product cards', words.cardStyle[s.cardStyle]],
    ['Product images', words.imageRatio[s.imageRatio]],
    ['Product columns', `${s.gridColumns} on wide screens`],
    ['Corners', words.radius[s.radius]],
    ['Buttons', words.buttonStyle[s.buttonStyle]],
    ['Spacing', words.density[s.density]],
    ['Footer', words.footerStyle[s.footerStyle]],
  ];
  const previewUrl = `${demoStoreUrl}/?${THEME_PREVIEW_PARAM}=${template.id}`;

  return (
    <>
      <PageHero
        breadcrumbs={[{ label: 'Templates', href: '/templates' }, { label: template.name }]}
        eyebrow={`${template.industryLabel} · ${template.styleLabel}`}
        title={template.name}
        subtitle={template.description}
        actions={
          <>
            <a href={`${signupUrl}?template=${template.id}`} className={buttonLight}>
              Start with this template
            </a>
            <a href={previewUrl} target="_blank" rel="noreferrer" className={buttonGhostDark}>
              Preview on demo store<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </>
        }
      />

      <section aria-label="Template preview" className="bg-slate-100 py-14 sm:py-20">
        <div className={`${container} flex items-end justify-center gap-6 lg:gap-10`}>
          <div className="w-full max-w-4xl min-w-0 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10">
            <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2">
              <span className="size-2 rounded-full bg-slate-300" />
              <span className="size-2 rounded-full bg-slate-300" />
              <span className="size-2 rounded-full bg-slate-300" />
            </div>
            <TemplateThumb
              template={template}
              tiles={Math.min(s.gridColumns, 4)}
              className="sm:[zoom:1.6] lg:[zoom:2]"
            />
          </div>
          <div className="hidden w-44 shrink-0 rounded-[2rem] bg-slate-900 p-2 shadow-2xl md:block">
            <div className="overflow-hidden rounded-[1.6rem]">
              <TemplateThumb template={template} tiles={2} className="h-80" />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="design" className="py-20 sm:py-24">
        <div className={`${container} grid gap-12 lg:grid-cols-[1fr_1.4fr]`}>
          <div>
            <SectionHeading
              id="design"
              eyebrow="Design choices"
              title="What this template sets"
              intro="Every choice below can be changed after you apply the template — in your admin under Settings → Theme → Customize."
            />
            <h3 className="mt-10 text-sm font-semibold text-slate-900">Colors</h3>
            <ul className="mt-4 grid grid-cols-5 gap-3">
              {swatches.map(([label, hex]) => (
                <li key={label} className="text-center">
                  <span
                    className="block aspect-square rounded-xl ring-1 ring-slate-900/10"
                    style={{ background: hex }}
                  />
                  <span className="mt-2 block text-xs font-medium text-slate-700">{label}</span>
                  <span className="block font-mono text-[10px] text-slate-500 uppercase">
                    {hex}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <dl className="divide-y divide-slate-200 rounded-2xl ring-1 ring-slate-200">
            {tokens.map(([k, v]) => (
              <div
                key={k}
                className="grid grid-cols-[9rem_1fr] gap-4 px-5 py-3.5 text-sm sm:grid-cols-[12rem_1fr]"
              >
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="bg-slate-50">
        <Row
          template={template}
          id="more-industry"
          title={`More for ${template.industryLabel.toLowerCase()}`}
          items={sameIndustry}
        />
        <Row
          template={template}
          id="more-style"
          title={`More in the ${template.styleLabel} style`}
          items={sameStyle}
        />
      </div>
      <CtaBand
        title={`Start your store with ${template.name}`}
        body="Pick it when you sign up, then make it yours. You can switch templates any time."
        template={template.id}
      />
    </>
  );
}
