// The program specifications: one form for each module, laid out as docs/SPEC.md section
// 11.4 lists its fields. The inputs and outputs are not typed: they are the module's
// couples, read from the chart.

import { Link, useParams } from 'react-router';
import {
  all,
  chartOfModule,
  fanIn,
  get,
  modulesOf,
  moduleNumber,
  originalModule,
  programIo,
  type Id,
  type IoRow,
  type Model,
  type Module,
  type ProgramSpecPatch,
} from '../../model';
import { clearSelection, dispatch, selectElements, useAreaFindings, useViewModel } from '../../store';
import { CellText, FindingMarks, Missing, ProblemList } from '../../components';
import { ListColumn, PageHeader, RightPanel, UndoRedo, WorkArea } from '../../frame';
import { DraftField, moduleLabel } from './shared';

function chartRoute(model: Model, moduleId: Id): string {
  const chart = chartOfModule(model, moduleId);
  return chart ? `/structure/${chart.id}` : '/structure';
}

/** One of the two read-only tables. Only the notes are typed here. */
function IoTable({ model, module, rows, kind }: { model: Model; module: Module; rows: IoRow[]; kind: 'input' | 'output' }) {
  const saveNotes = (coupleId: Id, notes: string) => {
    // Notes left behind by a couple that has since been removed are dropped.
    const kept = module.ioNotes.filter((n) => n.coupleId !== coupleId && get(model, n.coupleId, 'couple'));
    dispatch({ type: 'setProgramSpec', moduleId: module.id, patch: { ioNotes: [...kept, { coupleId, notes }] } });
  };
  return (
    <div>
      <div className="table-caption">{kind === 'input' ? 'Inputs' : 'Outputs'}</div>
      {rows.length === 0 ? (
        <div className="structure-spec-empty">
          <Missing>{kind === 'input' ? 'No couple on the chart is passed to this module' : 'No couple on the chart is passed from this module'}</Missing>
        </div>
      ) : (
        <table className="table structure-io">
          <thead>
            <tr>
              <th>{kind === 'input' ? 'Input name' : 'Output name'}</th>
              <th>Type</th>
              <th>{kind === 'input' ? 'Provided by' : 'Used by'}</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.couple.id}>
                <td>
                  <Link to={chartRoute(model, row.couple.moduleId)} onClick={() => selectElements([row.couple.id])} title="Show this couple on the chart">
                    {row.name || '(no name)'}
                  </Link>
                </td>
                <td>{row.type}</td>
                <td>{row.otherLabel}</td>
                <td className="structure-io-notes">
                  <CellText label={`Notes for ${row.name}`} value={row.notes} placeholder="No notes" onCommit={(notes) => saveNotes(row.couple.id, notes)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SpecForm({ model, module }: { model: Model; module: Module }) {
  const io = programIo(model, module.id);
  const save = (patch: ProgramSpecPatch) => dispatch({ type: 'setProgramSpec', moduleId: module.id, patch });
  const chart = chartOfModule(model, module.id);
  return (
    <div className="structure-spec">
      <div className="structure-spec-head">
        <div>
          <div className="structure-kind">Program specification{module.library ? ' for a library module' : ''}</div>
          <div className="structure-spec-title title">
            <span className="mono">{moduleNumber(model, module.id)}</span> {module.name || <Missing>No name yet</Missing>}
          </div>
          {module.description && <div className="muted">{module.description}</div>}
        </div>
        <Link className="btn btn-small" to={chartRoute(model, module.id)} onClick={() => selectElements([module.id])}>
          Show on the chart{chart ? ` '${chart.name}'` : ''}
        </Link>
      </div>

      <div className="structure-spec-row">
        <DraftField label="Purpose" value={module.purpose} rows={2} placeholder="No purpose yet" onSave={(purpose) => save({ purpose })} />
      </div>
      <div className="structure-spec-row structure-spec-three">
        <DraftField label="Programmer" value={module.programmer} placeholder="Nobody named yet" onSave={(programmer) => save({ programmer })} />
        <DraftField label="Date due" type="date" value={module.dateDue} onSave={(dateDue) => save({ dateDue })} />
        <DraftField label="Language" value={module.language} placeholder="Not chosen yet" onSave={(language) => save({ language })} />
      </div>
      <div className="structure-spec-row">
        <DraftField
          label="Events"
          value={module.events}
          rows={2}
          placeholder="None"
          hint="What starts the program, such as a click on a button. Leave it empty for a program that runs in a fixed order."
          onSave={(events) => save({ events })}
        />
      </div>
      <div className="structure-spec-row vstack">
        <IoTable model={model} module={module} rows={io.inputs} kind="input" />
        <IoTable model={model} module={module} rows={io.outputs} kind="output" />
        <div className="field-hint">
          These rows are the couples on the lines above and below this module. To add, change or remove one,{' '}
          <Link to={chartRoute(model, module.id)} onClick={() => selectElements([module.id])}>
            edit the structure chart
          </Link>
          .
        </div>
      </div>
      <div className="structure-spec-row">
        <DraftField label="Pseudocode" mono value={module.pseudocode} rows={12} placeholder="No pseudocode yet" onSave={(pseudocode) => save({ pseudocode })} />
      </div>
      <div className="structure-spec-row">
        <DraftField
          label="Other"
          value={module.other}
          rows={4}
          placeholder="Nothing else yet"
          hint="Calculations, business rules, calls to library modules, and changes that the chart needs."
          onSave={(other) => save({ other })}
        />
      </div>
    </div>
  );
}

export function ProgramSpecScreen() {
  const model = useViewModel();
  const { moduleId } = useParams();
  const findings = useAreaFindings('structure').filter((f) => f.ruleId === 'PS-01');
  const charts = all(model, 'structureChart');
  // A box that repeats another module has no specification of its own, so it is not listed.
  const lists = charts.map((chart) => ({ chart, rows: modulesOf(model, chart.id).filter((r) => !r.module.repeatsId) }));
  const first = lists.find((l) => l.rows.length > 0)?.rows[0].module;
  const asked = moduleId ? originalModule(model, moduleId) : first;
  const module = asked?.kind === 'module' ? asked : undefined;
  const own = findings.filter((f) => module && f.elementIds.includes(module.id));
  const others = findings.filter((f) => !own.includes(f));
  const places = module ? [module, ...all(model, 'module').filter((m) => m.repeatsId === module.id)] : [];
  const tests = module ? all(model, 'test').filter((t) => t.programId === module.id) : [];

  return (
    <>
      <ListColumn width={280} label="Modules">
        {lists.length === 0 && <p className="placeholder">No modules yet.</p>}
        {lists.map(({ chart, rows }) => (
          <div key={chart.id}>
            <Link className="structure-list-chart" to={`/structure/${chart.id}`} onClick={() => clearSelection()} title="Open this structure chart">
              {chart.name || '(no title)'}
            </Link>
            {rows.map(({ module: m, depth, number }) => (
              <Link key={m.id} className={`row structure-list-row${m.id === module?.id ? ' is-selected' : ''}`} to={`/programs/${m.id}`} style={{ paddingLeft: 9 + depth * 12 }}>
                <span className="mono structure-list-number">{number}</span>
                <span className="grow">{m.name || <Missing>No name yet</Missing>}</span>
                <FindingMarks findings={findings.filter((f) => f.elementIds.includes(m.id))} counts={false} />
              </Link>
            ))}
          </div>
        ))}
      </ListColumn>
      <WorkArea>
        <PageHeader breadcrumb={['Design', { label: 'Program specifications', to: '/programs' }]} title={module ? moduleLabel(model, module.id) : 'Program specifications'}>
          <UndoRedo />
        </PageHeader>
        <div className="work-body scroll pad">
          {module ? (
            <SpecForm key={module.id} model={model} module={module} />
          ) : moduleId ? (
            <p className="placeholder">There is no module with this address. It may have been removed. Choose one from the list.</p>
          ) : (
            <div className="structure-blank vstack">
              <p>A program specification is written for each module of a structure chart, and this project has no structure chart yet.</p>
              <div>
                <Link className="btn btn-primary" to="/structure">
                  Start a structure chart
                </Link>
              </div>
            </div>
          )}
        </div>
      </WorkArea>
      <RightPanel label="Problems and where used">
        <h2 className="panel-heading">Problems</h2>
        {module && (
          <>
            <h3 className="panel-subheading">This specification</h3>
            <ProblemList findings={own} emptyText="Nothing is missing from this specification." openFirst />
          </>
        )}
        {(others.length > 0 || !module) && (
          <>
            <h3 className="panel-subheading">{module ? 'Other specifications' : 'All specifications'}</h3>
            <ProblemList findings={others} emptyText="No problems in the program specifications." />
          </>
        )}
        {module && (
          <>
            <hr className="structure-divider" />
            <h3 className="panel-subheading">
              Drawn in {fanIn(model, module.id)} {fanIn(model, module.id) === 1 ? 'place' : 'places'}
            </h3>
            <ul className="structure-couples">
              {places.map((p) => (
                <li key={p.id}>
                  <Link className="row" to={chartRoute(model, p.id)} onClick={() => selectElements([p.id])}>
                    <span className="mono">{moduleNumber(model, p.id)}</span>
                    <span className="grow">
                      {p.parentModuleId ? `below ${moduleLabel(model, p.parentModuleId)}` : 'the top module'}
                    </span>
                    <span className="muted">{chartOfModule(model, p.id)?.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {tests.length > 0 && (
              <>
                <h3 className="panel-subheading">
                  Tested by {tests.length} {tests.length === 1 ? 'test' : 'tests'}
                </h3>
                <ul className="structure-couples">
                  {tests.map((t) => (
                    <li key={t.id}>
                      <Link className="row" to={`/test-plan/${t.id}`}>
                        <span className="mono">T-{t.ordinal}</span>
                        <span className="grow">{t.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </RightPanel>
    </>
  );
}
