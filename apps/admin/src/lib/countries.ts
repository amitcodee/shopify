import { useSyncExternalStore } from 'react';

export interface CountryOption {
  code: string;
  name: string;
}

/** Placeholder and unknown regions that are not places a product can be made in. */
const NOT_PLACES = new Set(['ZZ', 'XA', 'XB']);

let cached: CountryOption[] | null = null;

/**
 * Every region the runtime can name, built from Intl rather than a hand-kept list: all
 * two-letter codes AA–ZZ whose English display name differs from the code, sorted by name.
 */
export function countryOptions(): CountryOption[] {
  if (cached) return cached;
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  const result: CountryOption[] = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      if (NOT_PLACES.has(code)) continue;
      let name: string | undefined;
      try {
        name = names.of(code);
      } catch {
        name = undefined;
      }
      if (name && name !== code) result.push({ code, name });
    }
  }
  cached = result.sort((x, y) => x.name.localeCompare(y.name, 'en'));
  return cached;
}

const subscribe = () => () => {};
const none: CountryOption[] = [];

/**
 * Country options for client components. Empty during server rendering: ICU data differs
 * between Node and browsers, so names are only built in the browser (no hydration mismatch).
 */
export function useCountryOptions(): CountryOption[] {
  return useSyncExternalStore(subscribe, countryOptions, () => none);
}

/** True once the component has hydrated (for values that depend on the viewer's time zone). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
