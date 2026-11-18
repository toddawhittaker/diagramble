// The export page: choose what to include, see the pages, then print or save. Route: /export

import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button, Mark, Missing } from '../../components';
import { ListColumn, PageHeader, WorkArea } from '../../frame';
import {
  all,
  childDiagram,
  dataDefinitions,
  diagramOutline,
  diagramsInOrder,
  elementLabel,
  eventResponseList,
  get,
  getOutline,
  isAboveProject,
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
import { useFindings, useFindingsVisible, useModel } from '../../store';
import { StaticDfd, StaticErd, StaticFragment } from './drawings';
import { downloadModel } from './files';
import { groupFindings, plural } from './shared';
import './project.css';

const PARTS: { key: string; title: string }[] = [
  { key: 'fragments', title: 'DFD fragments' },
  { key: 'dictionary', title: 'Data dictionary' },
  { key: 'useCaseList', title: 'Use case list' },
  { key: 'eventResponse', title: 'Event-response list' },
  { key: 'useCases', title: 'Use cases' },
  { key: 'erd', title: 'Entity relationship diagram' },
  { key: 'crud', title: 'CRUD matrix' },
  { key: 'problems', title: 'Problems' },
];

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function nameOf(model: Model, id: Id | null): string {
  return (id && model.elements[id]?.name) || '';
}

/** A description, or the "missing" mark when it is empty. */
function Description({ text }: { text: string }) {
  return text.trim() ? <>{text}</> : <Missing>No description yet</Missing>;
}

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="project-page">
      <h2 className="project-page-title">{title}</h2>
      {children}
    </section>
  );
}

// ---- One section for each thing that can be ticked ----

function DiagramPage({ model, diagramId, title }: { model: Model; diagramId: Id; title: string }) {
  const outline = diagramOutline(model, diagramId);
  return (
    <Page title={title}>
      <StaticDfd model={model} diagramId={diagramId} />
      {outline.items.length > 0 && (
        <>
          <div className="table-caption project-caption">On this diagram</div>
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Kind</th>
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
                  <td>{capital(KIND_WORDS[item.element.kind])}</td>
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
              </tr>
            </thead>
            <tbody>
              {outline.flows.map((f) => (
                <tr key={f.flow.id}>
                  <td>{f.fromLabel}</td>
                  <td>{f.toLabel}</td>
                  <td>{f.dataName}</td>
                </tr>
              ))}
              {outline.controlFlows.map((c) => (
                <tr key={c.flow.id}>
                  <td className="muted">Control flow</td>
                  <td>{c.toLabel}</td>
                  <td>{c.flow.name}</td>
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
function MadeOf({ model, definition }: { model: Model; definition: DataDefinition }) {
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

function DictionaryPage({ model }: { model: Model }) {
  const definitions = [...dataDefinitions(model)].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Page title="Data dictionary">
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
                <td>{d.kind === 'dataStructure' ? 'Structure' : 'Element'}</td>
                <td>
                  <MadeOf model={model} definition={d} />
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

function UseCasesPage({ model }: { model: Model }) {
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

function UseCaseListPage({ model }: { model: Model }) {
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

function EventResponsePage({ model }: { model: Model }) {
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

function FragmentsPage({ model }: { model: Model }) {
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

function ErdPage({ model }: { model: Model }) {
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

function CrudPage({ model }: { model: Model }) {
  const processes = leafProcesses(model);
  const entities = all(model, 'entity');
  return (
    <Page title="CRUD matrix">
      {entities.length === 0 || processes.length === 0 ? (
        <p className="muted">The matrix needs at least one entity and one process.</p>
      ) : (
        <>
          <p className="muted project-caption">
            C is create, R is read, U is update and D is delete. Each column is a process that has no child diagram. Letters on
            an entity&rsquo;s own row are for the entity as a whole.
          </p>
          <table className="table project-crud">
            <thead>
              <tr>
                <th>Entity and attribute</th>
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
                  <td>{entity.name || 'No name'}</td>
                  {processes.map((p) => (
                    <td key={p.id} className="mono">
                      {p.crud.find((cell) => cell.dataId === entity.id)?.uses ?? ''}
                    </td>
                  ))}
                </tr>,
                ...entity.attributes.map((a) => (
                  <tr key={`${entity.id}:${a.dataId}`}>
                    <td className="project-crud-attribute">{nameOf(model, a.dataId)}</td>
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

function ProblemsPage({ model, findings, visible }: { model: Model; findings: Finding[]; visible: boolean }) {
  const { errors, warnings } = countFindings(findings);
  return (
    <Page title="Problems">
      {!visible ? (
        <p className="muted">
          Problems are hidden for this project, so none are listed here. Choose &ldquo;Check now&rdquo; in the top bar to list
          them.
        </p>
      ) : findings.length === 0 ? (
        <p className="hstack">
          <Mark kind="ok" /> The rules found no problems in this project.
        </p>
      ) : (
        <>
          <p className="project-caption">
            The rules found {plural(errors, 'error')} and {plural(warnings, 'warning')}.
          </p>
          {groupFindings(model, findings).map((group) => (
            <div key={group.key}>
              <div className="table-caption project-caption">{group.title}</div>
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
                        <div className="muted">How to fix: {f.fix}.</div>
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

// ---- The screen ----

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers, and pages not served over a secure connection.
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let done = false;
    try {
      done = document.execCommand('copy');
    } catch {
      done = false;
    }
    area.remove();
    return done;
  }
}

export function ExportScreen() {
  const model = useModel();
  const findings = useFindings();
  const visible = useFindingsVisible();
  // Holds only the boxes the user has changed. Any other box is ticked, unless it is a
  // diagram above the project's top diagram, so a diagram added later starts as it should.
  const [changed, setChanged] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [note, setNote] = useState('');

  const diagrams = diagramsInOrder(model);
  const choices = [
    ...diagrams.map((row) => ({ key: `diagram:${row.diagram.id}`, title: row.title, above: isAboveProject(model, row.diagram.id) })),
    ...PARTS.map((p) => ({ ...p, above: false })),
  ];
  const included = (key: string) => changed.get(key) ?? !choices.find((c) => c.key === key)?.above;
  const setIncluded = (key: string, on: boolean) => setChanged(new Map(changed).set(key, on));
  const setAll = (on: boolean) => setChanged(new Map(choices.map((c) => [c.key, on])));
  const chosen = choices.filter((c) => included(c.key));
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      <ListColumn width={280} label="What to include, and what to do with it">
        <div className="project-export-controls">
          <h2 className="panel-subheading">Include</h2>
          <div className="project-ticks">
            <div className="project-tick-group muted">Diagrams</div>
            {choices.map((choice, i) => (
              <label key={choice.key} className="project-tick" style={{ marginTop: i === diagrams.length ? 10 : undefined }}>
                <input type="checkbox" checked={included(choice.key)} onChange={(e) => setIncluded(choice.key, e.target.checked)} />
                <span>
                  {choice.title}
                  {choice.above && <span className="muted"> (above the project)</span>}
                </span>
              </label>
            ))}
          </div>
          <div className="hstack">
            <Button small onClick={() => setAll(true)} disabled={chosen.length === choices.length}>
              Tick all
            </Button>
            <Button small onClick={() => setAll(false)} disabled={chosen.length === 0}>
              Clear all
            </Button>
          </div>

          <h2 className="panel-subheading">Save</h2>
          <Button variant="primary" onClick={() => window.print()} disabled={chosen.length === 0}>
            Print or save as PDF
          </Button>
          <p className="field-hint">In the print window, choose &ldquo;Save as PDF&rdquo; as the printer to get a file.</p>
          <Button
            onClick={() => {
              setNote(`Saved ${downloadModel(model)} to your downloads.`);
            }}
          >
            Download project file
          </Button>
          <Button
            onClick={async () => {
              const done = await copyText(getOutline(model));
              setNote(done ? 'The outline is copied. Paste it wherever you need it.' : 'The browser would not copy the outline.');
            }}
          >
            Copy outline as text
          </Button>
          <p className="field-hint" role="status">
            {note}
          </p>

          <h2 className="panel-subheading">Start again</h2>
          <p className="field-hint">
            Starting a new project, opening a project file and starting again from the sample data are on the{' '}
            <Link to="/project">Project page</Link>.
          </p>
        </div>
      </ListColumn>
      <WorkArea>
        <PageHeader breadcrumb={['Project']} title="Export">
          <span className="muted">
            A title page and {plural(chosen.length, 'section')}, shown as they will print
          </span>
        </PageHeader>
        <div className="work-body scroll project-preview-area">
          <div className="project-preview">
            <section className="project-page project-title-page">
              <h1 className="project-doc-title">{model.name || 'Project with no name'}</h1>
              <p className="muted">{today}</p>
              {chosen.length > 0 ? (
                <>
                  <div className="table-caption project-caption">Contents</div>
                  <ol className="project-contents">
                    {chosen.map((c) => (
                      <li key={c.key}>{c.title}</li>
                    ))}
                  </ol>
                </>
              ) : (
                <p className="muted project-caption">Nothing is ticked, so there is nothing to print.</p>
              )}
            </section>
            {diagrams.map(
              (row) =>
                included(`diagram:${row.diagram.id}`) && (
                  <DiagramPage key={row.diagram.id} model={model} diagramId={row.diagram.id} title={row.title} />
                ),
            )}
            {included('fragments') && <FragmentsPage model={model} />}
            {included('dictionary') && <DictionaryPage model={model} />}
            {included('useCaseList') && <UseCaseListPage model={model} />}
            {included('eventResponse') && <EventResponsePage model={model} />}
            {included('useCases') && <UseCasesPage model={model} />}
            {included('erd') && <ErdPage model={model} />}
            {included('crud') && <CrudPage model={model} />}
            {included('problems') && <ProblemsPage model={model} findings={findings} visible={visible} />}
          </div>
        </div>
      </WorkArea>
    </>
  );
}
