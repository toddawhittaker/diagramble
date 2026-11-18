// The top of the right panel on the structure chart: the details of the selected module
// (with the call from its control module), of the selected couple, or of the chart itself.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  all,
  coupleLabel,
  couplesOf,
  fanIn,
  fanOut,
  get,
  modulesOf,
  moduleNumber,
  originalModule,
  processNumber,
  routeOf,
  type Couple,
  type Id,
  type Model,
  type Module,
  type StructureChart,
} from '../../model';
import { clearSelection, dispatch, selectElements } from '../../store';
import { Button, Missing, NumberField, Switch } from '../../components';
import type { Box } from './AddBox';
import { Check, DataPicker, DeleteControl, DraftField, moduleLabel } from './shared';

function ProcessOptions({ model }: { model: Model }) {
  const processes = all(model, 'process')
    .map((p) => ({ id: p.id, number: processNumber(model, p.id), name: p.name }))
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  return (
    <>
      <option value="">None</option>
      {processes.map((p) => (
        <option key={p.id} value={p.id}>
          {p.number} {p.name}
        </option>
      ))}
    </>
  );
}

/** A small arrow with a circle at its tail, as on the chart. */
function CoupleIcon({ couple }: { couple: Couple }) {
  return (
    <svg className="structure-couple-icon" width="14" height="20" viewBox="-7 -10 14 20" aria-hidden="true">
      <g transform={couple.direction === 'up' ? 'rotate(180)' : undefined}>
        <path d="M 0 -4 L 0 8 M -3.5 3.5 L 0 8 L 3.5 3.5" />
        <circle cx="0" cy="-6" r="3" style={{ fill: couple.coupleKind === 'control' ? 'var(--ink)' : 'var(--paper)' }} />
      </g>
    </svg>
  );
}

// ---- A module ----

function ModuleDetails({ model, module, setBox }: { model: Model; module: Module; setBox: (box: Box) => void }) {
  const original = originalModule(model, module.id) ?? module;
  const isRepeat = module.repeatsId !== null;
  const isTop = module.parentModuleId === null;
  const number = moduleNumber(model, module.id);
  const process = get(model, original.processId, 'process');
  const couples = isTop ? [] : couplesOf(model, module.id);
  const out = fanOut(model, module.id);
  const into = fanIn(model, module.id);

  return (
    <>
      <div>
        <div className="structure-kind">
          {isRepeat ? 'Library module, drawn again' : original.library ? 'Library module' : isTop ? 'Top module' : 'Module'} {number}
        </div>
        <h2 className="panel-heading">{original.name || <Missing>No name yet</Missing>}</h2>
      </div>

      {isRepeat && (
        <div className="structure-note">
          This box is one more appearance of {moduleLabel(model, original.id)}. Its name, description and program specification are kept on that module.{' '}
          <button type="button" className="btn-link" onClick={() => selectElements([original.id])}>
            Select that module
          </button>
        </div>
      )}

      {!isRepeat && (
        <>
          <DraftField label="Name" value={module.name} placeholder="No name yet" onSave={(name) => dispatch({ type: 'rename', id: module.id, name: name.trim() })} />
          <DraftField
            label="Description"
            value={module.description}
            rows={2}
            placeholder="No description yet"
            onSave={(description) => dispatch({ type: 'describe', id: module.id, description })}
          />
        </>
      )}

      <NumberField
        label={isTop ? 'Number of the top module' : `Number under ${moduleNumber(model, module.parentModuleId ?? '')}`}
        value={module.ordinal}
        size={4}
        hint={isTop ? 'Change it so that the chart carries the number of its process.' : `The last part of ${number}. It also sets the order from left to right.`}
        onCommit={(ordinal) => {
          if (ordinal !== null) dispatch({ type: 'updateModule', id: module.id, patch: { ordinal } });
        }}
      />

      {!isRepeat && (
        <>
          <div className="field">
            <span className="field-label">Kind</span>
            <Check
              label="A library module: a standard module used in many places"
              checked={module.library}
              onChange={(library) => dispatch({ type: 'updateModule', id: module.id, patch: { library } })}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="structure-process">
              Process it comes from
            </label>
            <select
              id="structure-process"
              className="input"
              value={module.processId ?? ''}
              onChange={(e) => dispatch({ type: 'updateModule', id: module.id, patch: { processId: e.target.value || null } })}
            >
              <ProcessOptions model={model} />
            </select>
            {process && (
              <div className="field-hint">
                <Link to={routeOf(model, process.id)?.route ?? '/'}>
                  Open process {processNumber(model, process.id)} {process.name}
                </Link>
              </div>
            )}
          </div>
        </>
      )}

      <div>
        <Link className="btn btn-small" to={`/programs/${original.id}`}>
          Open its program specification
        </Link>
      </div>

      <table className="table structure-facts">
        <tbody>
          <tr>
            <td>Fan-out</td>
            <td className="is-numeric">{out}</td>
            <td className="muted">{out === 1 ? 'module' : 'modules'} directly below it</td>
          </tr>
          <tr>
            <td>Fan-in</td>
            <td className="is-numeric">{into}</td>
            <td className="muted">{into === 1 ? 'place' : 'places'} where it is drawn</td>
          </tr>
        </tbody>
      </table>

      {!isTop && (
        <>
          <h3 className="panel-subheading">The call from {moduleLabel(model, module.parentModuleId ?? '')}</h3>
          <Check
            label="Conditional: called only in some cases (a diamond on the line)"
            checked={module.conditional}
            onChange={(conditional) => dispatch({ type: 'updateModule', id: module.id, patch: { conditional } })}
          />
          <Check
            label="Repeated: called more than once (a curved arrow across the line)"
            checked={module.repeated}
            onChange={(repeated) => dispatch({ type: 'updateModule', id: module.id, patch: { repeated } })}
          />
          <h3 className="panel-subheading">Couples on this line</h3>
          {couples.length === 0 ? (
            <div>
              <Missing>Nothing is passed along this line yet</Missing>
            </div>
          ) : (
            <ul className="structure-couples">
              {couples.map((c) => (
                <li key={c.id}>
                  <button type="button" className="row" onClick={() => selectElements([c.id])}>
                    <CoupleIcon couple={c} />
                    <span className="grow">{coupleLabel(model, c) || <Missing>no name</Missing>}</span>
                    <span className="muted">
                      {c.coupleKind === 'data' ? 'data' : 'control'}, {c.direction}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div>
            <Button small onClick={() => setBox('couple')}>
              Add a couple
            </Button>
          </div>
        </>
      )}
    </>
  );
}

// ---- A couple ----

function CoupleDetails({ model, couple }: { model: Model; couple: Couple }) {
  // Changing a flag into a data couple needs the data first, so the choice waits here until it is made.
  const [toData, setToData] = useState(false);
  const lower = get(model, couple.moduleId, 'module');
  const upperId = lower?.parentModuleId ?? '';
  const lowerName = originalModule(model, couple.moduleId)?.name || 'the lower module';
  const upperName = originalModule(model, upperId)?.name || 'the module above';
  const data = couple.dataId ? model.elements[couple.dataId] : undefined;
  const asData = couple.coupleKind === 'data' || toData;

  return (
    <>
      <div>
        <div className="structure-kind">{couple.coupleKind === 'data' ? 'Data couple' : 'Control couple (flag)'}</div>
        <h2 className="panel-heading">{coupleLabel(model, couple) || <Missing>No name yet</Missing>}</h2>
      </div>
      <div className="muted">
        On the line between {moduleLabel(model, upperId)} and{' '}
        <button type="button" className="btn-link" onClick={() => selectElements([couple.moduleId])}>
          {moduleLabel(model, couple.moduleId)}
        </button>
        .
      </div>

      <div className="field">
        <span className="field-label">Kind</span>
        <Switch
          small
          label="Kind of couple"
          value={asData ? 'data' : 'control'}
          onChange={(kind) => {
            if (kind === 'control') {
              setToData(false);
              if (couple.coupleKind !== 'control') dispatch({ type: 'updateCouple', id: couple.id, coupleKind: 'control' });
            } else if (couple.coupleKind !== 'data') {
              setToData(true);
            }
          }}
          options={[
            { value: 'data', label: 'Data (empty circle)' },
            { value: 'control', label: 'Control (filled circle)' },
          ]}
        />
      </div>

      <div className="field">
        <span className="field-label">Direction</span>
        <Switch
          small
          label="Direction"
          value={couple.direction}
          onChange={(direction) => {
            if (direction !== couple.direction) dispatch({ type: 'updateCouple', id: couple.id, direction });
          }}
          options={[
            { value: 'down', label: 'Passed down' },
            { value: 'up', label: 'Passed up' },
          ]}
        />
        <div className="field-hint">{couple.direction === 'down' ? `From ${upperName} down to ${lowerName}.` : `From ${lowerName} up to ${upperName}.`}</div>
      </div>

      {asData ? (
        <>
          <DataPicker
            key={`${couple.id}-${couple.dataId}`}
            model={model}
            value={couple.dataId}
            onChoose={(choice) => {
              if (!choice) return;
              const result = dispatch({ type: 'updateCouple', id: couple.id, coupleKind: 'data', ...choice });
              if (result.ok) setToData(false);
            }}
          />
          {toData && <div className="field-hint">Choose the data, and the flag becomes a data couple.</div>}
          {data && (
            <div className="field-hint">
              The couple takes its name from this data. <Link to={`/dictionary/${data.id}`}>Open {data.name} in the data dictionary</Link>
            </div>
          )}
        </>
      ) : (
        <DraftField
          label="Name of the flag"
          value={couple.name}
          placeholder="No name yet"
          hint="A flag is a message such as End of file. It carries no data."
          onSave={(name) => dispatch({ type: 'rename', id: couple.id, name: name.trim() })}
        />
      )}

      <DraftField
        label="Description"
        value={couple.description}
        rows={2}
        placeholder="No description yet"
        onSave={(description) => dispatch({ type: 'describe', id: couple.id, description })}
      />

      <div>
        <Button
          small
          onClick={() => {
            const result = dispatch({ type: 'deleteElement', id: couple.id });
            if (result.ok) selectElements([couple.moduleId]);
          }}
        >
          Remove this couple
        </Button>
      </div>
    </>
  );
}

// ---- The chart, and the list of charts ----

export function NewChartForm({ model, first = false }: { model: Model; first?: boolean }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [processId, setProcessId] = useState('');
  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const process = get(model, processId, 'process');
    // A chart made for a process carries that process's number, except process 0.
    const ordinal = process && process.ordinal > 0 ? process.ordinal : undefined;
    const result = dispatch({ type: 'addStructureChart', name: trimmed, processId: processId || null, ordinal });
    if (result.ok) {
      setName('');
      setProcessId('');
      clearSelection();
      void navigate(`/structure/${result.created[0]}`);
    }
  };
  return (
    <div className="structure-newchart vstack">
      <div className="field">
        <label className="field-label" htmlFor="structure-newchart-name">
          {first ? 'Title of the chart' : 'Title of a new chart'}
        </label>
        <input
          id="structure-newchart-name"
          className="input"
          placeholder="Such as Order System"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="structure-newchart-process">
          Process it designs, if any
        </label>
        <select id="structure-newchart-process" className="input" value={processId} onChange={(e) => setProcessId(e.target.value)}>
          <ProcessOptions model={model} />
        </select>
      </div>
      <div>
        <Button small variant={first ? 'primary' : 'default'} disabled={!name.trim()} onClick={add}>
          Add the chart
        </Button>
      </div>
    </div>
  );
}

function ChartDetails({ model, chart }: { model: Model; chart: StructureChart }) {
  const navigate = useNavigate();
  const charts = all(model, 'structureChart');
  const rows = modulesOf(model, chart.id);
  const couples = rows.reduce((n, r) => n + (r.module.parentModuleId === null ? 0 : couplesOf(model, r.module.id).length), 0);
  return (
    <>
      <div>
        <div className="structure-kind">Structure chart</div>
        <h2 className="panel-heading">{chart.name || <Missing>No title yet</Missing>}</h2>
      </div>
      <div className="muted">
        {rows.length} {rows.length === 1 ? 'module' : 'modules'} and {couples} {couples === 1 ? 'couple' : 'couples'}. Select a module, a line or a couple to see its details.
      </div>
      <DraftField label="Title" value={chart.name} onSave={(name) => dispatch({ type: 'rename', id: chart.id, name: name.trim() })} />
      <DraftField
        label="Description"
        value={chart.description}
        rows={2}
        placeholder="No description yet"
        onSave={(description) => dispatch({ type: 'describe', id: chart.id, description })}
      />
      <DeleteControl
        label="Delete this chart"
        question={`Delete the chart '${chart.name}' with its ${rows.length} ${rows.length === 1 ? 'module' : 'modules'} and their program specifications?`}
        onDelete={() => {
          const result = dispatch({ type: 'deleteElement', id: chart.id });
          if (result.ok) void navigate('/structure');
        }}
      />

      <h3 className="panel-subheading">All structure charts</h3>
      <ul className="structure-couples">
        {charts.map((c) => (
          <li key={c.id}>
            <Link className={`row${c.id === chart.id ? ' is-selected' : ''}`} to={`/structure/${c.id}`} onClick={() => clearSelection()}>
              <span className="grow">{c.name || '(no title)'}</span>
              <span className="count">{modulesOf(model, c.id).length}</span>
            </Link>
          </li>
        ))}
      </ul>
      <NewChartForm model={model} />
    </>
  );
}

export interface DetailsProps {
  model: Model;
  chart: StructureChart;
  module: Module | undefined;
  couple: Couple | undefined;
  setBox: (box: Box) => void;
}

export function Details({ model, chart, module, couple, setBox }: DetailsProps) {
  if (couple) return <CoupleDetails key={couple.id} model={model} couple={couple} />;
  if (module) return <ModuleDetails key={module.id} model={model} module={module} setBox={setBox} />;
  return <ChartDetails key={chart.id} model={model} chart={chart} />;
}

/** The selected module and couple, when they belong to this chart. A couple also gives the lower module of its line. */
export function selectionOn(model: Model, chartId: Id, selectedIds: Id[]): { module: Module | undefined; couple: Couple | undefined } {
  const onChart = new Set(modulesOf(model, chartId).map((r) => r.module.id));
  for (const id of selectedIds) {
    const couple = get(model, id, 'couple');
    if (couple && onChart.has(couple.moduleId)) return { module: get(model, couple.moduleId, 'module'), couple };
    const module = get(model, id, 'module');
    if (module && onChart.has(module.id)) return { module, couple: undefined };
  }
  return { module: undefined, couple: undefined };
}
