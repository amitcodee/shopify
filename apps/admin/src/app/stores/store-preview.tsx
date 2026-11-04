/* eslint-disable @next/next/no-img-element -- media-host photos in a tiny decorative preview. */
import {
  contrastingText,
  type StoreOverview,
  THEME_FONT_STACKS,
  THEME_STYLES,
} from '@repo/contracts';

/** Compositions: which way the published design leads, from its template style. */
const OVER_PHOTO = new Set([
  'minimal',
  'fullbleed',
  'noir',
  'luxe',
  'catalog',
  'market',
  'spotlight',
]);
const CENTERED = new Set(['classic', 'editorial', 'poster', 'lookbook', 'swiss']);

function styleOf(theme: StoreOverview['theme']): string {
  const fromTemplate = theme.settings.template.split('-').pop() ?? '';
  return THEME_STYLES.some((s) => s.id === fromTemplate) ? fromTemplate : theme.preset;
}

/**
 * A miniature of the store drawn from its published theme and real product photos: its colors,
 * fonts, name and headline. Sizes are in `em` of a font size that tracks the card's width, so it
 * looks the same at every width. Decorative: the card's text carries the same information.
 */
export function StorePreview({
  store,
  address,
}: {
  store: Pick<StoreOverview, 'name' | 'theme' | 'photos'>;
  address: string;
}) {
  const s = store.theme.settings;
  const style = styleOf(store.theme);
  const [lead, ...rest] = store.photos;
  const title = s.heroTitle || store.name;
  const onBrand = contrastingText(s.brandColor);
  const heading = {
    fontFamily: THEME_FONT_STACKS[s.headingFont],
    textTransform: s.headingCase === 'uppercase' ? 'uppercase' : 'none',
  } as const;
  const button = (
    <span
      className="mt-[0.7em] inline-block rounded-[0.35em] px-[0.9em] py-[0.45em] text-[0.62em] font-semibold whitespace-nowrap"
      style={{ background: s.brandColor, color: onBrand }}
    >
      {s.heroCta || 'Shop now'}
    </span>
  );
  const wash = `linear-gradient(135deg, ${s.brandColor}, ${s.accentColor})`;

  let hero;
  if (OVER_PHOTO.has(style)) {
    hero = (
      <div
        className="relative flex min-h-[11em] items-end overflow-hidden"
        style={{ background: wash }}
      >
        {lead ? (
          <img
            src={lead.url}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[#000000b3] to-transparent" />
        <div className="relative p-[1em] text-[#ffffff]">
          <p className="line-clamp-2 text-[1.5em] leading-[1.05] font-bold" style={heading}>
            {title}
          </p>
        </div>
      </div>
    );
  } else if (CENTERED.has(style)) {
    hero = (
      <div className="px-[1em] pt-[1em] text-center">
        <p
          className="mx-auto line-clamp-2 max-w-[80%] text-[1.5em] leading-[1.05] font-bold"
          style={{ ...heading, color: s.brandColor }}
        >
          {title}
        </p>
        {button}
        <div className="relative mt-[0.8em] h-[5.5em] overflow-hidden" style={{ background: wash }}>
          {lead ? (
            <img
              src={lead.url}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover"
            />
          ) : null}
        </div>
      </div>
    );
  } else {
    hero = (
      <div className="grid grid-cols-[1.1fr_1fr] items-center gap-[0.8em] p-[1em]">
        <div className="min-w-0">
          <p
            className="line-clamp-3 text-[1.45em] leading-[1.05] font-bold"
            style={{ ...heading, color: s.brandColor }}
          >
            {title}
          </p>
          {button}
        </div>
        <div
          className="relative aspect-square overflow-hidden rounded-[0.5em]"
          style={{ background: wash }}
        >
          {lead ? (
            <img
              src={lead.url}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover"
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-t-lg border border-b-0 border-slate-200 bg-white shadow-raised [container-type:inline-size] transition-transform duration-300 ease-out-soft group-hover/card:-translate-y-1"
    >
      <div className="flex items-center gap-2 border-b border-slate-100 px-2.5 py-1.5">
        <span className="flex gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded bg-slate-100 px-2 py-0.5 text-center text-[10px] leading-3 text-slate-500">
          {address.replace(/^https?:\/\//, '')}
        </span>
      </div>
      <div
        className="h-[13.5em] overflow-hidden text-[3.2cqw]"
        style={{
          background: s.backgroundColor,
          color: s.textColor,
          fontFamily: THEME_FONT_STACKS[s.font],
        }}
      >
        {s.announcement ? (
          <p
            className="truncate px-[1em] py-[0.25em] text-center text-[0.6em]"
            style={{ background: s.brandColor, color: onBrand }}
          >
            {s.announcement}
          </p>
        ) : null}
        <div className="flex items-center justify-between px-[1em] py-[0.55em]">
          <span
            className="truncate text-[0.85em] font-bold"
            style={{ ...heading, color: s.brandColor }}
          >
            {store.name}
          </span>
          <span className="flex shrink-0 gap-[0.5em] opacity-40">
            <span className="h-[0.25em] w-[1.8em] rounded-full bg-current" />
            <span className="h-[0.25em] w-[1.8em] rounded-full bg-current" />
            <span className="h-[0.25em] w-[1.8em] rounded-full bg-current" />
          </span>
        </div>
        {hero}
        {rest.length > 0 ? (
          <div className="mt-[0.7em] grid grid-cols-3 gap-[0.5em] px-[1em]">
            {rest.slice(0, 3).map((photo) => (
              <div
                key={photo.url}
                className="relative aspect-square overflow-hidden rounded-[0.3em]"
                style={{ background: s.surfaceColor }}
              >
                <img
                  src={photo.url}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover"
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
