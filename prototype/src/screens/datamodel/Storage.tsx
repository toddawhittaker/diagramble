// The storage size estimate: docs/SPEC.md section 11.6. Route: /storage.
// The screen holds the inputs. The shared calculation (`storageEstimate`) does the arithmetic.

import { Fragment, useState } from 'react';
import { Link } from 'react-router';
import { formatNumber, get, storageEstimate, type Id, type Model, type TableEstimate } from '../../model';
import { FindingMarks, Missing, ModeSwitch, NumberField, ProblemList, Button } from '../../components';
import { PageHeader, RightPanel, UndoRedo, WorkArea } from '../../frame';
import { dispatch, selectElements, useAreaFindings, useMode, useModel, useSelection } from '../../store';
import { storageStarted } from '../../rules';
import { tableLabel, typeAndLength } from './shared';
import './datamodel.css';

/** A number with digit grouping, and two decimal places only when it is not whole. */
function num(n: number): string {
  return formatNumber(n, Math.abs(n - Math.round(n)) < 1e-9 ? 0 : 2);
}

type GrowthBy = 'month' | 'year';

/** How one row's figures are made up, step by step, with the figures the shared calculation gave. */
function Working({ table, overheadRate, months }: { table: TableEstimate; overheadRate: number; months: number }) {
  const en = table.entity;
  const initial = en.initialRecords ?? 0;
  const years = Math.floor(months / 12);
  const noWidth = table.fields.filter((f) => f.element.averageWidth === null).length;
  return (
    <ol>
      <li>
        <strong>Record size.</strong>{' '}
        {table.typedSize ? (
          <>
            This table has no fields, so the size is the one typed: <span className="mono">{en.recordSize === null ? 'nothing typed, counted as 0' : num(table.recordSize)}</span>{' '}
            characters.
          </>
        ) : (
          <>
            The average widths of its fields, added up:{' '}
            <span className="mono">
              {table.fields.map((f) => `${f.name} ${f.element.averageWidth === null ? '?' : num(f.element.averageWidth)}`).join(' + ')} = {num(table.recordSize)}
            </span>{' '}
            characters.{noWidth > 0 && ` A field with no average width, shown as "?", is counted as 0.`}
          </>
        )}
      </li>
      <li>
        <strong>Record size with overhead.</strong>{' '}
        <span className="mono">
          {num(table.recordSize)} × (1 + {num(overheadRate)}%) = {num(table.totalRecordSize)}
        </span>{' '}
        characters.
      </li>
      <li>
        <strong>Volume at the start.</strong>{' '}
        <span className="mono">
          {num(table.totalRecordSize)} × {num(initial)} records = {num(table.initialVolume)}
        </span>{' '}
        characters.
      </li>
      <li>
        <strong>Growth.</strong>{' '}
        {table.growthBy === 'year' ? (
          <>
            {num(en.growthPerYear ?? 0)}% a year, added at the end of each whole year. {num(months)} months hold {years} whole {years === 1 ? 'year' : 'years'}:{' '}
            <span className="mono">
              {num(initial)} × (1 + {num(en.growthPerYear ?? 0)}%)^{years} − {num(initial)} = {num(table.growth)}
            </span>{' '}
            records.
          </>
        ) : table.growthBy === 'month' ? (
          <>
            <span className="mono">
              {num(en.growthPerMonth ?? 0)} records a month × {num(months)} months = {num(table.growth)}
            </span>{' '}
            records.
          </>
        ) : (
          'No growth is typed, so none is counted.'
        )}
      </li>
      <li>
        <strong>Records after {num(months)} months.</strong>{' '}
        <span className="mono">
          {num(initial)} + {num(table.growth)} = {num(table.finalRecords)}
        </span>
        .
      </li>
      <li>
        <strong>Volume after {num(months)} months.</strong>{' '}
        <span className="mono">
          {num(table.totalRecordSize)} × {num(table.finalRecords)} = {num(table.finalVolume)}
        </span>{' '}
        characters.
      </li>
    </ol>
  );
}

/** The average widths of the fields of one table, in the right panel. */
function FieldWidths({ model, table }: { model: Model; table: TableEstimate }) {
  const from = (id: Id | null) => tableLabel(id ? get(model, id, 'entity') : undefined);
  return (
    <>
      <div>
        <div className="datamodel-kind">Field widths</div>
        <h2 className="panel-heading mono">{table.name}</h2>
      </div>
      {table.typedSize ? (
        <div className="muted">
          This table has no fields yet, so its record size is typed in the grid. Give it fields on the <Link to="/data-model">data model</Link> and
          the record size is worked out from their widths.
        </div>
      ) : (
        <>
          <table className="table datamodel-widths">
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Type</th>
                <th scope="col" className="is-numeric">
                  Average width
                </th>
              </tr>
            </thead>
            <tbody>
              {table.fields.map((f, index) => (
                <tr key={`${f.dataId}:${index}`}>
                  <td>
                    <Link className="mono" to={`/dictionary/${f.dataId}`}>
                      {f.name}
                    </Link>
                    {(f.fk || f.copy) && (
                      <span className="datamodel-storage-sub">
                        {f.fk ? 'Foreign key from' : 'Copy from'} {from(f.fromEntityId)}. The width is shared with that table.
                      </span>
                    )}
                  </td>
                  <td>{typeAndLength(f.element) || <Missing>No type</Missing>}</td>
                  <td className="is-numeric">
                    <NumberField
                      label={`Average width of ${f.name}`}
                      hideLabel
                      size={5}
                      value={f.element.averageWidth}
                      onCommit={(averageWidth) => dispatch({ type: 'setPhysical', id: f.dataId, averageWidth })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Record size</td>
                <td className="is-numeric">{num(table.recordSize)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="field-hint">
            The average width is how many characters the values usually take, not the longest the field allows. The record size counts every
            field of the table, with its foreign key fields and its copies.
          </div>
        </>
      )}
    </>
  );
}

export function StorageScreen() {
  // The estimate belongs to the physical model, so it reads the whole model in both modes:
  // a system-related table takes room too.
  const model = useModel();
  const mode = useMode();
  const findings = useAreaFindings('storage');
  const selection = useSelection();
  const [working, setWorking] = useState<Id | null>(null);
  // How growth is given for a table that has no growth typed yet.
  const [chosen, setChosen] = useState<Record<Id, GrowthBy>>({});

  const estimate = storageEstimate(model);
  const { overheadRate, months } = estimate;
  const selected = estimate.tables.find((t) => selection.elementIds.includes(t.entity.id));
  const after = model.project.months === null ? 'after the months chosen' : `after ${num(months)} months`;
  const findingsFor = (table: TableEstimate) => findings.filter((f) => f.elementIds.includes(table.entity.id));

  const growthBy = (table: TableEstimate): GrowthBy => (table.growthBy === 'none' ? (chosen[table.entity.id] ?? 'month') : table.growthBy);
  const setGrowthBy = (table: TableEstimate, by: GrowthBy) => {
    setChosen((now) => ({ ...now, [table.entity.id]: by }));
    // A number of records is not a percentage, so the old figure is cleared, not carried over.
    if (table.growthBy !== 'none' && table.growthBy !== by) dispatch({ type: 'setStorage', entityId: table.entity.id, growthPerMonth: null, growthPerYear: null });
  };

  return (
    <>
      <WorkArea>
        <PageHeader breadcrumb={['Data model']} title="Storage size estimate">
          <UndoRedo />
        </PageHeader>
        <div className="work-body scroll pad">
          <div className="vstack" style={{ gap: 16 }}>
            {mode === 'logical' && (
              <div className="datamodel-storage-note">
                <span className="grow">
                  The storage size estimate is part of the physical model. You can fill it in here, but its figures are checked in physical mode
                  only.
                </span>
                <ModeSwitch small />
              </div>
            )}
            <div className="datamodel-storage-settings">
              <NumberField
                label="Overhead rate"
                unit="percent"
                size={6}
                value={model.project.overheadRate}
                hint="The share added to every record for the database's own needs."
                onCommit={(value) => dispatch({ type: 'setStorageSettings', overheadRate: value })}
              />
              <NumberField
                label="Estimate for"
                suffix="months"
                size={6}
                value={model.project.months}
                hint="How far ahead to estimate. A whole number."
                onCommit={(value) => dispatch({ type: 'setStorageSettings', months: value })}
              />
            </div>

            {estimate.tables.length === 0 ? (
              <p className="placeholder">
                There is nothing to estimate yet, because the project has no tables. Add entities on the <Link to="/data-model">data model</Link>. Each
                becomes one row here.
              </p>
            ) : (
              <div className="datamodel-storage-scroll">
                <table className="table datamodel-storage-table">
                  <thead>
                    <tr>
                      <th scope="col">Table</th>
                      <th scope="col" className="is-numeric">
                        Record size
                      </th>
                      <th scope="col" className="is-numeric">
                        With overhead
                      </th>
                      <th scope="col" className="is-numeric">
                        Records at the start
                      </th>
                      <th scope="col" className="is-numeric">
                        Growth
                      </th>
                      <th scope="col" className="is-numeric">
                        Volume at the start
                      </th>
                      <th scope="col" className="is-numeric">
                        Volume {after}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimate.tables.map((table) => {
                      const en = table.entity;
                      const by = growthBy(table);
                      const noWidth = table.fields.filter((f) => f.element.averageWidth === null).length;
                      const open = working === en.id;
                      return (
                        <Fragment key={en.id}>
                          <tr className={selected?.entity.id === en.id ? 'is-selected' : undefined}>
                            <td>
                              <span className="hstack">
                                <button
                                  type="button"
                                  className="datamodel-storage-name"
                                  title="Show this table's field widths"
                                  onClick={() => selectElements([en.id])}
                                >
                                  {table.name}
                                </button>
                                <FindingMarks findings={findingsFor(table)} counts={false} />
                              </span>
                              {en.systemRelated && <span className="datamodel-storage-sub">system-related</span>}
                              <Button variant="link" small aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} the working for ${table.name}`} onClick={() => setWorking(open ? null : en.id)}>
                                {open ? 'Hide the working' : 'Show the working'}
                              </Button>
                            </td>
                            <td className="is-numeric">
                              {table.typedSize ? (
                                <NumberField
                                  label={`Record size of ${table.name}`}
                                  hideLabel
                                  size={6}
                                  value={en.recordSize}
                                  onCommit={(recordSize) => dispatch({ type: 'setStorage', entityId: en.id, recordSize })}
                                />
                              ) : (
                                <>
                                  {num(table.recordSize)}
                                  {noWidth > 0 && (
                                    <span className="datamodel-storage-sub">
                                      <Missing>
                                        {noWidth} of {table.fields.length} widths not set
                                      </Missing>
                                    </span>
                                  )}
                                </>
                              )}
                            </td>
                            <td className="is-numeric">{num(table.totalRecordSize)}</td>
                            <td className="is-numeric">
                              <NumberField
                                label={`Records at the start in ${table.name}`}
                                hideLabel
                                size={8}
                                value={en.initialRecords}
                                onCommit={(initialRecords) => dispatch({ type: 'setStorage', entityId: en.id, initialRecords })}
                              />
                            </td>
                            <td>
                              <span className="datamodel-storage-growth">
                                <NumberField
                                  label={`Growth of ${table.name}, ${by === 'year' ? 'as a percentage for each year' : 'in records for each month'}`}
                                  hideLabel
                                  size={6}
                                  value={by === 'year' ? en.growthPerYear : en.growthPerMonth}
                                  onCommit={(value) =>
                                    dispatch(
                                      by === 'year'
                                        ? { type: 'setStorage', entityId: en.id, growthPerYear: value, growthPerMonth: null }
                                        : { type: 'setStorage', entityId: en.id, growthPerMonth: value, growthPerYear: null },
                                    )
                                  }
                                />
                                <select
                                  className="input"
                                  aria-label={`How the growth of ${table.name} is given`}
                                  value={by}
                                  onChange={(e) => setGrowthBy(table, e.target.value === 'year' ? 'year' : 'month')}
                                >
                                  <option value="month">records a month</option>
                                  <option value="year">% a year</option>
                                </select>
                              </span>
                            </td>
                            <td className="is-numeric">{num(table.initialVolume)}</td>
                            <td className="is-numeric">{num(table.finalVolume)}</td>
                          </tr>
                          {open && (
                            <tr className="datamodel-storage-working">
                              <td colSpan={7}>
                                <Working table={table} overheadRate={overheadRate} months={months} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5}>Database size, in characters</td>
                      <td className="is-numeric">{num(estimate.initialVolume)}</td>
                      <td className="is-numeric">{num(estimate.finalVolume)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <div className="vstack muted">
              <div>
                Sizes and volumes are in characters. A record size is the average widths of the table's fields added up. Click a table's name
                to open its field widths.
                {(model.project.overheadRate === null || model.project.months === null) &&
                  ' While the overhead rate or the number of months is not set, it is counted as 0.'}
              </div>
              <div>
                Growth given as a percentage for each year is compounded once, at the end of each whole year: the records are multiplied by one
                plus the percentage for every full 12 months. A part of a year at the end adds nothing. The textbook does not say how such growth
                should be compounded, so this is the tool's choice.
              </div>
            </div>
          </div>
        </div>
      </WorkArea>
      <RightPanel label="Field widths and problems">
        {selected ? (
          <FieldWidths model={model} table={selected} />
        ) : (
          <>
            <h2 className="panel-heading">Field widths</h2>
            <div className="muted">Click a table's name in the grid to see and change the average width of each of its fields.</div>
          </>
        )}
        <hr className="datamodel-divider" />
        <h2 className="panel-heading">Problems</h2>
        {mode === 'logical' ? (
          <div className="muted">The estimate is checked in physical mode only. Switch to "Physical" to see its problems.</div>
        ) : !storageStarted(model) ? (
          <div className="muted">Nothing is checked yet. The estimate is checked once its first figure is typed.</div>
        ) : (
          <ProblemList findings={findings} emptyText="No problems in the storage size estimate." />
        )}
      </RightPanel>
    </>
  );
}
