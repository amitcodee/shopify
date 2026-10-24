'use client';

import type { Theme, ThemeSettings } from '@repo/contracts';
import { useId } from 'react';
import { COLUMNS, type EditorField, PRESETS } from './editor-schema';

const control =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs ' +
  'placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-3 focus:ring-indigo-500/15 ' +
  'disabled:bg-slate-50 disabled:text-slate-500';

/** One setting control, bound to the theme being edited. */
export function FieldControl({
  field,
  theme,
  onChange,
  disabled,
}: {
  field: EditorField;
  theme: Theme;
  onChange: (next: Theme) => void;
  disabled: boolean;
}) {
  const id = useId();
  const s = theme.settings;
  const set = <K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) =>
    onChange({ ...theme, settings: { ...s, [key]: value } });

  if (field.type === 'toggle') {
    const on = s[field.key];
    return (
      <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3 py-1">
        <span className="text-sm text-slate-700">{field.label}</span>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={on}
          disabled={disabled}
          onClick={() => set(field.key, !on)}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 ${
            on ? 'bg-indigo-600' : 'bg-slate-300'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              on ? 'translate-x-4' : ''
            }`}
          />
        </button>
      </label>
    );
  }

  if (field.type === 'color') {
    const value = s[field.key];
    return (
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm text-slate-700">
          {field.label}
        </label>
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-500 uppercase">{value}</span>
          <input
            id={id}
            type="color"
            value={value}
            disabled={disabled}
            onChange={(e) => set(field.key, e.target.value)}
            className="h-8 w-10 cursor-pointer rounded-md border border-slate-300 bg-white p-0.5"
          />
        </span>
      </div>
    );
  }

  const label = (
    <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-slate-600">
      {field.label}
    </label>
  );

  if (field.type === 'preset') {
    return (
      <div>
        {label}
        <select
          id={id}
          className={control}
          value={theme.preset}
          disabled={disabled}
          onChange={(e) => onChange({ ...theme, preset: e.target.value as Theme['preset'] })}
        >
          {PRESETS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'columns') {
    return (
      <div>
        {label}
        <div
          role="radiogroup"
          aria-label={field.label}
          className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1"
        >
          {COLUMNS.map((o) => {
            const active = String(s.gridColumns) === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => set('gridColumns', Number(o.value))}
                className={`rounded-md py-1.5 text-sm font-medium transition ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div>
        {label}
        <select
          id={id}
          className={control}
          value={s[field.key]}
          disabled={disabled}
          onChange={(e) => set(field.key, e.target.value as never)}
        >
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const value = s[field.key];
  const counter = (
    <span className="mt-1 block text-right text-[11px] text-slate-400 tabular-nums">
      {value.length}/{field.max}
    </span>
  );
  return (
    <div>
      {label}
      {field.type === 'textarea' ? (
        <textarea
          id={id}
          rows={4}
          maxLength={field.max}
          className={control}
          value={value}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(e) => set(field.key, e.target.value)}
        />
      ) : (
        <input
          id={id}
          type="text"
          maxLength={field.max}
          className={control}
          value={value}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(e) => set(field.key, e.target.value)}
        />
      )}
      {counter}
    </div>
  );
}
