// The CRUD matrix (create, read, update, delete), laid out as docs/SPEC.md section 9.5
// says: one column for each process with no child diagram, and the entities as rows, each
// followed by its attributes. An entity with no attributes yet has one row of its own,
// and its cells are kept under the entity's id.

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { all, diagramOfProcess, get, leafProcesses, processNumber, type Entity, type Id, type Process } from '../../model';
import { dispatch, selectElements, useMode, useViewModel } from '../../store';
import { Button, Missing } from '../../components';
import { tableLabel } from './shared';

const LETTERS = ['C', 'R', 'U', 'D'] as const;
type Letter = (typeof LETTERS)[number];

/** `name` is what the row is called in the current mode. `logical` is the attribute's own name, and `unnamed` is true for a field with no field name yet. */
type Row = { kind: 'entity'; entity: Entity } | { kind: 'attribute'; entity: Entity; dataId: Id; name: string; logical: string; unnamed: boolean; system: boolean };

function usesOf(process: Process, dataId: Id): string {
  return process.crud.find((c) => c.dataId === dataId)?.uses ?? '';
}

/** The letters in the order C, R, U, D. */
function inOrder(letters: Iterable<string>): string {
  const set = new Set(letters);
  return LETTERS.filter((l) => set.has(l)).join('');
}

/** Where an entity's cells are kept: under its attributes, or under its own id while it has none. */
function cellIds(entity: Entity): Id[] {
  return entity.attributes.length > 0 ? entity.attributes.map((a) => a.dataId) : [entity.id];
}

function listOf(names: string[]): string {
  return names.map((n) => `'${n}'`).join(', ');
}

export function CrudMatrix() {
  // The model as the mode shows it. In physical mode that includes the system-related
  // processes, tables and fields. The cells are the same ones in both modes.
  const model = useViewModel();
  const physical = useMode() === 'physical';
  const table = useRef<HTMLTableElement>(null);
  const [active, setActive] = useState<string | null>(null);

  const processes = leafProcesses(model);
  const entities = all(model, 'entity');
  const rows = useMemo<Row[]>(
    () =>
      all(model, 'entity').flatMap((entity) => [
        { kind: 'entity', entity } as Row,
        ...entity.attributes.map((a): Row => {
          const element = get(model, a.dataId, 'dataElement');
          const logical = element?.name ?? '';
          const fieldName = element?.fieldName.trim() ?? '';
          return { kind: 'attribute', entity, dataId: a.dataId, name: physical ? fieldName || logical : logical, logical, unnamed: physical && !fieldName, system: physical && !!element?.systemRelated };
        }),
      ]),
    [model, physical],
  );

  /** What an entity is called in the current mode. */
  const entityName = (entity: Entity) => (physical ? tableLabel(entity) : entity.name);

  if (entities.length === 0)
    return (
      <div className="datamodel-help">
        The matrix has no rows yet, because the project has no entities. Add them on the <Link to="/data-model">entity relationship diagram</Link>.
      </div>
    );
  if (processes.length === 0) return <div className="datamodel-help">The matrix has no columns yet, because the project has no processes.</div>;

  /**
   * What a cell shows. An entity's cell shows every letter used by any of its attributes,
   * or the entity's own letters while it has no attributes.
   */
  const lettersAt = (row: Row, process: Process): string =>
    row.kind === 'attribute' ? usesOf(process, row.dataId) : inOrder(cellIds(row.entity).flatMap((id) => [...usesOf(process, id)]));

  const setCell = (process: Process, dataId: Id, uses: string) => {
    if (uses !== usesOf(process, dataId)) dispatch({ type: 'setCrud', processId: process.id, dataId, uses });
  };

  /**
   * Turns one letter on or off. In an entity's row it does so for every attribute of the
   * entity, or for the entity itself while it has no attributes.
   */
  const toggle = (row: Row, process: Process, letter: Letter) => {
    if (row.kind === 'attribute') {
      const now = usesOf(process, row.dataId);
      setCell(process, row.dataId, now.includes(letter) ? now.replace(letter, '') : inOrder(now + letter));
      return;
    }
    const ids = cellIds(row.entity);
    const everyHas = ids.every((id) => usesOf(process, id).includes(letter));
    for (const id of ids) {
      const now = usesOf(process, id);
      setCell(process, id, everyHas ? now.replace(letter, '') : inOrder(now + letter));
    }
  };

  const clear = (row: Row, process: Process) => {
    const ids = row.kind === 'attribute' ? [row.dataId] : cellIds(row.entity);
    for (const id of ids) setCell(process, id, '');
  };

  /** Moves the focus to the next cell in the direction given. */
  const moveFocus = (r: number, c: number, dr: number, dc: number) => {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= rows.length || nc < 0 || nc >= processes.length) return;
    table.current?.querySelector<HTMLElement>(`[data-cell="${nr}:${nc}"]`)?.focus();
    setActive(`${nr}:${nc}`);
  };

  const onKeyDown = (event: KeyboardEvent, r: number, c: number) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const row = rows[r];
    const process = processes[c];
    const letter = event.key.toUpperCase();
    if (event.key === 'ArrowUp') moveFocus(r, c, -1, 0);
    else if (event.key === 'ArrowDown') moveFocus(r, c, 1, 0);
    else if (event.key === 'ArrowLeft') moveFocus(r, c, 0, -1);
    else if (event.key === 'ArrowRight') moveFocus(r, c, 0, 1);
    else if (letter === 'C' || letter === 'R' || letter === 'U' || letter === 'D') toggle(row, process, letter);
    else if (event.key === 'Backspace' || event.key === 'Delete') clear(row, process);
    else if (event.key === 'Escape') (event.currentTarget as HTMLElement).blur();
    else return;
    event.preventDefault();
  };

  // ---- The summary under the table ----
  const anyCell = entities.some((en) => cellIds(en).some((id) => processes.some((p) => usesOf(p, id) !== '')));
  const entityNever = (letter: Letter) =>
    entities.filter((en) => !cellIds(en).some((id) => processes.some((p) => usesOf(p, id).includes(letter)))).map(entityName);
  const anyBare = entities.some((en) => en.attributes.length === 0);
  // Cells filled in under an entity before it had attributes. They are kept, but no row shows them.
  const leftOver = entities
    .filter((en) => en.attributes.length > 0)
    .flatMap((entity) => all(model, 'process').flatMap((process) => (usesOf(process, entity.id) ? [{ entity, process, uses: usesOf(process, entity.id) }] : [])));
  const neverCreated = entityNever('C');
  const neverRead = entityNever('R');

  return (
    <div className="datamodel-crud">
      <div className="datamodel-crud-scroll">
        <table ref={table} className="datamodel-crud-table">
          <thead>
            <tr>
              <th className="datamodel-crud-corner" scope="col">
                {physical ? 'Table and field' : 'Entity and attribute'}
              </th>
              {processes.map((p) => {
                const diagram = diagramOfProcess(model, p.id);
                return (
                  <th key={p.id} scope="col">
                    <Link to={diagram ? `/diagram/${diagram.id}` : '/'} onClick={() => selectElements([p.id])}>
                      <span className="datamodel-crud-number">{processNumber(model, p.id)}</span>
                      {p.name}
                    </Link>
                    {physical && p.systemRelated && <span className="datamodel-crud-system">system-related</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={row.kind === 'entity' ? row.entity.id : row.dataId} className={row.kind === 'entity' ? 'datamodel-crud-entity' : undefined}>
                <th scope="row">
                  {row.kind === 'entity' ? (
                    <>
                      <Link to="/data-model" onClick={() => selectElements([row.entity.id])}>
                        {physical ? (
                          <span className={row.entity.tableName.trim() ? 'mono' : 'missing'} title={`The table for the entity ${row.entity.name}`}>
                            {tableLabel(row.entity)}
                          </span>
                        ) : (
                          row.entity.name || 'Entity with no name'
                        )}
                      </Link>
                      {physical && row.entity.systemRelated && <span className="datamodel-crud-system"> system-related</span>}
                      {row.entity.attributes.length === 0 && (
                        <>
                          {' '}
                          <Missing>{physical ? 'No fields yet' : 'No attributes yet'}</Missing>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <Link to={`/dictionary/${row.dataId}`} title={physical ? `The field for the attribute ${row.logical}` : undefined}>
                        {physical ? <span className={row.unnamed ? 'missing' : 'mono'}>{row.name}</span> : row.name}
                      </Link>
                      {row.system && <span className="datamodel-crud-system"> system-related</span>}
                    </>
                  )}
                </th>
                {processes.map((p, c) => {
                  const key = `${r}:${c}`;
                  const letters = lettersAt(row, p);
                  // An entity's row sums up its attributes. With no attributes, the row holds the entity's own cells.
                  const sum = row.kind === 'entity' && row.entity.attributes.length > 0;
                  const what = row.kind === 'attribute' ? row.name : sum ? `every attribute of ${entityName(row.entity)}` : `${entityName(row.entity)}, which has no attributes yet`;
                  return (
                    <td key={p.id}>
                      <div
                        className={`datamodel-crud-cell${sum ? ' datamodel-crud-cell-sum' : ''}`}
                        data-cell={key}
                        tabIndex={0}
                        role="group"
                        aria-label={`${what}, in ${processNumber(model, p.id)} ${p.name}: ${letters || 'empty'}`}
                        onFocus={() => setActive(key)}
                        onClick={() => setActive(key)}
                        onBlur={() => setActive((now) => (now === key ? null : now))}
                        onKeyDown={(e) => onKeyDown(e, r, c)}
                      >
                        {active === key
                          ? LETTERS.map((l) => (
                              <button
                                key={l}
                                type="button"
                                tabIndex={-1}
                                className={`datamodel-crud-toggle${letters.includes(l) ? ' is-selected' : ''}`}
                                aria-pressed={letters.includes(l)}
                                // Keep the focus on the cell, so the keyboard goes on working.
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => toggle(row, p, l)}
                              >
                                {l}
                              </button>
                            ))
                          : letters}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="datamodel-crud-summary">
        {!anyCell ? (
          <p>The matrix is empty.</p>
        ) : (
          <>
            <p>{neverCreated.length > 0 ? `Never created by any process: ${listOf(neverCreated)}.` : `Every ${physical ? 'table' : 'entity'} is created by some process.`}</p>
            <p>{neverRead.length > 0 ? `Never read by any process: ${listOf(neverRead)}.` : `Every ${physical ? 'table' : 'entity'} is read by some process.`}</p>
          </>
        )}
        {leftOver.map(({ entity, process, uses }) => (
          <p key={`${entity.id}:${process.id}`} className="datamodel-crud-note">
            <span>
              '{entityName(entity)}' still has a cell of its own from before it had attributes: {uses} in {processNumber(model, process.id)}{' '}
              {process.name}. Fill it in again under the attributes, then remove it.
            </span>
            <Button small onClick={() => dispatch({ type: 'setCrud', processId: process.id, dataId: entity.id, uses: '' })}>
              Remove
            </Button>
          </p>
        ))}
        <p className="muted">
          {physical
            ? 'This is the matrix of the physical model. It shows table and field names and includes the system-related processes, tables and fields. The cells are the same ones the logical matrix shows. A name that is underlined is a table or field with no physical name yet.'
            : 'This is the matrix of the logical model. Anything marked as system-related is left out. Its cells are kept, and the physical matrix shows them.'}
        </p>
        <p className="muted">
          This is information only. The rules that check the matrix are not built yet, so nothing here is marked as an error or a warning.
        </p>
        <p className="muted">
          Click a cell, or move to it with the arrow keys, then press C, R, U or D to turn a letter on or off. Backspace empties the cell. A cell
          in an entity's row fills in every attribute of that entity.
          {anyBare &&
            ' An entity marked "No attributes yet" has one row of its own, because it has no attributes to list. Its cells are kept for the entity itself, so the matrix can be filled in before the attributes are known.'}
        </p>
      </div>
    </div>
  );
}
