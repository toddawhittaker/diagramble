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

/** The data types offered for a field. Any other text may be typed. The dictionary screen offers the same list. */
export const DATA_TYPES = ['Text', 'Number', 'Date', 'Date and time', 'Yes or no', 'Code'];

/** The table name, or the entity's name while it has no table name. */
export function tableLabel(entity: { name: string; tableName: string } | undefined): string {
  return entity ? entity.tableName.trim() || entity.name || 'Table with no name' : 'table';
}

/** "Text(40)", "Number", or nothing while the field has no type. */
export function typeAndLength(element: { dataType: string; length: number | null }): string {
  const type = element.dataType.trim();
  return element.length !== null ? `${type}(${element.length})` : type;
}
