// The small boxes that open on the canvas to ask for a name, and the tool icons.

import { useState, type ReactNode } from 'react';
import { Button } from '../../components';
import type { DataDefinition, Id, NodeElement, Process } from '../../model';
import type { Tool } from './ui';

function Box({
  left,
  top,
  title,
  onCancel,
  children,
}: {
  left: number;
  top: number;
  title: string;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="workspace-box"
      style={{ left, top }}
      role="dialog"
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
        e.stopPropagation();
      }}
    >
      <div className="workspace-box-title">{title}</div>
      {children}
    </div>
  );
}

const SYMBOL_WORDS = { process: 'process', dataStore: 'data store', externalEntity: 'external entity' } as const;

/** Asks for the name of a new symbol, and offers the existing ones that are not on this diagram. */
export function AddSymbolBox({
  left,
  top,
  kind,
  existing,
  onAdd,
  onPlace,
  onCancel,
}: {
  left: number;
  top: number;
  kind: keyof typeof SYMBOL_WORDS;
  existing: { element: NodeElement; label: string }[];
  onAdd: (name: string) => void;
  onPlace: (elementId: Id) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const add = () => {
    if (name.trim()) onAdd(name.trim());
  };
  return (
    <Box left={left} top={top} title={`New ${SYMBOL_WORDS[kind]}`} onCancel={onCancel}>
      <input
        className="input"
        aria-label="Name"
        placeholder="Name"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') add();
        }}
      />
      <div className="hstack">
        <Button small variant="primary" disabled={!name.trim()} onClick={add}>
          Add
        </Button>
        <Button small onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {existing.length > 0 && (
        <>
          <div className="workspace-box-hint">Or place one that is already in the project:</div>
          <div className="workspace-box-list">
            {existing.map((x) => (
              <button key={x.element.id} type="button" className="row workspace-box-row" onClick={() => onPlace(x.element.id)}>
                {x.label}
              </button>
            ))}
          </div>
        </>
      )}
    </Box>
  );
}

export type DataChoice = { dataId: Id } | { dataName: string };

/** Asks what data a flow carries: an existing definition, picked as the student types, or a new one. */
export function DataBox({
  left,
  top,
  title,
  initial,
  definitions,
  onPick,
  onCancel,
}: {
  left: number;
  top: number;
  title: string;
  initial: string;
  definitions: DataDefinition[];
  onPick: (choice: DataChoice) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  const wanted = text.trim().toLowerCase();
  const exact = definitions.find((d) => d.name.toLowerCase() === wanted);
  // Until the student changes the text, show every definition, not only the current one.
  const filter = text === initial ? '' : wanted;
  const matches = definitions
    .filter((d) => d.name.toLowerCase().includes(filter))
    .sort((a, b) => a.name.localeCompare(b.name));
  const submit = () => {
    if (!wanted) return;
    onPick(exact ? { dataId: exact.id } : { dataName: text.trim() });
  };
  return (
    <Box left={left} top={top} title={title} onCancel={onCancel}>
      <input
        className="input"
        aria-label="Name of the data"
        placeholder="Name of the data"
        autoFocus
        value={text}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
      />
      <div className="workspace-box-list">
        {wanted && !exact && (
          <button type="button" className="row workspace-box-row" onClick={submit}>
            Make new data: “{text.trim()}”
          </button>
        )}
        {matches.map((d) => (
          <button key={d.id} type="button" className="row workspace-box-row" onClick={() => onPick({ dataId: d.id })}>
            {d.name}
            <span className="muted workspace-box-kind">{d.kind === 'dataStructure' ? 'structure' : 'element'}</span>
          </button>
        ))}
      </div>
      <div className="hstack">
        <Button small variant="primary" disabled={!wanted} onClick={submit}>
          {exact || !wanted ? 'Use' : 'Make new'}
        </Button>
        <Button small onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Box>
  );
}

/** Asks for the process a control flow goes into, and the flow's name. */
export function ControlBox({
  left,
  top,
  processes,
  initialTargetId,
  onAdd,
  onCancel,
}: {
  left: number;
  top: number;
  processes: { process: Process; label: string }[];
  initialTargetId: Id | null;
  onAdd: (targetId: Id, name: string) => void;
  onCancel: () => void;
}) {
  const [targetId, setTargetId] = useState(initialTargetId ?? processes[0]?.process.id ?? '');
  const [name, setName] = useState('');
  const add = () => {
    if (targetId && name.trim()) onAdd(targetId, name.trim());
  };
  return (
    <Box left={left} top={top} title="New control flow" onCancel={onCancel}>
      {processes.length === 0 ? (
        <>
          <div className="workspace-box-hint">A control flow goes into a process. This diagram has no process yet.</div>
          <div className="hstack">
            <Button small onClick={onCancel}>
              Close
            </Button>
          </div>
        </>
      ) : (
        <>
          <label className="field">
            <span className="field-label">Into process</span>
            <select className="input" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              {processes.map((p) => (
                <option key={p.process.id} value={p.process.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Name</span>
            <input
              className="input"
              placeholder="Such as: End of day"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') add();
              }}
            />
          </label>
          <div className="hstack">
            <Button small variant="primary" disabled={!name.trim()} onClick={add}>
              Add
            </Button>
            <Button small onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </Box>
  );
}

export const TOOLS: { id: Tool; label: string }[] = [
  { id: 'select', label: 'Select' },
  { id: 'process', label: 'Process' },
  { id: 'dataStore', label: 'Data store' },
  { id: 'externalEntity', label: 'External entity' },
  { id: 'dataFlow', label: 'Data flow' },
  { id: 'controlFlow', label: 'Control flow' },
];

export function ToolIcon({ tool }: { tool: Tool }) {
  const common = {
    width: 28,
    height: 24,
    viewBox: '0 0 28 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    'aria-hidden': true,
  } as const;
  switch (tool) {
    case 'select':
      return (
        <svg {...common}>
          <path d="M9 3 9 19 13 15 16 21 18.5 20 15.5 14 21 14Z" strokeLinejoin="round" />
        </svg>
      );
    case 'process':
      return (
        <svg {...common}>
          <rect x="4" y="3" width="20" height="18" rx="4" />
          <path d="M4 9H24" />
        </svg>
      );
    case 'dataStore':
      return (
        <svg {...common}>
          <path d="M26 7H3V17H26M9 7V17" />
        </svg>
      );
    case 'externalEntity':
      return (
        <svg {...common}>
          <rect x="5" y="4" width="18" height="16" />
        </svg>
      );
    case 'dataFlow':
      return (
        <svg {...common}>
          <path d="M3 12H20" />
          <path d="M25 12 18 8.5V15.5Z" fill="currentColor" />
        </svg>
      );
    case 'controlFlow':
      return (
        <svg {...common}>
          <path d="M3 12H20" strokeDasharray="1.5 3.5" strokeLinecap="round" />
          <path d="M25 12 18 8.5V15.5Z" fill="currentColor" />
        </svg>
      );
  }
}
