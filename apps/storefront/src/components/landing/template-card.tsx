import { THEME_PREVIEW_PARAM, type ThemeTemplate } from '@repo/contracts';
import { TemplateThumb } from './template-thumb';

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

const pill =
  'inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition';

/**
 * One template in a grid: its storefront thumbnail on a pastel panel, with start/preview actions
 * that fade in on hover or focus (always shown on touch screens). The panel and name link to the
 * detail page.
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
    <div className="group flex flex-col">
      <div className="relative transition duration-300 group-hover:-translate-y-1">
        <a
          href={`/templates/${t.id}`}
          tabIndex={-1}
          aria-hidden="true"
          className="block overflow-hidden rounded-[1.75rem] px-3 pt-3 ring-1 ring-mk-line transition duration-300 group-hover:shadow-[0_28px_56px_-28px_rgb(15_23_42/0.5)] sm:px-4 sm:pt-4"
          style={{ background: templateTint(t) }}
        >
          <div className="overflow-hidden rounded-t-[1.1rem] shadow-[0_12px_32px_-16px_rgb(15_23_42/0.45)] ring-1 ring-mk-line">
            <TemplateThumb
              template={t}
              tiles={t.settings.gridColumns >= 4 ? 4 : 3}
              scale={lg ? 9 : 6.5}
              className={`${lg ? 'h-72 sm:h-80' : 'h-48 sm:h-56'} transition duration-700 group-hover:scale-[1.03]`}
            />
          </div>
        </a>
        {lg ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-2 rounded-b-[1.75rem] bg-gradient-to-t from-slate-950/45 to-transparent px-4 pt-16 pb-4 opacity-0 transition duration-300 group-focus-within:opacity-100 group-hover:opacity-100 *:pointer-events-auto [@media(hover:none)]:opacity-100">
            <a
              href={`${signupUrl}?template=${t.id}`}
              className={`${pill} bg-mk-fg text-mk-bg hover:opacity-85 ${focusRing}`}
            >
              Use template<span className="sr-only">: {t.name}</span>
            </a>
            <a
              href={`${demoStoreUrl}/?${THEME_PREVIEW_PARAM}=${t.id}`}
              target="_blank"
              rel="noreferrer"
              className={`${pill} mk-dark bg-navy-950/80 text-mk-fg ring-1 ring-mk-line backdrop-blur hover:bg-mk-fg hover:text-mk-bg ${focusRing}`}
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
            <a
              href={`/templates/${t.id}`}
              className={`rounded group-hover:text-mk-fg ${focusRing}`}
            >
              {t.name}
            </a>
          </H>
          <p className="mt-0.5 truncate text-sm text-mk-dim">
            {t.industryLabel} · {t.styleLabel}
          </p>
        </div>
        <span className="mt-1.5 shrink-0">
          <Swatches template={t} />
        </span>
      </div>
    </div>
  );
}
