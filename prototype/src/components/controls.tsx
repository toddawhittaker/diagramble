import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Count } from './Mark';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** "default" is outlined, "primary" is solid ink, "link" is underlined text. */
  variant?: 'default' | 'primary' | 'link';
  small?: boolean;
}

export function Button({ variant = 'default', small, className = '', type = 'button', ...rest }: ButtonProps) {
  const classes = ['btn', variant === 'primary' && 'btn-primary', variant === 'link' && 'btn-link', small && 'btn-small', className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...rest} />;
}

export interface SwitchProps<T extends string> {
  /** Usually two options. */
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** What the switch chooses, for screen readers. */
  label: string;
  small?: boolean;
}

/** A two-part switch, such as "Canvas" and "Outline". The current choice has the selection look. */
export function Switch<T extends string>({ options, value, onChange, label, small }: SwitchProps<T>) {
  return (
    <div className={`switch${small ? ' switch-small' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`switch-option${o.value === value ? ' is-selected' : ''}`}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export interface TabsProps<T extends string> {
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}

/** A row of tabs, each with an optional count. The page shows the content itself. */
export function Tabs<T extends string>({ tabs, value, onChange, label }: TabsProps<T>) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === value}
          className={`tab${t.id === value ? ' is-selected' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count !== undefined && <Count n={t.count} />}
        </button>
      ))}
    </div>
  );
}

export interface TextFieldProps {
  label: string;
  value: string;
  /** Called on every keystroke. To make one undo step per edit, keep a draft and dispatch in `onCommit`. */
  onChange?: (value: string) => void;
  /** Called when the field loses focus, or on Enter in a one-line field. */
  onCommit?: (value: string) => void;
  /** A text area with this many rows, in place of a one-line box. */
  rows?: number;
  /** Shown in muted italics while the field is empty, such as "No description yet". */
  placeholder?: string;
  hint?: ReactNode;
  readOnly?: boolean;
  /** Hide the visible label. It is still read by screen readers. */
  hideLabel?: boolean;
  autoFocus?: boolean;
}

/** A labelled text field. */
export function TextField({ label, value, onChange, onCommit, rows, placeholder, hint, readOnly, hideLabel, autoFocus }: TextFieldProps) {
  const id = useId();
  const shared = {
    id,
    className: 'input',
    value,
    placeholder,
    readOnly,
    autoFocus,
    'aria-label': hideLabel ? label : undefined,
    onChange: (e: { target: { value: string } }) => onChange?.(e.target.value),
    onBlur: (e: { target: { value: string } }) => onCommit?.(e.target.value),
  };
  return (
    <div className="field">
      {!hideLabel && (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      )}
      {rows ? (
        <textarea rows={rows} {...shared} />
      ) : (
        <input
          type="text"
          {...shared}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommit?.(e.currentTarget.value);
          }}
        />
      )}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}
