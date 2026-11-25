'use client';

import { MAX_REVIEW_PHOTOS, type ReviewPhoto } from '@repo/contracts';
import { useRef, useState, useTransition } from 'react';
import { removeReviewPhotoAction, uploadReviewPhotosAction } from './review-actions';

/** Longest side of a photo after shrinking it in the browser. */
const MAX_SIDE = 1600;

/** Shrinks a photo to JPEG in the browser so uploads stay small on mobile data. */
async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  );
  if (!blob) throw new Error('shrink failed');
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

/** The shopper's photos on their own review: add up to three, or remove one. */
export function ReviewPhotos({ handle, initial }: { handle: string; initial: ReviewPhoto[] }) {
  const [photos, setPhotos] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const room = MAX_REVIEW_PHOTOS - photos.length;

  function add(files: FileList | null) {
    if (!files?.length) return;
    const chosen = [...files].slice(0, room);
    startTransition(async () => {
      setMessage(null);
      const form = new FormData();
      try {
        for (const f of chosen) form.append('files', await shrink(f));
      } catch {
        setMessage('One of those files is not a photo we can read. Try a JPEG or PNG.');
        return;
      }
      const result = await uploadReviewPhotosAction(handle, form);
      if (result.error) setMessage(result.error);
      else {
        setPhotos(result.photos ?? []);
        setMessage(
          files.length > chosen.length
            ? `Only ${MAX_REVIEW_PHOTOS} photos fit; the rest were skipped. The store checks photos before they appear.`
            : 'Photos added. The store checks them before they appear.',
        );
      }
      if (input.current) input.current.value = '';
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      setMessage(null);
      const result = await removeReviewPhotoAction(handle, id);
      if (result.error) setMessage(result.error);
      else setPhotos(result.photos ?? []);
    });
  }

  return (
    <div className="mt-5 border-t border-zinc-200 pt-4">
      <p className="text-sm font-medium text-zinc-900">Photos</p>
      <p className="mt-0.5 text-xs text-zinc-500">
        Up to {MAX_REVIEW_PHOTOS}. Location and camera details are removed.
      </p>
      {photos.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {photos.map((p) => (
            <li key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- API media, sized here */}
              <img
                src={p.thumbUrl}
                alt="Your review photo"
                width={80}
                height={Math.round((80 * p.height) / p.width)}
                className="size-20 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => remove(p.id)}
                disabled={pending}
                aria-label="Remove this photo"
                className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-zinc-900 text-white shadow"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" className="size-3.5">
                  <path
                    fill="currentColor"
                    d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {room > 0 ? (
        <label className="btn btn-outline mt-3 inline-flex min-h-11 cursor-pointer items-center px-5 text-sm">
          {pending ? 'Uploading…' : photos.length ? 'Add more photos' : 'Add photos'}
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            multiple
            disabled={pending}
            className="sr-only"
            onChange={(e) => add(e.target.files)}
          />
        </label>
      ) : null}
      {message ? (
        <p className="mt-2 text-xs text-zinc-600" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
