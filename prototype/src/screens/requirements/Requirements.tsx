// The requirements definition: SPEC 10.3. Route: /requirements

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button, Count, FindingMarks, Missing, NumberField, ProblemList, SelectField, Switch } from '../../components';
import { PageHeader, RightPanel, UndoRedo, WorkArea } from '../../frame';
import {
  all,
  elementLabel,
  NONFUNCTIONAL_SUBTYPES,
  NONFUNCTIONAL_TYPES,
  processNumber,
  requirementsOutline,
  routeOf,
  type Id,
  type Model,
  type NonfunctionalType,
  type Requirement,
  type RequirementPatch,
} from '../../model';
import { findingsForElement, type Finding } from '../../rules';
import { dispatch, selectElements, useAreaFindings, useModel, useSelection, useViewModel } from '../../store';
import { capital, ConfirmButton, DraftField, plural } from './shared';
import './requirements.css';

type Outline = ReturnType<typeof requirementsOutline>;
type Group = Outline['functional'][number];
type Numbered = Outline['user'][number];
type Kind = Requirement['requirementKind'];
type Filter = 'all' | 'untraced';

const KIND_WORDS: Record<Kind, string> = {
  user: 'User requirement',
  functional: 'Functional requirement',
  nonfunctional: 'Nonfunctional requirement',
};

const FUNCTIONAL_TYPE_WORDS = { 'process-oriented': 'Process-oriented', 'information-oriented': 'Information-oriented' };

const HEADINGS_LIST = 'requirements-headings';

function priorityWords(priority: Requirement['priority']): string | null {
  if (priority === null) return null;
  return typeof priority === 'number' ? `Release ${priority}` : `${capital(priority)} priority`;
}

function groupKey(userGroup: string, name: string): string {
  return `${userGroup.trim()}\u0000${name.trim()}`;
}

/** The functional groups, gathered under their headings in outline order. */
function byHeading(groups: Group[]): { heading: string; groups: Group[] }[] {
  const blocks: { heading: string; groups: Group[] }[] = [];
  for (const g of groups) {
    const last = blocks[blocks.length - 1];
    if (last && last.heading === g.userGroup) last.groups.push(g);
    else blocks.push({ heading: g.userGroup, groups: [g] });
  }
  return blocks;
}

/** Every requirement's id in the order the outline shows them. */
function outlineIds(outline: Outline, functional: Group[] = outline.functional): Id[] {
  const ids = (items: Numbered[]) => items.map((r) => r.requirement.id);
  return [...ids(outline.user), ...functional.flatMap((g) => ids(g.requirements)), ...outline.nonfunctional.flatMap((t) => ids(t.requirements))];
}

function swapped<T>(list: T[], i: number, j: number): T[] {
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Changes places with the next or the previous requirement of the same group. */
function moveRequirement(outline: Outline, id: Id, siblings: Id[], by: number): void {
  const other = siblings[siblings.indexOf(id) + by];
  if (!other) return;
  const ids = outlineIds(outline);
  dispatch({ type: 'reorderRequirements', ids: swapped(ids, ids.indexOf(id), ids.indexOf(other)) });
}

/** Moves a group past the next or the previous group under the same heading. The numbers follow. */
function moveGroup(outline: Outline, group: Group, by: number): void {
  const blocks = byHeading(outline.functional).map((b) => {
    const i = b.groups.indexOf(group);
    return i >= 0 && b.groups[i + by] ? swapped(b.groups, i, i + by) : b.groups;
  });
  dispatch({ type: 'reorderRequirements', ids: outlineIds(outline, blocks.flat()) });
}

/** Moves a heading, with every group under it, past the next or the previous heading. */
function moveHeading(outline: Outline, index: number, by: number): void {
  const blocks = byHeading(outline.functional);
  if (!blocks[index + by]) return;
  dispatch({ type: 'reorderRequirements', ids: outlineIds(outline, swapped(blocks, index, index + by).flatMap((b) => b.groups)) });
}

/**
 * Changes every requirement of a group or a heading. The shared code has no command for
 * a group, so this is one command, and one undo step, for each requirement.
 */
function updateEach(items: Numbered[], patch: RequirementPatch): boolean {
  return items.every((r) => dispatch({ type: 'updateRequirement', id: r.requirement.id, patch }).ok);
}

// ---- One requirement in the outline ----

interface RowProps {
  model: Model;
  outline: Outline;
  item: Numbered;
  /** The ids of the requirements it can change places with, in order. */
  siblings: Id[];
  findings: Finding[];
  selected: boolean;
  /** Put the cursor in its sentence when it appears: it was just added. */
  focus: boolean;
}

function Row({ model, outline, item, siblings, findings, selected, focus }: RowProps) {
  const r = item.requirement;
  const index = siblings.indexOf(r.id);
  const ref = useRef<HTMLLIElement>(null);
  // A requirement chosen from a problem card may be out of sight.
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const select = () => {
    if (!selected) selectElements([r.id]);
  };
  const priority = priorityWords(r.priority);
  // Functional and nonfunctional numbers both start at 1.1, so a label names the kind too.
  const called = `${KIND_WORDS[r.requirementKind].toLowerCase()} ${item.number}`;
  return (
    <li ref={ref} className={`requirements-row${selected ? ' is-selected' : ''}`} onClick={select} onFocusCapture={select}>
      <span className="requirements-number mono">{item.number}</span>
      <div className="requirements-row-body">
        <DraftField
          quiet
          hideLabel
          rows={1}
          label={capital(called)}
          value={r.name}
          placeholder="No sentence yet"
          selectOnMount={focus}
          onCommit={(name) => dispatch({ type: 'rename', id: r.id, name }).ok}
        />
        <div className="requirements-meta">
          <span>{KIND_WORDS[r.requirementKind]}</span>
          {r.requirementKind === 'functional' && (r.functionalType ? <span>{FUNCTIONAL_TYPE_WORDS[r.functionalType]}</span> : <Missing>No type</Missing>)}
          {r.requirementKind === 'nonfunctional' && (r.subtype ? <span>{capital(r.subtype)}</span> : <Missing>No sub-type</Missing>)}
          {priority ? <span>{priority}</span> : <Missing>No priority</Missing>}
          {r.traceIds.length === 0 ? (
            <Missing>Traced to nothing</Missing>
          ) : (
            <span>
              Traced to{' '}
              {r.traceIds.map((id, i) => (
                <span key={id}>
                  {i > 0 && ', '}
                  <Link to={routeOf(model, id)?.route ?? '/'}>{elementLabel(model, id)}</Link>
                </span>
              ))}
            </span>
          )}
        </div>
      </div>
      <span className="requirements-row-marks">
        <FindingMarks findings={findingsForElement(findings, r.id)} counts={false} />
      </span>
      <span className="requirements-tools">
        <Button small variant="link" disabled={index <= 0} aria-label={`Move ${called} up`} onClick={() => moveRequirement(outline, r.id, siblings, -1)}>
          Up
        </Button>
        <Button
          small
          variant="link"
          disabled={index === siblings.length - 1}
          aria-label={`Move ${called} down`}
          onClick={() => moveRequirement(outline, r.id, siblings, 1)}
        >
          Down
        </Button>
        <Button small variant="link" aria-label={`Remove ${called}`} onClick={() => dispatch({ type: 'deleteElement', id: r.id })}>
          Remove
        </Button>
      </span>
    </li>
  );
}

// ---- The form that starts a new functional group ----

function AddGroup({ onAdd }: { onAdd: (name: string, heading: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [heading, setHeading] = useState('');
  if (!open)
    return (
      <div>
        <Button small onClick={() => setOpen(true)}>
          Add a group
        </Button>
      </div>
    );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onAdd(name.trim(), heading.trim());
    setOpen(false);
    setName('');
    setHeading('');
  };
  return (
    <form className="requirements-add-group" onSubmit={submit}>
      <label className="field">
        <span className="field-label">Name of the new group, such as a business area</span>
        <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Heading above it (optional)</span>
        <input className="input" list={HEADINGS_LIST} value={heading} onChange={(e) => setHeading(e.target.value)} />
      </label>
      <div className="hstack">
        <Button small variant="primary" type="submit">
          Add the group
        </Button>
        <Button small variant="link" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <div className="field-hint">The group starts with one empty requirement, because a group is made of its requirements.</div>
    </form>
  );
}

// ---- The details of the selected requirement, in the right panel ----

interface DetailsProps {
  model: Model;
  /** The model as the mode shows it: the use cases and processes offered for tracing. */
  viewModel: Model;
  outline: Outline;
  item: Numbered;
}

function Details({ model, viewModel, outline, item }: DetailsProps) {
  const r = item.requirement;
  const patch = (p: RequirementPatch) => dispatch({ type: 'updateRequirement', id: r.id, patch: p });

  const choices = useMemo(() => {
    const useCases = all(viewModel, 'useCase')
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((u) => ({ value: u.id, label: `Use case ${elementLabel(viewModel, u.id)}` }));
    const processes = all(viewModel, 'process')
      .map((p) => ({ id: p.id, number: processNumber(viewModel, p.id) }))
      .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
      .map((p) => ({ value: p.id, label: `Process ${elementLabel(viewModel, p.id)}` }));
    return [...useCases, ...processes];
  }, [viewModel]);
  const open = choices.filter((c) => !r.traceIds.includes(c.value));

  const priority = r.priority === null ? '' : typeof r.priority === 'number' ? 'release' : r.priority;
  return (
    <section className="requirements-details" aria-label={`Details of ${KIND_WORDS[r.requirementKind].toLowerCase()} ${item.number}`}>
      <h2 className="panel-heading">
        Requirement <span className="mono">{item.number}</span>
      </h2>
      <DraftField label="Sentence" rows={3} value={r.name} placeholder="No sentence yet" onCommit={(name) => dispatch({ type: 'rename', id: r.id, name }).ok} />
      <SelectField<Kind>
        label="Kind"
        value={r.requirementKind}
        options={(Object.keys(KIND_WORDS) as Kind[]).map((k) => ({ value: k, label: KIND_WORDS[k] }))}
        onChange={(requirementKind) => patch({ requirementKind })}
        hint="Changing the kind moves the requirement to that part of the outline."
      />

      {r.requirementKind === 'functional' && (
        <>
          <SelectField
            label="Type (optional)"
            value={r.functionalType ?? ''}
            options={[
              { value: '', label: 'Not chosen' },
              { value: 'process-oriented', label: 'Process-oriented: something the system does' },
              { value: 'information-oriented', label: 'Information-oriented: something the system holds' },
            ]}
            onChange={(v) => patch({ functionalType: v === '' ? null : (v as Requirement['functionalType']) })}
          />
          <SelectField
            label="Group"
            value={groupKey(r.userGroup, r.group)}
            options={outline.functional.map((g) => ({
              value: groupKey(g.userGroup, g.name),
              label: `${g.number} ${g.name || 'No group name yet'}${g.userGroup ? ` (${g.userGroup})` : ''}`,
            }))}
            onChange={(key) => {
              const g = outline.functional.find((x) => groupKey(x.userGroup, x.name) === key);
              if (g) patch({ group: g.name, userGroup: g.userGroup });
            }}
            hint="Choose another group to move the requirement there."
          />
        </>
      )}

      {r.requirementKind === 'nonfunctional' && (
        <>
          <SelectField<NonfunctionalType>
            label="Type"
            value={r.nonfunctionalType ?? 'operational'}
            options={NONFUNCTIONAL_TYPES.map((t) => ({ value: t, label: capital(t) }))}
            onChange={(nonfunctionalType) => patch({ nonfunctionalType })}
          />
          <SelectField
            label="Sub-type (optional)"
            value={r.subtype}
            options={[{ value: '', label: 'Not chosen' }, ...NONFUNCTIONAL_SUBTYPES[r.nonfunctionalType ?? 'operational'].map((s) => ({ value: s, label: capital(s) }))]}
            onChange={(subtype) => patch({ subtype })}
          />
        </>
      )}

      <div className="requirements-priority">
        <SelectField
          label="Priority (optional)"
          value={priority}
          options={[
            { value: '', label: 'Not set' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
            { value: 'release', label: 'A release number' },
          ]}
          onChange={(v) => patch({ priority: v === '' ? null : v === 'release' ? 1 : (v as 'high' | 'medium' | 'low') })}
        />
        {typeof r.priority === 'number' && <NumberField label="Release" size={3} value={r.priority} onCommit={(n) => patch({ priority: n })} />}
      </div>

      <div className="vstack">
        <h3 className="panel-subheading">Traced to</h3>
        {r.traceIds.length === 0 ? (
          <Missing>Traced to nothing</Missing>
        ) : (
          <ul className="requirements-traces">
            {r.traceIds.map((id) => (
              <li key={id}>
                <Link to={routeOf(model, id)?.route ?? '/'}>{elementLabel(model, id)}</Link>
                <Button
                  small
                  variant="link"
                  aria-label={`Stop tracing to ${elementLabel(model, id)}`}
                  onClick={() => patch({ traceIds: r.traceIds.filter((t) => t !== id) })}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        {choices.length === 0 ? (
          <span className="muted">The project has no use cases or processes to trace to yet.</span>
        ) : open.length === 0 ? (
          <span className="muted">It is traced to every use case and process.</span>
        ) : (
          <SelectField
            label="Trace to a use case or a process"
            value=""
            options={[{ value: '', label: 'Choose one to add' }, ...open]}
            onChange={(id) => {
              if (id) patch({ traceIds: [...r.traceIds, id] });
            }}
          />
        )}
      </div>

      <div>
        <Button small onClick={() => dispatch({ type: 'deleteElement', id: r.id })}>
          Remove this requirement
        </Button>
      </div>
    </section>
  );
}

// ---- The screen ----

export function RequirementsScreen() {
  const model = useModel();
  const viewModel = useViewModel();
  const findings = useAreaFindings('requirements');
  const selection = useSelection();
  const [filter, setFilter] = useState<Filter>('all');
  const [focusId, setFocusId] = useState<Id | null>(null);

  const outline = useMemo(() => requirementsOutline(model), [model]);
  const every = useMemo(
    () => [...outline.user, ...outline.functional.flatMap((g) => g.requirements), ...outline.nonfunctional.flatMap((t) => t.requirements)],
    [outline],
  );
  const selected = every.find((r) => selection.elementIds.includes(r.requirement.id));
  const untraced = every.filter((r) => r.requirement.traceIds.length === 0).length;
  const shown = (items: Numbered[]) => (filter === 'all' ? items : items.filter((r) => r.requirement.traceIds.length === 0));
  const headings = [...new Set(outline.functional.map((g) => g.userGroup).filter(Boolean))];
  const blocks = byHeading(outline.functional);

  const add = (fields: RequirementPatch) => {
    const result = dispatch({ type: 'addRequirement', name: '', ...fields });
    if (result.ok) {
      setFocusId(result.created[0]);
      selectElements([result.created[0]]);
    }
  };

  const rows = (items: Numbered[]) => {
    const siblings = items.map((r) => r.requirement.id);
    return (
      <ul className="requirements-rows">
        {shown(items).map((item) => (
          <Row
            key={item.requirement.id}
            model={model}
            outline={outline}
            item={item}
            siblings={siblings}
            findings={findings}
            selected={selected?.requirement.id === item.requirement.id}
            focus={focusId === item.requirement.id}
          />
        ))}
      </ul>
    );
  };

  const group = (g: Group, inBlock: Group[]) => {
    if (filter === 'untraced' && shown(g.requirements).length === 0) return null;
    const at = inBlock.indexOf(g);
    const label = g.name || `group ${g.number}`;
    return (
      <section key={groupKey(g.userGroup, g.name)} className="requirements-group" aria-label={`Group ${g.number} ${g.name}`}>
        <div className="requirements-group-head">
          <span className="requirements-number mono">{g.number}</span>
          <DraftField
            quiet
            hideLabel
            label={`Name of group ${g.number}`}
            value={g.name}
            placeholder="No group name yet"
            onCommit={(name) => updateEach(g.requirements, { group: name })}
          />
          <label className="requirements-under">
            <span className="field-label">Heading</span>
            <DraftField
              hideLabel
              label={`Heading above group ${g.number}`}
              value={g.userGroup}
              placeholder="No heading"
              list={HEADINGS_LIST}
              onCommit={(userGroup) => updateEach(g.requirements, { userGroup })}
            />
          </label>
          <span className="requirements-tools">
            <Button small variant="link" disabled={at === 0} aria-label={`Move ${label} up`} onClick={() => moveGroup(outline, g, -1)}>
              Up
            </Button>
            <Button small variant="link" disabled={at === inBlock.length - 1} aria-label={`Move ${label} down`} onClick={() => moveGroup(outline, g, 1)}>
              Down
            </Button>
            <ConfirmButton
              link
              label="Remove group"
              question={`Remove this group and its ${plural(g.requirements.length, 'requirement', 'requirements')}?`}
              confirmLabel="Remove them"
              onConfirm={() => g.requirements.every((r) => dispatch({ type: 'deleteElement', id: r.requirement.id }).ok)}
            />
          </span>
        </div>
        {rows(g.requirements)}
        <div className="requirements-add">
          <Button small aria-label={`Add a requirement to ${label}`} onClick={() => add({ requirementKind: 'functional', group: g.name, userGroup: g.userGroup })}>
            Add a requirement
          </Button>
        </div>
      </section>
    );
  };

  return (
    <>
      <WorkArea>
        <PageHeader breadcrumb={['Analysis']} title="Requirements definition">
          {every.length > 0 && (
            <Switch<Filter>
              small
              label="Which requirements to show"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'untraced', label: 'Traced to nothing' },
              ]}
            />
          )}
          <UndoRedo />
        </PageHeader>
        <div className="work-body scroll pad">
          <datalist id={HEADINGS_LIST}>
            {headings.map((h) => (
              <option key={h} value={h} />
            ))}
          </datalist>
          {every.length === 0 ? (
            <div className="requirements-empty">
              <p>
                A requirements definition lists what the users need to do, what the system must do, and how well it must do it. Add the first requirement
                to start.
              </p>
              <div className="hstack">
                <Button variant="primary" onClick={() => add({ requirementKind: 'user' })}>
                  Add a user requirement
                </Button>
                <Button onClick={() => add({ requirementKind: 'functional' })}>Add a functional requirement</Button>
                <Button onClick={() => add({ requirementKind: 'nonfunctional', nonfunctionalType: 'operational' })}>Add a nonfunctional requirement</Button>
              </div>
            </div>
          ) : (
            <div className="requirements-outline">
              {filter === 'untraced' && (
                <p className="requirements-filter-note" role="status">
                  {untraced === 0
                    ? 'Every requirement is traced to a use case or a process.'
                    : `${untraced} of ${plural(every.length, 'requirement is', 'requirements are')} traced to nothing. The others are hidden.`}{' '}
                  <Button small variant="link" onClick={() => setFilter('all')}>
                    Show all
                  </Button>
                </p>
              )}

              <section className="requirements-part" aria-label="User requirements">
                <h2 className="section-heading title">
                  User requirements <Count n={outline.user.length} />
                </h2>
                {outline.user.length === 0 ? filter === 'all' && <Missing>No user requirements yet</Missing> : rows(outline.user)}
                <div className="requirements-add">
                  <Button small onClick={() => add({ requirementKind: 'user' })}>
                    Add a user requirement
                  </Button>
                </div>
              </section>

              <section className="requirements-part" aria-label="Functional requirements">
                <h2 className="section-heading title">
                  Functional requirements <Count n={outline.functional.reduce((n, g) => n + g.requirements.length, 0)} />
                </h2>
                {outline.functional.length === 0 && filter === 'all' && <Missing>No functional requirements yet</Missing>}
                {blocks.map((block, b) => {
                  const groups = block.groups.map((g) => group(g, block.groups));
                  if (groups.every((g) => g === null)) return null;
                  const under = block.groups.flatMap((g) => g.requirements);
                  return (
                    <div key={block.heading || `none-${b}`} className="requirements-block">
                      {blocks.length > 1 || block.heading ? (
                        <div className="requirements-heading">
                          {block.heading ? (
                            <DraftField
                              quiet
                              hideLabel
                              label={`Heading ${block.heading}`}
                              value={block.heading}
                              onCommit={(userGroup) => updateEach(under, { userGroup })}
                            />
                          ) : (
                            <span className="grow">
                              <Missing>No heading</Missing>
                            </span>
                          )}
                          {blocks.length > 1 && (
                            <span className="requirements-tools">
                              <Button small variant="link" disabled={b === 0} aria-label={`Move the heading ${block.heading || 'with no name'} up`} onClick={() => moveHeading(outline, b, -1)}>
                                Up
                              </Button>
                              <Button
                                small
                                variant="link"
                                disabled={b === blocks.length - 1}
                                aria-label={`Move the heading ${block.heading || 'with no name'} down`}
                                onClick={() => moveHeading(outline, b, 1)}
                              >
                                Down
                              </Button>
                            </span>
                          )}
                        </div>
                      ) : null}
                      {groups}
                    </div>
                  );
                })}
                <AddGroup onAdd={(name, heading) => add({ requirementKind: 'functional', group: name, userGroup: heading })} />
              </section>

              <section className="requirements-part" aria-label="Nonfunctional requirements">
                <h2 className="section-heading title">
                  Nonfunctional requirements <Count n={outline.nonfunctional.reduce((n, t) => n + t.requirements.length, 0)} />
                </h2>
                {outline.nonfunctional.map((t) => {
                  const empty = t.requirements.length === 0;
                  if (filter === 'untraced' && shown(t.requirements).length === 0) return null;
                  return (
                    <section key={t.type} className="requirements-group" aria-label={`${capital(t.type)} requirements`}>
                      <div className="requirements-group-head">
                        <span className="requirements-number mono">{t.number}</span>
                        <h3 className="requirements-type-name">{capital(t.type)}</h3>
                        <FindingMarks findings={findings.filter((f) => f.ruleId === 'RQ-03' && f.values.type === t.type)} counts={false} />
                      </div>
                      {empty ? (
                        <div className="requirements-none">
                          <label className="requirements-check">
                            <input
                              type="checkbox"
                              checked={t.noneExpected}
                              onChange={(e) => dispatch({ type: 'setNoneExpected', nonfunctionalType: t.type, noneExpected: e.target.checked })}
                            />
                            None expected
                          </label>
                          {t.noneExpected ? <span>No special {t.type} requirements are expected.</span> : <Missing>Nothing here yet</Missing>}
                        </div>
                      ) : (
                        rows(t.requirements)
                      )}
                      <div className="requirements-add">
                        <Button small aria-label={`Add ${/^[aeiou]/.test(t.type) ? 'an' : 'a'} ${t.type} requirement`} onClick={() => add({ requirementKind: 'nonfunctional', nonfunctionalType: t.type })}>
                          Add a requirement
                        </Button>
                      </div>
                    </section>
                  );
                })}
              </section>
            </div>
          )}
        </div>
      </WorkArea>
      <RightPanel label="The selected requirement, and problems">
        {selected ? (
          <Details model={model} viewModel={viewModel} outline={outline} item={selected} />
        ) : (
          every.length > 0 && <p className="muted">Select a requirement to see and change its kind, its priority and what it is traced to.</p>
        )}
        <h2 className="panel-heading">
          Problems <Count n={findings.length} />
        </h2>
        <ProblemList findings={findings} emptyText="No problems in the requirements definition." />
      </RightPanel>
    </>
  );
}
