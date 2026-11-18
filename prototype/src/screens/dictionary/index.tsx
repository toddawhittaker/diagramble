// Screen 3 of docs/mockups/BRIEFS.md: the data dictionary. Routes: /dictionary and /dictionary/:dataId

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { Button, Count, EntryFields, FindingMarks, Missing, ProblemList, Switch } from '../../components';
import { ListColumn, PageHeader, RightPanel, UndoRedo, WorkArea } from '../../frame';
import {
  all,
  dataDefinitions,
  elementLabel,
  entityOfAttribute,
  expandData,
  isData,
  whereUsed,
  type AllowedValue,
  type Component,
  type DataDefinition,
  type DataElement,
  type DataStructure,
  type Id,
  type Model,
  type Occurs,
} from '../../model';
import { findingsForElement } from '../../rules';
import { dispatch, selectElements, useElementFindings, useFindings, useModel } from '../../store';
import './dictionary.css';

type Show = 'all' | 'structures' | 'elements';

const DATA_TYPES = ['Text', 'Number', 'Date', 'Date and time', 'Yes or no', 'Code'];
const OCCURS: { value: Occurs; label: string }[] = [
  { value: 'once', label: 'Once' },
  { value: 'optional', label: 'Optional' },
  { value: 'many', label: 'Many' },
];

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function byName(a: DataDefinition, b: DataDefinition): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function sortedDefinitions(model: Model): DataDefinition[] {
  const defs = dataDefinitions(model);
  return [
    ...defs.filter((d) => d.kind === 'dataStructure').sort(byName),
    ...defs.filter((d) => d.kind === 'dataElement').sort(byName),
  ];
}

/** A name no other definition has: "New element", then "New element 2", and so on. */
function freshName(model: Model, base: string): string {
  const taken = new Set(dataDefinitions(model).map((d) => d.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`.toLowerCase())) n++;
  return `${base} ${n}`;
}

/**
 * The number typed into a box, or null when the box is empty. Anything that is not a
 * number comes out as NaN, which the command refuses with a plain reason.
 */
function typedNumber(text: string): number | null {
  return text === '' ? null : Number(text);
}

function NameOf({ name }: { name: string }) {
  return name.trim() ? <>{name}</> : <Missing>No name yet</Missing>;
}

// ---- A text field that keeps a draft and commits once, when it loses focus ----

interface DraftFieldProps {
  label: string;
  value: string;
  /** Return false when the change was refused, and the field goes back to the saved value. */
  onCommit: (value: string) => unknown;
  rows?: number;
  placeholder?: string;
  hideLabel?: boolean;
  /** Focus the field and select its text when it first appears. */
  selectOnMount?: boolean;
}

function DraftField({ label, value, onCommit, rows, placeholder, hideLabel, selectOnMount }: DraftFieldProps) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  // Undo, redo and renames made elsewhere change the value under the field.
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (selectOnMount) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [selectOnMount]);

  const shared = {
    ref,
    className: 'input',
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
      rows={rows}
      {...shared}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setDraft(value);
      }}
    />
  ) : (
    <input
      type="text"
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

// ---- The list on the left ----

function DefinitionList({ model, openId }: { model: Model; openId: Id | undefined }) {
  const navigate = useNavigate();
  const findings = useFindings();
  const [filter, setFilter] = useState('');
  const [show, setShow] = useState<Show>('all');

  const defs = useMemo(() => sortedDefinitions(model), [model]);
  const used = useMemo(() => {
    const flows = new Map<Id, number>();
    const structures = new Map<Id, number>();
    for (const f of all(model, 'dataFlow')) flows.set(f.dataId, (flows.get(f.dataId) ?? 0) + 1);
    for (const s of all(model, 'dataStructure'))
      for (const id of new Set(s.components.map((c) => c.dataId))) structures.set(id, (structures.get(id) ?? 0) + 1);
    return (id: Id) => {
      const f = flows.get(id) ?? 0;
      const s = structures.get(id) ?? 0;
      if (f && s) return `${plural(f, 'flow', 'flows')} · in ${plural(s, 'structure', 'structures')}`;
      if (f) return plural(f, 'flow', 'flows');
      if (s) return `In ${plural(s, 'structure', 'structures')}`;
      return 'Not used';
    };
  }, [model]);

  const needle = filter.trim().toLowerCase();
  /** The alias that found a definition, when its name did not. */
  const foundByAlias = (d: DataDefinition) =>
    needle && !d.name.toLowerCase().includes(needle) ? d.aliases.find((a) => a.toLowerCase().includes(needle)) : undefined;
  const matches = (d: DataDefinition) => !needle || d.name.toLowerCase().includes(needle) || foundByAlias(d) !== undefined;
  const groups = [
    { key: 'structures', heading: 'Structures', items: defs.filter((d) => d.kind === 'dataStructure' && matches(d)) },
    { key: 'elements', heading: 'Elements', items: defs.filter((d) => d.kind === 'dataElement' && matches(d)) },
  ].filter((g) => show === 'all' || show === g.key);
  const shown = groups.reduce((n, g) => n + g.items.length, 0);

  const make = (dataKind: 'dataStructure' | 'dataElement') => {
    const name = freshName(model, dataKind === 'dataStructure' ? 'New structure' : 'New element');
    const result = dispatch({ type: 'defineData', dataKind, name });
    if (result.ok) {
      setFilter('');
      if (show !== 'all') setShow(dataKind === 'dataStructure' ? 'structures' : 'elements');
      navigate(`/dictionary/${result.created[0]}`, { state: { fresh: true } });
    }
  };

  return (
    <ListColumn width={300} label="Definitions">
      <div className="dictionary-list-top">
        <input
          className="input"
          type="search"
          aria-label="Search definitions"
          placeholder="Search names and aliases"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <Switch
          small
          label="Which definitions to list"
          value={show}
          onChange={setShow}
          options={[
            { value: 'all', label: 'All' },
            { value: 'structures', label: 'Structures' },
            { value: 'elements', label: 'Elements' },
          ]}
        />
        <div className="dictionary-new-buttons">
          <Button small onClick={() => make('dataStructure')}>
            New structure
          </Button>
          <Button small onClick={() => make('dataElement')}>
            New element
          </Button>
        </div>
      </div>
      {groups.map((g) => (
        <div key={g.key}>
          <div className="dictionary-group">
            {g.heading} <Count n={g.items.length} />
          </div>
          {g.items.map((d) => {
            const alias = foundByAlias(d);
            return (
              <Link key={d.id} to={`/dictionary/${d.id}`} className={`row${d.id === openId ? ' is-selected' : ''}`} aria-current={d.id === openId ? 'page' : undefined}>
                <span className="dictionary-row-name" title={d.name}>
                  <NameOf name={d.name} />
                  {alias && <span className="dictionary-row-alias">Alias: {alias}</span>}
                </span>
                <FindingMarks findings={findingsForElement(findings, d.id)} counts={false} />
                <span className="dictionary-row-used">{used(d.id)}</span>
              </Link>
            );
          })}
        </div>
      ))}
      {defs.length > 0 && shown === 0 && (
        <div className="dictionary-list-note">{needle ? `No name or alias matches '${filter.trim()}'.` : 'Nothing of this kind yet.'}</div>
      )}
    </ListColumn>
  );
}

// ---- A structure: its parts, and what it comes to in the end ----

function AddPart({ model, structure }: { model: Model; structure: DataStructure }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open)
    return (
      <div>
        <Button small onClick={() => setOpen(true)}>
          Add part
        </Button>
      </div>
    );

  const name = text.trim();
  const needle = name.toLowerCase();
  const present = new Set(structure.components.map((c) => c.dataId));
  const defs = sortedDefinitions(model);
  const candidates = defs.filter((d) => !present.has(d.id) && (!needle || d.name.toLowerCase().includes(needle)));
  const exact = defs.find((d) => d.name.toLowerCase() === needle);

  const add = (dataId: Id) => {
    const result = dispatch({
      type: 'setComposition',
      dataId: structure.id,
      components: [...structure.components, { dataId, occurs: 'once' }],
    });
    if (result.ok) setText('');
    inputRef.current?.focus();
  };
  const addNew = (dataKind: 'dataStructure' | 'dataElement') => {
    const made = dispatch({ type: 'defineData', dataKind, name });
    if (made.ok) add(made.created[0]);
  };

  return (
    <div className="dictionary-add">
      <div className="hstack">
        <input
          ref={inputRef}
          autoFocus
          className="input"
          type="text"
          aria-label="Name of the part to add"
          placeholder="Type a name to find a definition or make a new one"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key !== 'Enter' || !name) return;
            if (!exact) addNew('dataElement');
            else if (!present.has(exact.id)) add(exact.id);
          }}
        />
        <Button small onClick={() => setOpen(false)}>
          Done
        </Button>
      </div>
      {exact && present.has(exact.id) && <div className="muted">'{exact.name}' is already a part.</div>}
      <div className="dictionary-add-options">
        {candidates.slice(0, 8).map((d) => (
          <button key={d.id} type="button" className="row" onClick={() => add(d.id)}>
            <span className="grow">
              <NameOf name={d.name} />
            </span>
            <span className="muted">{d.kind === 'dataStructure' ? 'Structure' : 'Element'}</span>
          </button>
        ))}
        {candidates.length > 8 && <div className="dictionary-list-note">{candidates.length - 8} more. Type to narrow the list.</div>}
        {name && !exact && (
          <>
            <button type="button" className="row" onClick={() => addNew('dataElement')}>
              New element '{name}'
            </button>
            <button type="button" className="row" onClick={() => addNew('dataStructure')}>
              New structure '{name}'
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface EndOccurs {
  occurs: Occurs;
  limit: number | null;
}

/** How often a part occurs when it sits inside something that itself occurs `outer`. */
function nest(outer: EndOccurs, part: Component): EndOccurs {
  const limit = part.limit ?? null;
  if (outer.occurs === 'many' && part.occurs === 'many')
    return { occurs: 'many', limit: outer.limit !== null && limit !== null ? outer.limit * limit : null };
  if (outer.occurs === 'many') return outer;
  if (part.occurs === 'many') return { occurs: 'many', limit };
  return { occurs: outer.occurs === 'optional' || part.occurs === 'optional' ? 'optional' : 'once', limit: null };
}

/**
 * How often each data element occurs in a structure in the end, by the same path
 * `expandData` takes to it: the first one, reading the parts in order.
 */
function occursInTheEnd(model: Model, structureId: Id): Map<Id, EndOccurs> {
  const out = new Map<Id, EndOccurs>();
  const visit = (id: Id, how: EndOccurs, seen: Set<Id>) => {
    const e = model.elements[id];
    if (!e || seen.has(id)) return;
    if (e.kind === 'dataElement') {
      if (!out.has(id)) out.set(id, how);
    } else if (e.kind === 'dataStructure') {
      const next = new Set(seen).add(id);
      for (const c of e.components) visit(c.dataId, nest(how, c), next);
    }
  };
  visit(structureId, { occurs: 'once', limit: null }, new Set());
  return out;
}

function occursWords(how: EndOccurs | undefined): string {
  if (!how || how.occurs === 'once') return 'Once';
  if (how.occurs === 'optional') return 'Optional';
  return how.limit === null ? 'Many' : `Many, at most ${how.limit}`;
}

function StructureBody({ model, structure }: { model: Model; structure: DataStructure }) {
  const parts = structure.components;
  const setParts = (components: Component[]) => dispatch({ type: 'setComposition', dataId: structure.id, components });
  const move = (i: number, by: number) => {
    const next = [...parts];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item);
    setParts(next);
  };
  const inTheEnd = expandData(model, structure.id);
  const endOccurs = occursInTheEnd(model, structure.id);

  return (
    <>
      <div className="dictionary-table-wrap">
        <div className="table-caption">Made of</div>
        {parts.length === 0 ? (
          <div>
            <Missing>No parts yet</Missing>
          </div>
        ) : (
          <table className="table dictionary-table">
            <thead>
              <tr>
                <th>Part</th>
                <th>Kind</th>
                <th>Occurs</th>
                <th>At most</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {parts.map((c, i) => {
                const part = model.elements[c.dataId];
                const partName = part?.name ?? '';
                return (
                  <tr key={`${c.dataId}-${i}`}>
                    <td>
                      <Link to={`/dictionary/${c.dataId}`}>
                        <NameOf name={partName} />
                      </Link>
                    </td>
                    <td>{part?.kind === 'dataStructure' ? 'Structure' : 'Element'}</td>
                    <td>
                      <select
                        className="input"
                        aria-label={`How often ${partName} occurs`}
                        value={c.occurs}
                        onChange={(e) =>
                          dispatch({ type: 'setOccurs', dataId: structure.id, componentId: c.dataId, occurs: e.target.value as Occurs })
                        }
                      >
                        {OCCURS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="dictionary-limit">
                      {c.occurs === 'many' && (
                        <DraftField
                          hideLabel
                          label={`The most times ${partName} can occur`}
                          placeholder="No limit"
                          value={c.limit === undefined ? '' : String(c.limit)}
                          onCommit={(text) =>
                            dispatch({ type: 'setLimit', dataId: structure.id, componentId: c.dataId, limit: typedNumber(text) }).ok
                          }
                        />
                      )}
                    </td>
                    <td>
                      <div className="dictionary-row-tools">
                        <Button small disabled={i === 0} aria-label={`Move ${partName} up`} onClick={() => move(i, -1)}>
                          Up
                        </Button>
                        <Button small disabled={i === parts.length - 1} aria-label={`Move ${partName} down`} onClick={() => move(i, 1)}>
                          Down
                        </Button>
                        <Button small aria-label={`Remove ${partName} from this structure`} onClick={() => setParts(parts.filter((_, j) => j !== i))}>
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <AddPart model={model} structure={structure} />
      </div>

      <div className="dictionary-table-wrap">
        <div className="table-caption">In the end, {plural(inTheEnd.length, 'element', 'elements')}</div>
        {inTheEnd.length === 0 ? (
          <div className="muted">This structure does not come to any data element yet.</div>
        ) : (
          <table className="table dictionary-table">
            <thead>
              <tr>
                <th>Element</th>
                <th>Data type</th>
                <th>Occurs</th>
                <th>Comes from</th>
              </tr>
            </thead>
            <tbody>
              {inTheEnd.map(({ element, fromId }) => (
                <tr key={element.id}>
                  <td>
                    <Link to={`/dictionary/${element.id}`}>
                      <NameOf name={element.name} />
                    </Link>
                  </td>
                  <td>{element.dataType}</td>
                  <td>{occursWords(endOccurs.get(element.id))}</td>
                  <td>
                    {fromId === null || fromId === structure.id ? (
                      <span className="muted">This structure</span>
                    ) : (
                      <Link to={`/dictionary/${fromId}`}>
                        <NameOf name={model.elements[fromId]?.name ?? ''} />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ---- An element: its data type, length, "null allowed", and its values and meanings ----

function ValuesAndMeanings({ element }: { element: DataElement }) {
  const [value, setValue] = useState('');
  const [meaning, setMeaning] = useState('');
  const valueRef = useRef<HTMLInputElement>(null);
  const rows = element.allowedValues ?? [];

  // Always the { value, meaning } shape, so a meaning is never left to be looked up.
  const save = (allowedValues: AllowedValue[]) =>
    dispatch({ type: 'setDataType', dataId: element.id, dataType: element.dataType, allowedValues });
  const move = (i: number, by: number) => {
    const next = [...rows];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item);
    save(next);
  };

  const typed = value.trim();
  const listed = rows.some((r) => r.value === typed);
  const add = () => {
    if (!typed || listed) return;
    if (save([...rows, { value: typed, meaning: meaning.trim() }]).ok) {
      setValue('');
      setMeaning('');
    }
    valueRef.current?.focus();
  };
  const addOnEnter = (e: { key: string }) => {
    if (e.key === 'Enter') add();
  };

  return (
    <div className="dictionary-table-wrap">
      <div className="table-caption">Values and meanings</div>
      {rows.length === 0 && <div className="muted">Any value is allowed. List values here to limit it to them, and say what each one means.</div>}
      <table className="table dictionary-table dictionary-values">
        <thead>
          <tr>
            <th>Value</th>
            <th>Meaning</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.value}-${i}`}>
              <td className="dictionary-values-value">
                <DraftField
                  hideLabel
                  label={`Allowed value ${i + 1}`}
                  value={r.value}
                  onCommit={(text) => {
                    if (!text) return save(rows.filter((_, j) => j !== i)).ok;
                    if (rows.some((other, j) => j !== i && other.value === text)) return false;
                    return save(rows.map((old, j) => (j === i ? { ...old, value: text } : old))).ok;
                  }}
                />
              </td>
              <td>
                <DraftField
                  hideLabel
                  label={`What the value ${r.value} means`}
                  placeholder="No meaning yet"
                  value={r.meaning}
                  onCommit={(text) => save(rows.map((old, j) => (j === i ? { ...old, meaning: text } : old))).ok}
                />
              </td>
              <td>
                <div className="dictionary-row-tools">
                  <Button small disabled={i === 0} aria-label={`Move the value ${r.value} up`} onClick={() => move(i, -1)}>
                    Up
                  </Button>
                  <Button small disabled={i === rows.length - 1} aria-label={`Move the value ${r.value} down`} onClick={() => move(i, 1)}>
                    Down
                  </Button>
                  <Button small aria-label={`Remove the value ${r.value}`} onClick={() => save(rows.filter((_, j) => j !== i))}>
                    Remove
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          <tr>
            <td className="dictionary-values-value">
              <input
                ref={valueRef}
                className="input"
                type="text"
                aria-label="A value to allow"
                placeholder="Add a value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={addOnEnter}
              />
            </td>
            <td>
              <input
                className="input"
                type="text"
                aria-label="What the new value means"
                placeholder="What it means"
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                onKeyDown={addOnEnter}
              />
            </td>
            <td>
              <div className="dictionary-row-tools">
                <Button small disabled={!typed || listed} onClick={add}>
                  Add value
                </Button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      {typed && listed && <div className="muted">'{typed}' is already listed.</div>}
    </div>
  );
}

function ElementBody({ model, element }: { model: Model; element: DataElement }) {
  const types = DATA_TYPES.includes(element.dataType) ? DATA_TYPES : [element.dataType, ...DATA_TYPES];
  const owner = entityOfAttribute(model, element.id);
  const attribute = owner?.attributes.find((a) => a.dataId === element.id);
  const nullable = element.nullable === null ? '' : element.nullable ? 'yes' : 'no';

  return (
    <>
      <div className="dictionary-type-row">
        <label className="field dictionary-type-select">
          <span className="field-label">Data type</span>
          <select
            className="input"
            value={element.dataType}
            onChange={(e) => dispatch({ type: 'setDataType', dataId: element.id, dataType: e.target.value })}
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <div className="dictionary-length">
          <DraftField
            label="Length"
            placeholder="Not said"
            value={element.length === null ? '' : String(element.length)}
            onCommit={(text) => dispatch({ type: 'setDataDetails', dataId: element.id, length: typedNumber(text) }).ok}
          />
        </div>
        <label className="field dictionary-null">
          <span className="field-label">Null allowed</span>
          <select
            className={`input${nullable === '' ? ' dictionary-unsaid' : ''}`}
            value={nullable}
            onChange={(e) =>
              dispatch({ type: 'setDataDetails', dataId: element.id, nullable: e.target.value === '' ? null : e.target.value === 'yes' })
            }
          >
            <option value="">Not said</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
      </div>

      <ValuesAndMeanings element={element} />

      {owner && (
        <div className="dictionary-owner">
          An attribute of the entity{' '}
          <Link to="/data-model">
            <NameOf name={owner.name} />
          </Link>{' '}
          in the data model.{' '}
          {attribute?.repeats
            ? 'The entity marks it as repeating: one instance can hold several values of it.'
            : 'The entity does not mark it as repeating.'}
        </div>
      )}
    </>
  );
}

// ---- Delete, asking first when the definition is still used ----

function DeleteControl({ model, definition }: { model: Model; definition: DataDefinition }) {
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  const used = whereUsed(model, definition.id);
  const uses = [
    used.flows.length ? `carried by ${plural(used.flows.length, 'flow', 'flows')}` : '',
    used.structures.length ? `part of ${used.structures.map((s) => `'${s.name}'`).join(', ')}` : '',
    used.entities.length ? `an attribute of ${used.entities.map((e) => `'${e.name}'`).join(', ')}` : '',
    used.useCases.length ? `named by ${used.useCases.map((u) => elementLabel(model, u.id)).join(', ')}` : '',
  ].filter(Boolean);

  const remove = () => {
    const result = dispatch({ type: 'deleteElement', id: definition.id, cascade: uses.length > 0 });
    if (result.ok) navigate('/dictionary');
  };

  return (
    <div className="dictionary-delete">
      {!asking ? (
        <Button onClick={() => (uses.length ? setAsking(true) : remove())}>Delete</Button>
      ) : (
        <div className="dictionary-confirm" role="alertdialog" aria-label="Delete a definition that is still used">
          <div>
            '{definition.name}' is still used: {uses.join('; ')}.
            {used.flows.length > 0 && ` Deleting it also deletes ${used.flows.length === 1 ? 'that flow' : 'those flows'}.`} It will be taken out
            of everything else that names it. Undo brings it all back.
          </div>
          <div className="hstack">
            <Button variant="primary" onClick={remove}>
              Delete anyway
            </Button>
            <Button onClick={() => setAsking(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- The centre: the open definition ----

function Detail({ model, definition, fresh }: { model: Model; definition: DataDefinition; fresh: boolean }) {
  return (
    <div className="dictionary-detail">
      <DraftField
        label="Name"
        value={definition.name}
        selectOnMount={fresh}
        onCommit={(name) => dispatch({ type: 'rename', id: definition.id, name: name.trim() })}
      />
      <div className="dictionary-kind">
        <span className="field-label">Kind</span>
        <span>{definition.kind === 'dataStructure' ? 'Data structure' : 'Data element'}</span>
      </div>
      <DraftField
        label="Description"
        rows={3}
        placeholder="No description yet"
        value={definition.description}
        onCommit={(description) => dispatch({ type: 'describe', id: definition.id, description: description.trim() })}
      />
      <EntryFields elementId={definition.id} />
      {definition.kind === 'dataStructure' ? (
        <StructureBody model={model} structure={definition} />
      ) : (
        <ElementBody model={model} element={definition} />
      )}
      <DeleteControl model={model} definition={definition} />
    </div>
  );
}

// ---- The right panel: where it is used, and its problems ----

function UsedPanel({ model, definition }: { model: Model; definition: DataDefinition }) {
  const findings = useElementFindings(definition.id);
  const used = whereUsed(model, definition.id);
  const isStructure = definition.kind === 'dataStructure';

  return (
    <>
      <h2 className="panel-heading">Where used</h2>

      <div className="dictionary-used-section">
        <h3 className="panel-subheading">
          Carried by {used.flows.length === 0 ? 'no flows' : plural(used.flows.length, 'flow', 'flows')}
        </h3>
        {used.flows.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Diagram</th>
                <th>Flow</th>
              </tr>
            </thead>
            <tbody>
              {used.flows.map((u) => (
                <tr key={u.flow.id}>
                  <td>{u.diagramTitle}</td>
                  <td>
                    <Link to={`/diagram/${u.diagramId}`} onClick={() => selectElements([u.flow.id])}>
                      {u.fromLabel} → {u.toLabel}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="dictionary-used-section">
        <h3 className="panel-subheading">Part of</h3>
        {used.structures.length === 0 ? (
          <div className="muted">{isStructure ? 'No other structure' : 'No structure'}</div>
        ) : (
          <ul className="dictionary-used-links">
            {used.structures.map((s) => (
              <li key={s.id}>
                <Link to={`/dictionary/${s.id}`}>
                  <NameOf name={s.name} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {used.entities.length > 0 && (
        <div className="dictionary-used-section">
          <h3 className="panel-subheading">Attribute of {plural(used.entities.length, 'entity', 'entities')}</h3>
          <ul className="dictionary-used-links">
            {used.entities.map((e) => (
              <li key={e.id}>
                <Link to="/data-model">
                  <NameOf name={e.name} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {used.useCases.length > 0 && (
        <div className="dictionary-used-section">
          <h3 className="panel-subheading">Named by {plural(used.useCases.length, 'use case', 'use cases')}</h3>
          <ul className="dictionary-used-links">
            {used.useCases.map((u) => (
              <li key={u.id}>
                <Link to={`/use-cases/${u.id}`}>{elementLabel(model, u.id)}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="panel-heading">
        Problems <Count n={findings.length} />
      </h2>
      <ProblemList findings={findings} emptyText="No problem names this definition." />
    </>
  );
}

// ---- The screen ----

export function DictionaryScreen() {
  const { dataId } = useParams();
  const location = useLocation();
  const model = useModel();
  const first = useMemo(() => sortedDefinitions(model)[0], [model]);

  const named = dataId ? model.elements[dataId] : undefined;
  const definition = dataId ? (named && isData(named) ? named : undefined) : first;
  const fresh = Boolean((location.state as { fresh?: boolean } | null)?.fresh);

  let message: string | null = null;
  if (!definition) {
    message = dataId
      ? 'The dictionary has no definition at this address. It may have been deleted. Pick one from the list.'
      : 'The dictionary is empty. Make a structure or an element with the buttons on the left, or draw a flow on a diagram and name its data.';
  }

  return (
    <>
      <DefinitionList model={model} openId={definition?.id} />
      <WorkArea>
        <PageHeader breadcrumb={['Data dictionary']} title={definition ? definition.name || 'No name yet' : 'Data dictionary'}>
          <UndoRedo />
        </PageHeader>
        {definition ? (
          <div className="work-body scroll pad">
            <Detail key={definition.id} model={model} definition={definition} fresh={fresh} />
          </div>
        ) : (
          <div className="work-body placeholder">{message}</div>
        )}
      </WorkArea>
      <RightPanel label="Where used, and problems">
        {definition ? <UsedPanel key={definition.id} model={model} definition={definition} /> : <div className="muted">Nothing is open.</div>}
      </RightPanel>
    </>
  );
}
