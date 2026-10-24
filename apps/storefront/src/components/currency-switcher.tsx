'use client';

/** GET form to /currency; submits on change (the button covers browsers without scripts). */
export function CurrencySwitcher({
  current,
  currencies,
  returnPath,
}: {
  current: string;
  currencies: string[];
  returnPath: string;
}) {
  return (
    <form action="/currency" className="flex items-center gap-1 text-sm">
      <input type="hidden" name="return" value={returnPath} />
      <label htmlFor="currency-switcher" className="sr-only">
        Currency
      </label>
      <select
        id="currency-switcher"
        name="code"
        defaultValue={current}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-10 cursor-pointer rounded-full border-0 bg-zinc-100 pr-7 pl-3 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
      >
        {currencies.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="underline">
          Change
        </button>
      </noscript>
    </form>
  );
}
