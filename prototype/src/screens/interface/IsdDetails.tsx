// The top of the right panel beside an interface structure diagram: the details of the
// selected interface or link, or of the diagram itself when nothing is selected.

import { useId } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  diagramsInOrder,
  get,
  interfaceReach,
  interfacesOn,
  linksOn,
  processNumber,
  processesOn,
  routeOf,
  type Id,
  type Interface,
  type InterfaceDiagram,
  type Model,
  type NavigationLink,
} from '../../model';
import { clearSelection, dispatch, selectElements, useModel, useSelection, useViewModel } from '../../store';
import { Button, Missing } from '../../components';
import { DeleteControl, DraftField } from './shared';

const faceLabel = (face: Interface) => `${face.number} ${face.name}`.trim();

// ---- An interface ----

function InterfaceDetails({ model, view, face }: { model: Model; view: Model; face: Interface }) {
  const processFieldId = useId();
  const linkFieldId = useId();
  const reach = interfaceReach(model, face.diagramId);
  const steps = reach.distance.get(face.id);
  const chosen = face.processIds.filter((p) => get(model, p, 'process'));
  const links = linksOn(model, face.diagramId).filter((l) => l.aId === face.id || l.bId === face.id);
  const linkedIds = links.map((l) => (l.aId === face.id ? l.bId : l.aId));
  const others = interfacesOn(model, face.diagramId).filter((i) => i.id !== face.id && !linkedIds.includes(i.id));
  // The processes to choose from, under the data flow diagram each is drawn on.
  const groups = diagramsInOrder(view)
    .map(({ diagram, title }) => ({ id: diagram.id, title, processes: processesOn(view, diagram.id).filter((p) => !chosen.includes(p.id)) }))
    .filter((g) => g.processes.length > 0);
  const setProcesses = (processIds: Id[]) => dispatch({ type: 'updateInterface', id: face.id, processIds });

  return (
    <>
      <div>
        <div className="interface-kind">{face.number === '0' ? 'Interface: the main menu' : 'Interface'}</div>
        <h2 className="panel-heading">{faceLabel(face) || <Missing>No name yet</Missing>}</h2>
      </div>
      <DraftField label="Name" value={face.name} onSave={(name) => dispatch({ type: 'rename', id: face.id, name: name.trim() }).ok} />
      <DraftField
        label="Number"
        value={face.number}
        hint="Interface 0 is the main menu. Number the ones below it 1, 2, then 1.1, 1.2 and so on."
        onSave={(number) => dispatch({ type: 'updateInterface', id: face.id, number: number.trim() }).ok}
      />
      <DraftField
        label="Description"
        value={face.description}
        rows={3}
        placeholder="No description yet"
        onSave={(description) => dispatch({ type: 'describe', id: face.id, description }).ok}
      />

      <h3 className="panel-subheading">Processes it carries out</h3>
      {chosen.length === 0 ? (
        <div className="muted">None chosen. A menu that only leads to other interfaces needs none.</div>
      ) : (
        <ul className="interface-list">
          {chosen.map((p) => (
            <li key={p} className="interface-list-row">
              <Link className="interface-list-name" to={routeOf(model, p)?.route ?? '/'}>
                <span className="mono">{processNumber(model, p)}</span> {model.elements[p]?.name}
              </Link>
              <Button small variant="link" aria-label={`Remove process ${processNumber(model, p)} from this interface`} onClick={() => setProcesses(chosen.filter((x) => x !== p))}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      {groups.length > 0 ? (
        <div className="field">
          <label className="field-label" htmlFor={processFieldId}>
            Add a process from the data flow diagrams
          </label>
          <select id={processFieldId} className="input" value="" onChange={(e) => e.target.value && setProcesses([...chosen, e.target.value])}>
            <option value="">Choose a process…</option>
            {groups.map((g) => (
              <optgroup key={g.id} label={g.title}>
                {g.processes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {processNumber(view, p.id)} {p.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      ) : (
        chosen.length === 0 && <div className="muted">The data flow diagrams have no processes to choose from yet.</div>
      )}

      <h3 className="panel-subheading">Linked to</h3>
      {steps !== undefined && steps > 0 && (
        <div className="muted">
          {steps} {steps === 1 ? 'link' : 'links'} from interface 0.
        </div>
      )}
      {links.length === 0 ? (
        <div className="muted">No links yet.</div>
      ) : (
        <ul className="interface-list">
          {links.map((l) => {
            const other = get(model, l.aId === face.id ? l.bId : l.aId, 'interface');
            if (!other) return null;
            return (
              <li key={l.id} className="interface-list-row">
                <button type="button" className="btn btn-link interface-list-name" onClick={() => selectElements([other.id])}>
                  {faceLabel(other)}
                </button>
                <Button small variant="link" aria-label={`Remove the link to ${faceLabel(other)}`} onClick={() => dispatch({ type: 'deleteElement', id: l.id })}>
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {others.length > 0 && (
        <div className="field">
          <label className="field-label" htmlFor={linkFieldId}>
            Add a link to another interface
          </label>
          <select
            id={linkFieldId}
            className="input"
            value=""
            onChange={(e) => e.target.value && dispatch({ type: 'addNavigationLink', diagramId: face.diagramId, aId: face.id, bId: e.target.value })}
          >
            <option value="">Choose an interface…</option>
            {others.map((i) => (
              <option key={i.id} value={i.id}>
                {faceLabel(i)}
              </option>
            ))}
          </select>
        </div>
      )}

      <DeleteControl
        question={`Delete '${face.name}'${links.length ? ` and its ${links.length === 1 ? 'link' : `${links.length} links`}` : ''}?`}
        onDelete={() => {
          if (dispatch({ type: 'deleteElement', id: face.id }).ok) clearSelection();
        }}
      />
    </>
  );
}

// ---- A navigation link ----

function LinkDetails({ model, link }: { model: Model; link: NavigationLink }) {
  const ends = [get(model, link.aId, 'interface'), get(model, link.bId, 'interface')];
  return (
    <>
      <div>
        <div className="interface-kind">Navigation link</div>
        <h2 className="panel-heading">Between two interfaces</h2>
      </div>
      <div>The user can move between these two interfaces, in either direction.</div>
      <ul className="interface-list">
        {ends.map(
          (face) =>
            face && (
              <li key={face.id} className="interface-list-row">
                <button type="button" className="btn btn-link interface-list-name" onClick={() => selectElements([face.id])}>
                  {faceLabel(face)}
                </button>
              </li>
            ),
        )}
      </ul>
      <DeleteControl
        question="Delete this link? Both interfaces stay."
        onDelete={() => {
          if (dispatch({ type: 'deleteElement', id: link.id }).ok) clearSelection();
        }}
      />
    </>
  );
}

// ---- The diagram itself ----

function DiagramDetails({ model, diagram }: { model: Model; diagram: InterfaceDiagram }) {
  const navigate = useNavigate();
  const count = interfacesOn(model, diagram.id).length;
  return (
    <>
      <div>
        <div className="interface-kind">Interface structure diagram</div>
        <h2 className="panel-heading">{diagram.name || <Missing>No title yet</Missing>}</h2>
      </div>
      <div className="muted">Select an interface or a link on the diagram to see and change its details.</div>
      <DraftField label="Title" value={diagram.name} onSave={(name) => dispatch({ type: 'rename', id: diagram.id, name: name.trim() }).ok} />
      <DraftField
        label="Description"
        value={diagram.description}
        rows={3}
        placeholder="No description yet"
        onSave={(description) => dispatch({ type: 'describe', id: diagram.id, description }).ok}
      />
      <div>
        <span className="count">{count}</span> {count === 1 ? 'interface' : 'interfaces'}, <span className="count">{linksOn(model, diagram.id).length}</span> links
      </div>
      <DeleteControl
        label="Delete this diagram"
        question={`Delete '${diagram.name}' with every interface and link on it?`}
        onDelete={() => {
          if (dispatch({ type: 'deleteElement', id: diagram.id }).ok) {
            clearSelection();
            void navigate('/interfaces');
          }
        }}
      />
    </>
  );
}

export function IsdDetails({ diagram }: { diagram: InterfaceDiagram }) {
  const model = useModel();
  const view = useViewModel();
  const selection = useSelection();
  const id = selection.elementIds[0];
  const face = id ? get(model, id, 'interface') : undefined;
  const link = id ? get(model, id, 'navigationLink') : undefined;
  if (face && face.diagramId === diagram.id) return <InterfaceDetails key={face.id} model={model} view={view} face={face} />;
  if (link && link.diagramId === diagram.id) return <LinkDetails key={link.id} model={model} link={link} />;
  return <DiagramDetails key={diagram.id} model={model} diagram={diagram} />;
}
