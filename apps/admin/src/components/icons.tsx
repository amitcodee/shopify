import type { ReactNode, SVGProps } from 'react';

/** Small inline icon set (24px grid, 1.7 stroke) so the admin ships no icon dependency. */
const PATHS = {
  home: (
    <>
      <path d="M3.5 10.5 12 4l8.5 6.5" />
      <path d="M5.5 9v10.5h13V9" />
      <path d="M10 19.5v-5h4v5" />
    </>
  ),
  orders: (
    <>
      <path d="M5 4.5h14l-1 15.5H6L5 4.5Z" />
      <path d="M9 8.5a3 3 0 0 0 6 0" />
    </>
  ),
  products: (
    <>
      <path d="M3.5 7.5 12 3.5l8.5 4v9l-8.5 4-8.5-4v-9Z" />
      <path d="m3.5 7.5 8.5 4 8.5-4M12 11.5v9" />
    </>
  ),
  inventory: (
    <>
      <path d="M4 9.5h16v10H4z" />
      <path d="M3 5.5h18v4H3zM10 13h4" />
    </>
  ),
  collections: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  customers: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 19.5c.8-3.3 3.3-5 6.5-5s5.7 1.7 6.5 5" />
      <path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c1.8.7 3 2.3 3.5 4.7" />
    </>
  ),
  discounts: (
    <>
      <path d="M3.5 12.4V4.5a1 1 0 0 1 1-1h7.9l8.6 8.6a1.5 1.5 0 0 1 0 2.1l-6.8 6.8a1.5 1.5 0 0 1-2.1 0l-8.6-8.6Z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  gift: (
    <>
      <rect x="3.5" y="8" width="17" height="4" rx="1" />
      <path d="M5 12v8h14v-8M12 8v12" />
      <path d="M12 8C10.5 4 6.5 4 7 6.5 7.4 8 12 8 12 8Zm0 0c1.5-4 5.5-4 5-1.5C16.6 8 12 8 12 8Z" />
    </>
  ),
  store: (
    <>
      <path d="M4 9.5 5.5 4h13L20 9.5" />
      <path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" />
      <path d="M5.5 12v8h13v-8M10 20v-4.5h4V20" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" />
    </>
  ),
  plans: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M3.5 9.5h17M7 14.5h4" />
    </>
  ),
  users: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20.5c1-4 4-6 8-6s7 2 8 6" />
    </>
  ),
  audit: (
    <>
      <path d="M6 3.5h9l4 4v13H6z" />
      <path d="M14.5 3.5v4.5H19M9 12h6M9 16h6" />
    </>
  ),
  external: (
    <>
      <path d="M14 4.5h5.5V10M19.5 4.5 11 13" />
      <path d="M18 14v5.5H4.5V6H10" />
    </>
  ),
  chevronsUpDown: <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />,
  logout: (
    <>
      <path d="M14 4.5H6v15h8" />
      <path d="M17 8.5 20.5 12 17 15.5M20.5 12H10" />
    </>
  ),
  shield: <path d="M12 3.5 19.5 6v6c0 4.5-3.2 7.6-7.5 8.5C7.7 19.6 4.5 16.5 4.5 12V6L12 3.5Z" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}

/** The platform mark: a rounded tile with a stylised bag. */
export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-sm shadow-brand-900/30 inset-ring inset-ring-white/20 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="size-[55%]"
      >
        <path d="M5.5 8h13l-1 12h-11l-1-12Z" strokeLinejoin="round" />
        <path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}
