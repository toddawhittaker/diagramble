// Two views of the whole project, worked out from the forms (docs/SPEC.md section 8.4):
// the event-response list and the use case list. Both are read-only. Each row links to
// its use case, where the editing is done.

import { Link } from 'react-router';
import { Missing } from '../../components';
import { all, elementLabel, eventResponseList, get, type Model, type UseCase } from '../../model';

export type ViewId = 'events' | 'list';

export const VIEWS: { value: ViewId; label: string }[] = [
  { value: 'events', label: 'Event-response list' },
  { value: 'list', label: 'Use case list' },
];

export const PRIORITY_WORDS: Record<UseCase['priority'], string> = { high: 'High', medium: 'Medium', low: 'Low' };

function NameLink({ id, name }: { id: string; name: string }) {
  return <Link to={`/use-cases/${id}`}>{name || <Missing>No name yet</Missing>}</Link>;
}

/** One row for each use case: its trigger is the event and its name is the response. */
export function EventResponseView({ model }: { model: Model }) {
  const rows = eventResponseList(model);
  if (rows.length === 0) return <p>This project has no use cases yet, so there are no events to list.</p>;
  return (
    <div className="usecases-view vstack">
      <p className="muted">
        Each use case answers one event. The event is the use case's trigger, and the response is the use case itself. Choose a response to
        open its form.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th className="usecases-view-n">Use case</th>
            <th>Event</th>
            <th>Response</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="mono usecases-view-n">UC-{get(model, row.id, 'useCase')?.ordinal}</td>
              <td>{row.trigger.trim() ? row.trigger : <Missing>No trigger yet</Missing>}</td>
              <td>
                <NameLink id={row.id} name={row.name} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Every use case with its number, name, priority, actor and process. */
export function UseCaseListView({ model }: { model: Model }) {
  const useCases = all(model, 'useCase').sort((a, b) => a.ordinal - b.ordinal);
  if (useCases.length === 0) return <p>This project has no use cases yet.</p>;
  return (
    <div className="usecases-view vstack">
      <p className="muted">Every use case in the project. Choose a name to open its form.</p>
      <table className="table">
        <thead>
          <tr>
            <th className="usecases-view-n">Number</th>
            <th>Name</th>
            <th>Priority</th>
            <th>Actor</th>
            <th>Process</th>
          </tr>
        </thead>
        <tbody>
          {useCases.map((uc) => (
            <tr key={uc.id}>
              <td className="mono usecases-view-n">UC-{uc.ordinal}</td>
              <td>
                <NameLink id={uc.id} name={uc.name} />
              </td>
              <td>{PRIORITY_WORDS[uc.priority]}</td>
              <td>{uc.actorId && model.elements[uc.actorId] ? elementLabel(model, uc.actorId) : <Missing>No actor yet</Missing>}</td>
              <td>{uc.processId && model.elements[uc.processId] ? elementLabel(model, uc.processId) : <Missing>No process yet</Missing>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
