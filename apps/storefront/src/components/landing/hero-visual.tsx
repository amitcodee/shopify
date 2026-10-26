import { findThemeTemplate, THEME_TEMPLATES } from '@repo/contracts';
import { glass } from './page-parts';
import { Photo } from './photos';
import { TemplateThumb } from './template-thumb';

const BARS = [38, 52, 44, 66, 58, 80, 72, 94];

/**
 * The home hero's picture: a shop owner at work behind diagonal beams of blue light, the store
 * she runs on a phone, and frosted glass chips and cards floating over the photo.
 */
export function HeroVisual() {
  const template = findThemeTemplate('fashion-minimal');
  return (
    <div className="relative mx-auto w-full max-w-xl pt-6 pb-12 lg:max-w-none lg:pb-6">
      {/* Light beams behind the photo. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-visible">
        <div className="absolute top-[-10%] right-[8%] h-[120%] w-[38%] rotate-[24deg] rounded-full bg-gradient-to-b from-azure-300/0 via-azure-400/45 to-azure-200/0 blur-2xl" />
        <div className="absolute top-[-6%] right-[34%] h-[110%] w-[14%] rotate-[24deg] rounded-full bg-gradient-to-b from-azure-200/0 via-azure-300/50 to-azure-100/0 blur-xl" />
        <div className="absolute right-[-4%] bottom-[-8%] h-[70%] w-[60%] rounded-full bg-[radial-gradient(closest-side,rgb(48_94_255/0.18),transparent)] blur-2xl" />
      </div>

      <div className="relative ml-auto aspect-[4/3] overflow-hidden rounded-2xl bg-slate-200 shadow-[0_40px_80px_-40px_rgb(10_34_54/0.55)] ring-1 ring-slate-900/10 sm:aspect-[5/4] lg:w-[90%]">
        <Photo
          name="laptop-shop-counter"
          priority
          position="62% center"
          alt="A clothing shop owner managing her online store on a laptop"
        />
        {/* The beams continue over the photo. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(114deg,transparent_42%,rgb(110_141_255/0.28)_52%,rgb(197_212_255/0.18)_58%,transparent_66%)] mix-blend-screen"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-navy-950/25 via-transparent to-transparent"
        />
      </div>

      <div aria-hidden="true">
        {/* The store, on a phone. */}
        {template ? (
          <div className="absolute bottom-2 left-0 w-[32%] max-w-[12rem] rounded-[1.6rem] bg-navy-950 p-1.5 shadow-[0_30px_60px_-20px_rgb(10_34_54/0.6)] ring-1 ring-white/10 lg:-left-4">
            <div className="overflow-hidden rounded-[1.25rem]">
              <TemplateThumb
                template={template}
                phone
                priority
                scale={7}
                className="aspect-[9/17]"
              />
            </div>
          </div>
        ) : null}

        {/* Glass chips, stacked like a list down the right edge. */}
        <ul className="absolute top-[22%] right-1 flex flex-col items-end gap-2.5 sm:-right-3 lg:-right-6">
          {[
            [String(THEME_TEMPLATES.length), 'store templates'],
            ['Stripe', '& Razorpay'],
            ['Multi-currency', 'checkout'],
          ].map(([strong, rest], i) => (
            <li
              key={strong}
              className={`rounded-full px-4 py-2 text-[13px] text-navy-900 sm:text-sm ${glass} ${
                i === 1 ? 'mr-6 sm:mr-10' : ''
              }`}
            >
              <span className="font-semibold">{strong}</span> {rest}
            </li>
          ))}
        </ul>

        {/* New order. */}
        <div
          className={`absolute top-0 right-[18%] hidden w-52 rounded-xl p-3 sm:block lg:right-[22%] ${glass}`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-slate-600">New order</p>
            <span className="rounded-full bg-leaf-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-leaf-600">
              Paid
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2.5">
            <span className="flex h-9 items-center justify-center rounded-md bg-azure-600 px-2 text-xs font-bold text-white">
              #1042
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-navy-900">Linen shirt · 2 items</p>
              <p className="text-[11px] text-slate-600">Ready to fulfil</p>
            </div>
          </div>
        </div>

        {/* Sales. */}
        <div
          className={`absolute right-4 bottom-0 hidden w-56 rounded-xl p-4 sm:block lg:right-2 ${glass}`}
        >
          <p className="text-xs font-medium text-slate-600">Net sales · today</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-navy-900">
            $1,284.50
          </p>
          <div className="mt-3 flex h-10 items-end gap-1">
            {BARS.map((h, i) => (
              <span
                key={i}
                className="flex-1 rounded-sm bg-gradient-to-t from-azure-600 to-azure-300"
                style={{ height: `${h}%`, opacity: 0.45 + i * 0.07 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
