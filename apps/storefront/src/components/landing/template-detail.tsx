import { THEME_PREVIEW_PARAM, THEME_TEMPLATES, type ThemeTemplate } from '@repo/contracts';
import {
  Arrow,
  Breadcrumbs,
  buttonPrimary,
  buttonSecondary,
  container,
  CtaBand,
  display,
  Eyebrow,
  focusRing,
  lead,
  paper,
  SectionHeading,
  textLink,
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
          <SectionHeading id={id} title={title} size="md" />
          <a
            href={
              id === 'more-industry'
                ? `/templates?industry=${template.industry}`
                : `/templates?style=${template.style}`
            }
            className={`group inline-flex items-center gap-1 text-sm ${textLink}`}
          >
            See all <Arrow />
          </a>
        </div>
        <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-6 lg:grid-cols-4">
          {items.map((t) => (
            <li key={t.id}>
              <a href={`/templates/${t.id}`} className={`group block rounded-xl ${focusRing}`}>
                <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-900/10 transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_20px_40px_-20px_rgb(15_23_42/0.45)]">
                  <TemplateThumb template={t} tiles={3} scale={7} className="h-44 sm:h-56" />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-950 group-hover:text-indigo-700 sm:text-base">
                  {t.name}
                </p>
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
      <section className={`relative isolate overflow-hidden ${paper}`}>
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 -z-10 h-[70%]"
          style={{
            background: `linear-gradient(to bottom, transparent, color-mix(in srgb, ${s.accentColor} 18%, transparent))`,
          }}
        />
        <div className={`${container} pt-10 sm:pt-14`}>
          <Breadcrumbs
            items={[{ label: 'Templates', href: '/templates' }, { label: template.name }]}
          />
          <div className="mt-8 grid items-end gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
            <div>
              <Eyebrow>
                {template.industryLabel} · {template.styleLabel}
              </Eyebrow>
              <h1 className={`mt-5 text-slate-950 ${display}`}>{template.name}</h1>
            </div>
            <div>
              <p className={`text-slate-600 ${lead}`}>{template.description}</p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a href={`${signupUrl}?template=${template.id}`} className={buttonPrimary}>
                  Start with this template
                </a>
                <a href={previewUrl} target="_blank" rel="noreferrer" className={buttonSecondary}>
                  Preview on demo store<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop and phone previews. */}
        <div aria-hidden="true" className={`${container} relative mt-14 pb-16 sm:mt-16 sm:pb-24`}>
          <div className="relative mx-auto max-w-6xl">
            <div className="overflow-hidden rounded-2xl bg-white shadow-[0_50px_100px_-40px_rgb(15_23_42/0.55)] ring-1 ring-slate-900/10 md:mr-24 lg:mr-32">
              <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                <span className="flex gap-1.5">
                  <span className="size-2.5 rounded-full bg-slate-200" />
                  <span className="size-2.5 rounded-full bg-slate-200" />
                  <span className="size-2.5 rounded-full bg-slate-200" />
                </span>
                <span className="mx-auto w-full max-w-xs truncate rounded-md bg-white px-3 py-1 text-center text-xs text-slate-500 ring-1 ring-slate-200">
                  yourstore.com
                </span>
              </div>
              <div className="[container-type:inline-size]">
                <TemplateThumb
                  template={template}
                  tiles={Math.min(s.gridColumns, 4)}
                  scale="2.6cqw"
                  priority
                  className="aspect-[16/10]"
                />
              </div>
            </div>
            <div className="absolute -bottom-8 right-0 hidden w-52 rounded-[2.2rem] bg-slate-950 p-2 shadow-[0_40px_80px_-30px_rgb(15_23_42/0.7)] ring-1 ring-white/10 md:block lg:w-60">
              <div className="overflow-hidden rounded-[1.75rem]">
                <TemplateThumb
                  template={template}
                  phone
                  priority
                  scale={7.5}
                  className="aspect-[9/18]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="design" className="bg-white py-20 sm:py-28">
        <div className={`${container} grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-20`}>
          <div>
            <SectionHeading
              id="design"
              eyebrow="Design choices"
              title="What this template sets"
              intro="Every choice below can be changed after you apply the template — in your admin under Settings → Theme → Customize."
            />
            <h3 className="mt-10 text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Colors
            </h3>
            <ul className="mt-4 grid grid-cols-5 gap-2 sm:gap-3">
              {swatches.map(([label, hex]) => (
                <li key={label} className="min-w-0">
                  <span
                    className="block aspect-[4/5] rounded-xl ring-1 ring-slate-900/10"
                    style={{ background: hex }}
                  />
                  <span className="mt-2 block truncate text-xs font-medium text-slate-700">
                    {label}
                  </span>
                  <span className="block font-mono text-[10px] text-slate-500 uppercase">
                    {hex}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <dl className="divide-y divide-slate-900/[0.08] self-start rounded-2xl bg-[#f6f4ef] px-1 ring-1 ring-slate-900/[0.06]">
            {tokens.map(([k, v]) => (
              <div
                key={k}
                className="grid grid-cols-[8rem_1fr] gap-4 px-5 py-4 text-sm sm:grid-cols-[11rem_1fr]"
              >
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium text-slate-950">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className={paper}>
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
        photo="boutique-interior"
      />
    </>
  );
}
