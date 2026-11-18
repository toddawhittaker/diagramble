// The use case form itself: the ruled form of section 6 of docs/mockups/BRIEFS.md.
// Every edit is one dispatch, made when the field is committed.

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button, EntryFields, Switch } from '../../components';
import {
  all,
  dataDefinitions,
  diagramOfProcess,
  diagramTitle,
  elementLabel,
  type Id,
  type Model,
  type UseCase,
  type UseCaseException,
  type UseCasePatch,
  type UseCaseStep,
} from '../../model';
import { dispatch, selectElements, useModel } from '../../store';
import { Draft, Pick, moved } from './inputs';

type Option = { value: string; label: string };

const PRIORITIES: Option[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const DIRECTIONS: Option[] = [
  { value: 'in', label: 'In' },
  { value: 'out', label: 'Out' },
];

export function UseCaseForm({ useCase: uc, isNew }: { useCase: UseCase; isNew: boolean }) {
  const model = useModel();
  const navigate = useNavigate();
  const [numberError, setNumberError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = (p: UseCasePatch) => dispatch({ type: 'updateUseCase', id: uc.id, patch: p });

  const dataOptions = useMemo<Option[]>(
    () =>
      dataDefinitions(model)
        .map((d) => ({ value: d.id, label: d.name || 'Unnamed data' }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [model],
  );
  const actorOptions = useMemo<Option[]>(
    () => all(model, 'externalEntity').map((e) => ({ value: e.id, label: e.name || 'Unnamed external entity' })),
    [model],
  );
  // The model allows only an external entity or a data store as a source or destination.
  const endOptions = useMemo<Option[]>(
    () =>
      [...all(model, 'externalEntity'), ...all(model, 'dataStore')].map((e) => ({
        value: e.id,
        label: elementLabel(model, e.id),
      })),
    [model],
  );
  const processOptions = useMemo<Option[]>(
    () =>
      all(model, 'process')
        .map((p) => ({ value: p.id, label: elementLabel(model, p.id) }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
    [model],
  );

  function commitNumber(text: string) {
    const n = Number(text.trim().replace(/^UC-?/i, ''));
    if (!Number.isInteger(n) || n < 1) {
      setNumberError('The number must be a whole number, 1 or more.');
      return;
    }
    if (all(model, 'useCase').some((u) => u.id !== uc.id && u.ordinal === n)) {
      setNumberError(`Another use case already has the number UC-${n}.`);
      return;
    }
    setNumberError('');
    if (n !== uc.ordinal) patch({ ordinal: n });
  }

  // ---- Steps. Exceptions follow their step when steps move or go. ----

  const setStep = (i: number, step: UseCaseStep) => patch({ steps: uc.steps.map((s, k) => (k === i ? step : s)) });

  function moveStep(i: number, by: -1 | 1) {
    const j = i + by;
    if (j < 0 || j >= uc.steps.length) return;
    patch({
      steps: moved(uc.steps, i, by),
      exceptions: uc.exceptions.map((e) =>
        e.stepNumber === i + 1 ? { ...e, stepNumber: j + 1 } : e.stepNumber === j + 1 ? { ...e, stepNumber: i + 1 } : e,
      ),
    });
  }

  function removeStep(i: number) {
    patch({
      steps: uc.steps.filter((_, k) => k !== i),
      exceptions: uc.exceptions.map((e) =>
        e.stepNumber === i + 1 ? { ...e, stepNumber: 0 } : e.stepNumber > i + 1 ? { ...e, stepNumber: e.stepNumber - 1 } : e,
      ),
    });
  }

  // Each field given to updateUseCase replaces the whole list, so one edit sends every exception.
  const setException = (i: number, exception: UseCaseException) =>
    patch({ exceptions: uc.exceptions.map((e, k) => (k === i ? exception : e)) });

  const [focusStep, setFocusStep] = useState(-1);
  const [focusException, setFocusException] = useState(-1);

  const stepOptions: Option[] = uc.steps.map((_, i) => ({ value: String(i + 1), label: `Step ${i + 1}` }));
  const processDiagram = uc.processId ? diagramOfProcess(model, uc.processId) : undefined;
  const defaultEnd = uc.actorId ?? endOptions[0]?.value ?? '';

  return (
    <div className="usecases-form">
      <Row label="Use case name">
        <Draft
          label="Use case name"
          value={uc.name}
          placeholder="No name yet"
          autoFocus={isNew}
          selectAll={isNew}
          onCommit={(name) => dispatch({ type: 'rename', id: uc.id, name: name.trim() })}
        />
      </Row>
      <Row label="ID">
        <div className="hstack">
          <span className="mono">UC-</span>
          <Draft
            label="Use case number"
            className="usecases-number mono"
            value={String(uc.ordinal)}
            placeholder="No number yet"
            onCommit={commitNumber}
          />
          {numberError && <span className="muted usecases-note">{numberError}</span>}
        </div>
      </Row>
      <Row label="Priority">
        <Pick
          label="Priority"
          className="usecases-narrow"
          value={uc.priority}
          options={PRIORITIES}
          onChange={(v) => patch({ priority: v as UseCase['priority'] })}
        />
      </Row>
      <Row label="Actor">
        <Pick
          label="Actor"
          className="usecases-medium"
          value={uc.actorId ?? ''}
          options={actorOptions}
          emptyLabel="No actor yet"
          onChange={(v) => patch({ actorId: v || null })}
        />
      </Row>
      <Row label="Description">
        <Draft
          label="Description"
          rows={2}
          value={uc.description}
          placeholder="No description yet"
          onCommit={(description) => dispatch({ type: 'describe', id: uc.id, description })}
        />
      </Row>
      <Row label="Trigger">
        <Draft label="Trigger" value={uc.trigger} placeholder="No trigger yet" onCommit={(trigger) => patch({ trigger })} />
      </Row>
      <Row label="Type">
        <Switch
          label="Trigger type"
          small
          value={uc.triggerType}
          options={[
            { value: 'external', label: 'External' },
            { value: 'temporal', label: 'Temporal' },
          ]}
          onChange={(triggerType) => {
            if (triggerType !== uc.triggerType) patch({ triggerType });
          }}
        />
      </Row>
      <Row label="Preconditions">
        <TextList
          what="precondition"
          items={uc.preconditions}
          emptyText="No preconditions yet"
          onChange={(preconditions) => patch({ preconditions })}
        />
      </Row>

      <div className="usecases-block">
        <div className="table-caption">Normal course</div>
        {uc.steps.length === 0 ? (
          <p>
            <span className="missing">No steps yet</span>
          </p>
        ) : (
          <table className="table usecases-steps">
            <thead>
              <tr>
                <th className="usecases-col-n">#</th>
                <th>Step</th>
                <th className="usecases-col-info">Information for the step</th>
              </tr>
            </thead>
            <tbody>
              {uc.steps.map((step, i) => (
                <StepRow
                  key={i}
                  model={model}
                  step={step}
                  index={i}
                  count={uc.steps.length}
                  autoFocus={i === focusStep}
                  dataOptions={dataOptions}
                  onChange={(s) => setStep(i, s)}
                  onMove={(by) => moveStep(i, by)}
                  onRemove={() => removeStep(i)}
                />
              ))}
            </tbody>
          </table>
        )}
        <div>
          <Button
            small
            onClick={() => {
              setFocusStep(uc.steps.length);
              patch({ steps: [...uc.steps, { text: '', substeps: [], information: [] }] });
            }}
          >
            Add step
          </Button>
        </div>
      </div>

      <Row label="Postconditions">
        <TextList
          what="postcondition"
          items={uc.postconditions}
          emptyText="No postconditions yet"
          onChange={(postconditions) => patch({ postconditions })}
        />
      </Row>
      <Row label="Exceptions">
        <div className="vstack">
          {uc.exceptions.length === 0 && (
            <div>
              <span className="missing">No exceptions yet</span>
            </div>
          )}
          {uc.exceptions.map((ex, i) => {
            const known = ex.stepNumber >= 1 && ex.stepNumber <= uc.steps.length;
            return (
              <div className="usecases-exception" key={i}>
                <div className="usecases-line">
                  <span className="mono usecases-line-n">E{i + 1}</span>
                  <Pick
                    label={`Step of exception E${i + 1}`}
                    className="usecases-step-pick"
                    value={ex.stepNumber >= 1 ? String(ex.stepNumber) : ''}
                    options={known || ex.stepNumber < 1 ? stepOptions : [...stepOptions, { value: String(ex.stepNumber), label: `Step ${ex.stepNumber} (gone)` }]}
                    emptyLabel="No step"
                    onChange={(v) => setException(i, { ...ex, stepNumber: Number(v) || 0 })}
                  />
                  <Draft
                    label={`Exception E${i + 1}`}
                    className="grow"
                    value={ex.text}
                    placeholder="No text yet"
                    autoFocus={i === focusException}
                    onCommit={(text) => setException(i, { ...ex, text })}
                  />
                  <Action label={`Remove exception E${i + 1}`} onClick={() => patch({ exceptions: uc.exceptions.filter((_, k) => k !== i) })}>
                    Remove
                  </Action>
                </div>
                <div className="usecases-handling">
                  <div className="usecases-handling-label">What is done about E{i + 1}</div>
                  <TextList
                    what={`handling step of E${i + 1}`}
                    addLabel="Add handling step"
                    items={ex.steps}
                    emptyText="No handling steps yet"
                    onChange={(steps) => setException(i, { ...ex, steps })}
                  />
                </div>
              </div>
            );
          })}
          <div>
            <Button
              small
              onClick={() => {
                setFocusException(uc.exceptions.length);
                patch({ exceptions: [...uc.exceptions, { stepNumber: uc.steps.length ? 1 : 0, text: '', steps: [] }] });
              }}
            >
              Add exception
            </Button>
          </div>
        </div>
      </Row>

      <div className="usecases-block usecases-summaries">
        <SummaryTable
          title="Summary inputs"
          endHeading="Source"
          emptyText="No summary inputs yet"
          lines={uc.summaryInputs.map((l) => ({ dataId: l.dataId, endId: l.sourceId }))}
          model={model}
          dataOptions={dataOptions}
          endOptions={endOptions}
          defaultEnd={defaultEnd}
          onChange={(lines) => patch({ summaryInputs: lines.map((l) => ({ dataId: l.dataId, sourceId: l.endId })) })}
        />
        <SummaryTable
          title="Summary outputs"
          endHeading="Destination"
          emptyText="No summary outputs yet"
          lines={uc.summaryOutputs.map((l) => ({ dataId: l.dataId, endId: l.destinationId }))}
          model={model}
          dataOptions={dataOptions}
          endOptions={endOptions}
          defaultEnd={defaultEnd}
          onChange={(lines) => patch({ summaryOutputs: lines.map((l) => ({ dataId: l.dataId, destinationId: l.endId })) })}
        />
      </div>

      <Row label="Process">
        <div className="usecases-line">
          <Pick
            label="The process this use case becomes"
            className="usecases-medium"
            value={uc.processId ?? ''}
            options={processOptions}
            emptyLabel="No process yet"
            onChange={(v) => patch({ processId: v || null })}
          />
          {uc.processId && processDiagram && (
            <Link className="btn-link" to={`/diagram/${processDiagram.id}`} onClick={() => selectElements([uc.processId!])}>
              Open diagram
            </Link>
          )}
          {uc.processId && processDiagram && <span className="muted usecases-note">on {diagramTitle(model, processDiagram.id)}</span>}
        </div>
      </Row>

      <div className="usecases-block">
        <div className="table-caption">Other names and notes</div>
        <EntryFields elementId={uc.id} />
      </div>

      <div className="usecases-block usecases-delete">
        {confirmDelete ? (
          <div className="usecases-line">
            <span>Delete {elementLabel(model, uc.id)}?</span>
            <Button
              small
              variant="primary"
              onClick={() => {
                const result = dispatch({ type: 'deleteElement', id: uc.id });
                if (result.ok) navigate('/use-cases', { replace: true });
              }}
            >
              Delete
            </Button>
            <Button small autoFocus onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <span className="muted usecases-note">Undo brings it back.</span>
          </div>
        ) : (
          <Button small onClick={() => setConfirmDelete(true)}>
            Delete use case
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="usecases-row">
      <div className="usecases-label">{label}</div>
      <div className="usecases-value">{children}</div>
    </div>
  );
}

/** A small text button for the actions on one line of a list. */
function Action({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" className="usecases-action" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

/** A numbered list of lines of text: add, edit, remove and reorder. */
function TextList({
  what,
  items,
  emptyText,
  onChange,
  addLabel,
}: {
  what: string;
  items: string[];
  emptyText: string;
  onChange: (items: string[]) => void;
  /** The words on the button, when "Add" and `what` would read badly. */
  addLabel?: string;
}) {
  const [focus, setFocus] = useState(-1);
  return (
    <div className="vstack">
      {items.length === 0 && (
        <div>
          <span className="missing">{emptyText}</span>
        </div>
      )}
      {items.map((text, i) => (
        <div className="usecases-line" key={i}>
          <span className="mono usecases-line-n">{i + 1}.</span>
          <Draft
            label={`${what} ${i + 1}`}
            className="grow"
            value={text}
            placeholder="No text yet"
            autoFocus={i === focus}
            onCommit={(t) => onChange(items.map((x, k) => (k === i ? t : x)))}
          />
          <Action label={`Move ${what} ${i + 1} up`} disabled={i === 0} onClick={() => onChange(moved(items, i, -1))}>
            Up
          </Action>
          <Action label={`Move ${what} ${i + 1} down`} disabled={i === items.length - 1} onClick={() => onChange(moved(items, i, 1))}>
            Down
          </Action>
          <Action label={`Remove ${what} ${i + 1}`} onClick={() => onChange(items.filter((_, k) => k !== i))}>
            Remove
          </Action>
        </div>
      ))}
      <div>
        <Button
          small
          onClick={() => {
            setFocus(items.length);
            onChange([...items, '']);
          }}
        >
          {addLabel ?? `Add ${what}`}
        </Button>
      </div>
    </div>
  );
}

interface StepRowProps {
  model: Model;
  step: UseCaseStep;
  index: number;
  count: number;
  autoFocus: boolean;
  dataOptions: Option[];
  onChange: (step: UseCaseStep) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}

function StepRow({ model, step, index, count, autoFocus, dataOptions, onChange, onMove, onRemove }: StepRowProps) {
  const n = index + 1;
  const [addDirection, setAddDirection] = useState<'in' | 'out'>('in');
  const [focusSub, setFocusSub] = useState(-1);
  const letter = (i: number) => String.fromCharCode(97 + (i % 26));

  return (
    <tr>
      <td className="mono usecases-col-n">{n}</td>
      <td>
        <div className="vstack">
          <Draft
            label={`Step ${n}`}
            rows={2}
            value={step.text}
            placeholder="No step text yet"
            autoFocus={autoFocus}
            onCommit={(text) => onChange({ ...step, text })}
          />
          {step.substeps.map((sub, i) => (
            <div className="usecases-line usecases-substep" key={i}>
              <span className="mono usecases-line-n">{letter(i)}.</span>
              <Draft
                label={`Substep ${n}${letter(i)}`}
                className="grow"
                value={sub}
                placeholder="No text yet"
                autoFocus={i === focusSub}
                onCommit={(t) => onChange({ ...step, substeps: step.substeps.map((x, k) => (k === i ? t : x)) })}
              />
              <Action label={`Remove substep ${n}${letter(i)}`} onClick={() => onChange({ ...step, substeps: step.substeps.filter((_, k) => k !== i) })}>
                Remove
              </Action>
            </div>
          ))}
          <div className="usecases-actions">
            <Action
              label={`Add a substep to step ${n}`}
              onClick={() => {
                setFocusSub(step.substeps.length);
                onChange({ ...step, substeps: [...step.substeps, ''] });
              }}
            >
              Add substep
            </Action>
            <Action label={`Move step ${n} up`} disabled={index === 0} onClick={() => onMove(-1)}>
              Up
            </Action>
            <Action label={`Move step ${n} down`} disabled={index === count - 1} onClick={() => onMove(1)}>
              Down
            </Action>
            <Action label={`Remove step ${n}`} onClick={onRemove}>
              Remove step
            </Action>
          </div>
        </div>
      </td>
      <td className="usecases-col-info">
        <div className="vstack">
          {step.information.length === 0 && (
            <div>
              <span className="missing">No information yet</span>
            </div>
          )}
          {step.information.map((info, i) => (
            <div className="usecases-line" key={i}>
              <Pick
                label={`Direction of ${elementLabel(model, info.dataId)} at step ${n}`}
                className="usecases-dir"
                value={info.direction}
                options={DIRECTIONS}
                onChange={(v) =>
                  onChange({ ...step, information: step.information.map((x, k) => (k === i ? { ...x, direction: v as 'in' | 'out' } : x)) })
                }
              />
              <DataLink model={model} dataId={info.dataId} />
              <Action
                label={`Remove ${elementLabel(model, info.dataId)} from step ${n}`}
                onClick={() => onChange({ ...step, information: step.information.filter((_, k) => k !== i) })}
              >
                Remove
              </Action>
            </div>
          ))}
          <div className="usecases-line usecases-add">
            <Pick label={`Direction of the data to add to step ${n}`} className="usecases-dir" value={addDirection} options={DIRECTIONS} onChange={(v) => setAddDirection(v as 'in' | 'out')} />
            <Pick
              label={`Add data to step ${n}`}
              className="grow"
              value=""
              options={dataOptions}
              emptyLabel={dataOptions.length ? 'Add data…' : 'The dictionary is empty'}
              disabled={dataOptions.length === 0}
              onChange={(dataId) => {
                if (dataId) onChange({ ...step, information: [...step.information, { direction: addDirection, dataId }] });
              }}
            />
          </div>
        </div>
      </td>
    </tr>
  );
}

/** A data name, linked to its page in the dictionary. */
export function DataLink({ model, dataId }: { model: Model; dataId: Id }) {
  const name = model.elements[dataId]?.name;
  return (
    <Link className="usecases-data grow" to={`/dictionary/${dataId}`}>
      {name || 'Unnamed data'}
    </Link>
  );
}

interface SummaryLine {
  dataId: Id;
  endId: Id;
}

interface SummaryTableProps {
  title: string;
  endHeading: 'Source' | 'Destination';
  emptyText: string;
  lines: SummaryLine[];
  model: Model;
  dataOptions: Option[];
  endOptions: Option[];
  defaultEnd: Id;
  onChange: (lines: SummaryLine[]) => void;
}

function SummaryTable({ title, endHeading, emptyText, lines, model, dataOptions, endOptions, defaultEnd, onChange }: SummaryTableProps) {
  const canAdd = dataOptions.length > 0 && endOptions.length > 0;
  return (
    <div className="usecases-summary">
      <div className="table-caption">{title}</div>
      <table className="table">
        <thead>
          <tr>
            <th>Data</th>
            <th>{endHeading}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td colSpan={3}>
                <span className="missing">{emptyText}</span>
              </td>
            </tr>
          )}
          {lines.map((line, i) => (
            <tr key={i}>
              <td>
                <DataLink model={model} dataId={line.dataId} />
              </td>
              <td>
                <Pick
                  label={`${endHeading} of ${elementLabel(model, line.dataId)}`}
                  value={line.endId}
                  options={endOptions}
                  onChange={(endId) => onChange(lines.map((l, k) => (k === i ? { ...l, endId } : l)))}
                />
              </td>
              <td className="usecases-col-action">
                <Action label={`Remove ${elementLabel(model, line.dataId)} from the ${title.toLowerCase()}`} onClick={() => onChange(lines.filter((_, k) => k !== i))}>
                  Remove
                </Action>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {canAdd ? (
        <Pick
          label={`Add data to the ${title.toLowerCase()}`}
          value=""
          options={dataOptions}
          emptyLabel="Add data…"
          onChange={(dataId) => {
            if (dataId) onChange([...lines, { dataId, endId: defaultEnd }]);
          }}
        />
      ) : (
        <p className="muted usecases-note">
          {dataOptions.length === 0
            ? 'Define some data in the dictionary first.'
            : `Draw an external entity or a data store first, to have a ${endHeading.toLowerCase()} to choose.`}
        </p>
      )}
    </div>
  );
}
