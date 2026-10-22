import { contrastingText, THEME_FONT_STACKS as FONTS, type ThemeTemplate } from '@repo/contracts';
import type { CSSProperties } from 'react';

const RADII = { none: 0, small: 3, medium: 6, large: 10, pill: 14 } as const;
const RATIOS = { square: '1 / 1', portrait: '4 / 5', landscape: '4 / 3' } as const;

/** Soft tint of `hex` over transparent, for image placeholders and soft buttons. */
function tint(hex: string, percent: number): string {
  return `color-mix(in srgb, ${hex} ${percent}%, transparent)`;
}

/**
 * A miniature storefront drawn from a template's settings with plain HTML and CSS: header,
 * hero (shaped by the template's layout), and a row of product tiles. Decorative only.
 */
export function TemplateThumb({
  template,
  tiles = 4,
  className = '',
}: {
  template: ThemeTemplate;
  tiles?: number;
  className?: string;
}) {
  const s = template.settings;
  const radius = RADII[s.radius];
  const heading: CSSProperties = {
    fontFamily: FONTS[s.headingFont],
    textTransform: s.headingCase === 'uppercase' ? 'uppercase' : 'none',
    letterSpacing: s.headingCase === 'uppercase' ? '0.04em' : undefined,
  };
  const button: CSSProperties = {
    borderRadius: s.radius === 'pill' ? 999 : radius,
    ...(s.buttonStyle === 'solid'
      ? { background: s.accentColor, color: contrastingText(s.accentColor) }
      : s.buttonStyle === 'soft'
        ? { background: tint(s.accentColor, 18), color: s.textColor }
        : { border: `1px solid ${s.accentColor}`, color: s.textColor }),
  };
  const image = (strength = 22): CSSProperties => ({
    background: `linear-gradient(135deg, ${s.surfaceColor}, ${tint(s.accentColor, strength)})`,
  });
  const onBrand = contrastingText(s.brandColor);
  const centered = s.headerStyle !== 'inline';

  const heroText = (color: string, align: 'left' | 'center' = 'left') => (
    <div style={{ textAlign: align }}>
      <p
        className="text-[11px] leading-tight font-semibold sm:text-xs"
        style={{ ...heading, color }}
      >
        {template.sample.heroTitle}
      </p>
      <span
        className="mt-1.5 inline-block px-2 py-0.5 text-[8px] font-medium"
        style={
          s.buttonStyle === 'solid'
            ? button
            : { ...button, color, ...(s.buttonStyle === 'outline' ? { borderColor: color } : {}) }
        }
      >
        Shop now
      </span>
    </div>
  );

  let hero;
  switch (template.preset) {
    case 'bold':
      hero = (
        <div className="p-3" style={{ background: s.brandColor, borderRadius: radius }}>
          {heroText(onBrand)}
        </div>
      );
      break;
    case 'banner':
      hero = (
        <div
          className="p-3"
          style={{
            background: `linear-gradient(120deg, ${s.brandColor}, ${s.accentColor})`,
            borderRadius: radius,
          }}
        >
          {heroText(onBrand)}
        </div>
      );
      break;
    case 'split':
      hero = (
        <div className="grid grid-cols-2 items-center gap-2">
          {heroText(s.textColor)}
          <div className="aspect-[4/3]" style={{ ...image(35), borderRadius: radius }} />
        </div>
      );
      break;
    case 'fullbleed':
      hero = (
        <div
          className="-mx-2.5 flex aspect-[16/6] items-end p-2.5"
          style={{
            background: `linear-gradient(to top, ${tint(s.brandColor, 70)}, transparent), ${image(45).background}`,
          }}
        >
          {heroText(onBrand)}
        </div>
      );
      break;
    case 'classic':
      hero = (
        <div className="px-3 py-3" style={{ background: s.surfaceColor, borderRadius: radius }}>
          {heroText(s.textColor, 'center')}
        </div>
      );
      break;
    default:
      // minimal, editorial and catalog lead with type on the page background.
      hero = (
        <div className="py-2">
          {heroText(s.textColor, template.preset === 'editorial' ? 'center' : 'left')}
        </div>
      );
  }

  const card = (i: number) => {
    const imageBox = (
      <div
        style={{ aspectRatio: RATIOS[s.imageRatio], ...image(14 + i * 8), borderRadius: radius }}
      />
    );
    const caption = (color: string) => (
      <div className="mt-1 space-y-0.5">
        <div className="h-1 w-3/4 rounded-full" style={{ background: color, opacity: 0.55 }} />
        <div className="h-1 w-1/3 rounded-full" style={{ background: s.accentColor }} />
      </div>
    );
    switch (s.cardStyle) {
      case 'overlay':
        return (
          <div key={i} className="relative">
            {imageBox}
            <div className="absolute inset-x-1 bottom-1">{caption('#ffffff')}</div>
          </div>
        );
      case 'framed':
        return (
          <div key={i} className="p-1" style={{ background: s.surfaceColor, borderRadius: radius }}>
            {imageBox}
            {caption(s.textColor)}
          </div>
        );
      case 'bordered':
        return (
          <div
            key={i}
            className="p-0.5"
            style={{ border: `1px solid ${tint(s.textColor, 15)}`, borderRadius: radius }}
          >
            {imageBox}
            {caption(s.textColor)}
          </div>
        );
      case 'shadow':
        return (
          <div
            key={i}
            className="p-0.5"
            style={{
              boxShadow: '0 2px 6px rgb(0 0 0 / 0.12)',
              borderRadius: radius,
              background: s.backgroundColor,
            }}
          >
            {imageBox}
            {caption(s.textColor)}
          </div>
        );
      default:
        return (
          <div key={i}>
            {imageBox}
            {caption(s.textColor)}
          </div>
        );
    }
  };

  return (
    <div
      aria-hidden="true"
      className={`overflow-hidden select-none ${className}`}
      style={{ background: s.backgroundColor, color: s.textColor, fontFamily: FONTS[s.font] }}
    >
      <div
        className="truncate px-2 py-0.5 text-center text-[7px]"
        style={{ background: s.brandColor, color: onBrand }}
      >
        {template.sample.announcement}
      </div>
      <div
        className={`flex items-center gap-2 px-2.5 py-1.5 ${centered ? 'flex-col' : 'justify-between'}`}
      >
        <span className="text-[10px] font-bold" style={{ ...heading, color: s.brandColor }}>
          {template.name}
        </span>
        <span className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1 w-4 rounded-full"
              style={{ background: s.textColor, opacity: 0.3 }}
            />
          ))}
        </span>
      </div>
      <div className="space-y-2.5 px-2.5 pb-3">
        {hero}
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${tiles}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: tiles }, (_, i) => card(i))}
        </div>
      </div>
    </div>
  );
}
