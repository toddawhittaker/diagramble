// The page layouts of the first release for the export preview: one for each thing that
// can be put in a document.

import { type ReactNode } from 'react';
import { Mark, Missing } from '../../components';
import {
  all,
  childDiagram,
  dataDefinitions,
  diagramOutline,
  elementLabel,
  eventResponseList,
  get,
  isSystemRelated,
  KIND_WORDS,
  leafProcesses,
  processesOn,
  processNumber,
  rootProcess,
  type DataDefinition,
  type Id,
  type Model,
  type RelationshipEnd,
  type UseCase,
} from '../../model';
import { countFindings, type Finding } from '../../rules';
import { StaticDfd, StaticErd, StaticFragment } from './drawings';
import { groupFindings, plural } from './shared';

export function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function nameOf(model: Model, id: Id | null): string {
  return (id && model.elements[id]?.name) || '';
}

/** A description, or the "missing" mark when it is empty. */
export function Description({ text }: { text: string }) {
  return text.trim() ? <>{text}</> : <Missing>No description yet</Missing>;
}

export function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="project-page">
      <h2 className="project-page-title">{title}</h2>
      {children}
    </section>
  );
}

// ---- One section for each thing that can be ticked ----

/** How a symbol is carried out in the physical model, in words. */
function carriedOut(element: Model['elements'][Id]): ReactNode {
  if (element.kind === 'process') {
    if (element.implementation.trim()) return element.human ? `${element.implementation} (done by a person)` : element.implementation;
    return element.human ? 'Done by a person' : <Missing>No implementation yet</Missing>;
  }
  if (element.kind === 'dataStore') return element.physicalName.trim() || <Missing>No physical name yet</Missing>;
  if (element.kind === 'externalEntity') return element.human ? 'A person' : <span className="muted">Not a person</span>;
  return null;
}

/** One data flow diagram with its descriptions. With `physical`, it shows the physical names and how each part is carried out. */
export function DiagramPage({ model, diagramId, title, physical }: { model: Model; diagramId: Id; title: string; physical?: boolean }) {
  const outline = diagramOutline(model, diagramId);
  return (
    <Page title={title}>
      <StaticDfd model={model} diagramId={diagramId} physical={physical} />
      {physical && outline.items.length > 0 && (
        <p className="muted project-caption">
          The last line of a process says how it is carried out. A dashed outline marks work that a person does: everything
          outside the outlines is done by the system.
        </p>
      )}
      {outline.items.length > 0 && (
        <>
          <div className="table-caption project-caption">On this diagram</div>
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Kind</th>
                {physical && <th>Physical name, or how it is carried out</th>}
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {outline.items.map((item) => (
                <tr key={item.occurrenceId}>
                  <td>
                    {item.label}
                    {item.element.aliases.length > 0 && <div className="muted">Also called: {item.element.aliases.join(', ')}</div>}
                  </td>
                  <td>
                    {capital(KIND_WORDS[item.element.kind])}
                    {physical && isSystemRelated(item.element) && <div className="muted">System-related</div>}
                  </td>
                  {physical && <td>{carriedOut(item.element)}</td>}
                  <td>
                    <Description text={item.element.description} />
                    {item.element.kind === 'process' && item.element.processDescription.trim() && (
                      <div className="project-process-description">
                        <div className="mono muted">Process description</div>
                        {item.element.processDescription}
                      </div>
                    )}
                    {item.element.notes.trim() && <div className="muted project-notes">Notes: {item.element.notes}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {outline.flows.length + outline.controlFlows.length > 0 && (
        <>
          <div className="table-caption project-caption">Flows</div>
          <table className="table">
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Data</th>
                {physical && <th>Physical name</th>}
              </tr>
            </thead>
            <tbody>
              {outline.flows.map((f) => (
                <tr key={f.flow.id}>
                  <td>{f.fromLabel}</td>
                  <td>{f.toLabel}</td>
                  <td>{f.dataName}</td>
                  {physical && <td>{f.flow.physicalName.trim() || <Missing>No physical name yet</Missing>}</td>}
                </tr>
              ))}
              {outline.controlFlows.map((c) => (
                <tr key={c.flow.id}>
                  <td className="muted">Control flow</td>
                  <td>{c.toLabel}</td>
                  <td>{c.flow.name}</td>
                  {physical && <td />}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Page>
  );
}

/** What a definition is made of: a structure's parts, or an element's type, length, "null" and values. */
function MadeOf({ model, definition, physical }: { model: Model; definition: DataDefinition; physical?: boolean }) {
  if (definition.kind === 'dataStructure') {
    if (definition.components.length === 0) return <Missing>No contents yet</Missing>;
    return (
      <>
        {definition.components
          .map((c) => {
            const name = nameOf(model, c.dataId) || 'No name';
            if (c.occurs === 'optional') return `${name} (optional)`;
            if (c.occurs === 'many') return c.limit ? `${name} (many, at most ${c.limit})` : `${name} (many)`;
            return name;
          })
          .join(', ')}
      </>
    );
  }
  const values = definition.allowedValues ?? [];
  return (
    <>
      <div>{definition.dataType || <Missing>No data type yet</Missing>}</div>
      {definition.length !== null && <div>Length: {definition.length}</div>}
      {definition.nullable !== null && <div>Null: {definition.nullable ? 'allowed' : 'not allowed'}</div>}
      {physical && definition.fieldName.trim() && (
        <div>
          Field name: <span className="mono">{definition.fieldName}</span>
        </div>
      )}
      {physical && definition.defaultValue.trim() && <div>Default: {definition.defaultValue}</div>}
      {values.length > 0 && (
        <>
          <div className="muted">Values</div>
          <ul className="project-plain-list">
            {values.map((v, i) => (
              <li key={i}>
                <span className="mono">{v.value}</span>
                {v.meaning.trim() && <>: {v.meaning}</>}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

export function DictionaryPage({ model, title = 'Data dictionary', physical }: { model: Model; title?: string; physical?: boolean }) {
  const definitions = [...dataDefinitions(model)].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Page title={title}>
      {definitions.length === 0 ? (
        <p className="muted">The data dictionary has no definitions yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Kind</th>
              <th>Made of, or data type and values</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {definitions.map((d) => (
              <tr key={d.id}>
                <td>
                  {d.name || <Missing>No name yet</Missing>}
                  {d.aliases.length > 0 && <div className="muted">Also called: {d.aliases.join(', ')}</div>}
                </td>
                <td>
                  {d.kind === 'dataStructure' ? 'Structure' : 'Element'}
                  {physical && isSystemRelated(d) && <div className="muted">System-related</div>}
                </td>
                <td>
                  <MadeOf model={model} definition={d} physical={physical} />
                </td>
                <td>
                  <Description text={d.description} />
                  {d.notes.trim() && <div className="muted project-notes">Notes: {d.notes}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Page>
  );
}

function UseCaseBlock({ model, useCase }: { model: Model; useCase: UseCase }) {
  const list = (items: string[]) =>
    items.length ? (
      <ul className="project-plain-list">
        {items.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ul>
    ) : (
      <span className="muted">None</span>
    );
  return (
    <div className="project-use-case">
      <h3 className="project-page-subtitle">
        <span className="mono">UC-{useCase.ordinal}</span> {useCase.name}
      </h3>
      <table className="table project-form">
        <tbody>
          <tr>
            <th>Priority</th>
            <td>{capital(useCase.priority)}</td>
          </tr>
          <tr>
            <th>Actor</th>
            <td>{useCase.actorId ? elementLabel(model, useCase.actorId) : <Missing>No actor yet</Missing>}</td>
          </tr>
          <tr>
            <th>Description</th>
            <td>
              <Description text={useCase.description} />
            </td>
          </tr>
          <tr>
            <th>Trigger</th>
            <td>
              {useCase.trigger || <Missing>No trigger yet</Missing>}{' '}
              <span className="muted">({useCase.triggerType === 'external' ? 'External' : 'Temporal'})</span>
            </td>
          </tr>
          <tr>
            <th>Preconditions</th>
            <td>{list(useCase.preconditions)}</td>
          </tr>
          <tr>
            <th>Steps</th>
            <td>
              {useCase.steps.length ? (
                <ol className="project-steps">
                  {useCase.steps.map((step, i) => (
                    <li key={i}>
                      {step.text}
                      {step.substeps.length > 0 && (
                        <ol type="a">
                          {step.substeps.map((text, j) => (
                            <li key={j}>{text}</li>
                          ))}
                        </ol>
                      )}
                      {step.information.map((info, j) => (
                        <div key={j} className="muted">
                          {info.direction === 'in' ? 'In' : 'Out'}: {nameOf(model, info.dataId)}
                        </div>
                      ))}
                    </li>
                  ))}
                </ol>
              ) : (
                <Missing>No steps yet</Missing>
              )}
            </td>
          </tr>
          <tr>
            <th>Exceptions</th>
            <td>
              {useCase.exceptions.length ? (
                <ul className="project-plain-list">
                  {useCase.exceptions.map((e, i) => (
                    <li key={i}>
                      Step {e.stepNumber}: {e.text}
                      {e.steps.length > 0 && (
                        <ol className="project-steps">
                          {e.steps.map((text, j) => (
                            <li key={j}>{text}</li>
                          ))}
                        </ol>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="muted">None</span>
              )}
            </td>
          </tr>
          <tr>
            <th>Postconditions</th>
            <td>{list(useCase.postconditions)}</td>
          </tr>
          <tr>
            <th>Inputs</th>
            <td>{list(useCase.summaryInputs.map((i) => `${nameOf(model, i.dataId)}, from ${elementLabel(model, i.sourceId)}`))}</td>
          </tr>
          <tr>
            <th>Outputs</th>
            <td>
              {list(useCase.summaryOutputs.map((o) => `${nameOf(model, o.dataId)}, to ${elementLabel(model, o.destinationId)}`))}
            </td>
          </tr>
          <tr>
            <th>Process</th>
            <td>{useCase.processId ? elementLabel(model, useCase.processId) : <span className="muted">None</span>}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function UseCasesPage({ model }: { model: Model }) {
  const useCases = [...all(model, 'useCase')].sort((a, b) => a.ordinal - b.ordinal);
  return (
    <Page title="Use cases">
      {useCases.length === 0 && <p className="muted">The project has no use cases yet.</p>}
      {useCases.map((useCase) => (
        <UseCaseBlock key={useCase.id} model={model} useCase={useCase} />
      ))}
    </Page>
  );
}

export function UseCaseListPage({ model }: { model: Model }) {
  const useCases = [...all(model, 'useCase')].sort((a, b) => a.ordinal - b.ordinal);
  return (
    <Page title="Use case list">
      {useCases.length === 0 ? (
        <p className="muted">The project has no use cases yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Use case</th>
              <th>Priority</th>
              <th>Actor</th>
              <th>Process</th>
            </tr>
          </thead>
          <tbody>
            {useCases.map((u) => (
              <tr key={u.id}>
                <td className="mono">UC-{u.ordinal}</td>
                <td>{u.name || <Missing>No name yet</Missing>}</td>
                <td>{capital(u.priority)}</td>
                <td>{u.actorId ? elementLabel(model, u.actorId) : <Missing>No actor yet</Missing>}</td>
                <td>{u.processId ? elementLabel(model, u.processId) : <span className="muted">None</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Page>
  );
}

export function EventResponsePage({ model }: { model: Model }) {
  const rows = eventResponseList(model);
  return (
    <Page title="Event-response list">
      {rows.length === 0 ? (
        <p className="muted">The project has no use cases yet, so there are no events to list.</p>
      ) : (
        <>
          <p className="muted project-caption">One row for each use case. The event is what starts it, and the response is what the system does.</p>
          <table className="table">
            <thead>
              <tr>
                <th>Use case</th>
                <th>Event</th>
                <th>Response</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="mono">UC-{get(model, row.id, 'useCase')?.ordinal}</td>
                  <td>{row.trigger || <Missing>No trigger yet</Missing>}</td>
                  <td>{row.name || <Missing>No name yet</Missing>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Page>
  );
}

export function FragmentsPage({ model }: { model: Model }) {
  const root = rootProcess(model);
  const level0 = root && childDiagram(model, root.id);
  const processes = level0 ? processesOn(model, level0.id) : [];
  return (
    <Page title="DFD fragments">
      {!level0 ? (
        <p className="muted">The project has no level 0 diagram yet, so there are no fragments.</p>
      ) : processes.length === 0 ? (
        <p className="muted">The level 0 diagram has no processes yet, so there are no fragments.</p>
      ) : (
        <>
          <p className="muted project-caption">
            One drawing for each process of the level 0 diagram, with its flows and what is at their other ends.
          </p>
          {processes.map((p) => (
            <div key={p.id} className="project-fragment">
              <h3 className="project-page-subtitle">
                <span className="mono">{processNumber(model, p.id)}</span> {p.name || <Missing>No name yet</Missing>}
              </h3>
              <StaticFragment model={model} processId={p.id} />
            </div>
          ))}
        </>
      )}
    </Page>
  );
}

function howMany(end: RelationshipEnd): string {
  if (end.min === null && end.max === null) return 'a number not yet decided of';
  if (end.max === null) return end.min === 1 ? 'at least one (the most is not yet decided)' : 'zero or more (the most is not yet decided)';
  if (end.min === null) return end.max === 'one' ? 'at most one (the least is not yet decided)' : 'many (the least is not yet decided)';
  if (end.max === 'one') return end.min === 1 ? 'exactly one' : 'zero or one';
  return end.min === 1 ? 'one or many' : 'zero or many';
}

export function ErdPage({ model }: { model: Model }) {
  const entities = all(model, 'entity');
  const relationships = all(model, 'relationship');
  // One sentence for each direction: "One Client owns zero or many Pet."
  const sentence = (from: RelationshipEnd, to: RelationshipEnd) =>
    `One ${nameOf(model, from.entityId) || 'entity'} ${from.verbPhrase || 'is related to'} ${howMany(to)} ${nameOf(model, to.entityId) || 'entity'}.`;
  return (
    <Page title="Entity relationship diagram">
      <StaticErd model={model} />
      {entities.length > 0 && (
        <>
          <div className="table-caption project-caption">Entities</div>
          <table className="table">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Attributes (identifier marked *, repeating in braces)</th>
                <th>Held in</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {entities.map((entity) => (
                <tr key={entity.id}>
                  <td>{entity.name || <Missing>No name yet</Missing>}</td>
                  <td>
                    {entity.attributes
                      .map((a) => `${a.identifier ? '* ' : ''}${a.repeats ? `{${nameOf(model, a.dataId)}}` : nameOf(model, a.dataId)}`)
                      .join(', ') || (
                      <Missing>No attributes yet</Missing>
                    )}
                  </td>
                  <td>{entity.storeId ? elementLabel(model, entity.storeId) : <Missing>No data store yet</Missing>}</td>
                  <td>
                    <Description text={entity.description} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {relationships.length > 0 && (
        <>
          <div className="table-caption project-caption">Relationships</div>
          <ul className="project-plain-list">
            {relationships.map((rel) => (
              <li key={rel.id}>
                {sentence(rel.ends[0], rel.ends[1])} {sentence(rel.ends[1], rel.ends[0])}
                {rel.identifying && <span className="muted"> Identifying.</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </Page>
  );
}

/** The CRUD matrix. With `physical`, the rows carry the table and field names. */
export function CrudPage({ model, title = 'CRUD matrix', physical }: { model: Model; title?: string; physical?: boolean }) {
  const processes = leafProcesses(model);
  const entities = all(model, 'entity');
  const fieldName = (id: Id) => {
    const element = get(model, id, 'dataElement');
    return (physical && element?.fieldName.trim()) || nameOf(model, id);
  };
  return (
    <Page title={title}>
      {entities.length === 0 || processes.length === 0 ? (
        <p className="muted">The matrix needs at least one entity and one process.</p>
      ) : (
        <>
          <p className="muted project-caption">
            C is create, R is read, U is update and D is delete. Each column is a process that has no child diagram. Letters on
            {physical ? ' a table’s own row are for the table as a whole.' : ' an entity’s own row are for the entity as a whole.'}
          </p>
          <table className="table project-crud">
            <thead>
              <tr>
                <th>{physical ? 'Table and field' : 'Entity and attribute'}</th>
                {processes.map((p) => (
                  <th key={p.id}>
                    {processNumber(model, p.id)} {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entities.map((entity) => [
                <tr key={entity.id} className="project-crud-entity">
                  <td>{(physical && entity.tableName.trim()) || entity.name || 'No name'}</td>
                  {processes.map((p) => (
                    <td key={p.id} className="mono">
                      {p.crud.find((cell) => cell.dataId === entity.id)?.uses ?? ''}
                    </td>
                  ))}
                </tr>,
                ...entity.attributes.map((a) => (
                  <tr key={`${entity.id}:${a.dataId}`}>
                    <td className="project-crud-attribute">{fieldName(a.dataId)}</td>
                    {processes.map((p) => (
                      <td key={p.id} className="mono">
                        {p.crud.find((cell) => cell.dataId === a.dataId)?.uses ?? ''}
                      </td>
                    ))}
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </>
      )}
    </Page>
  );
}

export function ProblemsPage({
  model,
  findings,
  visible,
  title = 'Problems',
  scope = 'this project',
  note,
}: {
  model: Model;
  findings: Finding[];
  visible: boolean;
  title?: string;
  /** What the findings cover, as in "no problems in this project". */
  scope?: string;
  /** A sentence about which rules ran. */
  note?: string;
}) {
  const { errors, warnings } = countFindings(findings);
  return (
    <Page title={title}>
      {!visible ? (
        <p className="muted">
          Problems are hidden for this project, so none are listed here. Choose &ldquo;Check now&rdquo; in the top bar to list
          them.
        </p>
      ) : findings.length === 0 ? (
        <p className="hstack">
          <Mark kind="ok" /> The rules found no problems in {scope}.{note ? ` ${note}` : ''}
        </p>
      ) : (
        <>
          <p className="project-caption">
            The rules found {plural(errors, 'error')} and {plural(warnings, 'warning')} in {scope}.{note ? ` ${note}` : ''}
          </p>
          {groupFindings(model, findings).map((group) => (
            <div key={group.key}>
              <div className="table-caption project-caption">
                {group.title}
                {group.physicalOnly && <span className="muted project-physical-note"> Physical mode only</span>}
              </div>
              <table className="table">
                <tbody>
                  {group.findings.map((f) => (
                    <tr key={f.id}>
                      <td className="project-problem-mark">
                        <Mark kind={f.severity} word />
                      </td>
                      <td className="mono project-problem-code">{f.ruleId}</td>
                      <td>
                        <div>{f.message}</div>
                        <div className="muted">How to fix: {f.fix.replace(/\.$/, '')}.</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </Page>
  );
}
