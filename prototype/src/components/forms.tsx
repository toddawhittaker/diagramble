// Controls the form screens share: a number field, a select, a table of editable rows,
// a figure the student types and the tool checks, and the logical and physical switch.

import { useEffect, useId, useState, type ReactNode } from 'react';
import { formatNumber } from '../model/calc';
import type { Mode } from '../model/types';
import { setMode, useFindingsVisible, useMode } from '../store/store';
import { Button, Switch } from './controls';
import { Mark, Missing } from './Mark';

export type NumberUnit = 'money' | 'percent' | 'plain';

/** A number as a field shows it: "12,500" for money, "8" or "8.5" for anything else. Empty for null. */
export function numberText(value: number | null, unit: NumberUnit = 'plain'): string {
  if (value === null) return '';
  if (unit === 'money') return formatNumber(value, Number.isInteger(value) ? 0 : 2);
  return String(value);
}

/** Reads what was typed into a number field. Commas, spaces, "$" and "%" are ignored. Empty gives null, and anything else that is not a number gives undefined. */
export function parseNumber(text: string): number | null | undefined {
  const clean = text.replace(/[,\s$%]/g, '');
  if (clean === '') return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : undefined;
}

export interface NumberFieldProps {
  label: string;
  value: number | null;
  /** Called when the field loses focus, or on Enter, with the number typed or null when it was cleared. Not called when the value did not change or is not a number. */
  onCommit: (value: number | null) => void;
  /** 'money' groups the digits. 'percent' shows a % sign after the box. */
  unit?: NumberUnit;
  /** Words after the box, such as "years" or "characters". */
  suffix?: string;
  hint?: ReactNode;
  placeholder?: string;
  readOnly?: boolean;
  /** Hide the visible label. It is still read by screen readers. Use it inside a table cell. */
  hideLabel?: boolean;
  /** The width of the box in characters. Default 10. */
  size?: number;
}

/** A labelled box for one number: money, a percentage or a plain number. The number is right-aligned and monospaced. */
export function NumberField({ label, value, onCommit, unit = 'plain', suffix, hint, placeholder, readOnly, hideLabel, size = 10 }: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(numberText(value, unit));
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setDraft(numberText(value, unit));
    setBad(false);
  }, [value, unit]);
  const commit = () => {
    const parsed = parseNumber(draft);
    if (parsed === undefined) {
      setBad(true);
      return;
    }
    setBad(false);
    setDraft(numberText(parsed, unit));
    if (parsed !== value) onCommit(parsed);
  };
  const after = unit === 'percent' ? '%' : suffix;
  return (
    <div className={`field number-field${hideLabel ? ' number-field-bare' : ''}`}>
      {!hideLabel && (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      )}
      <span className="number-field-box">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          className="input number-field-input"
          style={{ width: `${size + 2}ch` }}
          value={draft}
          placeholder={placeholder}
          readOnly={readOnly}
          aria-label={hideLabel ? label : undefined}
          aria-invalid={bad || undefined}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
          }}
        />
        {after && <span className="number-field-unit">{after}</span>}
      </span>
      {bad && <div className="field-hint">Type a number, such as 1250 or 12.5.</div>}
      {hint && !bad && <div className="field-hint">{hint}</div>}
    </div>
  );
}

export interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: ReactNode;
  hideLabel?: boolean;
  disabled?: boolean;
}

/** A labelled list to choose one option from. The change is reported at once. */
export function SelectField<T extends string>({ label, value, options, onChange, hint, hideLabel, disabled }: SelectFieldProps<T>) {
  const id = useId();
  return (
    <div className="field">
      {!hideLabel && (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      )}
      <select id={id} className="input" value={value} disabled={disabled} aria-label={hideLabel ? label : undefined} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

export interface CellTextProps {
  /** What the cell holds, for screen readers, such as "Name of benefit 2". */
  label: string;
  value: string;
  /** Called when the box loses focus, or on Enter in a one-line box, if the text changed. */
  onCommit: (value: string) => void;
  placeholder?: string;
  /** A text area with this many rows, in place of a one-line box. */
  rows?: number;
}

/** A text box for a table cell. It keeps its own draft and reports the text when it loses focus. */
export function CellText({ label, value, onCommit, placeholder, rows }: CellTextProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  const shared = { className: 'input cell-text', value: draft, placeholder, 'aria-label': label, onBlur: commit };
  return rows ? (
    <textarea rows={rows} {...shared} onChange={(e) => setDraft(e.target.value)} />
  ) : (
    <input
      type="text"
      {...shared}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
    />
  );
}

export interface RowColumn<T> {
  key: string;
  heading: ReactNode;
  /** A CSS width, such as '8rem'. Leave out to share the spare room. */
  width?: string;
  /** Right-align the heading and the cells, for numbers. */
  numeric?: boolean;
  /** Draws the cell. Call `set` with the changed row to report an edit. */
  render: (row: T, index: number, set: (row: T) => void) => ReactNode;
}

export interface EditableRowsProps<T> {
  /** What the table lists, for screen readers and for the button names, such as "Benefits". */
  label: string;
  rows: T[];
  columns: RowColumn<T>[];
  /** Called with the whole new list after any edit, add, removal or move. Dispatch one command from it. */
  onChange: (rows: T[]) => void;
  /** Makes the row that "Add" appends. Leave out to hide the button. */
  newRow?: () => T;
  /** The words on the add button. Default "Add a row". */
  addLabel?: string;
  /** Shown in place of the table while there are no rows. */
  emptyText?: string;
  /** Hide the "Up" and "Down" buttons. */
  fixedOrder?: boolean;
  /** Hide the "Remove" button. */
  fixedRows?: boolean;
  /** Extra `<tr>` rows for the bottom of the table, such as totals. */
  footer?: ReactNode;
  /** Hide the column headings, for a plain list of one column. */
  hideHeadings?: boolean;
}

/**
 * A table of rows that can be edited, added, removed and moved up or down. It holds no
 * state: every change is reported through `onChange` as the whole new list.
 */
export function EditableRows<T>({ label, rows, columns, onChange, newRow, addLabel = 'Add a row', emptyText, fixedOrder, fixedRows, footer, hideHeadings }: EditableRowsProps<T>) {
  const replace = (index: number, row: T) => onChange(rows.map((r, i) => (i === index ? row : r)));
  const move = (index: number, by: number) => {
    const next = [...rows];
    const [row] = next.splice(index, 1);
    next.splice(index + by, 0, row);
    onChange(next);
  };
  const hasControls = !fixedOrder || !fixedRows;
  return (
    <div className="editable-rows">
      {rows.length === 0 && !footer ? (
        emptyText && <Missing>{emptyText}</Missing>
      ) : (
        <table className="table editable-rows-table" aria-label={label}>
          <thead className={hideHeadings ? 'visually-hidden' : undefined}>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ width: c.width }} className={c.numeric ? 'is-numeric' : undefined}>
                  {c.heading}
                </th>
              ))}
              {hasControls && <th className="editable-rows-controls">{hideHeadings ? '' : <span className="visually-hidden">Move or remove</span>}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((c) => (
                  <td key={c.key} className={c.numeric ? 'is-numeric' : undefined}>
                    {c.render(row, index, (next) => replace(index, next))}
                  </td>
                ))}
                {hasControls && (
                  <td className="editable-rows-controls">
                    {!fixedOrder && (
                      <>
                        <Button small variant="link" disabled={index === 0} aria-label={`Move row ${index + 1} of ${label} up`} onClick={() => move(index, -1)}>
                          Up
                        </Button>
                        <Button small variant="link" disabled={index === rows.length - 1} aria-label={`Move row ${index + 1} of ${label} down`} onClick={() => move(index, 1)}>
                          Down
                        </Button>
                      </>
                    )}
                    {!fixedRows && (
                      <Button small variant="link" aria-label={`Remove row ${index + 1} of ${label}`} onClick={() => onChange(rows.filter((_, i) => i !== index))}>
                        Remove
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      )}
      {newRow && (
        <Button small onClick={() => onChange([...rows, newRow()])}>
          {addLabel}
        </Button>
      )}
    </div>
  );
}

/** How a typed figure compares with the formula. The same words as `MeasureCheck['status']`. */
export type FigureStatus = 'empty' | 'match' | 'mismatch' | 'none' | 'unknown';

export interface CheckedFigureProps extends Omit<NumberFieldProps, 'hint'> {
  status: FigureStatus;
  /** Words to show in place of the usual ones for this status. */
  note?: string;
}

const STATUS_WORDS: Record<FigureStatus, string> = {
  empty: 'Not typed yet',
  match: 'Matches the table',
  mismatch: 'Does not match the table',
  none: 'The table gives no such figure',
  unknown: 'Cannot be checked yet',
};

/**
 * A figure the student works out and types, with a mark beside it saying whether it
 * matches the formula. It never shows the right answer: the finding's card shows the
 * working. While the findings are held back, it shows no verdict.
 */
export function CheckedFigure({ status, note, ...field }: CheckedFigureProps) {
  const visible = useFindingsVisible();
  const words = note ?? STATUS_WORDS[status];
  return (
    <div className="checked-figure">
      <NumberField {...field} />
      <div className="checked-figure-status" role="status">
        {status === 'empty' ? (
          <Missing>{words}</Missing>
        ) : !visible ? (
          <span className="muted">Checked when you ask for the problems</span>
        ) : status === 'match' ? (
          <>
            <Mark kind="ok" /> {words}
          </>
        ) : status === 'unknown' ? (
          <span className="muted">{words}</span>
        ) : (
          <>
            <Mark kind="error" /> {words}
          </>
        )}
      </div>
    </div>
  );
}

export interface ModeSwitchProps {
  small?: boolean;
}

/** The "Logical" and "Physical" switch, wired to the store. The top bar has one. A page header may add another. */
export function ModeSwitch({ small }: ModeSwitchProps) {
  const mode = useMode();
  return (
    <Switch<Mode>
      small={small}
      label="Show the logical or the physical model"
      value={mode}
      onChange={setMode}
      options={[
        { value: 'logical', label: 'Logical' },
        { value: 'physical', label: 'Physical' },
      ]}
    />
  );
}
