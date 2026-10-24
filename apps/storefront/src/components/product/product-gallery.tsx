'use client';

import type { StorefrontProduct } from '@repo/contracts';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { srcSetFor } from '@/lib/images';
import { ProductIcon } from './icons';
import { VARIANT_IMAGE_EVENT, type VariantImageDetail } from './variant-image';

type Image = StorefrontProduct['images'][number];

/**
 * Width of the main image box: the 7fr column of the product page (82rem wide at most) less
 * the thumbnail column; the full width on phones.
 */
const MAIN_SIZES = '(min-width: 1312px) 600px, (min-width: 768px) 50vw, 100vw';

const srcSetOf = (image: Image) => srcSetFor(image.url, image.renditions, image.width);

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

/**
 * Product images: one swipeable scroll-snap track (phones swipe it, with dots underneath) and,
 * from md up, thumbnails on the left plus previous/next arrows. Clicking an image opens a
 * full-screen viewer (a modal <dialog>, so Escape closes it and the page behind is inert).
 * Choosing a variant with its own image (see `variant-image.ts`) scrolls to that image.
 */
export function ProductGallery({
  images,
  title,
  ratio,
  productId,
  initialImageId,
}: {
  images: Image[];
  title: string;
  /** Aspect-ratio class for the main image box (the theme's image ratio). */
  ratio: string;
  /** Only variant-image announcements for this product move the gallery. */
  productId?: string;
  /** Image of the variant selected when the page opens (the gallery starts on it). */
  initialImageId?: string | null;
}) {
  const track = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const initialIndex = Math.max(
    0,
    initialImageId ? images.findIndex((image) => image.id === initialImageId) : 0,
  );
  const [active, setActive] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(0);
  // Read by the dialog's close handler without re-subscribing on every change.
  const zoomedRef = useRef(0);
  const count = images.length;

  const show = useCallback((index: number) => {
    const el = track.current;
    if (!el) return;
    // Slides can be a fractional width; integer offsets would leave a sliver of the next one.
    el.scrollTo({ left: index * el.getBoundingClientRect().width, behavior: scrollBehavior() });
    setActive(index);
  }, []);

  const onScroll = () => {
    const el = track.current;
    const width = el?.getBoundingClientRect().width ?? 0;
    if (el && width > 0) setActive(Math.round(el.scrollLeft / width));
  };

  const openViewer = (index: number) => {
    setZoomed(index);
    dialog.current?.showModal();
    document.documentElement.style.setProperty('overflow', 'hidden');
  };

  // Start on the selected variant's image, before the first paint (no visible jump). Only on
  // mount: later variant changes arrive as events.
  const startIndex = useRef(initialIndex);
  useLayoutEffect(() => {
    const el = track.current;
    if (el && startIndex.current > 0) {
      el.scrollLeft = startIndex.current * el.getBoundingClientRect().width;
    }
  }, []);

  // A variant with its own image was chosen: show that image.
  useEffect(() => {
    const onVariantImage = (event: Event) => {
      const { productId: id, imageId } = (event as CustomEvent<VariantImageDetail>).detail;
      if (productId && id !== productId) return;
      const index = images.findIndex((image) => image.id === imageId);
      if (index >= 0) show(index);
    };
    window.addEventListener(VARIANT_IMAGE_EVENT, onVariantImage);
    return () => window.removeEventListener(VARIANT_IMAGE_EVENT, onVariantImage);
  }, [images, productId, show]);

  // The dialog closes itself on Escape; this releases the scroll lock and shows the image
  // last viewed in the dialog.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onClose = () => {
      document.documentElement.style.removeProperty('overflow');
      show(zoomedRef.current);
    };
    el.addEventListener('close', onClose);
    return () => el.removeEventListener('close', onClose);
  }, [show]);
  useEffect(() => {
    zoomedRef.current = zoomed;
  }, [zoomed]);

  if (count === 0) {
    return <div className={`${ratio} rounded-xl bg-zinc-100`} />;
  }

  const zoomedImage = images[zoomed];
  const step = (delta: number) => (index: number) => (index + delta + count) % count;

  return (
    <div className="md:flex md:items-start md:gap-4">
      {count > 1 ? (
        <ul className="hidden w-20 shrink-0 flex-col gap-3 md:flex lg:w-24" aria-label="Images">
          {images.map((image, i) => (
            <li key={image.id ?? image.url}>
              <button
                type="button"
                onClick={() => show(i)}
                aria-label={`Show image ${i + 1} of ${count}`}
                aria-current={active === i ? 'true' : undefined}
                className={`block w-full overflow-hidden rounded-lg bg-zinc-100 ring-offset-2 ring-offset-page transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  active === i ? 'ring-2 ring-zinc-900' : 'opacity-70 hover:opacity-100'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  srcSet={srcSetOf(image)}
                  sizes="96px"
                  alt=""
                  width={image.width}
                  height={image.height}
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="group/gallery relative min-w-0 flex-1">
        <div
          ref={track}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-xl bg-zinc-100 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((image, i) => (
            <div
              key={image.id ?? image.url}
              className={`relative w-full shrink-0 snap-center ${ratio}`}
            >
              <button
                type="button"
                onClick={() => openViewer(i)}
                aria-label={`Zoom image ${i + 1} of ${count}`}
                className="block h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  srcSet={srcSetOf(image)}
                  sizes={MAIN_SIZES}
                  alt={image.alt || (i === 0 ? title : '')}
                  width={image.width}
                  height={image.height}
                  loading={i === initialIndex ? 'eager' : 'lazy'}
                  fetchPriority={i === initialIndex ? 'high' : undefined}
                  decoding={i === initialIndex ? undefined : 'async'}
                  className="h-full w-full object-cover"
                />
              </button>
            </div>
          ))}
        </div>

        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 right-3 grid size-9 place-items-center rounded-full bg-page/85 text-zinc-900 opacity-0 shadow-sm transition group-hover/gallery:opacity-100"
        >
          <ProductIcon name="zoom" className="size-4" />
        </span>

        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => show(step(-1)(active))}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-page/90 text-zinc-900 opacity-0 shadow-md transition hover:bg-page focus-visible:opacity-100 group-hover/gallery:opacity-100 md:grid"
            >
              <ProductIcon name="chevronLeft" />
            </button>
            <button
              type="button"
              onClick={() => show(step(1)(active))}
              aria-label="Next image"
              className="absolute right-3 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-page/90 text-zinc-900 opacity-0 shadow-md transition hover:bg-page focus-visible:opacity-100 group-hover/gallery:opacity-100 md:grid"
            >
              <ProductIcon name="chevronRight" />
            </button>
            <div className="mt-3 flex justify-center gap-1 md:hidden">
              {images.map((image, i) => (
                <button
                  key={image.id ?? image.url}
                  type="button"
                  onClick={() => show(i)}
                  aria-label={`Show image ${i + 1} of ${count}`}
                  aria-current={active === i ? 'true' : undefined}
                  className="p-1.5"
                >
                  <span
                    className={`block h-1.5 rounded-full transition-all ${
                      active === i ? 'w-5 bg-zinc-900' : 'w-1.5 bg-zinc-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <dialog
        ref={dialog}
        aria-label={`${title} images`}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setZoomed(step(-1));
          if (e.key === 'ArrowRight') setZoomed(step(1));
        }}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-page p-0 text-zinc-900 backdrop:bg-[#000000cc]"
      >
        <div className="pointer-events-none flex h-full flex-col">
          <div className="pointer-events-auto flex items-center justify-between px-4 py-3 text-sm">
            <span aria-live="polite" className="text-zinc-500">
              {zoomed + 1} / {count}
            </span>
            <button
              type="button"
              autoFocus
              onClick={() => dialog.current?.close()}
              aria-label="Close"
              className="grid size-10 place-items-center rounded-full transition hover:bg-zinc-100"
            >
              <ProductIcon name="close" />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6 md:px-16">
            {zoomedImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={zoomedImage.id ?? zoomedImage.url}
                src={zoomedImage.url}
                srcSet={srcSetOf(zoomedImage)}
                sizes="100vw"
                alt={zoomedImage.alt || title}
                width={zoomedImage.width}
                height={zoomedImage.height}
                className="pointer-events-auto max-h-full w-auto max-w-full object-contain"
              />
            ) : null}
            {count > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => setZoomed(step(-1))}
                  aria-label="Previous image"
                  className="pointer-events-auto absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-page/90 shadow-md transition hover:bg-zinc-100 md:left-4"
                >
                  <ProductIcon name="chevronLeft" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomed(step(1))}
                  aria-label="Next image"
                  className="pointer-events-auto absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-page/90 shadow-md transition hover:bg-zinc-100 md:right-4"
                >
                  <ProductIcon name="chevronRight" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      </dialog>
    </div>
  );
}
