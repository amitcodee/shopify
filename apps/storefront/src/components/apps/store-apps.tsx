import type { StoreApps as Apps } from '@repo/contracts';
import { StoreCookieNotice } from './store-cookie-notice';

/** Site-wide store apps: the WhatsApp chat button and the cookie notice. */
export function StoreApps({ apps }: { apps: Apps }) {
  const chat = apps.whatsapp;
  return (
    <>
      {chat.enabled && chat.phone ? (
        <a
          href={`https://wa.me/${chat.phone}?text=${encodeURIComponent(chat.message)}`}
          target="_blank"
          rel="noreferrer"
          className="fixed right-4 bottom-4 z-40 flex size-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg ring-4 ring-white/60 transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25d366] sm:right-6 sm:bottom-6"
        >
          <span className="sr-only">Chat with us on WhatsApp (opens in a new tab)</span>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-7">
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
          </svg>
        </a>
      ) : null}
      {apps.cookieNotice.enabled ? <StoreCookieNotice message={apps.cookieNotice.message} /> : null}
    </>
  );
}
