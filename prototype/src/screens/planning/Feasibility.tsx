// The feasibility analysis: SPEC 10.2. Route: /feasibility

import { Fragment, useMemo, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { Button, CellText, CheckedFigure, EditableRows, FindingMarks, Missing, NumberField, ProblemList, SelectField } from '../../components';
import { PageHeader, RightPanel, UndoRedo, WorkArea } from '../../frame';
import {
  FACTOR_WORDS,
  ORGANIZATIONAL_FACTORS,
  TECHNICAL_FACTORS,
  cashFlow,
  checkMeasures,
  feasibility,
  isQuantityLine,
  systemRequest,
  type CashLine,
  type CashSection,
  type Economic,
  type EconomicPatch,
  type Feasibility,
  type Measure,
  type SystemRequest,
} from '../../model';
import type { Finding } from '../../rules';
import { dispatch, useAreaFindings, useFindingsVisible, useModel } from '../../store';
import { StartHere, capital, money, useArrival } from './shared';
import './planning.css';

function setEconomic(economic: EconomicPatch) {
  return dispatch({ type: 'updateFeasibility', economic });
}

const SECTIONS: { key: CashSection; title: string; one: string; total: string }[] = [
  { key: 'benefits', title: 'Benefits', one: 'benefit', total: 'Total benefits' },
  { key: 'developmentCosts', title: 'Development costs', one: 'development cost', total: 'Total development costs' },
  { key: 'operationalCosts', title: 'Operational costs', one: 'operational cost', total: 'Total operational costs' },
];

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

// ---- The technical and organizational parts ----

function Factors({ fa, findings }: { fa: Feasibility; findings: Finding[] }) {
  const part = (name: string) => findings.filter((f) => f.ruleId === 'FA-01' && f.values.part === name);
  return (
    <>
      <section className="planning-section">
        <h2 className="section-heading planning-heading">
          Technical feasibility
          <FindingMarks findings={part('technical')} counts={false} />
        </h2>
        <table className="table planning-factors">
          <thead>
            <tr>
              <th>Factor</th>
              <th>Assessment</th>
              <th>Reasons</th>
            </tr>
          </thead>
          <tbody>
            {TECHNICAL_FACTORS.map((factor) => (
              <tr key={factor}>
                <th scope="row">{capital(FACTOR_WORDS[factor])}</th>
                <td className="planning-factors-short">
                  <CellText
                    label={`Assessment of ${FACTOR_WORDS[factor]}`}
                    value={fa.technical[factor].assessment}
                    placeholder="No assessment yet"
                    onCommit={(assessment) => dispatch({ type: 'updateFeasibility', technical: { [factor]: { assessment } } })}
                  />
                </td>
                <td>
                  <CellText
                    label={`Reasons for the assessment of ${FACTOR_WORDS[factor]}`}
                    value={fa.technical[factor].reasons}
                    rows={2}
                    placeholder="No reasons yet"
                    onCommit={(reasons) => dispatch({ type: 'updateFeasibility', technical: { [factor]: { reasons } } })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="planning-section">
        <h2 className="section-heading planning-heading">
          Organizational feasibility
          <FindingMarks findings={part('organizational')} counts={false} />
        </h2>
        <table className="table planning-factors">
          <thead>
            <tr>
              <th>Factor</th>
              <th>Assessment</th>
            </tr>
          </thead>
          <tbody>
            {ORGANIZATIONAL_FACTORS.map((factor) => (
              <tr key={factor}>
                <th scope="row">{capital(FACTOR_WORDS[factor])}</th>
                <td>
                  <CellText
                    label={`Assessment of ${FACTOR_WORDS[factor]}`}
                    value={fa.organizational[factor]}
                    rows={2}
                    placeholder="No assessment yet"
                    onCommit={(text) => dispatch({ type: 'updateFeasibility', organizational: { [factor]: text } })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

// ---- The cash flow table ----

/** Up and Down arrows move between the amounts of one column, as in a spreadsheet. */
function moveInColumn(event: KeyboardEvent<HTMLTableElement>) {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
  const input = event.target as HTMLElement;
  const cell = input.closest('td[data-col]');
  if (!cell || input.tagName !== 'INPUT') return;
  const inputs = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>(`td[data-col="${cell.getAttribute('data-col')}"] input`));
  const next = inputs[inputs.indexOf(input as HTMLInputElement) + (event.key === 'ArrowUp' ? -1 : 1)];
  if (!next) return;
  event.preventDefault();
  next.focus();
  next.select();
}

interface LineOptionsProps {
  line: CashLine;
  section: CashSection;
  one: string;
  n: number;
  amounts: number[];
  sr: SystemRequest | undefined;
  set: (line: CashLine) => void;
}

/** The row under a line: the quantity, unit amount and growth rate, and for a benefit the value it comes from. */
function LineOptions({ line, section, one, n, amounts, sr, set }: LineOptionsProps) {
  const worked = isQuantityLine(line);
  const half = !worked && (line.quantity !== null || line.unitAmount !== null);
  const values = sr?.businessValue ?? [];
  const choices = values.flatMap((value, index) =>
    value.tangible || line.valueIndex === index
      ? [{ value: String(index), label: `Value ${index + 1}: ${value.text || 'not described yet'}${value.amount === null ? '' : ` (${money(value.amount)})`}` }]
      : [],
  );
  return (
    <div className="planning-options">
      <div className="planning-options-row">
        <NumberField label="Quantity" size={7} value={line.quantity} placeholder="None" onCommit={(quantity) => set({ ...line, quantity })} />
        <span className="planning-options-sign" aria-hidden="true">
          ×
        </span>
        <NumberField label="Amount for each unit" unit="money" size={8} value={line.unitAmount} placeholder="None" onCommit={(unitAmount) => set({ ...line, unitAmount })} />
        {section !== 'developmentCosts' && (
          <NumberField label="Growth each year" unit="percent" size={5} value={line.growthRate} placeholder="0" onCommit={(growthRate) => set({ ...line, growthRate })} />
        )}
        {worked && (
          <Button
            small
            aria-label={`Type the amounts of ${one} ${n} myself`}
            onClick={() => set({ ...line, amounts, quantity: null, unitAmount: null, growthRate: null })}
          >
            Type the amounts myself
          </Button>
        )}
      </div>
      <p className="muted planning-note">
        {worked
          ? section === 'developmentCosts'
            ? 'The tool fills this line in: the quantity multiplied by the amount for each unit, in year 0.'
            : 'The tool fills this line in: year 1 is the quantity multiplied by the amount for each unit, and each later year grows by the rate.'
          : half
            ? 'Type both a quantity and an amount for each unit, and the tool fills the line in.'
            : 'To have the tool fill the line in, give a quantity and an amount for each unit, such as hours and an hourly rate. Leave them empty to type the amounts.'}
      </p>
      {section === 'benefits' && (
        <div className="planning-options-row">
          {choices.length === 0 ? (
            <p className="muted planning-note">
              The system request has no tangible value for this benefit to come from. <Link className="btn-link" to="/system-request">Open the system request</Link>
            </p>
          ) : (
            <>
              <SelectField
                label="Comes from this value of the system request"
                value={line.valueIndex === null ? '' : String(line.valueIndex)}
                options={[{ value: '', label: 'Not linked' }, ...choices]}
                onChange={(choice) => set({ ...line, valueIndex: choice === '' ? null : Number(choice) })}
              />
              {line.valueIndex !== null && (
                <Link className="btn-link planning-options-link" to="/system-request" state={{ value: line.valueIndex }}>
                  Open it in the system request
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CashTable({ ec, sr, findings }: { ec: Economic; sr: SystemRequest | undefined; findings: Finding[] }) {
  const flow = useMemo(() => cashFlow(ec), [ec]);
  // Which lines have their options row open. A line that uses an option starts open.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const columns = ec.years + 1;
  const span = columns + 3;

  const figures = (label: string, values: number[], total: number | null, className = '') => (
    <tr className={`planning-grid-sum ${className}`}>
      <th scope="row">{label}</th>
      {values.map((v, i) => (
        <td key={i} className="is-numeric">
          {money(Math.round(v * 100) / 100)}
        </td>
      ))}
      <td className="is-numeric">{total === null ? '' : money(Math.round(total * 100) / 100)}</td>
      <td />
    </tr>
  );
  const presentValues = (label: string, values: number[], total: number | null) =>
    ec.rate === null ? (
      <tr className="planning-grid-sum">
        <th scope="row">{label}</th>
        <td colSpan={columns + 2}>
          <Missing>Needs the required rate of return</Missing>
        </td>
      </tr>
    ) : (
      figures(label, values.map(Math.round), total === null ? null : Math.round(total))
    );

  return (
    <div className="planning-grid-wrap">
      <table className="table planning-grid" aria-label="Cash flow table" onKeyDown={moveInColumn}>
        <thead>
          <tr>
            <th>Line</th>
            {flow.yearLabels.map((year, i) => (
              <th key={i} className="is-numeric">
                Year {i}
                <br />
                {year}
              </th>
            ))}
            <th className="is-numeric">Total</th>
            <th>
              <span className="visually-hidden">Options, move or remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {SECTIONS.map(({ key: section, title, one, total }) => {
            const lines = ec[section];
            const setLines = (next: CashLine[]) => {
              setEconomic({ [section]: next });
            };
            const reorder = (next: CashLine[]) => {
              setOpen({});
              setLines(next);
            };
            return (
              <Fragment key={section}>
                <tr className="planning-grid-section">
                  <th colSpan={span} scope="colgroup">
                    <span className="hstack">
                      {title}
                      <Button small onClick={() => setLines([...lines, { name: '', amounts: [], quantity: null, unitAmount: null, growthRate: null, valueIndex: null }])}>
                        Add {one === 'operational cost' ? 'an' : 'a'} {one}
                      </Button>
                    </span>
                  </th>
                </tr>
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={span}>
                      <Missing>No {title.toLowerCase()} yet</Missing>
                    </td>
                  </tr>
                )}
                {lines.map((line, index) => {
                  const id = `${section}:${index}`;
                  const n = index + 1;
                  const worked = isQuantityLine(line);
                  const amounts = flow.lines[section][index];
                  const set = (next: CashLine) => setLines(lines.map((l, i) => (i === index ? next : l)));
                  const isOpen = open[id] ?? (worked || line.quantity !== null || line.unitAmount !== null || line.valueIndex !== null);
                  const what = line.name || `${one} ${n}`;
                  const move = (by: number) => {
                    const next = [...lines];
                    next.splice(index + by, 0, ...next.splice(index, 1));
                    reorder(next);
                  };
                  return (
                    <Fragment key={id}>
                      <tr className={isOpen ? 'planning-grid-line is-open' : 'planning-grid-line'} id={section === 'benefits' ? `planning-benefit-${index}` : undefined} tabIndex={-1}>
                        <th scope="row" className="planning-grid-name">
                          <span className="hstack">
                            <CellText label={`Name of ${one} ${n}`} value={line.name} placeholder="No name yet" onCommit={(name) => set({ ...line, name })} />
                            {section === 'benefits' && <FindingMarks findings={findings.filter((f) => f.ruleId === 'FA-05' && f.values.index === index)} counts={false} />}
                          </span>
                        </th>
                        {amounts.map((amount, year) => (
                          <td key={year} className="is-numeric" data-col={year}>
                            {worked ? (
                              <span className="planning-worked" title="Worked out by the tool">
                                {money(Math.round(amount * 100) / 100)}
                              </span>
                            ) : (
                              <NumberField
                                hideLabel
                                label={`${what}, year ${year}`}
                                unit="money"
                                size={8}
                                value={line.amounts[year] ?? null}
                                placeholder="0"
                                onCommit={(value) => set({ ...line, amounts: Array.from({ length: columns }, (_, i) => (i === year ? value : (line.amounts[i] ?? null))) })}
                              />
                            )}
                          </td>
                        ))}
                        <td className="is-numeric planning-grid-total">{money(Math.round(sum(amounts) * 100) / 100)}</td>
                        <td className="editable-rows-controls">
                          <Button small variant="link" aria-expanded={isOpen} aria-label={`Options of ${what}`} onClick={() => setOpen({ ...open, [id]: !isOpen })}>
                            Options
                          </Button>
                          <Button small variant="link" disabled={index === 0} aria-label={`Move ${what} up`} onClick={() => move(-1)}>
                            Up
                          </Button>
                          <Button small variant="link" disabled={index === lines.length - 1} aria-label={`Move ${what} down`} onClick={() => move(1)}>
                            Down
                          </Button>
                          <Button small variant="link" aria-label={`Remove ${what}`} onClick={() => reorder(lines.filter((_, i) => i !== index))}>
                            Remove
                          </Button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="planning-grid-options">
                          <td colSpan={span}>
                            <LineOptions line={line} section={section} one={one} n={n} amounts={amounts} sr={sr} set={set} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {figures(total, flow[section], flow.totals[section])}
              </Fragment>
            );
          })}
        </tbody>
        <tbody>
          <tr className="planning-grid-section">
            <th colSpan={span} scope="colgroup">
              Worked out by the tool
            </th>
          </tr>
          {figures('Total costs', flow.costs, flow.totals.costs)}
          {figures('Net benefit (total benefits less total costs)', flow.net, flow.totals.net)}
          {figures('Cumulative net cash flow', flow.cumulative, null)}
          {presentValues('Present value of total benefits', flow.pvBenefits, flow.totals.pvBenefits)}
          {presentValues('Present value of total costs', flow.pvCosts, flow.totals.pvCosts)}
        </tbody>
      </table>
    </div>
  );
}

// ---- The three measures the student types ----

const MEASURES: { key: Measure; label: string; unit: 'percent' | 'plain' | 'money'; suffix?: string; help: string }[] = [
  { key: 'roi', label: 'Return on investment', unit: 'percent', help: 'Total benefits less total costs, divided by total costs.' },
  { key: 'breakEven', label: 'Break-even point', unit: 'plain', suffix: 'years', help: 'When the cumulative net cash flow turns positive, to two decimal places.' },
  { key: 'npv', label: 'Net present value', unit: 'money', help: 'The present value of total benefits less the present value of total costs.' },
];

function Measures({ ec }: { ec: Economic }) {
  const checks = useMemo(() => checkMeasures(ec), [ec]);
  const visible = useFindingsVisible();
  const [shown, setShown] = useState<Partial<Record<Measure, boolean>>>({});
  return (
    <div className="planning-measures">
      {MEASURES.map(({ key, label, unit, suffix, help }) => {
        const isShown = visible && !!shown[key];
        return (
          <div key={key} className="planning-measure">
            <CheckedFigure label={label} unit={unit} suffix={suffix} value={ec[key]} status={checks[key].status} placeholder="Not typed" onCommit={(value) => setEconomic({ [key]: value })} />
            <p className="muted planning-note">{help}</p>
            {visible && (
              <Button small variant="link" aria-expanded={isShown} onClick={() => setShown({ ...shown, [key]: !isShown })}>
                {isShown ? 'Hide the working' : 'Show the working'}
              </Button>
            )}
            {isShown && (
              <ol className="planning-working">
                {checks[key].working.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Economics({ ec, sr, findings }: { ec: Economic; sr: SystemRequest | undefined; findings: Finding[] }) {
  // A refused figure, such as 12 years, leaves its text in the box. Drawing the box again puts the saved figure back.
  const [refused, setRefused] = useState(0);
  const guarded = (patch: EconomicPatch) => {
    if (!setEconomic(patch).ok) setRefused(refused + 1);
  };
  return (
    <section className="planning-section">
      <h2 className="section-heading planning-heading">Economic feasibility</h2>
      <div className="planning-settings" key={refused}>
        <NumberField label="Calendar year of year 0" size={6} value={ec.firstYear} onCommit={(firstYear) => guarded({ firstYear: firstYear ?? ec.firstYear })} />
        <NumberField
          label="Years after year 0"
          size={4}
          value={ec.years}
          hint="From 1 to 10. Fewer years cuts the last columns off."
          onCommit={(years) => guarded({ years: years ?? ec.years })}
        />
        <NumberField label="Required rate of return" unit="percent" size={5} value={ec.rate} placeholder="None" onCommit={(rate) => guarded({ rate })} />
      </div>

      <div className="table-caption">Cash flow table</div>
      <CashTable ec={ec} sr={sr} findings={findings} />

      <div className="table-caption planning-gap">Your results</div>
      <p className="muted planning-note">Work each one out from the table and type it. The tool says whether it matches, and shows the working only when you ask.</p>
      <Measures ec={ec} />

      <div className="table-caption planning-gap">Intangible costs and benefits</div>
      <p className="muted planning-note">Listed, not added up.</p>
      <EditableRows<string>
        label="Intangible costs and benefits"
        rows={ec.intangibles}
        hideHeadings
        emptyText="No intangible costs or benefits yet"
        addLabel="Add an intangible"
        newRow={() => ''}
        onChange={(intangibles) => setEconomic({ intangibles })}
        columns={[
          {
            key: 'text',
            heading: 'Intangible',
            render: (row, i, set) => <CellText label={`Intangible ${i + 1}`} value={row} placeholder="Nothing written yet" onCommit={set} />,
          },
        ]}
      />
    </section>
  );
}

export function FeasibilityScreen() {
  const model = useModel();
  const findings = useAreaFindings('feasibility');
  const fa = feasibility(model);
  const sr = systemRequest(model);
  useArrival('benefit', 'planning-benefit-');

  return (
    <>
      <WorkArea>
        <PageHeader breadcrumb={['Planning']} title="Feasibility analysis">
          <UndoRedo />
        </PageHeader>
        <div className="work-body scroll pad">
          {!fa ? (
            <StartHere action="Start the feasibility analysis" onStart={() => dispatch({ type: 'updateFeasibility' })}>
              This project has no feasibility analysis yet. It weighs the technical, organizational and economic risks, and the cash flow table can be used alone.
            </StartHere>
          ) : (
            <div className="planning-form planning-form-wide">
              <Factors fa={fa} findings={findings} />
              <Economics ec={fa.economic} sr={sr} findings={findings} />
            </div>
          )}
        </div>
      </WorkArea>
      <RightPanel label="Problems">
        <h2 className="panel-heading">Problems</h2>
        {fa ? <ProblemList findings={findings} emptyText="No problems in the feasibility analysis." /> : <p className="muted">Nothing is checked until the feasibility analysis is started.</p>}
      </RightPanel>
    </>
  );
}
