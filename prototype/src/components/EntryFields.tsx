// The fields every dictionary entry shares: aliases and notes, and for a process its
// longer description (docs/SPEC.md sections 3.2 and 3.3).

import { useEffect, useState } from 'react';
import type { Id } from '../model/types';
import { dispatch, useModel } from '../store/store';
import { Button, TextField } from './controls';
import { Missing } from './Mark';

interface DraftProps {
  label: string;
  value: string;
  rows: number;
  placeholder: string;
  hint?: string;
  onCommit: (value: string) => void;
}

/** A text area that keeps a draft and saves it once, when the field loses focus. */
function Draft({ label, value, rows, placeholder, hint, onCommit }: DraftProps) {
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
      onCommit={(next) => {
        if (next !== value) onCommit(next);
      }}
    />
  );
}

function Aliases({ elementId, aliases }: { elementId: Id; aliases: string[] }) {
  const [adding, setAdding] = useState('');
  const save = (next: string[]) => dispatch({ type: 'setAliases', id: elementId, aliases: next });
  const add = (text: string) => {
    const alias = text.trim();
    setAdding('');
    if (alias && !aliases.some((a) => a.toLowerCase() === alias.toLowerCase())) save([...aliases, alias]);
  };
  return (
    <div className="field">
      <span className="field-label">Aliases</span>
      {aliases.length === 0 ? (
        <div>
          <Missing>No aliases yet</Missing>
        </div>
      ) : (
        <ul className="entry-aliases">
          {aliases.map((alias) => (
            <li className="entry-alias" key={alias}>
              <span className="entry-alias-name">{alias}</span>
              <Button variant="link" small aria-label={`Remove the alias ${alias}`} onClick={() => save(aliases.filter((a) => a !== alias))}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <TextField hideLabel label="Add an alias" value={adding} placeholder="Add another name the business uses" onChange={setAdding} onCommit={add} />
    </div>
  );
}

export interface EntryFieldsProps {
  /** Any element: a process, a flow, a data definition, a use case, an entity, and so on. */
  elementId: Id;
  /** A tighter layout with shorter text areas, for a narrow panel. */
  compact?: boolean;
}

/**
 * Shows and edits an element's aliases and notes, and a process's longer description.
 * Each edit is saved when its field loses focus, as one undo step. It needs nothing
 * from the screen around it. It shows nothing when the element does not exist.
 */
export function EntryFields({ elementId, compact = false }: EntryFieldsProps) {
  const model = useModel();
  const element = model.elements[elementId];
  if (!element) return null;
  return (
    <div className={`entry-fields${compact ? ' entry-fields-compact' : ''}`} key={elementId}>
      <Aliases elementId={elementId} aliases={element.aliases} />
      <Draft
        label="Notes"
        value={element.notes}
        rows={compact ? 2 : 3}
        placeholder="No notes yet"
        onCommit={(notes) => dispatch({ type: 'setNotes', id: elementId, notes })}
      />
      {element.kind === 'process' && (
        <Draft
          label="Process description"
          value={element.processDescription}
          rows={compact ? 4 : 8}
          placeholder="No process description yet"
          hint={compact ? undefined : 'What the process does, step by step. Structured English, a decision tree or a decision table, written as text.'}
          onCommit={(processDescription) => dispatch({ type: 'setProcessDescription', processId: elementId, processDescription })}
        />
      )}
    </div>
  );
}
