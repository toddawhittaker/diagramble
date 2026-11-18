// Small controls for the use case form. They live here because the shared TextField
// keeps no draft of its own and the shared code has no select.

import { useEffect, useState, type ChangeEvent, type FocusEvent } from 'react';

export interface DraftProps {
  /** Read by screen readers. The form shows its own label beside the field. */
  label: string;
  value: string;
  /** Called once, when the field loses focus or on Enter, and only if the text changed. */
  onCommit: (value: string) => void;
  /** Shown in the "missing" look while the field is empty. */
  placeholder: string;
  /** A text area with this many rows, in place of a one-line box. */
  rows?: number;
  autoFocus?: boolean;
  /** Select the whole text when the field takes focus. */
  selectAll?: boolean;
  className?: string;
}

/** A text box that keeps a draft while the user types, so one edit is one undo step. Escape puts the old text back. */
export function Draft({ label, value, onCommit, placeholder, rows, autoFocus, selectAll, className = '' }: DraftProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const shared = {
    className: `input usecases-input${draft === '' ? ' usecases-empty' : ''} ${className}`,
    value: draft,
    placeholder,
    autoFocus,
    'aria-label': label,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: () => {
      if (draft !== value) onCommit(draft);
    },
    onFocus: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (selectAll) e.target.select();
    },
  };

  if (rows) {
    return (
      <textarea
        rows={rows}
        {...shared}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setDraft(value);
        }}
      />
    );
  }
  return (
    <input
      type="text"
      {...shared}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setDraft(value);
      }}
    />
  );
}

export interface PickProps {
  label: string;
  /** The chosen value. An empty string means nothing is chosen. */
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  /** The words for "nothing chosen". When given, the user may choose nothing. */
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
}

/** A select. With nothing chosen it takes the "missing" look. */
export function Pick({ label, value, options, onChange, emptyLabel, className = '', disabled }: PickProps) {
  const empty = value === '';
  return (
    <select
      className={`input usecases-pick${empty ? ' usecases-empty' : ''} ${className}`}
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Returns a copy of a list with the item at `index` moved one place up (-1) or down (+1). */
export function moved<T>(items: T[], index: number, by: -1 | 1): T[] {
  const to = index + by;
  if (to < 0 || to >= items.length) return items;
  const copy = items.slice();
  [copy[index], copy[to]] = [copy[to], copy[index]];
  return copy;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
