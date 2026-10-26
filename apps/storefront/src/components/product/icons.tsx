/** 24px outline icons for product pages (stroke-based, currentColor, decorative). */
const PATHS = {
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 1 1 8 0v4',
  box: 'M21 8 12 3 3 8m18 0v8l-9 5m9-13-9 5m0 8-9-5V8m9 13v-8M3 8l9 5',
  chevronLeft: 'm15 18-6-6 6-6',
  chevronRight: 'm9 18 6-6-6-6',
  chevronDown: 'm6 9 6 6 6-6',
  minus: 'M5 12h14',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  zoom: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4-4M11 8v6M8 11h6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4-4',
  bag: 'M5 8h14l-1 13H6L5 8Zm4 0V6a3 3 0 1 1 6 0v2',
} as const;

export type ProductIconName = keyof typeof PATHS;

export function ProductIcon({
  name,
  className = 'size-5',
}: {
  name: ProductIconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
