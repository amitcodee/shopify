import {
  findThemeTemplate,
  THEME_INDUSTRIES,
  THEME_STYLES,
  THEME_TEMPLATES,
  type ThemeTemplate,
} from '@repo/contracts';
import { container, display, Eyebrow, lead, paper } from './page-parts';
import { TemplateGallery } from './template-gallery';
import { TemplateThumb } from './template-thumb';
import { demoStoreUrl, signupUrl } from './urls';

/** The public template store; `industry` / `style` preselect filters (unknown ids are ignored). */
export function TemplatesPage({ industry, style }: { industry: string; style: string }) {
  const fan = ['jewelry-editorial', 'home-split', 'sports-bold']
    .map(findThemeTemplate)
    .filter((t): t is ThemeTemplate => !!t);
  return (
    <>
      <section className={`relative isolate overflow-hidden ${paper}`}>
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(44rem_26rem_at_90%_0%,rgb(48_94_255/0.14),transparent)]"
        />
        <div
          className={`${container} grid items-center gap-12 pt-12 pb-16 sm:pt-16 lg:grid-cols-[1fr_1.1fr] lg:pt-20 lg:pb-20`}
        >
          <div className="max-w-2xl">
            <Eyebrow>Template store</Eyebrow>
            <h1 className={`mt-5 text-navy-900 ${display}`}>Templates for every kind of store</h1>
            <p className={`mt-6 text-slate-600 ${lead}`}>
              {THEME_TEMPLATES.length} templates across {THEME_INDUSTRIES.length} industries and{' '}
              {THEME_STYLES.length} design styles. Preview any of them on a demo store, then start
              your store with the one you like. You can switch any time.
            </p>
          </div>
          <div aria-hidden="true" className="relative hidden h-[25rem] sm:block">
            {fan.map((t, i) => (
              <div
                key={t.id}
                className={`absolute w-[58%] overflow-hidden rounded-2xl bg-white shadow-[0_30px_60px_-24px_rgb(15_23_42/0.45)] ring-1 ring-slate-900/10 ${
                  ['top-10 left-0 -rotate-3', 'top-0 left-[21%] z-10', 'top-12 right-0 rotate-3'][i]
                }`}
              >
                <TemplateThumb template={t} tiles={3} scale={8.5} priority className="h-80" />
              </div>
            ))}
          </div>
        </div>
      </section>
      <TemplateGallery
        initialIndustry={THEME_INDUSTRIES.some((i) => i.id === industry) ? industry : ''}
        initialStyle={THEME_STYLES.some((s) => s.id === style) ? style : ''}
        demoStoreUrl={demoStoreUrl}
        signupUrl={signupUrl}
      />
    </>
  );
}
