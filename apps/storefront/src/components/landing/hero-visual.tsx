import { findThemeTemplate } from '@repo/contracts';
import { Photo } from './photos';
import { TemplateThumb } from './template-thumb';

const BARS = [38, 52, 44, 66, 58, 80, 72, 94];

/**
 * The home hero's picture: a real shop owner at work, with the store she runs on a phone and two
 * admin cards floating over the photo.
 */
export function HeroVisual() {
  const template = findThemeTemplate('fashion-minimal');
  return (
    <div className="relative mx-auto w-full max-w-xl pb-10 lg:max-w-none lg:pb-0">
      <div
        aria-hidden="true"
        className="absolute -inset-x-6 -top-6 -bottom-2 -z-10 rounded-[3rem] bg-[radial-gradient(closest-side,rgb(99_102_241/0.22),transparent)] blur-2xl"
      />
      <div className="relative ml-auto aspect-[4/3] overflow-hidden rounded-[2rem] bg-slate-200 shadow-[0_40px_80px_-40px_rgb(15_23_42/0.6)] ring-1 ring-slate-900/10 sm:aspect-[5/4] lg:w-[92%]">
        <Photo
          name="laptop-shop-counter"
          priority
          position="62% center"
          alt="A clothing shop owner managing her online store on a laptop"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-slate-950/25 via-transparent to-transparent"
        />
      </div>

      <div aria-hidden="true">
        {/* The store, on a phone. */}
        {template ? (
          <div className="absolute bottom-0 left-0 w-[34%] max-w-[12.5rem] rounded-[1.6rem] bg-slate-950 p-1.5 shadow-[0_30px_60px_-20px_rgb(15_23_42/0.6)] ring-1 ring-white/10 sm:rounded-[2rem] sm:p-2 lg:-left-6">
            <div className="overflow-hidden rounded-[1.25rem] sm:rounded-[1.55rem]">
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

        {/* New order. */}
        <div className="absolute top-4 right-3 w-48 rounded-2xl bg-white/95 p-3 shadow-[0_24px_48px_-16px_rgb(15_23_42/0.4)] ring-1 ring-slate-900/10 backdrop-blur sm:top-8 sm:-right-4 sm:w-56 sm:p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-slate-500">New order</p>
            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
              Paid
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2.5">
            <span className="flex h-9 items-center justify-center rounded-lg bg-indigo-50 px-2 text-xs font-bold text-indigo-700">
              #1042
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-900">Linen shirt · 2 items</p>
              <p className="text-[11px] text-slate-500">Ready to fulfil</p>
            </div>
          </div>
        </div>

        {/* Sales. */}
        <div className="absolute right-3 bottom-14 hidden w-56 rounded-2xl bg-white/95 p-4 shadow-[0_24px_48px_-16px_rgb(15_23_42/0.4)] ring-1 ring-slate-900/10 backdrop-blur sm:block lg:-right-6 lg:bottom-10">
          <p className="text-xs font-medium text-slate-500">Net sales · today</p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-slate-950">$1,284.50</p>
          <div className="mt-3 flex h-12 items-end gap-1">
            {BARS.map((h, i) => (
              <span
                key={i}
                className="flex-1 rounded-sm bg-gradient-to-t from-indigo-600 to-violet-400"
                style={{ height: `${h}%`, opacity: 0.45 + i * 0.07 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
