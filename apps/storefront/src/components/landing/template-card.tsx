import { THEME_PREVIEW_PARAM, type ThemeTemplate } from '@repo/contracts';
import { TemplateScreen } from '@repo/template-preview';

// Not imported from page-parts: that module is server-only and this card also renders in the
// client-side gallery.
const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-fg';

/** Pastel panel color for a template: a soft tint of its accent. */
export function templateTint(t: ThemeTemplate, percent = 16): string {
  return `color-mix(in srgb, ${t.settings.accentColor} ${percent}%, var(--color-mk-subtle))`;
}

export function Swatches({ template: t }: { template: ThemeTemplate }) {
  return (
    <span aria-hidden="true" className="flex -space-x-1">
      {[t.settings.brandColor, t.settings.accentColor, t.settings.backgroundColor].map((c, i) => (
        <span
          key={i}
          className="size-4 rounded-full ring-2 ring-mk-bg"
          style={{ background: c, boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.12)' }}
        />
      ))}
    </span>
  );
}

/** The dots and address bar above a template screen. */
export function BrowserBar({ name }: { name: string }) {
  return (
    <div aria-hidden="true" className="flex items-center gap-3 bg-[#e9ebee] px-3.5 py-2">
      <span className="flex gap-1.5">
        <span className="size-2 rounded-full bg-[#c4c8ce]" />
        <span className="size-2 rounded-full bg-[#c4c8ce]" />
        <span className="size-2 rounded-full bg-[#c4c8ce]" />
      </span>
      <span className="mx-auto w-full max-w-[60%] truncate rounded-md bg-[#ffffff] px-2 py-0.5 text-center text-[10px] leading-4 text-[#5b6470]">
        {name.toLowerCase().replaceAll(' ', '')}.store
      </span>
    </div>
  );
}

const pill =
  'inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition';

/**
 * One template in a grid: a whole storefront page in a browser window that scrolls on hover, with
 * start/preview actions that fade in on hover or focus (always shown on touch screens). The window
 * and name link to the detail page.
 */
export function TemplateCard({
  template: t,
  size = 'lg',
  headingLevel: H = 'h2',
  demoStoreUrl,
  signupUrl,
}: {
  template: ThemeTemplate;
  /** Passed in because the URL module is server-only and the gallery is a client component. */
  demoStoreUrl: string;
  signupUrl: string;
  size?: 'lg' | 'sm';
  headingLevel?: 'h2' | 'h3';
}) {
  const lg = size === 'lg';
  return (
    <div className="group/template flex flex-col">
      <div className="relative">
        <a
          href={`/templates/${t.id}`}
          tabIndex={-1}
          aria-hidden="true"
          className="block overflow-hidden rounded-2xl shadow-[0_18px_40px_-24px_rgb(5_15_30/0.55)] ring-1 ring-mk-line transition duration-300 group-hover/template:-translate-y-1 group-hover/template:shadow-[0_34px_70px_-30px_var(--template-glow)]"
          style={{
            ['--template-glow' as string]: `color-mix(in srgb, ${t.settings.accentColor} 70%, transparent)`,
          }}
        >
          <BrowserBar name={t.name} />
          <TemplateScreen template={t} height={lg ? '23rem' : '15rem'} />
        </a>
        {lg ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-2 rounded-b-2xl bg-gradient-to-t from-[#020617a6] to-transparent px-4 pt-20 pb-4 opacity-0 transition duration-300 group-focus-within/template:opacity-100 group-hover/template:opacity-100 *:pointer-events-auto [@media(hover:none)]:opacity-100">
            <a
              href={`${signupUrl}?template=${t.id}`}
              className={`${pill} bg-[#ffffff] text-[#0b1220] hover:bg-[#e6e8ec] ${focusRing}`}
            >
              Use template<span className="sr-only">: {t.name}</span>
            </a>
            <a
              href={`${demoStoreUrl}/?${THEME_PREVIEW_PARAM}=${t.id}`}
              target="_blank"
              rel="noreferrer"
              className={`${pill} bg-[#0b1220cc] text-[#ffffff] ring-1 ring-[#ffffff40] backdrop-blur hover:bg-[#0b1220] ${focusRing}`}
            >
              Live preview
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-3.5">
                <path d="M6.2 4.5a.75.75 0 0 1 .75-.75h8.55a.75.75 0 0 1 .75.75v8.55a.75.75 0 0 1-1.5 0V6.31l-9.47 9.47a.75.75 0 1 1-1.06-1.06l9.47-9.47H6.95a.75.75 0 0 1-.75-.75Z" />
              </svg>
              <span className="sr-only"> of {t.name} (opens in a new tab)</span>
            </a>
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <H className={`${lg ? 'text-lg' : 'text-base'} font-semibold tracking-tight text-mk-fg`}>
            <a href={`/templates/${t.id}`} className={`rounded ${focusRing}`}>
              {t.name}
            </a>
          </H>
          <p className="mt-0.5 truncate text-sm text-mk-dim">
            {t.industryLabel.split(' & ')[0]} · {t.styleLabel}
          </p>
        </div>
        <span className="mt-1.5 shrink-0">
          <Swatches template={t} />
        </span>
      </div>
    </div>
  );
}
