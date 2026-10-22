import { contrastingText, type ThemePreset, type ThemeSettings } from '@repo/contracts';
import type { CSSProperties, ReactNode } from 'react';
import { FONT_STACKS } from '@/lib/theme-options';

/**
 * A miniature storefront drawn with plain HTML/CSS from theme settings: no images or iframes,
 * so a gallery of 100+ stays cheap. Decorative (hidden from assistive tech); the card around it
 * names the template.
 */
export function TemplateThumbnail({
  preset,
  settings,
  storeName,
  heroTitle,
  announcement,
  height = 210,
}: {
  preset: ThemePreset;
  settings: ThemeSettings;
  storeName: string;
  heroTitle: string;
  announcement: string;
  height?: number;
}) {
  const s = settings;
  const radius = RADII[s.radius];
  const gap = GAPS[s.density];
  const muted = withAlpha(s.textColor, '55');
  const heading: CSSProperties = {
    fontFamily: FONT_STACKS[s.headingFont],
    textTransform: s.headingCase === 'uppercase' ? 'uppercase' : undefined,
    letterSpacing: s.headingCase === 'uppercase' ? '0.06em' : undefined,
    fontWeight: 700,
    lineHeight: 1.1,
    margin: 0,
  };
  const ctx: Ctx = { s, radius, gap, muted, heading, heroTitle };

  return (
    <div
      aria-hidden
      className="relative overflow-hidden select-none"
      style={{
        height,
        background: s.backgroundColor,
        color: s.textColor,
        fontFamily: FONT_STACKS[s.font],
        fontSize: 8,
      }}
    >
      {announcement ? (
        <div
          className="truncate px-2 text-center"
          style={{
            background: s.accentColor,
            color: contrastingText(s.accentColor),
            fontSize: 7,
            lineHeight: '14px',
          }}
        >
          {announcement}
        </div>
      ) : null}
      <Header ctx={ctx} storeName={storeName} />
      <Hero ctx={ctx} preset={preset} />
      <Products ctx={ctx} />
    </div>
  );
}

interface Ctx {
  s: ThemeSettings;
  radius: number;
  gap: number;
  muted: string;
  heading: CSSProperties;
  heroTitle: string;
}

const RADII: Record<ThemeSettings['radius'], number> = {
  none: 0,
  small: 2,
  medium: 4,
  large: 8,
  pill: 12,
};

const GAPS: Record<ThemeSettings['density'], number> = { compact: 4, comfortable: 7, spacious: 10 };

/** `#rrggbb` plus a two-digit alpha (inputs are schema-validated hex colors). */
function withAlpha(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

function MenuBars({ color, count = 3 }: { color: string; count?: number }) {
  return (
    <span className="flex items-center gap-1.5">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} style={{ width: 14, height: 2, borderRadius: 1, background: color }} />
      ))}
    </span>
  );
}

function Header({ ctx, storeName }: { ctx: Ctx; storeName: string }) {
  const { s, muted, heading } = ctx;
  const name = (
    <span className="truncate" style={{ ...heading, fontSize: 10, color: s.brandColor }}>
      {storeName}
    </span>
  );
  const cart = (
    <span style={{ width: 9, height: 9, borderRadius: 2, border: `1.5px solid ${s.textColor}` }} />
  );
  const border = { borderBottom: `1px solid ${withAlpha(s.textColor, '18')}` };
  if (s.headerStyle === 'stacked') {
    return (
      <div className="flex flex-col items-center gap-1.5 px-3 py-2" style={border}>
        {name}
        <MenuBars color={muted} count={4} />
      </div>
    );
  }
  if (s.headerStyle === 'centered') {
    return (
      <div className="grid grid-cols-3 items-center px-3 py-2.5" style={border}>
        <MenuBars color={muted} count={2} />
        <span className="flex justify-center">{name}</span>
        <span className="flex justify-end">{cart}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5" style={border}>
      {name}
      <span className="flex items-center gap-2">
        <MenuBars color={muted} />
        {cart}
      </span>
    </div>
  );
}

/** Call-to-action pill. `on` is the color behind it, for heroes painted in the brand color. */
function Cta({ ctx, label = 'Shop now', on }: { ctx: Ctx; label?: string; on?: string }) {
  const { s } = ctx;
  const ink = on ? contrastingText(on) : s.brandColor;
  const style: CSSProperties =
    s.buttonStyle === 'outline'
      ? { border: `1px solid ${ink}`, color: ink }
      : s.buttonStyle === 'soft'
        ? { background: withAlpha(ink, '22'), color: ink }
        : { background: ink, color: on ?? contrastingText(ink) };
  return (
    <span
      className="inline-block whitespace-nowrap"
      style={{
        ...style,
        borderRadius: s.radius === 'pill' ? 999 : ctx.radius,
        padding: '3px 8px',
        fontSize: 7,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}

function TextLines({ color, widths }: { color: string; widths: number[] }) {
  return (
    <span className="flex flex-col gap-1">
      {widths.map((w, i) => (
        <span key={i} style={{ width: `${w}%`, height: 2, borderRadius: 1, background: color }} />
      ))}
    </span>
  );
}

function Hero({ ctx, preset }: { ctx: Ctx; preset: ThemePreset }) {
  const { s, heading, heroTitle, radius, muted } = ctx;
  const title = (size: number, color?: string, extra?: CSSProperties) => (
    <p className="line-clamp-2" style={{ ...heading, fontSize: size, color, ...extra }}>
      {heroTitle}
    </p>
  );
  const imageFill = `linear-gradient(135deg, ${s.accentColor}, ${withAlpha(s.brandColor, 'cc')})`;

  switch (preset) {
    case 'bold':
      return (
        <div className="px-3 pt-2">
          <div
            className="flex flex-col items-start gap-1.5 px-3 py-3.5"
            style={{ background: s.brandColor, borderRadius: radius }}
          >
            {title(15, contrastingText(s.brandColor))}
            <Cta ctx={ctx} on={s.brandColor} />
          </div>
        </div>
      );
    case 'banner':
      return (
        <div className="px-3 pt-2">
          <div
            className="flex items-center justify-between gap-2 px-3 py-3"
            style={{
              background: `linear-gradient(100deg, ${s.brandColor}, ${s.accentColor})`,
              borderRadius: radius,
            }}
          >
            {title(12, contrastingText(s.brandColor))}
            <Cta ctx={ctx} on={s.brandColor} />
          </div>
        </div>
      );
    case 'split':
      return (
        <div className="grid grid-cols-2 items-center gap-2 px-3 pt-2">
          <div className="flex flex-col items-start gap-1.5">
            {title(12)}
            <TextLines color={muted} widths={[90, 70]} />
            <Cta ctx={ctx} />
          </div>
          <div style={{ height: 58, background: imageFill, borderRadius: radius }} />
        </div>
      );
    case 'fullbleed':
      return (
        <div
          className="flex flex-col items-center justify-center gap-1.5 px-3 text-center"
          style={{
            height: 66,
            background: `linear-gradient(160deg, ${withAlpha(s.accentColor, 'dd')}, ${s.brandColor})`,
          }}
        >
          {title(13, contrastingText(s.brandColor))}
          <Cta ctx={ctx} on={s.brandColor} />
        </div>
      );
    case 'editorial':
      return (
        <div className="px-3 pt-2">
          <div
            className="py-2"
            style={{
              borderTop: `2px solid ${s.textColor}`,
              borderBottom: `1px solid ${s.textColor}`,
            }}
          >
            {title(17, s.textColor, { fontFamily: FONT_STACKS.serif, fontWeight: 600 })}
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <TextLines color={muted} widths={[60]} />
            <Cta ctx={ctx} />
          </div>
        </div>
      );
    case 'catalog':
      return (
        <div className="px-3 pt-2">
          <div className="mb-1.5 flex items-center justify-between">
            {title(10)}
            <Cta ctx={ctx} />
          </div>
          <div className="grid grid-cols-6" style={{ gap: 3 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <span
                key={i}
                style={{
                  height: 22,
                  borderRadius: radius,
                  background: i % 2 ? s.surfaceColor : withAlpha(s.accentColor, '40'),
                }}
              />
            ))}
          </div>
        </div>
      );
    case 'classic':
      return (
        <div className="flex flex-col items-center gap-1.5 px-6 pt-4 pb-1 text-center">
          {title(13)}
          <TextLines color={muted} widths={[100]} />
          <Cta ctx={ctx} />
        </div>
      );
    default:
      return (
        <div className="px-3 pt-2">
          <div
            className="flex flex-col items-start gap-1.5 px-3 py-3"
            style={{ background: s.surfaceColor, borderRadius: radius }}
          >
            {title(12)}
            <TextLines color={muted} widths={[55]} />
            <Cta ctx={ctx} />
          </div>
        </div>
      );
  }
}

const RATIOS: Record<ThemeSettings['imageRatio'], string> = {
  square: '1 / 1',
  portrait: '3 / 4',
  landscape: '4 / 3',
};

function Products({ ctx }: { ctx: Ctx }) {
  const { s, gap } = ctx;
  const columns = s.gridColumns >= 4 ? 4 : 3;
  return (
    <div className="px-3" style={{ paddingTop: gap + 2 }}>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, gap }}>
        {Array.from({ length: columns }, (_, i) => (
          <ProductTile key={i} ctx={ctx} index={i} />
        ))}
      </div>
    </div>
  );
}

function ProductTile({ ctx, index }: { ctx: Ctx; index: number }) {
  const { s, radius, muted } = ctx;
  const image = (overlay?: ReactNode) => (
    <div
      className="relative overflow-hidden"
      style={{
        aspectRatio: RATIOS[s.imageRatio],
        borderRadius: s.cardStyle === 'framed' ? Math.max(0, radius - 2) : radius,
        background: `linear-gradient(${135 + index * 40}deg, ${s.surfaceColor}, ${withAlpha(s.accentColor, '55')})`,
      }}
    >
      {overlay}
    </div>
  );
  const caption = (
    <span className="mt-1 flex flex-col gap-1">
      <span style={{ width: '80%', height: 2, borderRadius: 1, background: s.textColor }} />
      <span style={{ width: '40%', height: 2, borderRadius: 1, background: muted }} />
    </span>
  );

  switch (s.cardStyle) {
    case 'overlay':
      return image(
        <span
          className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-1.5"
          style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.55))' }}
        >
          <span style={{ width: '75%', height: 2, borderRadius: 1, background: '#ffffff' }} />
          <span style={{ width: '40%', height: 2, borderRadius: 1, background: '#ffffffaa' }} />
        </span>,
      );
    case 'bordered':
      return (
        <div
          className="p-1"
          style={{ border: `1px solid ${withAlpha(s.textColor, '26')}`, borderRadius: radius }}
        >
          {image()}
          {caption}
        </div>
      );
    case 'shadow':
      return (
        <div
          className="p-1"
          style={{
            background: s.backgroundColor,
            borderRadius: radius,
            boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
          }}
        >
          {image()}
          {caption}
        </div>
      );
    case 'framed':
      return (
        <div className="p-1.5" style={{ background: s.surfaceColor, borderRadius: radius }}>
          {image()}
          {caption}
        </div>
      );
    default:
      return (
        <div>
          {image()}
          {caption}
        </div>
      );
  }
}
