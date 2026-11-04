import {
  findThemeTemplate,
  TEMPLATE_LOOKS,
  THEME_INDUSTRIES,
  THEME_PREVIEW_PARAM,
  THEME_STYLES,
  THEME_TEMPLATES,
  type ThemeTemplate,
} from '@repo/contracts';
import { TemplateScreen, TemplateThumb } from '@repo/template-preview';
import {
  buttonLight,
  buttonPrimary,
  buttonSecondary,
  buttonGhostDark,
  container,
  CtaBand,
  display,
  Eyebrow,
  focusRing,
  headline,
  lead,
  paper,
  section,
  SectionHeading,
} from './page-parts';
import { BrowserBar, Swatches, templateTint } from './template-card';
import { TemplateGallery } from './template-gallery';
import { demoStoreUrl, signupUrl } from './urls';

const pick = (ids: string[]) =>
  ids.map(findThemeTemplate).filter((t): t is ThemeTemplate => t !== undefined);

/** Three columns of real template screens drifting past each other behind the headline. */
const WALL = [
  pick(['fashion-lookbook', 'food-pop', 'electronics-spotlight', 'home-arch']),
  pick(['beauty-duo', 'electronics-rail', 'sports-ticker', 'art-swiss']),
  pick(['home-showroom', 'kids-pop', 'jewelry-noir', 'fashion-mosaic']),
];

function WallScreen({ template }: { template: ThemeTemplate }) {
  return (
    <div className="overflow-hidden rounded-xl shadow-[0_24px_50px_-24px_rgb(0_0_0/0.8)] ring-1 ring-[#ffffff1f] [container-type:inline-size]">
      <TemplateThumb
        template={template}
        tiles={4}
        scale="2.6cqw"
        priority
        className="aspect-[4/5]"
      />
    </div>
  );
}

function TemplateWall() {
  return (
    <div
      aria-hidden="true"
      className="relative hidden h-[42rem] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)] lg:block"
    >
      <div className="absolute -inset-x-6 -inset-y-24 grid rotate-[-5deg] grid-cols-3 gap-4">
        {WALL.map((column, i) => (
          <div
            key={column[0]?.id}
            className={`flex flex-col gap-4 ${i === 1 ? 'tpl-wall-down' : 'tpl-wall-up'}`}
            style={{ animationDuration: `${70 + i * 12}s` }}
          >
            {/* Listed twice so the loop has no visible seam. */}
            {[...column, ...column].map((t, n) => (
              <WallScreen key={`${t.id}-${n}`} template={t} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A curated group of styles: a tinted panel with one of its templates rising out of it. */
function LookTile({ look, wide }: { look: (typeof TEMPLATE_LOOKS)[number]; wide: boolean }) {
  const sample = findThemeTemplate(look.sample);
  if (!sample) return null;
  const count = THEME_TEMPLATES.filter((t) =>
    (look.styles as readonly string[]).includes(t.style),
  ).length;
  return (
    <a
      href={`/templates?look=${look.id}#catalog`}
      className={`group/template relative flex h-[26rem] flex-col overflow-hidden rounded-3xl ring-1 ring-mk-line transition duration-300 hover:-translate-y-1 hover:shadow-[0_36px_70px_-40px_rgb(5_15_30/0.8)] ${wide ? 'lg:col-span-3' : 'lg:col-span-2'} ${focusRing}`}
      style={{ background: templateTint(sample, 26) }}
    >
      <span className="block p-6 pb-5">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-xl font-semibold tracking-tight text-mk-fg">{look.label}</span>
          <span className="shrink-0 text-sm text-mk-muted tabular-nums">{count} templates</span>
        </span>
        <span className="mt-1 block text-sm leading-6 text-mk-muted">{look.description}</span>
      </span>
      <span
        aria-hidden="true"
        className="mx-6 block flex-1 overflow-hidden rounded-t-xl shadow-[0_24px_50px_-20px_rgb(5_15_30/0.65)] ring-1 ring-mk-line"
      >
        <TemplateScreen template={sample} height="100%" />
      </span>
    </a>
  );
}

/** One template shown large: a desktop window with a phone in front, beside what makes it work. */
function Spotlight({
  template: t,
  note,
  flip,
}: {
  template: ThemeTemplate;
  note: string;
  flip: boolean;
}) {
  return (
    <div
      className={`group/template grid items-center gap-10 lg:gap-16 ${
        flip ? 'lg:grid-cols-[1fr_1.45fr]' : 'lg:grid-cols-[1.45fr_1fr]'
      }`}
    >
      <div aria-hidden="true" className={`relative pb-8 lg:pr-20 ${flip ? 'lg:order-2' : ''}`}>
        <div className="overflow-hidden rounded-2xl shadow-[0_44px_90px_-44px_rgb(5_15_30/0.8)] ring-1 ring-mk-line">
          <BrowserBar name={t.name} />
          <TemplateScreen template={t} height="clamp(20rem, 34vw, 32rem)" />
        </div>
        <div className="absolute right-0 bottom-0 hidden w-44 rounded-[1.9rem] bg-[#0b1220] p-1.5 shadow-[0_34px_70px_-26px_rgb(0_0_0/0.8)] ring-1 ring-[#ffffff24] sm:block xl:w-52">
          <div className="overflow-hidden rounded-[1.5rem]">
            <TemplateThumb template={t} phone scale={6.5} className="aspect-[9/18]" />
          </div>
        </div>
      </div>
      <div className={flip ? 'lg:order-1' : ''}>
        <Eyebrow>
          {t.industryLabel.split(' & ')[0]} · {t.styleLabel}
        </Eyebrow>
        <h3 className={`mt-4 text-mk-fg ${headline}`}>{t.name}</h3>
        <p className="mt-5 text-lg leading-8 text-mk-muted">{note}</p>
        <div className="mt-5">
          <Swatches template={t} />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={`${signupUrl}?template=${t.id}`} className={buttonPrimary}>
            Use {t.name}
          </a>
          <a
            href={`${demoStoreUrl}/?${THEME_PREVIEW_PARAM}=${t.id}`}
            target="_blank"
            rel="noreferrer"
            className={buttonSecondary}
          >
            Live preview<span className="sr-only"> of {t.name} (opens in a new tab)</span>
          </a>
        </div>
      </div>
    </div>
  );
}

const SPOTLIGHTS: { id: string; note: string }[] = [
  {
    id: 'fashion-mosaic',
    note: 'A checkerboard of photos and solid color. Your collections become part of the layout, so the first screen works like a lookbook cover.',
  },
  {
    id: 'beauty-arch',
    note: 'Stepped arches on a warm panel with a calm serif headline. It gives close-up product photos room to feel considered.',
  },
  {
    id: 'electronics-rail',
    note: 'A category rail sits beside the banner, with offer tiles and a dense grid below. Shoppers with a big catalog reach any department in one click.',
  },
];

const INCLUDED = [
  ['Every page styled', 'Home, collections, product pages, cart and checkout follow the design.'],
  ['Made for phones', 'Each template has a phone layout, not just a shrunken desktop.'],
  [
    'Yours to change',
    'Edit colors, fonts, sections and wording in the visual editor, with no code.',
  ],
  ['Switch any time', 'Change templates later. Your products, orders and wording stay put.'],
];

/** The public template store; `industry`, `style` and `look` preselect filters. */
export function TemplatesPage({
  industry,
  style,
  look,
}: {
  industry: string;
  style: string;
  look: string;
}) {
  const spotlights = SPOTLIGHTS.flatMap((s) => {
    const template = findThemeTemplate(s.id);
    return template ? [{ ...s, template }] : [];
  });
  return (
    <>
      <section className="relative isolate overflow-hidden bg-mk-bg">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(52rem_34rem_at_78%_30%,rgb(48_94_255/0.2),transparent),radial-gradient(34rem_24rem_at_0%_100%,rgb(219_39_119/0.09),transparent)]"
        />
        <div className={`${container} grid items-center gap-12 lg:grid-cols-[1fr_1.15fr]`}>
          <div className="max-w-xl py-16 sm:py-20 lg:py-24">
            <Eyebrow>Template store</Eyebrow>
            <h1 className={`mt-5 text-mk-fg ${display}`}>
              Open with a store that already looks finished
            </h1>
            <p className={`mt-6 text-mk-muted ${lead}`}>
              {THEME_TEMPLATES.length} storefront designs across {THEME_INDUSTRIES.length}{' '}
              industries and {THEME_STYLES.length} styles. Preview any of them on a live demo store,
              then make it yours.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#catalog" className={buttonLight}>
                Browse all templates
              </a>
              <a
                href={`${demoStoreUrl}/`}
                target="_blank"
                rel="noreferrer"
                className={buttonGhostDark}
              >
                Open the demo store<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          </div>
          <TemplateWall />
        </div>
      </section>

      <section aria-labelledby="looks" className={`${paper} ${section}`}>
        <div className={container}>
          <SectionHeading
            id="looks"
            eyebrow="Start with a feeling"
            title="Pick the look, then the details"
            intro="Hover a tile to scroll through a full page."
          />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {TEMPLATE_LOOKS.map((item, i) => (
              <li key={item.id} className={`contents`}>
                <LookTile look={item} wide={i < 2} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="spotlight" className={`bg-mk-bg ${section}`}>
        <div className={container}>
          <SectionHeading
            id="spotlight"
            eyebrow="In the spotlight"
            title="Three very different first impressions"
          />
          <div className="mt-14 space-y-24">
            {spotlights.map((s, i) => (
              <Spotlight key={s.id} template={s.template} note={s.note} flip={i % 2 === 1} />
            ))}
          </div>
        </div>
      </section>

      <div id="catalog" className="scroll-mt-16">
        <TemplateGallery
          initialIndustry={THEME_INDUSTRIES.some((i) => i.id === industry) ? industry : ''}
          initialStyle={THEME_STYLES.some((s) => s.id === style) ? style : ''}
          initialLook={TEMPLATE_LOOKS.some((l) => l.id === look) ? look : ''}
          demoStoreUrl={demoStoreUrl}
          signupUrl={signupUrl}
        />
      </div>

      <section aria-labelledby="included" className={`${paper} ${section}`}>
        <div className={container}>
          <SectionHeading id="included" eyebrow="In every template" title="More than a homepage" />
          <dl className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-mk-line ring-1 ring-mk-line sm:grid-cols-2 lg:grid-cols-4">
            {INCLUDED.map(([term, text]) => (
              <div key={term} className="bg-mk-surface p-7">
                <dt className="text-base font-semibold text-mk-fg">{term}</dt>
                <dd className="mt-2 text-[0.9375rem] leading-7 text-mk-muted">{text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <CtaBand />
    </>
  );
}
