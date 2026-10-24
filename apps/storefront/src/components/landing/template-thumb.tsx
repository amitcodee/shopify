/* eslint-disable @next/next/no-img-element -- static same-origin photos with explicit sizes; next/image adds nothing here. */
import { contrastingText, THEME_FONT_STACKS as FONTS, type ThemeTemplate } from '@repo/contracts';
import type { CSSProperties, ReactNode } from 'react';
import { industryPhoto, productPhoto } from './photos';

/** Corner radius per template setting, in em of the thumbnail's base size. */
const RADII = { none: 0, small: 0.25, medium: 0.5, large: 0.9, pill: 1.2 } as const;
const RATIOS = { square: '1 / 1', portrait: '4 / 5', landscape: '4 / 3' } as const;

/** Soft tint of `hex` over transparent, for soft buttons and borders. */
function tint(hex: string, percent: number): string {
  return `color-mix(in srgb, ${hex} ${percent}%, transparent)`;
}

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

/**
 * A miniature storefront drawn from a template's settings — header, a hero shaped by the
 * template's layout, and product tiles — filled with real photos for the template's industry.
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
  // Different styles of one industry lead with different products.
  const offset = template.id.length % 4;
  const heading: CSSProperties = {
    fontFamily: FONTS[s.headingFont],
    textTransform: s.headingCase === 'uppercase' ? 'uppercase' : 'none',
    letterSpacing: s.headingCase === 'uppercase' ? '0.06em' : '-0.01em',
  };
  const buttonBase: CSSProperties = {
    borderRadius: s.radius === 'pill' ? 999 : r,
    padding: '0.45em 1.1em',
    fontSize: '0.72em',
    fontWeight: 600,
    display: 'inline-block',
    lineHeight: 1.2,
  };
  const button = (onColor?: string): CSSProperties =>
    s.buttonStyle === 'solid'
      ? { ...buttonBase, background: s.accentColor, color: contrastingText(s.accentColor) }
      : s.buttonStyle === 'soft'
        ? { ...buttonBase, background: tint(s.accentColor, 22), color: onColor ?? s.textColor }
        : {
            ...buttonBase,
            border: `1px solid ${onColor ?? s.accentColor}`,
            color: onColor ?? s.textColor,
          };
  const onBrand = contrastingText(s.brandColor);
  const pad = s.density === 'compact' ? 0.9 : s.density === 'spacious' ? 1.4 : 1.15;

  const heroText = (color: string, align: 'left' | 'center' = 'left', size = 1.5): ReactNode => (
    <div style={{ textAlign: align }}>
      <p
        style={{
          ...heading,
          color,
          fontSize: `${size}em`,
          lineHeight: 1.1,
          fontWeight: 700,
          margin: 0,
        }}
      >
        {template.sample.heroTitle}
      </p>
      <div style={{ marginTop: '0.8em' }}>
        <span style={button(s.buttonStyle === 'solid' ? undefined : color)}>Shop now</span>
      </div>
    </div>
  );
  const heroImg = (style?: CSSProperties) => (
    <Img src={industryPhoto(ind)} priority={priority} style={style} />
  );

  let hero: ReactNode;
  switch (phone && template.preset === 'split' ? 'fullbleed' : template.preset) {
    case 'bold':
      hero = (
        <div
          style={{ background: s.brandColor, borderRadius: r, overflow: 'hidden' }}
          className="grid grid-cols-[1.1fr_1fr] items-stretch"
        >
          <div style={{ padding: '1.4em 1.2em' }} className="self-center">
            {heroText(onBrand, 'left', phone ? 1.25 : 1.5)}
          </div>
          <div style={{ minHeight: '9em' }}>{heroImg()}</div>
        </div>
      );
      break;
    case 'banner':
      hero = (
        <div className="relative overflow-hidden" style={{ borderRadius: r, minHeight: '10em' }}>
          <div className="absolute inset-0">{heroImg()}</div>
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(100deg, ${tint(s.brandColor, 92)} 0%, ${tint(s.accentColor, 70)} 55%, transparent 100%)`,
            }}
          />
          <div className="relative" style={{ padding: '1.6em 1.3em', maxWidth: '70%' }}>
            {heroText(onBrand)}
          </div>
        </div>
      );
      break;
    case 'split':
      hero = (
        <div className="grid grid-cols-2 items-center" style={{ gap: '1.2em' }}>
          {heroText(s.textColor, 'left', 1.6)}
          <div style={{ aspectRatio: '4 / 3.4', borderRadius: r, overflow: 'hidden' }}>
            {heroImg()}
          </div>
        </div>
      );
      break;
    case 'fullbleed':
      hero = (
        <div
          className="relative flex items-end overflow-hidden"
          style={{ margin: `0 -${pad}em`, minHeight: phone ? '13em' : '12em' }}
        >
          <div className="absolute inset-0">{heroImg()}</div>
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgb(0 0 0 / 0.65), transparent 70%)' }}
          />
          <div className="relative" style={{ padding: `1.2em ${pad + 0.2}em` }}>
            {heroText('#ffffff')}
          </div>
        </div>
      );
      break;
    case 'classic':
      hero = (
        <div
          className="relative grid place-items-center overflow-hidden"
          style={{ borderRadius: r, minHeight: '11em', padding: '1.2em' }}
        >
          <div className="absolute inset-0">{heroImg()}</div>
          <div
            className="relative"
            style={{
              background: s.surfaceColor,
              borderRadius: r,
              padding: '1em 1.4em',
              boxShadow: '0 0.4em 1.2em rgb(0 0 0 / 0.15)',
            }}
          >
            {heroText(s.textColor, 'center', 1.25)}
          </div>
        </div>
      );
      break;
    case 'editorial':
      hero = (
        <div>
          <div style={{ padding: '0.6em 0 1em' }}>{heroText(s.textColor, 'center', 1.7)}</div>
          <div style={{ aspectRatio: '21 / 8', borderRadius: r, overflow: 'hidden' }}>
            {heroImg()}
          </div>
        </div>
      );
      break;
    case 'catalog':
      hero = (
        <div>
          <div style={{ padding: '0.3em 0 0.9em' }}>{heroText(s.textColor, 'left', 1.3)}</div>
          <div className="grid grid-cols-3" style={{ gap: '0.6em' }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="relative overflow-hidden"
                style={{ aspectRatio: '3 / 2', borderRadius: r }}
              >
                {i === 0 ? (
                  heroImg()
                ) : (
                  <Img src={productPhoto(ind, i + 2 + offset)} square priority={priority} />
                )}
                <span
                  className="absolute"
                  style={{
                    left: '0.5em',
                    bottom: '0.5em',
                    background: s.backgroundColor,
                    color: s.textColor,
                    fontSize: '0.6em',
                    fontWeight: 600,
                    padding: '0.25em 0.6em',
                    borderRadius: r,
                  }}
                >
                  {['New in', 'Best of', 'Gifts'][i]}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
      break;
    default:
      // minimal: type on the page background, products first.
      hero = <div style={{ padding: '0.8em 0 0.2em' }}>{heroText(s.textColor, 'left', 1.8)}</div>;
  }

  const columns = phone ? 2 : tiles;
  const card = (i: number) => {
    const imageBox = (
      <div style={{ aspectRatio: RATIOS[s.imageRatio], borderRadius: r, overflow: 'hidden' }}>
        <Img src={productPhoto(ind, i + 1 + offset)} square priority={priority} />
      </div>
    );
    const caption = (color: string) => (
      <div style={{ marginTop: '0.5em' }}>
        <div
          style={{
            height: '0.4em',
            width: '75%',
            borderRadius: 99,
            background: color,
            opacity: 0.6,
          }}
        />
        <div
          style={{
            height: '0.4em',
            width: '35%',
            marginTop: '0.35em',
            borderRadius: 99,
            background: s.accentColor,
          }}
        />
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
                padding: '0.5em',
                borderRadius: `0 0 ${r} ${r}`,
                background: 'linear-gradient(to top, rgb(0 0 0 / 0.6), transparent)',
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
            {caption(s.textColor)}
          </div>
        );
      case 'bordered':
        return (
          <div
            key={i}
            style={{
              border: `1px solid ${tint(s.textColor, 16)}`,
              borderRadius: r,
              padding: '0.3em 0.3em 0.5em',
            }}
          >
            {imageBox}
            {caption(s.textColor)}
          </div>
        );
      case 'shadow':
        return (
          <div
            key={i}
            style={{
              boxShadow: '0 0.25em 0.9em rgb(0 0 0 / 0.12)',
              borderRadius: r,
              background: s.backgroundColor,
              padding: '0.3em 0.3em 0.55em',
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

  const navBars = (
    <span className="flex" style={{ gap: '0.8em' }}>
      {[2.4, 2.8, 2].map((w, i) => (
        <span
          key={i}
          style={{
            height: '0.35em',
            width: `${w}em`,
            borderRadius: 99,
            background: s.textColor,
            opacity: 0.35,
          }}
        />
      ))}
    </span>
  );
  const logo = (
    <span
      style={{
        ...heading,
        color: s.brandColor,
        fontSize: '1.05em',
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {template.name}
    </span>
  );
  const bag = (
    <span
      style={{
        width: '0.9em',
        height: '0.9em',
        border: `0.12em solid ${s.textColor}`,
        borderRadius: '0.2em',
        opacity: 0.7,
      }}
    />
  );

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
          fontSize: '0.62em',
          padding: '0.45em 1em',
          letterSpacing: '0.02em',
        }}
      >
        {template.sample.announcement}
      </div>
      {s.headerStyle === 'inline' || phone ? (
        <div className="flex items-center justify-between" style={{ padding: `0.9em ${pad}em` }}>
          {logo}
          {phone ? (
            <span className="flex flex-col" style={{ gap: '0.22em' }}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{ width: '1.1em', height: '0.12em', background: s.textColor }}
                />
              ))}
            </span>
          ) : (
            <span className="flex items-center" style={{ gap: '1.4em' }}>
              {navBars}
              {bag}
            </span>
          )}
        </div>
      ) : (
        <div
          className="flex flex-col items-center"
          style={{
            padding: `0.9em ${pad}em 0.7em`,
            gap: '0.6em',
            borderBottom: s.headerStyle === 'stacked' ? `1px solid ${tint(s.textColor, 12)}` : 0,
            marginBottom: s.headerStyle === 'stacked' ? '0.8em' : 0,
          }}
        >
          {logo}
          {navBars}
        </div>
      )}
      <div style={{ padding: `0 ${pad}em ${pad}em` }}>
        {hero}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: `${pad * 0.7}em`,
            marginTop: `${pad}em`,
          }}
        >
          {Array.from(
            { length: phone ? 4 : template.preset === 'minimal' ? tiles * 2 : tiles },
            (_, i) => card(i),
          )}
        </div>
      </div>
    </div>
  );
}
