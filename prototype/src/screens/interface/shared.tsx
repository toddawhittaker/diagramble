// Small pieces both screens use. They live here because the shared code does not have them.

import { useEffect, useId, useState, type ReactNode } from 'react';
import { Button, TextField } from '../../components';
import type { Id } from '../../model';

export interface DraftFieldProps {
  label: string;
  /** The value in the model. */
  value: string;
  /**
   * Called once, when the field loses focus or Enter is pressed, and only if the text
   * changed. Return false when the change was refused, and the field goes back.
   */
  onSave: (value: string) => boolean | void;
  rows?: number;
  placeholder?: string;
  hint?: ReactNode;
}

/** A text field that keeps a draft while the user types, so that one edit is one undo step. */
export function DraftField({ label, value, onSave, rows, placeholder, hint }: DraftFieldProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <TextField
      label={label}
      value={draft}
      rows={rows}
      placeholder={placeholder}
      hint={hint}
      onChange={setDraft}
      onCommit={(v) => {
        if (v !== value && onSave(v) === false) setDraft(value);
      }}
    />
  );
}

/** "Delete", then a question before anything is removed. */
export function DeleteControl({ label = 'Delete', question, onDelete }: { label?: string; question: string; onDelete: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <div>
        <Button small onClick={() => setAsking(true)}>
          {label}
        </Button>
      </div>
    );
  return (
    <div className="interface-confirm vstack">
      <div>{question}</div>
      <div className="hstack">
        <Button small variant="primary" onClick={onDelete}>
          Delete
        </Button>
        <Button small onClick={() => setAsking(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export interface ChoiceOption {
  value: Id;
  label: string;
}

export interface IdOrTextProps {
  label: string;
  /** The chosen item, or null while the text is used. */
  id: Id | null;
  text: string;
  /** What can be chosen. When empty, only the text box is shown. */
  options: ChoiceOption[];
  /** Called once for each change, with both values. */
  onChange: (id: Id | null, text: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  hideLabel?: boolean;
}

/**
 * One of the "an item, or text" fields of a test: a list to choose from, and a text box
 * that is used while nothing is chosen. A project with nothing to choose shows the text
 * box alone.
 */
export function IdOrText({ label, id, text, options, onChange, placeholder, hint, hideLabel }: IdOrTextProps) {
  const fieldId = useId();
  const [draft, setDraft] = useState(text);
  useEffect(() => setDraft(text), [text]);
  const commit = () => {
    if (draft !== text) onChange(id, draft);
  };
  const hasList = options.length > 0;
  return (
    <div className="field">
      {!hideLabel && (
        <label className="field-label" htmlFor={fieldId}>
          {label}
        </label>
      )}
      {hasList && (
        <select id={fieldId} className="input" value={id ?? ''} aria-label={hideLabel ? label : undefined} onChange={(e) => onChange(e.target.value || null, text)}>
          <option value="">Typed as text</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {(!hasList || id === null) && (
        <input
          id={hasList ? undefined : fieldId}
          type="text"
          className="input"
          value={draft}
          placeholder={placeholder}
          aria-label={hasList ? `${label}, typed as text` : hideLabel ? label : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
          }}
        />
      )}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

/** Cuts a long sentence short for a list of choices. */
export function shorten(text: string, length = 70): string {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}
