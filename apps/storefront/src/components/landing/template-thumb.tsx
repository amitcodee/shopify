/* eslint-disable @next/next/no-img-element -- static same-origin photos with explicit sizes; next/image adds nothing here. */
import { contrastingText, THEME_FONT_STACKS as FONTS, type ThemeTemplate } from '@repo/contracts';
import type { CSSProperties, ReactNode } from 'react';
import { industryPhoto, productPhoto } from './photos';
import { sampleCategories, sampleProduct } from './template-samples';

/** Corner radius per template setting, in em of the thumbnail's base size. */
const RADII = { none: 0, small: 0.25, medium: 0.55, large: 1, pill: 1.3 } as const;
const RATIOS = { square: '1 / 1', portrait: '4 / 5', landscape: '4 / 3' } as const;

/** Soft tint of `hex` over transparent, for soft buttons and borders. */
function tint(hex: string, percent: number): string {
  return `color-mix(in srgb, ${hex} ${percent}%, transparent)`;
}

/** `hex` mixed into `base`, for opaque pastel panels. */
function mix(hex: string, percent: number, base: string): string {
  return `color-mix(in srgb, ${hex} ${percent}%, ${base})`;
}

const money = (n: number) => `$${n}`;

function Img({
  src,
  square,
  priority,
  style,
}: {
  src: string;
  square?: boolean;
  priority?: boolean;
  style?: CSSProperties;
}) {
  return (
    <img
      src={src}
      alt=""
      width={square ? 600 : 1500}
      height={square ? 600 : 1000}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      className="block size-full object-cover"
      style={style}
    />
  );
}

/** Tiny line icons, sized in em. */
function Icon({
  name,
  size = 0.95,
}: {
  name: 'search' | 'user' | 'bag' | 'arrow' | 'lock' | 'truck' | 'chat';
  size?: number;
}) {
  const paths = {
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
    bag: 'M5 8h14l-1 12H6L5 8Zm4 0V6a3 3 0 0 1 6 0v2',
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    lock: 'M6 11h12v9H6v-9Zm3 0V8a3 3 0 0 1 6 0v3',
    truck:
      'M3 7h11v9H3V7Zm11 3h4l3 3v3h-7v-6ZM7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
    chat: 'M4 5h16v11H9l-5 4V5Z',
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: `${size}em`, height: `${size}em`, flex: 'none' }}
    >
      <path d={paths[name]} />
    </svg>
  );
}

/**
 * A miniature storefront drawn from a template's settings: announcement, header, the hero
 * composition of the template's design style (mirroring the storefront's `Hero`), the trust bar
 * and a product grid, filled with real photos and sample products for the template's industry.
 * Every size is in `em`, so `scale` (the base font size in px) enlarges the whole store crisply.
 * Decorative only.
 */
export function TemplateThumb({
  template,
  tiles = 4,
  className = '',
  scale = 10,
  priority = false,
  phone = false,
}: {
  template: ThemeTemplate;
  tiles?: number;
  className?: string;
  /**
   * Base font size (px number, or any CSS length such as `2.8cqw` to track a container's width);
   * everything scales with it.
   */
  scale?: number | string;
  /** Load the photos eagerly (above-the-fold use only). */
  priority?: boolean;
  /** Phone layout: stacked hero and a two-column grid. */
  phone?: boolean;
}) {
  const s = template.settings;
  const r = `${RADII[s.radius]}em`;
  const ind = template.industry;
  const categories = sampleCategories(ind);
  // Different styles of one industry lead with different products.
  const offset = template.id.length % 4;
  const upper = s.headingCase === 'uppercase';
  const heading: CSSProperties = {
    fontFamily: FONTS[s.headingFont],
    textTransform: upper ? 'uppercase' : 'none',
    letterSpacing: upper ? '0.04em' : '-0.015em',
  };
  const eyebrowStyle: CSSProperties = {
    fontSize: '0.5em',
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    margin: 0,
  };
  const buttonBase: CSSProperties = {
    borderRadius: s.radius === 'pill' || s.radius === 'large' ? 999 : r,
    padding: '0.6em 1.2em',
    fontSize: '0.6em',
    fontWeight: 650,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5em',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    border: '1px solid transparent',
  };
  /** The button in the theme's style, filled with `bg`/`fg` (outline draws in `fg`). */
  const button = (bg: string, fg: string): CSSProperties =>
    s.buttonStyle === 'outline'
      ? { ...buttonBase, borderColor: bg, color: bg }
      : s.buttonStyle === 'soft'
        ? { ...buttonBase, background: bg, color: fg, boxShadow: `0 0.4em 1em -0.3em ${bg}` }
        : { ...buttonBase, background: bg, color: fg };
  const onBrand = contrastingText(s.brandColor);
  const onAccent = contrastingText(s.accentColor);
  const pad = s.density === 'compact' ? 0.9 : s.density === 'spacious' ? 1.4 : 1.15;
  const muted = tint(s.textColor, 62);

  const eyebrow = (text: string, color: string) => <p style={{ ...eyebrowStyle, color }}>{text}</p>;
  const title = (color: string, size: number, extra?: CSSProperties) => (
    <p
      style={{
        ...heading,
        color,
        fontSize: `${size}em`,
        lineHeight: 1.04,
        fontWeight: 700,
        margin: '0.3em 0 0',
        textWrap: 'balance',
        ...extra,
      }}
    >
      {template.sample.heroTitle}
    </p>
  );
  const subtitle = (color: string, align: 'left' | 'center' = 'left', extra?: CSSProperties) => (
    <p
      style={{
        color,
        opacity: 0.8,
        fontSize: '0.58em',
        lineHeight: 1.5,
        margin: `0.8em ${align === 'center' ? 'auto' : '0'} 0`,
        maxWidth: '24em',
        textAlign: align,
        ...extra,
      }}
    >
      {s.heroSubtitle}
    </p>
  );
  const cta = (bg: string = s.brandColor, fg: string = onBrand, marginTop = '0.9em') => (
    <div style={{ marginTop }}>
      <span style={button(bg, fg)}>
        {s.heroCta}
        <Icon name="arrow" size={1.05} />
      </span>
    </div>
  );
  const photo = (src: string, style?: CSSProperties) => (
    <div className="relative overflow-hidden" style={style}>
      <Img src={src} priority={priority} />
    </div>
  );
  const hero1 = industryPhoto(ind);
  const extra = (n: number) => productPhoto(ind, n + offset);
  const fill: CSSProperties = { position: 'absolute', inset: 0 };

  /** A collection shortcut: photo tile with a label, as the catalog/bento/market heroes link them. */
  const tileLabel = (label: string, color: string) => (
    <span
      className="flex items-center justify-between"
      style={{ fontSize: '0.62em', fontWeight: 650, color, gap: '0.4em' }}
    >
      <span className="truncate">{label}</span>
      <Icon name="arrow" size={1} />
    </span>
  );

  let hero: ReactNode;
  switch (phone && template.style === 'split' ? 'fullbleed' : template.style) {
    case 'bold':
      hero = (
        <div
          style={{ background: s.brandColor, borderRadius: r, overflow: 'hidden' }}
          className={phone ? 'grid' : 'grid grid-cols-[1.15fr_1fr] items-stretch'}
        >
          <div style={{ padding: phone ? '1.4em 1.2em' : '1.8em 1.6em' }} className="self-center">
            <div
              style={{
                width: '2.4em',
                height: '0.25em',
                borderRadius: 99,
                background: s.accentColor,
              }}
            />
            {title(onBrand, phone ? 1.45 : 1.95, { fontWeight: 800, lineHeight: 0.95 })}
            {subtitle(onBrand)}
            {cta(onBrand, s.brandColor)}
          </div>
          {photo(hero1, {
            minHeight: phone ? '8em' : '13em',
            order: phone ? -1 : 0,
            background: s.accentColor,
          })}
        </div>
      );
      break;
    case 'classic':
      hero = (
        <div>
          <div className="text-center" style={{ padding: '0.4em 0 1.2em' }}>
            {eyebrow(template.name, muted)}
            {title(s.brandColor, phone ? 1.4 : 1.8, { fontWeight: 500 })}
            <div
              style={{
                width: '2em',
                height: 1,
                background: s.accentColor,
                margin: '0.8em auto 0',
              }}
            />
            {subtitle(muted, 'center')}
            {cta()}
          </div>
          <div className="grid grid-cols-[1fr_1.6fr_1fr]" style={{ gap: '0.4em' }}>
            {photo(extra(1), { borderRadius: r, aspectRatio: '3 / 4' })}
            {photo(hero1, { borderRadius: r })}
            {photo(extra(2), { borderRadius: r, aspectRatio: '3 / 4' })}
          </div>
        </div>
      );
      break;
    case 'split':
      hero = (
        <div className="grid grid-cols-[1fr_1.1fr] items-center" style={{ gap: '1.8em' }}>
          <div>
            {eyebrow(template.name, s.accentColor)}
            {title(s.brandColor, 2, { fontWeight: 650 })}
            {subtitle(muted)}
            {cta()}
          </div>
          <div className="relative" style={{ paddingBottom: '0.6em' }}>
            {photo(hero1, { borderRadius: `calc(${r} * 1.6)`, aspectRatio: '4 / 4.6' })}
            <div
              className="absolute overflow-hidden"
              style={{
                left: '-1.1em',
                bottom: 0,
                width: '32%',
                aspectRatio: '1',
                borderRadius: r,
                border: `0.35em solid ${s.backgroundColor}`,
                boxShadow: '0 0.8em 1.6em -0.6em rgb(0 0 0 / 0.35)',
              }}
            >
              <Img src={extra(1)} square priority={priority} />
            </div>
          </div>
        </div>
      );
      break;
    case 'fullbleed':
      hero = (
        <div
          className="relative flex items-end overflow-hidden"
          style={{ margin: `0 -${pad}em`, minHeight: phone ? '15em' : '15em', background: '#111' }}
        >
          <div style={fill}>
            <Img src={hero1} priority={priority} />
          </div>
          <div
            style={{
              ...fill,
              background:
                'linear-gradient(to top, rgb(0 0 0 / 0.8), rgb(0 0 0 / 0.25) 60%, rgb(0 0 0 / 0.15))',
            }}
          />
          <div className="relative w-full" style={{ padding: `1.4em ${pad + 0.3}em` }}>
            {title('#ffffff', phone ? 1.7 : 2.5, { lineHeight: 0.92 })}
            <div className="flex items-end justify-between" style={{ gap: '1em' }}>
              {subtitle('#ffffff')}
              {phone ? null : cta('#ffffff', '#111111', '0')}
            </div>
          </div>
        </div>
      );
      break;
    case 'editorial':
      hero = (
        <div>
          <div
            className="flex justify-between"
            style={{
              ...eyebrowStyle,
              color: muted,
              borderTop: `1px solid ${s.textColor}`,
              borderBottom: `1px solid ${s.textColor}`,
              padding: '0.5em 0',
            }}
          >
            <span>This season</span>
            {phone ? null : <span>{template.name}</span>}
            <span>The edit</span>
          </div>
          <div
            className={phone ? 'grid' : 'grid grid-cols-[1.4fr_1fr]'}
            style={{ gap: '1.2em', marginTop: '1.1em' }}
          >
            <div className="flex flex-col">
              {title(s.brandColor, phone ? 1.8 : 2.5, { fontWeight: 400, lineHeight: 0.98 })}
              <div style={{ marginTop: 'auto', paddingTop: '1em' }}>
                {subtitle(s.textColor, 'left', {
                  fontFamily: FONTS[s.headingFont],
                  fontStyle: 'italic',
                  fontSize: '0.7em',
                })}
                {cta()}
              </div>
            </div>
            {phone ? null : photo(hero1, { aspectRatio: '5 / 6', borderRadius: r })}
          </div>
        </div>
      );
      break;
    case 'catalog':
      hero = (
        <div className={phone ? 'grid' : 'grid grid-cols-[2fr_1fr]'} style={{ gap: '0.5em' }}>
          <div
            className="relative flex items-center overflow-hidden"
            style={{ borderRadius: r, minHeight: '12.5em', background: '#111' }}
          >
            <div style={fill}>
              <Img src={hero1} priority={priority} />
            </div>
            <div
              style={{
                ...fill,
                background:
                  'linear-gradient(to right, rgb(0 0 0 / 0.72), rgb(0 0 0 / 0.35), transparent)',
              }}
            />
            <div className="relative" style={{ padding: '1.3em', maxWidth: '75%' }}>
              {title('#ffffff', 1.5)}
              {subtitle('#ffffff')}
              {cta('#ffffff', '#111111')}
            </div>
          </div>
          {phone ? null : (
            <div className="grid grid-rows-2" style={{ gap: '0.5em' }}>
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="relative flex items-end overflow-hidden"
                  style={{ borderRadius: r, background: '#111' }}
                >
                  <div style={fill}>
                    <Img src={extra(i + 2)} square priority={priority} />
                  </div>
                  <div
                    style={{
                      ...fill,
                      background: 'linear-gradient(to top, rgb(0 0 0 / 0.7), transparent 70%)',
                    }}
                  />
                  <div className="relative w-full" style={{ padding: '0.7em' }}>
                    {tileLabel(categories[i]!, '#ffffff')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
      break;
    case 'banner':
    case 'fresh': {
      const fresh = template.style === 'fresh';
      const from = s.brandColor;
      hero = fresh ? (
        <div>
          <div
            className="relative overflow-hidden"
            style={{
              background: s.brandColor,
              color: onBrand,
              borderRadius: r,
              clipPath: 'ellipse(150% 100% at 50% 0%)',
              padding: phone ? '1.4em 1.2em 3.4em' : '1.8em 1.8em 3.6em',
            }}
          >
            <div
              style={{
                ...fill,
                opacity: 0.1,
                backgroundImage: `radial-gradient(${onBrand} 0.08em, transparent 0.12em)`,
                backgroundSize: '1.6em 1.6em',
              }}
            />
            <div
              className={
                phone ? 'relative grid' : 'relative grid grid-cols-[1.15fr_1fr] items-center'
              }
              style={{ gap: '1.2em' }}
            >
              <div>
                {title(onBrand, phone ? 1.5 : 2, { fontWeight: 800 })}
                {subtitle(onBrand)}
                {cta(s.accentColor, onAccent)}
              </div>
              {phone ? null : (
                <div className="relative mx-auto" style={{ width: '82%', aspectRatio: '1' }}>
                  <div
                    style={{
                      position: 'absolute',
                      inset: '-6%',
                      borderRadius: 999,
                      border: `0.12em dashed ${tint(onBrand, 35)}`,
                    }}
                  />
                  {photo(hero1, {
                    borderRadius: 999,
                    height: '100%',
                    background: s.accentColor,
                    boxShadow: '0 1em 2em -1em rgb(0 0 0 / 0.5)',
                  })}
                </div>
              )}
            </div>
          </div>
          <div
            className="relative grid"
            style={{
              gridTemplateColumns: `repeat(${phone ? 2 : 4}, minmax(0, 1fr))`,
              gap: '0.45em',
              margin: '-2.3em 0.8em 0',
            }}
          >
            {[...categories, 'Offers'].slice(0, phone ? 2 : 4).map((c, i) => (
              <div
                key={c}
                className="flex items-center justify-between"
                style={{
                  background: s.backgroundColor,
                  borderRadius: '0.7em',
                  padding: '0.45em 0.45em 0.45em 0.65em',
                  boxShadow: '0 0.6em 1.4em -0.8em rgb(0 0 0 / 0.45)',
                  gap: '0.4em',
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate" style={{ fontSize: '0.58em', fontWeight: 650 }}>
                    {c}
                  </span>
                  <span className="block" style={{ fontSize: '0.46em', color: muted }}>
                    Shop now
                  </span>
                </span>
                <span
                  className="block shrink-0 overflow-hidden"
                  style={{ width: '1.9em', height: '1.9em', borderRadius: '0.45em' }}
                >
                  <Img src={productPhoto(ind, i + 1)} square priority={priority} />
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="relative overflow-hidden"
          style={{
            borderRadius: `calc(${r} * 1.5)`,
            minHeight: '12.5em',
            background: `linear-gradient(135deg, ${from} 0%, ${s.accentColor} 100%)`,
          }}
        >
          <div
            className="absolute"
            style={{
              right: '-2.5em',
              top: '-2.5em',
              width: '9em',
              height: '9em',
              borderRadius: 999,
              background: tint('#ffffff', 8),
            }}
          />
          <div
            className={phone ? 'relative' : 'relative grid grid-cols-2 items-center'}
            style={{ padding: '1.6em 1.5em', gap: '1.3em' }}
          >
            <div>
              {title(onBrand, phone ? 1.45 : 1.8, { fontWeight: 750 })}
              {subtitle(onBrand)}
              {cta(onBrand, s.brandColor)}
            </div>
            {phone
              ? null
              : photo(hero1, {
                  aspectRatio: '4 / 3',
                  borderRadius: `calc(${r} * 1.3)`,
                  boxShadow: '0 1em 2em -0.8em rgb(0 0 0 / 0.5)',
                  transform: 'rotate(1.5deg)',
                })}
          </div>
        </div>
      );
      break;
    }
    case 'noir':
      hero = (
        <div
          className="relative grid place-items-center overflow-hidden text-center"
          style={{ margin: `0 -${pad}em`, minHeight: '15em', background: '#050506' }}
        >
          <div style={{ ...fill, opacity: 0.7 }}>
            <Img src={hero1} priority={priority} />
          </div>
          <div
            style={{
              ...fill,
              background:
                'radial-gradient(ellipse at center, rgb(0 0 0 / 0.2), rgb(0 0 0 / 0.8) 75%)',
            }}
          />
          <div className="relative" style={{ padding: '1.6em' }}>
            {eyebrow(template.name, '#f4f4f5cc')}
            {title('#f4f4f5', phone ? 1.5 : 2, { fontWeight: 500, marginTop: '0.6em' })}
            <div
              style={{ width: '2em', height: 1, background: s.accentColor, margin: '0.9em auto 0' }}
            />
            {subtitle('#f4f4f5', 'center')}
            {cta('#ffffff', '#111111')}
          </div>
        </div>
      );
      break;
    case 'bento': {
      const panel = (bg: string, children: ReactNode, key?: number) => (
        <div
          key={key}
          className="relative overflow-hidden"
          style={{ background: bg, borderRadius: '1.6em' }}
        >
          {children}
        </div>
      );
      hero = (
        <div className={phone ? 'grid' : 'grid grid-cols-[1.65fr_1fr]'} style={{ gap: '0.5em' }}>
          {panel(
            mix(s.accentColor, 14, s.backgroundColor),
            <div className={phone ? 'grid' : 'grid grid-cols-[1.05fr_1fr]'}>
              <div style={{ padding: '1.4em 1.3em' }} className="self-center">
                {eyebrow(template.name, s.accentColor)}
                {title(s.brandColor, phone ? 1.4 : 1.6)}
                {subtitle(muted)}
                {cta()}
              </div>
              {photo(hero1, {
                margin: '0.45em',
                borderRadius: '1.2em',
                minHeight: phone ? '7em' : '11em',
                order: phone ? -1 : 0,
              })}
            </div>,
          )}
          {phone ? null : (
            <div className="grid grid-rows-2" style={{ gap: '0.5em' }}>
              {[0, 1].map((i) =>
                panel(
                  i ? s.surfaceColor : mix(s.brandColor, 10, s.backgroundColor),
                  <>
                    <div
                      className="absolute overflow-hidden"
                      style={{
                        top: '0.4em',
                        right: '0.4em',
                        bottom: '0.4em',
                        width: '44%',
                        borderRadius: '1.1em',
                      }}
                    >
                      <Img src={extra(i + 2)} square priority={priority} />
                    </div>
                    <div
                      className="relative flex h-full flex-col justify-between"
                      style={{ padding: '0.8em', maxWidth: '54%' }}
                    >
                      <div>
                        {eyebrow('Collection', muted)}
                        <p
                          style={{
                            ...heading,
                            fontSize: '0.85em',
                            fontWeight: 700,
                            margin: '0.25em 0 0',
                            color: s.brandColor,
                            lineHeight: 1.1,
                          }}
                        >
                          {categories[i]}
                        </p>
                      </div>
                      <span
                        className="grid place-items-center"
                        style={{
                          width: '1.6em',
                          height: '1.6em',
                          borderRadius: 999,
                          background: s.backgroundColor,
                          boxShadow: '0 0.1em 0.3em rgb(0 0 0 / 0.12)',
                        }}
                      >
                        <Icon name="arrow" size={0.75} />
                      </span>
                    </div>
                  </>,
                  i,
                ),
              )}
            </div>
          )}
        </div>
      );
      break;
    }
    case 'market': {
      const ink = s.textColor;
      hero = (
        <div
          className="grid"
          style={{
            gap: '0.4em',
            gridTemplateColumns: phone ? '1fr 1fr' : '1.6fr 1fr 0.85fr',
            gridTemplateRows: phone ? 'auto auto' : '1fr 1fr',
          }}
        >
          <div
            className="relative flex items-center overflow-hidden"
            style={{
              background: s.brandColor,
              color: onBrand,
              borderRadius: r,
              minHeight: phone ? '10em' : '13.5em',
              gridRow: phone ? 'auto' : '1 / 3',
              gridColumn: phone ? '1 / 3' : 'auto',
            }}
          >
            <div style={{ position: 'absolute', inset: '0 0 0 35%' }}>
              <Img src={hero1} priority={priority} />
            </div>
            <div
              style={{
                ...fill,
                background: `linear-gradient(to right, ${s.brandColor} 35%, ${tint(s.brandColor, 55)} 55%, transparent)`,
              }}
            />
            <div className="relative" style={{ padding: '1.2em', maxWidth: '68%' }}>
              <span
                style={{
                  ...eyebrowStyle,
                  letterSpacing: '0.08em',
                  background: s.accentColor,
                  color: onAccent,
                  padding: '0.3em 0.6em',
                  borderRadius: '0.2em',
                }}
              >
                {template.name}
              </span>
              {title(onBrand, phone ? 1.35 : 1.65, { fontWeight: 800, marginTop: '0.6em' })}
              {subtitle(onBrand)}
              {cta(onBrand, s.brandColor)}
            </div>
          </div>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="relative overflow-hidden"
              style={{
                background: i ? ink : s.accentColor,
                color: i ? s.backgroundColor : onAccent,
                borderRadius: r,
                minHeight: '6em',
                padding: '0.7em',
              }}
            >
              <div
                className="absolute overflow-hidden"
                style={{ right: 0, bottom: 0, width: '52%', height: '78%', borderTopLeftRadius: r }}
              >
                <Img src={extra(i + 2)} square priority={priority} />
              </div>
              <div className="relative" style={{ maxWidth: '48%' }}>
                <p
                  style={{
                    ...heading,
                    fontSize: '0.8em',
                    fontWeight: 800,
                    margin: 0,
                    lineHeight: 1.1,
                  }}
                >
                  {categories[i]}
                </p>
                <p
                  style={{
                    fontSize: '0.48em',
                    fontWeight: 650,
                    margin: '0.5em 0 0',
                    textDecoration: 'underline',
                  }}
                >
                  Shop now
                </p>
              </div>
            </div>
          ))}
          {phone ? null : (
            <div
              className="relative flex items-end overflow-hidden"
              style={{
                borderRadius: r,
                gridColumn: 3,
                gridRow: '1 / 3',
                background: s.surfaceColor,
              }}
            >
              <div style={fill}>
                <Img src={extra(1)} square priority={priority} />
              </div>
              <div
                className="relative w-full"
                style={{
                  margin: '0.45em',
                  background: s.backgroundColor,
                  borderRadius: r,
                  padding: '0.45em 0.6em',
                }}
              >
                {tileLabel('Shop everything', s.textColor)}
              </div>
            </div>
          )}
        </div>
      );
      break;
    }
    case 'poster':
      hero = (
        <div>
          <p
            style={{
              ...heading,
              color: s.brandColor,
              fontSize: phone ? '2.5em' : '3.6em',
              fontWeight: 800,
              lineHeight: 0.86,
              letterSpacing: '-0.01em',
              margin: 0,
            }}
          >
            {template.sample.heroTitle}
          </p>
          <div
            className="flex items-center justify-between"
            style={{
              borderTop: `0.25em solid ${s.accentColor}`,
              marginTop: '0.7em',
              paddingTop: '0.6em',
              gap: '1em',
            }}
          >
            {subtitle(muted, 'left', { margin: 0 })}
            {phone ? null : cta(undefined, undefined, '0')}
          </div>
          <div
            className="grid grid-cols-[1fr_1.5fr_1fr]"
            style={{ gap: '0.35em', marginTop: '0.8em' }}
          >
            {photo(extra(1), { aspectRatio: '4 / 5' })}
            {photo(hero1, {})}
            {photo(extra(2), { aspectRatio: '4 / 5' })}
          </div>
        </div>
      );
      break;
    case 'luxe':
      hero = (
        <div>
          <div
            className="relative flex items-center overflow-hidden"
            style={{
              borderRadius: r,
              minHeight: phone ? '12em' : '14em',
              background: s.surfaceColor,
            }}
          >
            <div style={fill}>
              <Img src={hero1} priority={priority} />
            </div>
            <div
              style={{
                ...fill,
                background: `linear-gradient(to right, ${s.backgroundColor} 0%, ${tint(s.backgroundColor, phone ? 85 : 80)} 40%, transparent 75%)`,
              }}
            />
            <div
              className="relative"
              style={{ padding: '1.4em 1.6em', maxWidth: phone ? '90%' : '52%' }}
            >
              {eyebrow(template.name, muted)}
              {title(s.brandColor, phone ? 1.45 : 1.75, { fontWeight: 400 })}
              {subtitle(s.textColor)}
              <div className="flex items-center" style={{ gap: '1em', marginTop: '0.9em' }}>
                {cta(undefined, undefined, '0')}
                {phone ? null : (
                  <span
                    style={{ fontSize: '0.55em', fontWeight: 650, textDecoration: 'underline' }}
                  >
                    Browse collections
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-center" style={{ gap: '1.4em', marginTop: '0.9em' }}>
            {[...categories, 'New in'].slice(0, phone ? 3 : 4).map((c, i) => (
              <div key={c} className="flex flex-col items-center" style={{ gap: '0.35em' }}>
                <span
                  className="block overflow-hidden"
                  style={{
                    width: '2.6em',
                    height: '2.6em',
                    borderRadius: 999,
                    border: `1px solid ${tint(s.textColor, 10)}`,
                  }}
                >
                  <Img src={productPhoto(ind, i + 1)} square priority={priority} />
                </span>
                <span style={{ fontSize: '0.5em', fontWeight: 550 }}>{c}</span>
              </div>
            ))}
          </div>
        </div>
      );
      break;
    default:
      // minimal: one large photo with the headline set into its lower corner.
      hero = (
        <div
          className="relative flex items-end overflow-hidden"
          style={{
            borderRadius: `calc(${r} * 1.6)`,
            minHeight: phone ? '13em' : '14em',
            background: '#111',
          }}
        >
          <div style={fill}>
            <Img src={hero1} priority={priority} />
          </div>
          <div
            style={{
              ...fill,
              background:
                'linear-gradient(to top right, rgb(0 0 0 / 0.72), rgb(0 0 0 / 0.2), transparent)',
            }}
          />
          <div className="relative" style={{ padding: '1.4em 1.5em', maxWidth: '75%' }}>
            {title('#ffffff', phone ? 1.6 : 2.1)}
            {subtitle('#ffffff')}
            {cta('#ffffff', '#111111')}
          </div>
        </div>
      );
  }

  const trustBar = (
    <div
      className="grid grid-cols-3"
      style={{
        marginTop: `${pad}em`,
        borderTop: `1px solid ${tint(s.textColor, 10)}`,
        borderBottom: `1px solid ${tint(s.textColor, 10)}`,
      }}
    >
      {(
        [
          ['lock', s.trustItem1],
          ['truck', s.trustItem2],
          ['chat', s.trustItem3],
        ] as const
      )
        .slice(0, phone ? 2 : 3)
        .map(([icon, label], i) => (
          <span
            key={icon}
            className="flex items-center justify-center"
            style={{
              gap: '0.45em',
              padding: '0.55em 0.3em',
              borderLeft: i ? `1px solid ${tint(s.textColor, 10)}` : 0,
              gridColumn: phone && i === 1 ? 'span 2' : undefined,
            }}
          >
            <span
              className="grid place-items-center"
              style={{
                width: '1.5em',
                height: '1.5em',
                borderRadius: 999,
                background: tint(s.accentColor, 14),
                color: s.accentColor,
              }}
            >
              <Icon name={icon} size={0.8} />
            </span>
            <span className="truncate" style={{ fontSize: '0.52em', fontWeight: 550 }}>
              {label}
            </span>
          </span>
        ))}
    </div>
  );

  const columns = phone ? 2 : tiles;
  const card = (i: number) => {
    const product = sampleProduct(ind, i + 1 + offset);
    const sale = i === 1;
    const imageBox = (
      <div
        className="relative"
        style={{ aspectRatio: RATIOS[s.imageRatio], borderRadius: r, overflow: 'hidden' }}
      >
        <Img src={productPhoto(ind, i + 1 + offset)} square priority={priority} />
        {sale ? (
          <span
            className="absolute"
            style={{
              left: '0.5em',
              top: '0.5em',
              background: s.accentColor,
              color: onAccent,
              fontSize: '0.5em',
              fontWeight: 700,
              padding: '0.3em 0.7em',
              borderRadius: 999,
              letterSpacing: '0.04em',
            }}
          >
            SALE
          </span>
        ) : null}
      </div>
    );
    const caption = (color: string) => (
      <div style={{ marginTop: '0.55em', color }}>
        <p
          className="truncate"
          style={{ fontSize: '0.62em', fontWeight: 550, margin: 0, lineHeight: 1.35 }}
        >
          {product.name}
        </p>
        <p style={{ fontSize: '0.62em', fontWeight: 700, margin: '0.15em 0 0' }}>
          {sale ? (
            <>
              <span style={{ color: s.cardStyle === 'overlay' ? color : s.accentColor }}>
                {money(Math.round(product.price * 0.8))}
              </span>{' '}
              <span style={{ opacity: 0.55, textDecoration: 'line-through', fontWeight: 500 }}>
                {money(product.price)}
              </span>
            </>
          ) : (
            money(product.price)
          )}
        </p>
      </div>
    );
    switch (s.cardStyle) {
      case 'overlay':
        return (
          <div key={i} className="relative">
            {imageBox}
            <div
              className="absolute inset-x-0 bottom-0"
              style={{
                padding: '0.2em 0.6em 0.6em',
                borderRadius: `0 0 ${r} ${r}`,
                background: 'linear-gradient(to top, rgb(0 0 0 / 0.7), transparent)',
              }}
            >
              {caption('#ffffff')}
            </div>
          </div>
        );
      case 'framed':
        return (
          <div key={i} style={{ background: s.surfaceColor, borderRadius: r, padding: '0.45em' }}>
            {imageBox}
            <div style={{ padding: '0 0.2em 0.15em' }}>{caption(s.textColor)}</div>
          </div>
        );
      case 'bordered':
        return (
          <div
            key={i}
            style={{
              border: `1px solid ${tint(s.textColor, 14)}`,
              borderRadius: r,
              padding: '0.35em 0.35em 0.55em',
            }}
          >
            {imageBox}
            <div style={{ padding: '0 0.2em' }}>{caption(s.textColor)}</div>
          </div>
        );
      case 'shadow':
        return (
          <div
            key={i}
            style={{
              boxShadow: '0 0.35em 1.1em -0.2em rgb(0 0 0 / 0.16)',
              borderRadius: r,
              background: s.backgroundColor,
              padding: '0.35em 0.35em 0.6em',
            }}
          >
            {imageBox}
            <div style={{ padding: '0 0.25em' }}>{caption(s.textColor)}</div>
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

  const logo = (
    <span
      style={{
        ...heading,
        color: s.brandColor,
        fontSize: '1.1em',
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {template.name}
    </span>
  );
  const nav = (
    <span className="flex" style={{ gap: '1.3em', fontSize: '0.6em', fontWeight: 550 }}>
      {['Shop all', ...categories.slice(0, 2), 'About'].map((n) => (
        <span key={n} style={{ whiteSpace: 'nowrap' }}>
          {n}
        </span>
      ))}
    </span>
  );
  const icons = (
    <span className="flex items-center" style={{ gap: '0.8em' }}>
      <Icon name="user" />
      <span className="relative flex">
        <Icon name="bag" />
        <span
          className="absolute grid place-items-center"
          style={{
            right: '-0.45em',
            top: '-0.35em',
            width: '1em',
            height: '1em',
            borderRadius: 999,
            background: s.accentColor,
            color: onAccent,
            fontSize: '0.5em',
            fontWeight: 700,
          }}
        >
          2
        </span>
      </span>
    </span>
  );
  const searchPill = (
    <span
      className="flex items-center"
      style={{
        gap: '0.45em',
        width: '9em',
        padding: '0.35em 0.7em',
        borderRadius: 999,
        background: s.surfaceColor,
        color: muted,
      }}
    >
      <Icon name="search" size={0.75} />
      <span style={{ fontSize: '0.55em' }}>Search</span>
    </span>
  );

  let header: ReactNode;
  if (phone) {
    header = (
      <div className="flex items-center justify-between" style={{ padding: `0.9em ${pad}em` }}>
        <span className="flex flex-col" style={{ gap: '0.22em' }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: '1.1em', height: '0.12em', background: s.textColor }} />
          ))}
        </span>
        {logo}
        {icons}
      </div>
    );
  } else if (s.headerStyle === 'inline') {
    header = (
      <div
        className="flex items-center justify-between"
        style={{ padding: `0.9em ${pad}em`, gap: '1.5em' }}
      >
        <span className="flex items-center" style={{ gap: '2em' }}>
          {logo}
          {nav}
        </span>
        <span className="flex items-center" style={{ gap: '1em' }}>
          {searchPill}
          {icons}
        </span>
      </div>
    );
  } else {
    header = (
      <div
        style={{
          padding: `0.9em ${pad}em 0.75em`,
          borderBottom: s.headerStyle === 'stacked' ? `1px solid ${tint(s.textColor, 12)}` : 0,
          marginBottom: s.headerStyle === 'stacked' ? '0.9em' : '0.2em',
        }}
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <span style={{ color: muted }}>
            <Icon name="search" />
          </span>
          {logo}
          <span className="justify-self-end">{icons}</span>
        </div>
        <div className="flex justify-center" style={{ marginTop: '0.7em', color: muted }}>
          {nav}
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`overflow-hidden select-none ${className}`}
      style={{
        background: s.backgroundColor,
        color: s.textColor,
        fontFamily: FONTS[s.font],
        fontSize: typeof scale === 'number' ? `${scale}px` : scale,
        lineHeight: 1.4,
      }}
    >
      <div
        className="truncate text-center"
        style={{
          background: s.brandColor,
          color: onBrand,
          fontSize: '0.56em',
          fontWeight: 550,
          padding: '0.55em 1em',
          letterSpacing: '0.03em',
        }}
      >
        {template.sample.announcement}
      </div>
      {header}
      <div style={{ padding: `0 ${pad}em ${pad}em` }}>
        {hero}
        {trustBar}
        <div
          className="flex items-end justify-between"
          style={{ marginTop: `${pad * 1.2}em`, marginBottom: '0.7em' }}
        >
          <div>
            {eyebrow('Just landed', muted)}
            <p
              style={{
                ...heading,
                fontSize: '1em',
                fontWeight: 700,
                margin: '0.2em 0 0',
                lineHeight: 1.1,
              }}
            >
              {s.featuredTitle}
            </p>
          </div>
          <span
            className="flex items-center"
            style={{ gap: '0.3em', fontSize: '0.58em', fontWeight: 600, color: muted }}
          >
            View all <Icon name="arrow" size={1} />
          </span>
        </div>
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: `${pad * 0.7}em`,
          }}
        >
          {Array.from({ length: phone ? 4 : tiles * 2 }, (_, i) => card(i))}
        </div>
      </div>
    </div>
  );
}
