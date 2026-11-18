// Screen 2 of docs/mockups/BRIEFS.md: the outline view. Route: /diagram/:diagramId/outline
// The same data flow diagram as the canvas, as lists that work with the keyboard alone.

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button, Count, EntryFields, FindingMarks, ProblemsPanel, Switch } from '../../components';
import { DiagramHeader, PageHeader, RightPanel, WorkArea } from '../../frame';
import {
  all,
  apply,
  childDiagram,
  dataDefinitions,
  diagramOutline,
  elementLabel,
  get,
  isAboveProject,
  isShownOn,
  occurrencesOn,
  type DiagramOutline,
  type Id,
  type Model,
  type OutlineFlow,
  type OutlineItem,
} from '../../model';
import { countFindings, findingsForElement, type Finding } from '../../rules';
import { dispatch, selectElements, useFindings, useFindingsVisible, useModel, useSelection } from '../../store';
import './outline.css';

type ItemKind = 'process' | 'externalEntity' | 'dataStore';

const KIND_NAMES: Record<ItemKind, string> = {
  process: 'Process',
  externalEntity: 'External entity',
  dataStore: 'Data store',
};

const KIND_KEYS: Record<ItemKind, string> = { process: 'P', externalEntity: 'E', dataStore: 'S' };

type Row =
  | { id: Id; type: 'item'; item: OutlineItem }
  | { id: Id; type: 'flow'; flow: OutlineFlow }
  | { id: Id; type: 'control'; name: string; toLabel: string };

type Mode =
  | null
  | { type: 'rename'; id: Id }
  | { type: 'editFlow'; id: Id }
  | { type: 'confirmRemove'; id: Id }
  | { type: 'addItem'; kind: ItemKind }
  | { type: 'addFlow' }
  | { type: 'addControl' };

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** A place for a new symbol that sits on no other: below the lowest one on the diagram. */
function freeSpot(model: Model, diagramId: Id): { x: number; y: number } {
  const occurrences = occurrencesOn(model, diagramId);
  if (occurrences.length === 0) return { x: 40, y: 40 };
  return {
    x: Math.min(...occurrences.map((o) => o.x)),
    y: Math.max(...occurrences.map((o) => o.y + o.height)) + 40,
  };
}

function rowName(row: Row): string {
  if (row.type === 'item') return row.item.label;
  if (row.type === 'flow') return row.flow.dataName || 'Unnamed data';
  return row.name || 'Unnamed event';
}

/** One row as a sentence, for a screen reader. */
function rowSentence(row: Row, findings: Finding[]): string {
  const parts: string[] = [];
  if (row.type === 'item') {
    parts.push(`${KIND_NAMES[row.item.element.kind]} ${row.item.label}`);
    parts.push(`${plural(row.item.flowsIn, 'flow')} in`, `${plural(row.item.flowsOut, 'flow')} out`);
  } else if (row.type === 'flow') {
    parts.push(`Data flow ${rowName(row)}`, `from ${row.flow.fromLabel} to ${row.flow.toLabel}`);
  } else {
    parts.push(`Control flow ${rowName(row)}`, `to ${row.toLabel}`);
  }
  const { errors, warnings } = countFindings(findings);
  if (errors) parts.push(plural(errors, 'error'));
  if (warnings) parts.push(plural(warnings, 'warning'));
  return parts.join(', ');
}

/** A name, with the element's aliases in brackets after it when it has any. */
function withAliases(name: string, aliases: string[]): string {
  return aliases.length ? `${name} [${aliases.join(', ')}]` : name;
}

/** This diagram's part of the outline as plain text. */
function outlineText(outline: DiagramOutline): string {
  const lines = [outline.title, '', `Items (${outline.items.length})`];
  for (const i of outline.items)
    lines.push(`  ${KIND_NAMES[i.element.kind]}: ${withAliases(i.label, i.element.aliases)} (${i.flowsIn} in, ${i.flowsOut} out)`);
  lines.push('', `Flows (${outline.flows.length})`);
  for (const f of outline.flows)
    lines.push(`  ${withAliases(f.dataName || 'Unnamed data', f.flow.aliases)}: from ${f.fromLabel} to ${f.toLabel}`);
  if (outline.controlFlows.length) {
    lines.push('', `Control flows (${outline.controlFlows.length})`);
    for (const c of outline.controlFlows)
      lines.push(`  ${withAliases(c.flow.name || 'Unnamed event', c.flow.aliases)}: to ${c.toLabel}`);
  }
  return lines.join('\n');
}

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="outline-key" aria-hidden="true">
      {children}
    </kbd>
  );
}

// ---- Small forms ----

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="field outline-field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

/** A name box in place of a row. Enter or leaving the box keeps the name. Escape cancels. */
function RenameBox(props: { label: string; initial: string; onCommit: (name: string) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(props.initial);
  const finished = useRef(false);
  const finish = (keep: boolean) => {
    if (finished.current) return;
    finished.current = true;
    if (keep) props.onCommit(draft.trim());
    else props.onCancel();
  };
  return (
    <div className="outline-rename">
      <input
        className="input"
        aria-label={props.label}
        value={draft}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') finish(true);
          else if (e.key === 'Escape') finish(false);
        }}
      />
    </div>
  );
}

/** The description of the selected row. One undo step when the box loses focus. */
function DescriptionBox({ id, value, onEscape }: { id: Id; value: string; onEscape: () => void }) {
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);
  return (
    <Field label="Description">
      {(fieldId) => (
        <textarea
          id={fieldId}
          className="input"
          rows={2}
          value={draft}
          placeholder="No description yet"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (!cancelled.current && draft !== value) dispatch({ type: 'describe', id, description: draft });
            cancelled.current = false;
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            cancelled.current = true;
            setDraft(value);
            onEscape();
          }}
        />
      )}
    </Field>
  );
}

interface FlowFormProps {
  model: Model;
  outline: DiagramOutline;
  /** The flow being edited. Leave out to add a new one. */
  editing?: OutlineFlow;
  onDone: (flowId: Id, message: string) => void;
  onCancel: () => void;
}

/** The three boxes of a flow: what it carries, where it comes from and where it goes. */
function FlowForm({ model, outline, editing, onDone, onCancel }: FlowFormProps) {
  const [data, setData] = useState(editing?.dataName ?? '');
  const [from, setFrom] = useState(editing?.flow.sourceId ?? '');
  const [to, setTo] = useState(editing?.flow.targetId ?? '');
  const [message, setMessage] = useState('');
  const listId = useId();
  const names = useMemo(
    () => dataDefinitions(model).map((d) => d.name).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [model],
  );

  // The items on this diagram, plus an end the flow already has on another diagram.
  const ends = outline.items.map((i) => ({ id: i.element.id, label: i.label }));
  for (const id of [editing?.flow.sourceId, editing?.flow.targetId])
    if (id && !ends.some((e) => e.id === id)) ends.push({ id, label: `${elementLabel(model, id)} (on another diagram)` });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = data.trim();
    if (!name) return setMessage('Say which data this flow carries.');
    if (!from && !to) return setMessage('A flow needs at least one end attached.');
    if (!editing) {
      const r = dispatch({ type: 'addFlow', diagramId: outline.diagramId, sourceId: from || null, targetId: to || null, dataName: name });
      if (!r.ok) return setMessage(r.error);
      return onDone(r.created[0], `Added the flow ${name}.`);
    }
    const flow = editing.flow;
    const sourceChanged = (from || null) !== flow.sourceId;
    const targetChanged = (to || null) !== flow.targetId;
    if (sourceChanged || targetChanged) {
      const r = dispatch({
        type: 'setFlowEnds',
        flowId: flow.id,
        ...(sourceChanged ? { sourceId: from || null } : {}),
        ...(targetChanged ? { targetId: to || null } : {}),
      });
      if (!r.ok) return setMessage(r.error);
    }
    if (name.toLowerCase() !== editing.dataName.toLowerCase()) {
      const r = dispatch({ type: 'setFlowData', flowId: flow.id, dataName: name });
      if (!r.ok) return setMessage(r.error);
    }
    onDone(flow.id, `Changed the flow ${name}.`);
  };

  const endSelect = (id: string, value: string, set: (v: string) => void) => (
    <select id={id} className="input" value={value} onChange={(e) => set(e.target.value)}>
      <option value="">Not attached</option>
      {ends.map((e) => (
        <option key={e.id} value={e.id}>
          {e.label}
        </option>
      ))}
    </select>
  );

  return (
    <form
      className={`outline-form ${editing ? 'is-selected' : 'outline-form-new'}`}
      aria-label={editing ? `Edit the flow ${editing.dataName}` : 'Add a data flow'}
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <Field label="Carries" hint="Type to search the dictionary">
        {(id) => (
          <>
            <input id={id} className="input" list={listId} value={data} autoFocus autoComplete="off" onChange={(e) => setData(e.target.value)} />
            <datalist id={listId}>
              {names.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </>
        )}
      </Field>
      <Field label="From">{(id) => endSelect(id, from, setFrom)}</Field>
      <Field label="To">{(id) => endSelect(id, to, setTo)}</Field>
      <div className="outline-form-buttons">
        <Button type="submit" variant="primary">
          {editing ? 'Done' : 'Add flow'}
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
      {message && (
        <div className="outline-form-message" role="alert">
          {message}
        </div>
      )}
    </form>
  );
}

interface AddItemFormProps {
  model: Model;
  diagramId: Id;
  kind: ItemKind;
  kinds: ItemKind[];
  onKind: (kind: ItemKind) => void;
  onDone: (elementId: Id, message: string) => void;
  onCancel: () => void;
}

/** Adds a process, an external entity or a data store: a new one, or one already in the project. */
function AddItemForm({ model, diagramId, kind, kinds, onKind, onDone, onCancel }: AddItemFormProps) {
  const [name, setName] = useState('');
  const [existingId, setExistingId] = useState('');
  const [message, setMessage] = useState('');
  const word = KIND_NAMES[kind].toLowerCase();
  const existing = kind === 'process' ? [] : all(model, kind).filter((e) => !isShownOn(model, e.id, diagramId));
  const chosen = existing.find((e) => e.id === existingId);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const at = freeSpot(model, diagramId);
    if (chosen) {
      const r = dispatch({ type: 'placeExisting', diagramId, elementId: chosen.id, ...at });
      if (!r.ok) return setMessage(r.error);
      return onDone(chosen.id, `Placed ${elementLabel(model, chosen.id)} on this diagram.`);
    }
    const trimmed = name.trim();
    if (!trimmed) return setMessage(`Give the ${word} a name.`);
    const type = kind === 'process' ? 'addProcess' : kind === 'externalEntity' ? 'addExternalEntity' : 'addDataStore';
    const r = dispatch({ type, diagramId, name: trimmed, ...at });
    if (!r.ok) return setMessage(r.error);
    onDone(r.created[0], `Added the ${word} ${trimmed}.`);
  };

  return (
    <form
      className="outline-form outline-form-new"
      aria-label="Add an item"
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <div className="field">
        <span className="field-label">Kind</span>
        <Switch
          label="Kind of item"
          value={kind}
          onChange={(k) => {
            setExistingId('');
            onKind(k);
          }}
          options={kinds.map((k) => ({ value: k, label: KIND_NAMES[k] }))}
        />
      </div>
      <Field label={`Name of the new ${word}`}>
        {(id) => (
          <input
            id={id}
            className="input"
            value={chosen ? '' : name}
            disabled={!!chosen}
            autoFocus
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
        )}
      </Field>
      {existing.length > 0 && (
        <Field label="Or place an existing one" hint="Already in this project, not yet on this diagram">
          {(id) => (
            <select id={id} className="input" value={existingId} onChange={(e) => setExistingId(e.target.value)}>
              <option value="">A new {word}</option>
              {existing.map((e) => (
                <option key={e.id} value={e.id}>
                  {elementLabel(model, e.id)}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      <div className="outline-form-buttons">
        <Button type="submit" variant="primary">
          Add {word}
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
      {message && (
        <div className="outline-form-message" role="alert">
          {message}
        </div>
      )}
    </form>
  );
}

/** Adds a control flow: a starting event, into a process on this diagram. */
function AddControlForm(props: { outline: DiagramOutline; onDone: (id: Id, message: string) => void; onCancel: () => void }) {
  const processes = props.outline.items.filter((i) => i.element.kind === 'process');
  const [name, setName] = useState('');
  const [to, setTo] = useState(processes[0]?.element.id ?? '');
  const [message, setMessage] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setMessage('Name the event that starts the process.');
    if (!to) return setMessage('A control flow leads into a process. This diagram has none yet.');
    const r = dispatch({ type: 'addControlFlow', diagramId: props.outline.diagramId, targetId: to, name: trimmed });
    if (!r.ok) return setMessage(r.error);
    props.onDone(r.created[0], `Added the control flow ${trimmed}.`);
  };

  return (
    <form
      className="outline-form outline-form-new"
      aria-label="Add a control flow"
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          props.onCancel();
        }
      }}
    >
      <Field label="Starting event" hint="Such as: End of day">
        {(id) => <input id={id} className="input" value={name} autoFocus autoComplete="off" onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Field label="To">
        {(id) => (
          <select id={id} className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            {processes.length === 0 && <option value="">No process on this diagram</option>}
            {processes.map((p) => (
              <option key={p.element.id} value={p.element.id}>
                {p.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <div className="outline-form-buttons">
        <Button type="submit" variant="primary">
          Add control flow
        </Button>
        <Button onClick={props.onCancel}>Cancel</Button>
      </div>
      {message && (
        <div className="outline-form-message" role="alert">
          {message}
        </div>
      )}
    </form>
  );
}

// ---- The screen ----

export function OutlineScreen() {
  const { diagramId = '' } = useParams();
  const model = useModel();
  if (!get(model, diagramId, 'diagram'))
    return (
      <WorkArea>
        <PageHeader breadcrumb={['Diagrams']} title="No such diagram" />
        <div className="work-body placeholder">This project has no diagram with that address.</div>
      </WorkArea>
    );
  return (
    <>
      <WorkArea>
        <DiagramHeader diagramId={diagramId} view="outline" />
        <Outline key={diagramId} diagramId={diagramId} />
      </WorkArea>
      <RightPanel label="Problems">
        <ProblemsPanel diagramId={diagramId} />
      </RightPanel>
    </>
  );
}

function Outline({ diagramId }: { diagramId: Id }) {
  const model = useModel();
  const allFindings = useFindings();
  const findingsVisible = useFindingsVisible();
  // While the problems are held back, no row shows a mark or speaks of a problem.
  const findings = findingsVisible ? allFindings : NO_FINDINGS;
  const selection = useSelection();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<Mode>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: Id } | null>(null);
  const [status, setStatus] = useState<ReactNode>('');
  const [showText, setShowText] = useState(false);
  const [showKeys, setShowKeys] = useState(false);

  const outline = useMemo(() => diagramOutline(model, diagramId), [model, diagramId]);
  const rows = useMemo<Row[]>(
    () => [
      ...outline.items.map((item): Row => ({ id: item.element.id, type: 'item', item })),
      ...outline.flows.map((flow): Row => ({ id: flow.flow.id, type: 'flow', flow })),
      ...outline.controlFlows.map((c): Row => ({ id: c.flow.id, type: 'control', name: c.flow.name, toLabel: c.toLabel })),
    ],
    [outline],
  );
  const diagram = get(model, diagramId, 'diagram');
  const isContext = diagram?.diagramKind === 'context';
  const above = isAboveProject(model, diagramId);
  // The process this diagram expands. The context diagram expands none.
  const expands = diagram?.decomposesProcessId ? get(model, diagram.decomposesProcessId, 'process') : undefined;
  const kinds: ItemKind[] = isContext ? ['externalEntity', 'dataStore'] : ['process', 'externalEntity', 'dataStore'];
  const hasProcess = outline.items.some((i) => i.element.kind === 'process');

  // The row that shows its detail: the first row the shared selection names.
  const current = rows.find((r) => selection.elementIds.includes(r.id));
  const tabStop = current?.id ?? rows[0]?.id;
  // The process the B key acts on: the selected one if it has a child diagram, or else the one this diagram expands.
  const selectedParent =
    current?.type === 'item' && current.item.element.kind === 'process' && childDiagram(model, current.id) ? current.id : undefined;
  const bringTarget = selectedParent ?? expands?.id;

  useEffect(() => {
    if (!focusRequest) return;
    rootRef.current?.querySelector<HTMLElement>(`[data-outline-row="${CSS.escape(focusRequest.id)}"]`)?.focus();
    setFocusRequest(null);
  }, [focusRequest]);

  const goTo = (id: Id) => {
    selectElements([id]);
    setFocusRequest({ id });
  };

  const cancel = () => {
    const back = mode && 'id' in mode ? mode.id : current?.id;
    setMode(null);
    if (back) setFocusRequest({ id: back });
  };

  const added = (id: Id, message: string) => {
    setMode(null);
    setStatus(message);
    goTo(id);
  };

  const startEdit = (row: Row) => {
    selectElements([row.id]);
    setMode(row.type === 'flow' ? { type: 'editFlow', id: row.id } : { type: 'rename', id: row.id });
  };

  const commitRename = (row: Row, name: string) => {
    const old = model.elements[row.id]?.name ?? '';
    if (name && name !== old) {
      const r = dispatch({ type: 'rename', id: row.id, name });
      if (r.ok) setStatus(`Renamed to ${name}.`);
    }
    setMode(null);
    setFocusRequest({ id: row.id });
  };

  const remove = (row: Row, confirmed = false) => {
    const name = rowName(row);
    let after: Model | null = null;
    let message = `Removed ${name}.`;
    if (row.type === 'item' && row.item.element.kind !== 'process') {
      // An external entity or data store leaves this diagram only. It stays in the project.
      for (const o of occurrencesOn(model, diagramId).filter((x) => x.elementId === row.id)) {
        const r = dispatch({ type: 'removeOccurrence', occurrenceId: o.id });
        if (!r.ok) return;
        after = r.model;
      }
      message = `Removed ${name} from this diagram.`;
    } else {
      if (row.type === 'item' && childDiagram(model, row.id) && !confirmed) {
        selectElements([row.id]);
        return setMode({ type: 'confirmRemove', id: row.id });
      }
      const r = dispatch({ type: 'deleteElement', id: row.id });
      if (!r.ok) return setMode(null);
      after = r.model;
    }
    setMode(null);
    setStatus(message);
    if (!after) return;
    // Move to the nearest row that is still there. Removing an item removes its flows too.
    const left = new Set(diagramOutline(after, diagramId).items.map((i) => i.element.id));
    const stays = (r: Row) => r.id !== row.id && (r.type === 'item' ? left.has(r.id) : !!after!.elements[r.id]);
    const at = rows.indexOf(row);
    const next = rows.slice(at + 1).find(stays) ?? rows.slice(0, at).reverse().find(stays);
    if (next) goTo(next.id);
    else selectElements([]);
  };

  const expand = (processId: Id) => {
    const r = dispatch({ type: 'expandProcess', processId });
    if (r.ok) navigate(`/diagram/${r.created[0]}/outline`);
  };

  /** Brings down, to a process's child diagram, the flows added to its parent since. One undo step. */
  const bringDown = (processId: Id) => {
    const child = childDiagram(model, processId);
    if (!child) return;
    const label = elementLabel(model, processId);
    const here = child.id === diagramId;
    const command = { type: 'carryDown', processId } as const;
    // Tried on a copy first, so that "nothing to bring down" is said here and makes no undo step.
    if (!apply(model, command).ok)
      return setStatus(
        here
          ? `Nothing new to bring down. Every flow of ${label} on the parent diagram already reaches this diagram.`
          : `Nothing new to bring down. Every flow of ${label} on this diagram already reaches its child diagram.`,
      );
    const r = dispatch(command);
    if (!r.ok) return;
    const names = r.created.map((id) => elementLabel(r.model, id)).join(', ');
    const count = plural(r.created.length, 'flow');
    const loose = r.created.length === 1 ? 'It has one end not attached yet.' : 'Each has one end not attached yet.';
    if (here) {
      setStatus(`Brought down ${count} from the parent diagram: ${names}. ${loose}`);
      if (r.created[0]) goTo(r.created[0]);
    } else {
      setStatus(
        <>
          Brought down {count} to the child diagram of {label}: {names}. {loose}{' '}
          <Link to={`/diagram/${child.id}/outline`}>Open the child diagram's outline</Link>
        </>,
      );
    }
  };

  const text = useMemo(() => outlineText(outline), [outline]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied the outline as text.');
    } catch {
      setShowText(true);
      setStatus('The browser would not copy. The text is shown below, ready to select and copy.');
    }
  };

  const openAdd = (next: Mode) => {
    if (next?.type === 'addItem' && !kinds.includes(next.kind)) return;
    setMode(next);
  };

  // The keys. One listener on the window, so that N and F work wherever the focus is.
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target instanceof HTMLElement ? e.target : document.body;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (e.key === 'Escape') {
      if (mode) cancel();
      else if (showKeys) setShowKeys(false);
      return;
    }
    if (mode) return;

    const rowId = target.closest<HTMLElement>('[data-outline-row]')?.dataset.outlineRow;
    const row = rows.find((r) => r.id === rowId);
    const here = target === document.body || !!rootRef.current?.contains(target);

    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && here && rows.length) {
      e.preventDefault();
      if (!row) return goTo(tabStop!);
      const at = rows.indexOf(row) + (e.key === 'ArrowDown' ? 1 : -1);
      return goTo(rows[Math.max(0, Math.min(rows.length - 1, at))].id);
    }
    if (row && (e.key === 'Enter' || e.key === 'F2')) {
      e.preventDefault();
      return startEdit(row);
    }
    if (row && e.key === 'Delete') {
      e.preventDefault();
      return remove(row);
    }
    if (e.key === '?') {
      e.preventDefault();
      return setShowKeys((v) => !v);
    }
    if (e.shiftKey) return;
    if (e.key.toLowerCase() === 'b') {
      e.preventDefault();
      if (bringTarget) bringDown(bringTarget);
      else setStatus('Select a process that has a child diagram first. Then B brings down its new flows.');
      return;
    }
    const add: Record<string, Mode> = {
      n: { type: 'addItem', kind: kinds[0] },
      p: { type: 'addItem', kind: 'process' },
      e: { type: 'addItem', kind: 'externalEntity' },
      s: { type: 'addItem', kind: 'dataStore' },
      f: { type: 'addFlow' },
      c: { type: 'addControl' },
    };
    const next = add[e.key.toLowerCase()];
    if (next) {
      e.preventDefault();
      openAdd(next);
    }
  };
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKeyRef.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const renderRow = (row: Row) => {
    const rowFindings = findingsForElement(findings, row.id);
    const selected = selection.elementIds.includes(row.id);
    const element = model.elements[row.id];
    const marks = <FindingMarks findings={rowFindings} counts={false} />;
    const editing = mode && 'id' in mode && mode.id === row.id ? mode : null;

    let line: ReactNode;
    if (editing?.type === 'rename') {
      const what = row.type === 'item' ? KIND_NAMES[row.item.element.kind].toLowerCase() : 'starting event of the control flow';
      line = (
        <RenameBox
          label={`Name of the ${what}`}
          initial={element?.name ?? ''}
          onCommit={(name) => commitRename(row, name)}
          onCancel={cancel}
        />
      );
    } else if (editing?.type === 'editFlow' && row.type === 'flow') {
      line = <FlowForm model={model} outline={outline} editing={row.flow} onDone={added} onCancel={cancel} />;
    } else {
      line = (
        <button
          type="button"
          className={`row outline-row outline-cols-${row.type}${selected ? ' is-selected' : ''}`}
          data-outline-row={row.id}
          tabIndex={row.id === tabStop ? 0 : -1}
          aria-label={rowSentence(row, rowFindings)}
          aria-current={selected ? 'true' : undefined}
          onClick={() => selectElements([row.id])}
          onDoubleClick={() => startEdit(row)}
        >
          {row.type === 'item' && (
            <>
              <span className="outline-cell muted">{KIND_NAMES[row.item.element.kind]}</span>
              <span className="outline-cell">
                {row.item.label}
                {marks}
              </span>
              <span className="outline-cell outline-right muted">
                {row.item.flowsIn} in · {row.item.flowsOut} out
              </span>
            </>
          )}
          {row.type === 'flow' && (
            <>
              <span className="outline-cell">
                {row.flow.dataName || <span className="missing">No data named</span>}
                {marks}
              </span>
              <span className="outline-cell">{row.flow.fromLabel}</span>
              <span className="outline-cell">{row.flow.toLabel}</span>
            </>
          )}
          {row.type === 'control' && (
            <>
              <span className="outline-cell">
                {row.name || <span className="missing">No event named</span>}
                {marks}
              </span>
              <span className="outline-cell">{row.toLabel}</span>
            </>
          )}
        </button>
      );
    }

    const child = row.type === 'item' && row.item.element.kind === 'process' ? childDiagram(model, row.id) : undefined;
    const backToRow = () => setFocusRequest({ id: row.id });
    return (
      <li key={row.id}>
        {line}
        {editing?.type === 'confirmRemove' && (
          <div
            className="outline-detail"
            role="alertdialog"
            aria-label="Remove this process?"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                cancel();
              }
            }}
          >
            <p>
              '{rowName(row)}' has a child diagram. Removing the process also removes that diagram and everything on it.
            </p>
            <div className="outline-actions">
              <Button autoFocus onClick={() => remove(row, true)}>
                Remove the process and its child diagram
              </Button>
              <Button onClick={cancel}>Cancel</Button>
            </div>
          </div>
        )}
        {row === current && !editing && element && (
          <div className="outline-detail" role="group" aria-label={`Details of ${rowName(row)}`}>
            <DescriptionBox key={`${row.id}:${element.description}`} id={row.id} value={element.description} onEscape={backToRow} />
            <div className="outline-actions">
              {row.type === 'item' && row.item.element.kind === 'process' &&
                (child ? (
                  <>
                    <Link className="btn btn-small" to={`/diagram/${child.id}/outline`}>
                      Open the child diagram's outline
                    </Link>
                    <Button small aria-keyshortcuts="B" onClick={() => bringDown(row.id)}>
                      Bring down new flows <Key>B</Key>
                    </Button>
                  </>
                ) : (
                  <Button small onClick={() => expand(row.id)}>
                    Expand into a child diagram
                  </Button>
                ))}
              <Button small aria-keyshortcuts="Enter" onClick={() => startEdit(row)}>
                {row.type === 'flow' ? 'Edit' : 'Rename'} <Key>Enter</Key>
              </Button>
              <Button small aria-keyshortcuts="Delete" onClick={() => remove(row)}>
                Remove <Key>Delete</Key>
              </Button>
            </div>
            {/* Leaving a box saves it, so Escape here goes back to the row and keeps what was typed. */}
            <div
              className="outline-entry"
              onKeyDown={(e) => {
                if (e.key !== 'Escape') return;
                e.stopPropagation();
                backToRow();
              }}
            >
              <EntryFields elementId={row.id} compact />
            </div>
          </div>
        )}
      </li>
    );
  };

  const itemRows = rows.filter((r) => r.type === 'item');
  const flowRows = rows.filter((r) => r.type === 'flow');
  const controlRows = rows.filter((r) => r.type === 'control');

  return (
    <div className="work-body outline-body" ref={rootRef}>
      <div className="outline-scroll">
        <div className="outline-toolbar">
          <span className="muted grow" role="status">
            {status || 'The same diagram as the canvas, as a list.'}
          </span>
          <Button small onClick={copy}>
            Copy as text
          </Button>
          <Button small aria-expanded={showText} onClick={() => setShowText((v) => !v)}>
            {showText ? 'Hide the text' : 'Show as text'}
          </Button>
          {showText && (
            <textarea
              className="input outline-text"
              aria-label="This diagram as plain text"
              readOnly
              rows={Math.min(16, text.split('\n').length + 1)}
              value={text}
              onFocus={(e) => e.currentTarget.select()}
            />
          )}
        </div>

        {above && (
          <p className="outline-notice">
            <span>This diagram is above the project, so nothing on it is checked.</span>
            <Link to="/project">Open the project page</Link>
          </p>
        )}

        {expands && (
          <div className="outline-notice">
            <span className="grow">This diagram expands the process {elementLabel(model, expands.id)}.</span>
            <Button small aria-keyshortcuts={selectedParent ? undefined : 'B'} onClick={() => bringDown(expands.id)}>
              Bring down new flows from the parent diagram {!selectedParent && <Key>B</Key>}
            </Button>
          </div>
        )}

        {rows.length === 0 && (
          <p className="muted">This diagram is empty. Press N to add an item, then F to join two items with a flow.</p>
        )}

        <section aria-label="Items">
          <div className="outline-head">
            <h2 className="section-heading">
              Items <Count n={itemRows.length} />
            </h2>
            <Button small aria-keyshortcuts="N" onClick={() => openAdd({ type: 'addItem', kind: kinds[0] })}>
              Add item <Key>N</Key>
            </Button>
            {kinds.map((k) => (
              <Button key={k} small aria-keyshortcuts={KIND_KEYS[k]} onClick={() => openAdd({ type: 'addItem', kind: k })}>
                {KIND_NAMES[k]} <Key>{KIND_KEYS[k]}</Key>
              </Button>
            ))}
          </div>
          {itemRows.length > 0 && (
            <>
              <div className="outline-columns outline-cols-item" aria-hidden="true">
                <span>Kind</span>
                <span>Name</span>
                <span className="outline-right">Flows</span>
              </div>
              <ul className="outline-list" aria-label="Items">
                {itemRows.map(renderRow)}
              </ul>
            </>
          )}
          {mode?.type === 'addItem' && (
            <AddItemForm
              key={mode.kind}
              model={model}
              diagramId={diagramId}
              kind={mode.kind}
              kinds={kinds}
              onKind={(kind) => setMode({ type: 'addItem', kind })}
              onDone={added}
              onCancel={cancel}
            />
          )}
        </section>

        <section aria-label="Flows">
          <div className="outline-head">
            <h2 className="section-heading">
              Flows <Count n={flowRows.length} />
            </h2>
            <Button small aria-keyshortcuts="F" onClick={() => openAdd({ type: 'addFlow' })}>
              Add flow <Key>F</Key>
            </Button>
            <Button small aria-keyshortcuts="C" disabled={!hasProcess} onClick={() => openAdd({ type: 'addControl' })}>
              Add control flow <Key>C</Key>
            </Button>
          </div>
          {flowRows.length > 0 && (
            <>
              <div className="outline-columns outline-cols-flow" aria-hidden="true">
                <span>Data</span>
                <span>From</span>
                <span>To</span>
              </div>
              <ul className="outline-list" aria-label="Flows">
                {flowRows.map(renderRow)}
              </ul>
            </>
          )}
          {mode?.type === 'addFlow' && <FlowForm model={model} outline={outline} onDone={added} onCancel={cancel} />}
        </section>

        {(controlRows.length > 0 || mode?.type === 'addControl') && (
          <section aria-label="Control flows">
            <div className="outline-head">
              <h2 className="section-heading">
                Control flows <Count n={controlRows.length} />
              </h2>
            </div>
            {controlRows.length > 0 && (
              <>
                <div className="outline-columns outline-cols-control" aria-hidden="true">
                  <span>Starting event</span>
                  <span>To</span>
                </div>
                <ul className="outline-list" aria-label="Control flows">
                  {controlRows.map(renderRow)}
                </ul>
              </>
            )}
            {mode?.type === 'addControl' && <AddControlForm outline={outline} onDone={added} onCancel={cancel} />}
          </section>
        )}
      </div>

      {showKeys && (
        <section className="outline-allkeys" aria-label="All keys">
          <div className="hstack">
            <h2 className="section-heading grow">All keys</h2>
            <Button small onClick={() => setShowKeys(false)}>
              Close
            </Button>
          </div>
          <dl>
            {ALL_KEYS.filter(([key]) => key !== 'P' || !isContext).map(([key, what]) => (
              <KeyLine key={key} name={key} what={what} />
            ))}
          </dl>
        </section>
      )}

      <div className="outline-keybar" role="group" aria-label="Keys">
        {KEY_BAR.map(([key, what]) => (
          <span className="outline-keypair" key={key}>
            <kbd className="outline-key">{key}</kbd> {what}
          </span>
        ))}
        <button type="button" className="outline-keypair" aria-expanded={showKeys} onClick={() => setShowKeys((v) => !v)}>
          <kbd className="outline-key">?</kbd> All keys
        </button>
      </div>
    </div>
  );
}

const NO_FINDINGS: Finding[] = [];

const KEY_BAR: [string, string][] = [
  ['↑ ↓', 'Move'],
  ['Enter', 'Edit'],
  ['N', 'Add item'],
  ['F', 'Add flow'],
  ['Delete', 'Remove'],
];

const ALL_KEYS: [string, string][] = [
  ['↑ ↓', 'Move to the row above or below, and select it'],
  ['Enter or F2', 'Edit the row: rename an item, or change a flow'],
  ['Delete', 'Remove the row'],
  ['Escape', 'Cancel what you are doing, or go back to the row from its aliases and notes'],
  ['Tab', 'Move into the selected row’s description, buttons, aliases and notes'],
  ['N', 'Add item'],
  ['P', 'Add a process'],
  ['E', 'Add an external entity'],
  ['S', 'Add a data store'],
  ['F', 'Add flow (a data flow)'],
  ['C', 'Add a control flow'],
  ['B', 'Bring down new flows: to the child diagram of the selected process, or else to this diagram from its parent'],
  ['?', 'Show or hide this list'],
];

function KeyLine({ name, what }: { name: string; what: string }) {
  return (
    <>
      <dt>
        <kbd className="outline-key">{name}</kbd>
      </dt>
      <dd>{what}</dd>
    </>
  );
}
