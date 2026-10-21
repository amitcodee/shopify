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
  useId,
} from 'react';
import { useFormStatus } from 'react-dom';
import type { FormState } from '@/lib/form';
import { Alert, buttonClass, type ButtonVariant } from './ui';

const FormStateContext = createContext<FormState>(undefined);

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/** A form bound to a server action; shows errors/success and feeds field errors to <Field>. */
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
  return (
    <FormStateContext value={state}>
      <form action={formAction} className={className ?? 'space-y-4'} noValidate={false}>
        {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
        {state?.success ? <Alert tone="success">{state.success}</Alert> : null}
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
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-disabled={pending}
      className={buttonClass(variant)}
    >
      {pending ? 'Working…' : children}
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
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm ' +
  'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ' +
  'aria-[invalid=true]:border-red-500 disabled:bg-slate-100';

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
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'name'> & {
  name: string;
  label: string;
  hint?: ReactNode;
  defaultValue?: string | number | null;
};

export function Field({ name, label, hint, defaultValue, ...rest }: FieldProps) {
  const { id, error, value } = useField(name, defaultValue);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
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
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      <label htmlFor={id} className="text-sm text-slate-700">
        {label}
        {hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
      </label>
    </div>
  );
}

const inlineClass =
  'block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm ' +
  'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ' +
  'aria-[invalid=true]:border-red-500 disabled:bg-slate-100';

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
