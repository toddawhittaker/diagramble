// Small pieces both screens of this folder use.

import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components';

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface DraftFieldProps {
  /** Read by screen readers, and shown above the field unless `hideLabel` is set. */
  label: string;
  value: string;
  /** Called once, when the field loses focus with changed text. Return false when the change was refused. */
  onCommit: (value: string) => unknown;
  /** A text area. It grows with its text, and never has fewer rows than this. */
  rows?: number;
  /** Shown in muted italics while the field is empty: the "missing" look. */
  placeholder?: string;
  hideLabel?: boolean;
  /** Focus the field and select its text when it first appears. */
  selectOnMount?: boolean;
  /** No border until the pointer or the keyboard reaches it, for text edited in place. */
  quiet?: boolean;
  /** The id of a `<datalist>` of suggestions. */
  list?: string;
}

/** A text field that keeps a draft and reports it once, so that one edit is one undo step. */
export function DraftField({ label, value, onCommit, rows, placeholder, hideLabel, selectOnMount, quiet, list }: DraftFieldProps) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  // Undo, redo and changes made elsewhere replace the value under the field.
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (selectOnMount) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [selectOnMount]);

  const shared = {
    ref,
    className: `input requirements-draft${quiet ? ' requirements-quiet' : ''}`,
    value: draft,
    placeholder,
    'aria-label': label,
    onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
    onBlur: () => {
      const next = draft.trim();
      if (next === value || onCommit(next) === false) setDraft(value);
    },
  };
  const field = rows ? (
    <textarea
      // The row count is a guess for browsers that cannot size a text area to its text.
      rows={Math.max(rows, Math.ceil(draft.length / 64))}
      {...shared}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setDraft(value);
      }}
    />
  ) : (
    <input
      type="text"
      list={list}
      {...shared}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setDraft(value);
      }}
    />
  );
  if (hideLabel) return field;
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {field}
    </label>
  );
}

export interface ConfirmButtonProps {
  /** The words on the button, such as "Remove group". */
  label: string;
  /** The question asked before anything is removed. */
  question: string;
  /** The words on the button that goes ahead. */
  confirmLabel: string;
  onConfirm: () => void;
  link?: boolean;
}

/** A button that asks once, in place, before it removes more than one thing. */
export function ConfirmButton({ label, question, confirmLabel, onConfirm, link }: ConfirmButtonProps) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <Button small variant={link ? 'link' : 'default'} onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  return (
    <span className="requirements-confirm" role="group" aria-label={question}>
      <span>{question}</span>
      <Button
        small
        autoFocus
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </Button>
      <Button small variant="link" onClick={() => setAsking(false)}>
        Keep
      </Button>
    </span>
  );
}
