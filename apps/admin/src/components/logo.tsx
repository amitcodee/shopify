/** The platform's logo mark: a shopping bag on a rounded tile. Decorative; pair it with the name. */
export function LogoMark({
  className = 'h-7 w-7',
  inverted,
}: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className={`shrink-0 ${className}`}>
      <rect width="32" height="32" rx="8" fill={inverted ? '#ffffff' : '#4f46e5'} />
      <path
        d="M9.5 12.5h13l-1 11.5a1.5 1.5 0 0 1-1.5 1.4h-8a1.5 1.5 0 0 1-1.5-1.4z"
        fill={inverted ? '#4f46e5' : '#ffffff'}
      />
      <path
        d="M12.5 14.5v-3a3.5 3.5 0 0 1 7 0v3"
        fill="none"
        stroke={inverted ? '#4f46e5' : '#ffffff'}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
