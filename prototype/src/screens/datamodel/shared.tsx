// Small pieces both screens use. They live here because the shared code does not have them.

import { useEffect, useState, type ReactNode } from 'react';
import { TextField } from '../../components';

export interface DraftFieldProps {
  label: string;
  /** The value in the model. */
  value: string;
  /** Called once, when the field loses focus or Enter is pressed, and only if the text changed. */
  onSave: (value: string) => void;
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
        if (v !== value) onSave(v);
      }}
    />
  );
}

/** A rough English plural, good enough for reading a relationship back. */
export function plural(name: string): string {
  if (/[^aeiou]y$/i.test(name)) return name.slice(0, -1) + 'ies';
  if (/(s|x|z|ch|sh)$/i.test(name)) return name + 'es';
  return name + 's';
}
