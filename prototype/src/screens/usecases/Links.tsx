// The right panel: how the form links to the diagrams. The comparison is plain
// information. No rule of the specification checks it yet (UC-01 to UC-03 are planned),
// so it uses no error, warning or OK marks.

import { Link } from 'react-router';
import { ProblemList, SectionHeading } from '../../components';
import {
  childDiagram,
  diagramOfProcess,
  diagramTitle,
  elementLabel,
  getFragment,
  processNumber,
  processesOn,
  type Fragment,
  type FragmentFlow,
  type Model,
  type UseCase,
} from '../../model';
import { selectElements, useElementFindings, useModel } from '../../store';
import { DataLink } from './Form';
import { plural } from './inputs';

type Verdict = 'Match' | 'Form only' | 'Diagram only' | '';

export function LinksPanel({ useCase: uc }: { useCase: UseCase }) {
  const model = useModel();
  const findings = useElementFindings(uc.id);

  const process = uc.processId ? model.elements[uc.processId] : undefined;
  const diagram = uc.processId ? diagramOfProcess(model, uc.processId) : undefined;
  const number = uc.processId ? processNumber(model, uc.processId) : '';
  const child = uc.processId ? childDiagram(model, uc.processId) : undefined;

  // The fragment holds only the flows on the diagram the process is drawn on. A flow on
  // another diagram that ends at this process is the same exchange seen from elsewhere.
  const fragment = uc.processId ? getFragment(model, uc.processId) : undefined;
  const into = (fragment?.flows ?? []).filter((f) => f.direction === 'in').map((f) => f.flow);
  const out = (fragment?.flows ?? []).filter((f) => f.direction === 'out').map((f) => f.flow);

  const inputOnDiagram = (dataId: string, sourceId: string) => into.some((f) => f.dataId === dataId && f.sourceId === sourceId);
  const outputOnDiagram = (dataId: string, destinationId: string) => out.some((f) => f.dataId === dataId && f.targetId === destinationId);
  const intoOnly = into.filter((f) => !uc.summaryInputs.some((i) => i.dataId === f.dataId && i.sourceId === f.sourceId));
  const outOnly = out.filter((f) => !uc.summaryOutputs.some((o) => o.dataId === f.dataId && o.destinationId === f.targetId));

  const openDiagram = diagram && uc.processId && (
    <Link className="btn-link" to={`/diagram/${diagram.id}`} onClick={() => selectElements([uc.processId!])}>
      {diagramTitle(model, diagram.id)}
    </Link>
  );

  return (
    <>
      <h2 className="panel-heading">Links to the diagrams</h2>

      <table className="table usecases-links">
        <thead>
          <tr>
            <th>On the form</th>
            <th>On the diagrams</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>This use case</td>
            <td>
              {process ? (
                <>
                  Process {elementLabel(model, process.id)}
                  {openDiagram && <>, on {openDiagram}</>}
                </>
              ) : (
                <span className="missing">No process yet</span>
              )}
            </td>
            <td />
          </tr>
          {uc.summaryInputs.map((line, i) => {
            const match = inputOnDiagram(line.dataId, line.sourceId);
            return (
              <CompareRow
                key={`in-${i}`}
                form={
                  <>
                    Input: <DataLink model={model} dataId={line.dataId} /> from {elementLabel(model, line.sourceId)}
                  </>
                }
                diagrams={!process ? '' : match ? `A flow into process ${number}` : `No flow into process ${number} carries it from there`}
                verdict={!process ? '' : match ? 'Match' : 'Form only'}
              />
            );
          })}
          {uc.summaryOutputs.map((line, i) => {
            const match = outputOnDiagram(line.dataId, line.destinationId);
            return (
              <CompareRow
                key={`out-${i}`}
                form={
                  <>
                    Output: <DataLink model={model} dataId={line.dataId} /> to {elementLabel(model, line.destinationId)}
                  </>
                }
                diagrams={!process ? '' : match ? `A flow out of process ${number}` : `No flow out of process ${number} carries it there`}
                verdict={!process ? '' : match ? 'Match' : 'Form only'}
              />
            );
          })}
          {intoOnly.map((f) => (
            <CompareRow
              key={f.id}
              form={<span className="muted">Not among the summary inputs</span>}
              diagrams={
                <>
                  A flow into process {number}: <DataLink model={model} dataId={f.dataId} /> from {elementLabel(model, f.sourceId)}
                </>
              }
              verdict="Diagram only"
            />
          ))}
          {outOnly.map((f) => (
            <CompareRow
              key={f.id}
              form={<span className="muted">Not among the summary outputs</span>}
              diagrams={
                <>
                  A flow out of process {number}: <DataLink model={model} dataId={f.dataId} /> to {elementLabel(model, f.targetId)}
                </>
              }
              verdict="Diagram only"
            />
          ))}
        </tbody>
      </table>

      <p className="muted usecases-note">
        This comparison is information only. No rule checks a use case against its diagrams yet, so nothing here counts as a problem. A flow
        counts as a match when it carries the same data to or from the same place.
      </p>

      {process && (
        <p className="muted">
          {plural(uc.steps.length, 'step', 'steps')} on the form.{' '}
          {child
            ? `${plural(processesOn(model, child.id).length, 'process', 'processes')} on the diagram ${diagramTitle(model, child.id)}.`
            : `Process ${number} has no child diagram yet.`}
        </p>
      )}

      {fragment && <FragmentSection model={model} fragment={fragment} />}

      <SectionHeading count={findings.length}>Problems</SectionHeading>
      {findings.length > 0 ? <ProblemList findings={findings} /> : <p className="muted">No rule checks a use case yet.</p>}
    </>
  );
}

function CompareRow({ form, diagrams, verdict }: { form: React.ReactNode; diagrams: React.ReactNode; verdict: Verdict }) {
  return (
    <tr>
      <td>{form}</td>
      <td>{diagrams || <span className="muted">No process to compare with</span>}</td>
      <td className="usecases-verdict">{verdict}</td>
    </tr>
  );
}

/** The textbook's DFD fragment: one process, its flows, and what is at their other ends. */
function FragmentSection({ model, fragment }: { model: Model; fragment: Fragment }) {
  const { process, diagramId, flows, controlFlows, elements } = fragment;
  return (
    <section className="usecases-fragment">
      <h3 className="panel-subheading">Fragment</h3>
      <p className="muted usecases-note">
        Process {elementLabel(model, process.id)} with its flows, as drawn on{' '}
        <Link className="btn-link" to={`/diagram/${diagramId}`} onClick={() => selectElements([process.id])}>
          {diagramTitle(model, diagramId)}
        </Link>
        .
      </p>
      <FlowList model={model} heading="In" flows={flows.filter((f) => f.direction === 'in')} />
      <FlowList model={model} heading="Out" flows={flows.filter((f) => f.direction === 'out')} />
      {controlFlows.length > 0 && (
        <div className="usecases-flows">
          <span className="field-label">Start</span>
          <ul>
            {controlFlows.map((c) => (
              <li key={c.id}>{c.name || <span className="missing">No starting event yet</span>}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="usecases-flows">
        <span className="field-label">Ends</span>
        {elements.length === 0 ? <span className="muted">None</span> : <span>{elements.map((e) => elementLabel(model, e.id)).join(', ')}</span>}
      </div>
    </section>
  );
}

function FlowList({ model, heading, flows }: { model: Model; heading: string; flows: FragmentFlow[] }) {
  return (
    <div className="usecases-flows">
      <span className="field-label">{heading}</span>
      {flows.length === 0 ? (
        <span className="muted">None</span>
      ) : (
        <ul>
          {flows.map(({ flow, direction, other, otherLabel }) => (
            <li key={flow.id}>
              <DataLink model={model} dataId={flow.dataId} /> {direction === 'in' ? 'from' : 'to'}{' '}
              {other ? otherLabel : <span className="missing">{otherLabel}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
