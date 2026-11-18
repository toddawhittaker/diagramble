// Small pieces both screens use. They live here because the shared code does not have them.

import { useEffect, useId, useState, type ReactNode } from 'react';
import { dataDefinitions, moduleNumber, originalModule, type Id, type Model } from '../../model';
import { Button } from '../../components';

/** "1.2 Book Slot", read from the module a box stands for. */
export function moduleLabel(model: Model, moduleId: Id): string {
  const name = originalModule(model, moduleId)?.name ?? '';
  return `${moduleNumber(model, moduleId)} ${name || '(no name)'}`;
}

export interface DraftFieldProps {
  label: string;
  /** The value in the model. */
  value: string;
  /** Called once, when the field loses focus or Enter is pressed, and only if the text changed. */
  onSave: (value: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: ReactNode;
  /** Monospaced text, for pseudocode. */
  mono?: boolean;
  /** 'date' gives the browser's date box. */
  type?: 'text' | 'date';
  autoFocus?: boolean;
}

/** A labelled field that keeps a draft while the user types, so that one edit is one undo step. */
export function DraftField({ label, value, onSave, rows, placeholder, hint, mono, type = 'text', autoFocus }: DraftFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onSave(draft);
  };
  const className = `input${mono ? ' structure-mono-input' : ''}`;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {rows ? (
        <textarea id={id} className={className} rows={rows} value={draft} placeholder={placeholder} spellCheck={!mono} onChange={(e) => setDraft(e.target.value)} onBlur={commit} />
      ) : (
        <input
          id={id}
          className={className}
          type={type}
          value={draft}
          placeholder={placeholder}
          autoFocus={autoFocus}
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

/** A tick box with its words. */
export function Check({ label, checked, onChange, disabled }: { label: ReactNode; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className="structure-check">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** A button, then a question before anything is removed. */
export function DeleteControl({ label = 'Remove', question, onDelete }: { label?: string; question: string; onDelete: () => void }) {
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
    <div className="structure-confirm vstack">
      <div>{question}</div>
      <div className="hstack">
        <Button small variant="primary" onClick={onDelete}>
          {label}
        </Button>
        <Button small onClick={() => setAsking(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** What a data couple carries: a definition from the dictionary, or the name of a new data element. */
export type DataChoice = { dataId: Id } | { dataName: string } | null;

const NEW = '__new__';

/**
 * Chooses the data a couple carries from the data dictionary. The last option makes a
 * new data element. `onChoose` is called with a definition as soon as one is picked, and
 * with a new name when "Use this name" is pressed.
 */
export function DataPicker({
  model,
  value,
  onChoose,
  label = 'Data it carries',
  live = false,
}: {
  model: Model;
  value: Id | null;
  onChoose: (choice: DataChoice) => void;
  label?: string;
  /** Report a new name as it is typed, with no button. For a form that has its own "Add" button. */
  live?: boolean;
}) {
  const id = useId();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const definitions = [...dataDefinitions(model)].sort((a, b) => a.name.localeCompare(b.name));
  const useName = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onChoose({ dataName: trimmed });
    setAdding(false);
    setName('');
  };
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="input"
        value={adding ? NEW : (value ?? '')}
        onChange={(e) => {
          const v = e.target.value;
          if (v === NEW) {
            setAdding(true);
            onChoose(null);
          } else {
            setAdding(false);
            onChoose(v ? { dataId: v } : null);
          }
        }}
      >
        <option value="">Choose from the data dictionary…</option>
        {definitions.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name || '(no name)'}
            {d.kind === 'dataStructure' ? ' (structure)' : ''}
          </option>
        ))}
        <option value={NEW}>A new data element…</option>
      </select>
      {adding && (
        <div className="hstack">
          <input
            className="input grow"
            aria-label="Name of the new data element"
            placeholder="Name of the new data element"
            value={name}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              if (live) onChoose(e.target.value.trim() ? { dataName: e.target.value.trim() } : null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !live) useName();
            }}
          />
          {!live && (
            <Button small disabled={!name.trim()} onClick={useName}>
              Use this name
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
