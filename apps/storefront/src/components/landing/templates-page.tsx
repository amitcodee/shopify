import { THEME_INDUSTRIES, THEME_STYLES, THEME_TEMPLATES } from '@repo/contracts';
import { TemplateGallery } from './template-gallery';
import { demoStoreUrl, signupUrl } from './urls';

/** The public template store; `industry` / `style` preselect filters (unknown ids are ignored). */
export function TemplatesPage({ industry, style }: { industry: string; style: string }) {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-slate-950 pt-20 pb-20 text-white sm:pt-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(50rem_26rem_at_50%_0%,rgb(124_58_237/0.4),transparent)]" />
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            Templates for every kind of store
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            {THEME_TEMPLATES.length} templates across {THEME_INDUSTRIES.length} industries and{' '}
            {THEME_STYLES.length} design styles. Preview any of them on a demo store, then start
            your store with the one you like. You can switch any time.
          </p>
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
