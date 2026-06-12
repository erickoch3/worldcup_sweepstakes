import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: ReactNode;
};

export function Button({ children, className, icon, type = 'button', variant = 'secondary', ...props }: ButtonProps) {
  const classes = ['button', `button-${variant}`, className].filter(Boolean).join(' ');

  return (
    <button className={classes} type={type} {...props}>
      {icon ? <span className="button-icon">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({ error, hint, id, label, ...props }: TextFieldProps) {
  const inputId = id ?? props.name;
  const hintId = hint && inputId ? `${inputId}-hint` : undefined;
  const errorId = error && inputId ? `${inputId}-error` : undefined;

  return (
    <label className="field" htmlFor={inputId}>
      <span className="field-label">{label}</span>
      <input
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        aria-invalid={error ? true : undefined}
        className="field-control"
        id={inputId}
        {...props}
      />
      {hint ? (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="field-error" id={errorId}>
          {error}
        </span>
      ) : null}
    </label>
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function SelectField({ children, error, hint, id, label, ...props }: SelectFieldProps) {
  const selectId = id ?? props.name;
  const hintId = hint && selectId ? `${selectId}-hint` : undefined;
  const errorId = error && selectId ? `${selectId}-error` : undefined;

  return (
    <label className="field" htmlFor={selectId}>
      <span className="field-label">{label}</span>
      <select
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        aria-invalid={error ? true : undefined}
        className="field-control"
        id={selectId}
        {...props}
      >
        {children}
      </select>
      {hint ? (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="field-error" id={errorId}>
          {error}
        </span>
      ) : null}
    </label>
  );
}
