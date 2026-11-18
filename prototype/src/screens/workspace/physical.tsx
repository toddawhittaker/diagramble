// The parts of the canvas that belong to the physical mode (sections 11.1 and 11.2 of the
// specification): the bar that says which mode is on, and the physical fields of the
// detail strip.

import { useEffect, useState } from 'react';
import { Button, ModeSwitch, TextField } from '../../components';
import type { Element, Id } from '../../model';
import { dispatch } from '../../store';

type Mode = 'logical' | 'physical';

const HELP_KEY = 'diagramble.prototype.workspace.modeHelpSeen';

const HELP: Record<Mode, string> = {
  logical:
    'The logical model shows what the business does, whoever or whatever does it. Items marked as system-related are left out. Nothing is lost: switch to Physical to see them.',
  physical:
    'The physical model is the same diagram with the design added: what carries out each process, the physical name of each flow and data store, and the items that exist only because of how the system is built.',
};

function readSeen(): Mode[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(HELP_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((v): v is Mode => v === 'logical' || v === 'physical') : [];
  } catch {
    return [];
  }
}

/**
 * The line above the canvas: which mode is on, the switch, the explanation of the mode
 * (until it is closed once), and in physical mode the switch that shades the software side.
 */
export function ModeBar({
  mode,
  shade,
  onShade,
  hidden,
}: {
  mode: Mode;
  shade: boolean;
  onShade: (shade: boolean) => void;
  /** How many system-related items of this diagram the logical mode leaves out. */
  hidden: number;
}) {
  const [seen, setSeen] = useState<Mode[]>(readSeen);
  const close = () => {
    const next = [...seen, mode];
    setSeen(next);
    try {
      localStorage.setItem(HELP_KEY, JSON.stringify(next));
    } catch {
      // The browser would not save it. The explanation comes back on the next visit.
    }
  };

  return (
    <div className="workspace-mode">
      <div className="workspace-mode-row">
        <span className="workspace-mode-name">{mode === 'physical' ? 'Physical model' : 'Logical model'}</span>
        <ModeSwitch small />
        {mode === 'logical' && hidden > 0 && (
          <span className="muted">
            {hidden === 1 ? '1 system-related item on this diagram is hidden.' : `${hidden} system-related items on this diagram are hidden.`}
          </span>
        )}
        {mode === 'physical' && (
          <>
            <label className="workspace-tick">
              <input type="checkbox" checked={shade} onChange={(e) => onShade(e.target.checked)} />
              Shade the software side
            </label>
            <span className="workspace-legend">
              <span className="workspace-legend-box workspace-legend-human" aria-hidden />
              a person does the work
            </span>
            {shade && (
              <span className="workspace-legend">
                <span className="workspace-legend-box workspace-legend-software" aria-hidden />
                the software does the work
              </span>
            )}
          </>
        )}
      </div>
      {!seen.includes(mode) && (
        <div className="workspace-mode-row workspace-mode-help">
          <span>{HELP[mode]}</span>
          <Button small onClick={close}>
            Got it
          </Button>
        </div>
      )}
    </div>
  );
}

/** A one-line text box that keeps a draft and reports it when it loses focus, or on Enter. */
function Committed({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <TextField
      label={label}
      value={draft}
      placeholder={placeholder}
      onChange={setDraft}
      onCommit={(next) => {
        if (next.trim() !== value) onCommit(next.trim());
      }}
    />
  );
}

function Tick({ label, title, checked, onChange }: { label: string; title: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="workspace-tick" title={title}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

const SYSTEM_TITLE =
  'For something that exists only because of how the system is built, such as an audit file. It is shown only in physical mode.';

/** The physical fields of the selected item. Each change is one `setPhysical`, so one undo step. */
export function PhysicalFields({ element }: { element: Element }) {
  const id: Id = element.id;
  const system = (checked: boolean) => dispatch({ type: 'setPhysical', id, systemRelated: checked });

  if (element.kind === 'process')
    return (
      <div className="workspace-physical">
        <Committed
          label="Carried out by"
          value={element.implementation}
          placeholder={element.human ? 'Such as: paper form' : 'No implementation yet. Such as: Python'}
          onCommit={(implementation) => dispatch({ type: 'setPhysical', id, implementation })}
        />
        <Tick
          label="A person does this work"
          title="Puts this process on the human side of the human-machine boundary"
          checked={element.human}
          onChange={(human) => dispatch({ type: 'setPhysical', id, human })}
        />
        {/* Process 0 stands for the whole system, so it cannot be system-related. */}
        {element.parentProcessId !== null && <Tick label="System-related" title={SYSTEM_TITLE} checked={element.systemRelated} onChange={system} />}
      </div>
    );

  if (element.kind === 'dataStore' || element.kind === 'dataFlow')
    return (
      <div className="workspace-physical">
        <Committed
          label="Physical name"
          value={element.physicalName}
          placeholder={element.kind === 'dataStore' ? 'No physical name yet. Such as: MySQL: Loans Table' : 'No physical name yet. Such as: Loan Request Input Form'}
          onCommit={(physicalName) => dispatch({ type: 'setPhysical', id, physicalName })}
        />
        <Tick label="System-related" title={SYSTEM_TITLE} checked={element.systemRelated} onChange={system} />
      </div>
    );

  if (element.kind === 'externalEntity')
    return (
      <div className="workspace-physical">
        <Tick
          label="A person"
          title="Puts this external entity on the human side of the human-machine boundary"
          checked={element.human}
          onChange={(human) => dispatch({ type: 'setPhysical', id, human })}
        />
        <span className="muted">An external entity has no other physical detail.</span>
      </div>
    );

  return null;
}
