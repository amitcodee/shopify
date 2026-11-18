'use client';

import {
  createContext,
  Fragment,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type InputHTMLAttributes,
  useActionState,
  useContext,
  useEffect,
  useId,
  useState,
} from 'react';
import { useFormStatus } from 'react-dom';
import type { FormState } from '@/lib/form';
import { toast } from '@/lib/toast';
import { Alert, buttonClass, type ButtonSize, type ButtonVariant, inputClass } from './ui';

const FormStateContext = createContext<FormState>(undefined);

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/** A form bound to a server action: errors inline, success as a toast, field errors to <Field>. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  // Success is confirmed with a toast; errors stay inline, next to the form they belong to.
  useEffect(() => {
    if (state?.success) toast(state.success);
  }, [state]);
  return (
    <FormStateContext value={state}>
      <form action={formAction} className={className ?? 'space-y-4'} noValidate={false}>
        {/* Full width, so grid forms keep their fields in place when it appears. */}
        {state?.error ? (
          <div className="col-span-full">
            <Alert tone="error">{state.error}</Alert>
          </div>
        ) : null}
        {children}
      </form>
    </FormStateContext>
  );
}

export function SubmitButton({
  children,
  variant = 'primary',
  name,
  value,
  size,
  fullWidth,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  name?: string;
  value?: string;
  size?: ButtonSize;
  fullWidth?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-disabled={pending}
      className={`${buttonClass(variant, size)}${fullWidth ? ' w-full' : ''}`}
    >
      {pending ? (
        <>
          <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none">
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeWidth="3"
            />
            <path
              d="M21 12a9 9 0 0 0-9-9"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          Working…
        </>
      ) : (
        children
      )}
    </button>
  );
}

function useField(name: string, defaultValue?: string | number | null) {
  const state = useContext(FormStateContext);
  const id = useId();
  const error = state?.fieldErrors?.[name];
  const value = state?.values?.[name] ?? (defaultValue == null ? undefined : String(defaultValue));
  return { id, error, value };
}

const controlClass =
  `${inputClass} w-full py-2 aria-[invalid=true]:border-red-500 ` +
  'aria-[invalid=true]:focus:ring-red-500/15';

function FieldShell({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-slate-800">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs leading-5 text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1 text-xs leading-5 text-red-600">
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            fill="currentColor"
          >
            <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-.75 4.5a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-1.5 0v-4ZM10 14.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
          </svg>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** 20px outline icons for the start of a field. */
const FIELD_ICONS = {
  user: 'M10 10a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Zm-6 6.5c.6-2.9 3-4.5 6-4.5s5.4 1.6 6 4.5',
  mail: 'M3 5.5h14v9H3zM3.5 6l6.5 5 6.5-5',
  lock: 'M5.5 9h9v7.5h-9zM7.25 9V6.75a2.75 2.75 0 0 1 5.5 0V9',
  key: 'M12.5 3.5a4 4 0 1 1-3.2 6.4L3.5 15.7V17h2.2v-1.3H7v-1.3h1.3l1.9-1.9',
} as const;
export type FieldIcon = keyof typeof FIELD_ICONS;

function FieldIconSvg({ icon }: { icon: FieldIcon }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none absolute top-1/2 left-3 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-slate-700"
    >
      <path d={FIELD_ICONS[icon]} />
    </svg>
  );
}

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'name'> & {
  name: string;
  label: string;
  hint?: ReactNode;
  defaultValue?: string | number | null;
  /** An icon at the start of the input. */
  icon?: FieldIcon;
  /** For passwords: a button that shows or hides what was typed. */
  revealable?: boolean;
};

export function Field({
  name,
  label,
  hint,
  defaultValue,
  icon,
  revealable,
  type,
  ...rest
}: FieldProps) {
  const { id, error, value } = useField(name, defaultValue);
  const [revealed, setRevealed] = useState(false);
  const input = (
    <input
      id={id}
      name={name}
      defaultValue={value}
      type={revealable && revealed ? 'text' : type}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      className={`${controlClass} ${icon ? 'pl-10' : ''} ${revealable ? 'pr-11' : ''} ${icon || revealable ? 'h-11' : ''}`}
      {...rest}
    />
  );
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      {icon || revealable ? (
        <div className="group relative">
          {icon ? <FieldIconSvg icon={icon} /> : null}
          {input}
          {revealable ? (
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              aria-label={revealed ? 'Hide password' : 'Show password'}
              aria-pressed={revealed}
              className="absolute top-1/2 right-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-slate-900"
            >
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[18px] w-[18px]"
              >
                <path d="M2 10s3-5.5 8-5.5 8 5.5 8 5.5-3 5.5-8 5.5S2 10 2 10Z" />
                <circle cx="10" cy="10" r="2.25" />
                {revealed ? <path d="M3.5 3.5l13 13" /> : null}
              </svg>
            </button>
          ) : null}
        </div>
      ) : (
        input
      )}
    </FieldShell>
  );
}

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'defaultValue' | 'name'> & {
  name: string;
  label: string;
  hint?: ReactNode;
  defaultValue?: string | null;
};

export function TextAreaField({ name, label, hint, defaultValue, ...rest }: TextAreaProps) {
  const { id, error, value } = useField(name, defaultValue);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        name={name}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={controlClass}
        {...rest}
      />
    </FieldShell>
  );
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'defaultValue' | 'name'> & {
  name: string;
  label: string;
  hint?: ReactNode;
  defaultValue?: string | null;
  options: { value: string; label: string }[];
};

export function SelectField({ name, label, hint, defaultValue, options, ...rest }: SelectProps) {
  const { id, error, value } = useField(name, defaultValue);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        name={name}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        className={controlClass}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({
  name,
  label,
  defaultChecked,
  value = 'on',
  hint,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  value?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
      />
      <label htmlFor={id} className="text-sm text-slate-800">
        {label}
        {hint ? (
          <span className="mt-0.5 block text-xs leading-5 text-slate-500">{hint}</span>
        ) : null}
      </label>
    </div>
  );
}

const inlineClass = `${inputClass} w-full px-2.5 aria-[invalid=true]:border-red-500`;

type InlineInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'name'> & {
  name: string;
  /** Accessible name (the control has no visible label, e.g. a table cell). */
  label: string;
  defaultValue?: string | number | null;
};

/** Compact unlabeled input for repeated rows; keeps typed values after a failed submit. */
export function InlineInput({ name, label, defaultValue, className, ...rest }: InlineInputProps) {
  const { error, value } = useField(name, defaultValue);
  return (
    <input
      name={name}
      defaultValue={value}
      aria-label={label}
      aria-invalid={error ? true : undefined}
      title={error}
      className={className ?? inlineClass}
      {...rest}
    />
  );
}

type InlineSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'defaultValue' | 'name'> & {
  name: string;
  label: string;
  defaultValue?: string | null;
  groups: { label?: string; options: { value: string; label: string }[] }[];
};

export function InlineSelect({ name, label, defaultValue, groups, ...rest }: InlineSelectProps) {
  const { error, value } = useField(name, defaultValue);
  return (
    <select
      name={name}
      defaultValue={value}
      aria-label={label}
      aria-invalid={error ? true : undefined}
      className={inlineClass}
      {...rest}
    >
      {groups.map((g, i) => {
        const options = g.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ));
        return g.label ? (
          <optgroup key={g.label} label={g.label}>
            {options}
          </optgroup>
        ) : (
          <Fragment key={`group-${i}`}>{options}</Fragment>
        );
      })}
    </select>
  );
}
