// The system request: SPEC 10.1. Route: /system-request

import { Link } from 'react-router';
import { Button, CellText, CheckedFigure, EditableRows, FindingMarks, Missing, NumberField, ProblemList, Switch, type FigureStatus } from '../../components';
import { PageHeader, RightPanel, UndoRedo, WorkArea } from '../../frame';
import {
  expectedValue,
  feasibility,
  formatNumber,
  probabilityTotal,
  systemRequest,
  type BusinessValue,
  type SystemRequestPatch,
  type ValueEstimate,
} from '../../model';
import type { Finding } from '../../rules';
import { dispatch, useAreaFindings, useModel } from '../../store';
import { DraftText, StartHere, money, useArrival } from './shared';
import './planning.css';

function update(patch: SystemRequestPatch) {
  dispatch({ type: 'updateSystemRequest', patch });
}

/** The findings that say one field is empty (SR-01 names the field in words). */
function emptyField(findings: Finding[], field: string): Finding[] {
  return findings.filter((f) => f.ruleId === 'SR-01' && f.values.field === field);
}

function Heading({ children, findings }: { children: string; findings: Finding[] }) {
  return (
    <h2 className="section-heading planning-heading">
      {children}
      <FindingMarks findings={findings} counts={false} />
    </h2>
  );
}

interface ValueCardProps {
  value: BusinessValue;
  index: number;
  findings: Finding[];
  /** The benefits of the cash flow table that point at this value. */
  usedBy: { index: number; name: string }[];
  onChange: (value: BusinessValue) => void;
  onRemove: () => void;
}

function ValueCard({ value, index, findings, usedBy, onChange, onRemove }: ValueCardProps) {
  const n = index + 1;
  const hasEstimates = value.estimates.length > 0;
  const expected = expectedValue(value.estimates);
  const total = probabilityTotal(value.estimates);
  const status: FigureStatus = value.amount === null ? 'empty' : Math.abs(value.amount - expected) <= 1 + 1e-9 ? 'match' : 'mismatch';
  const setEstimates = (estimates: ValueEstimate[]) => onChange({ ...value, estimates });

  return (
    <div className="planning-value" id={`planning-value-${index}`} tabIndex={-1} role="group" aria-label={`Value ${n}`}>
      <div className="planning-value-top">
        <span className="mono muted">Value {n}</span>
        <FindingMarks findings={findings} />
        <span className="grow" />
        <Switch
          small
          label={`Whether value ${n} is tangible`}
          value={value.tangible ? 'tangible' : 'intangible'}
          options={[
            { value: 'tangible', label: 'Tangible' },
            { value: 'intangible', label: 'Intangible' },
          ]}
          onChange={(kind) => {
            if ((kind === 'tangible') === value.tangible) return;
            // An amount belongs to tangible value only, so an intangible value keeps neither.
            onChange(kind === 'tangible' ? { ...value, tangible: true } : { ...value, tangible: false, amount: null, estimates: [] });
          }}
        />
        <Button small variant="link" aria-label={`Remove value ${n}`} onClick={onRemove}>
          Remove
        </Button>
      </div>

      <CellText label={`What value ${n} is`} value={value.text} rows={2} placeholder="No value described yet" onCommit={(text) => onChange({ ...value, text })} />

      {!value.tangible ? (
        <p className="muted planning-note">An intangible value is described, not counted. It has no amount.</p>
      ) : !hasEstimates ? (
        <div className="planning-amount">
          <NumberField label="Amount each year" unit="money" value={value.amount} placeholder="No amount yet" onCommit={(amount) => onChange({ ...value, amount })} />
          <Button
            small
            onClick={() =>
              setEstimates([
                { label: 'Low', amount: null, probability: null },
                { label: 'Likely', amount: null, probability: null },
                { label: 'High', amount: null, probability: null },
              ])
            }
          >
            Work it out from estimates
          </Button>
        </div>
      ) : (
        <>
          <div className="table-caption">Estimates</div>
          <EditableRows<ValueEstimate>
            label={`Estimates of value ${n}`}
            rows={value.estimates}
            onChange={setEstimates}
            newRow={() => ({ label: '', amount: null, probability: null })}
            addLabel="Add an estimate"
            columns={[
              {
                key: 'label',
                heading: 'Estimate',
                render: (row, i, set) => <CellText label={`Name of estimate ${i + 1}`} value={row.label} placeholder="No name yet" onCommit={(label) => set({ ...row, label })} />,
              },
              {
                key: 'amount',
                heading: 'Amount',
                numeric: true,
                width: '9rem',
                render: (row, i, set) => (
                  <NumberField hideLabel label={`Amount of estimate ${i + 1}`} unit="money" size={9} value={row.amount} placeholder="None" onCommit={(amount) => set({ ...row, amount })} />
                ),
              },
              {
                key: 'probability',
                heading: 'Probability',
                numeric: true,
                width: '8rem',
                render: (row, i, set) => (
                  <NumberField
                    hideLabel
                    label={`Probability of estimate ${i + 1}`}
                    unit="percent"
                    size={4}
                    value={row.probability}
                    placeholder="None"
                    onCommit={(probability) => set({ ...row, probability })}
                  />
                ),
              },
              {
                key: 'weighted',
                heading: 'Amount × probability',
                numeric: true,
                width: '10rem',
                render: (row) =>
                  row.amount === null || row.probability === null ? <Missing>Not yet</Missing> : <span className="planning-worked">{money((row.amount * row.probability) / 100)}</span>,
              },
            ]}
            footer={
              <tr>
                <td>Total</td>
                <td />
                <td className="is-numeric">{formatNumber(total, total % 1 ? 1 : 0)}%</td>
                <td className="is-numeric">{money(expected)}</td>
                <td />
              </tr>
            }
          />
          <div className="planning-amount">
            <CheckedFigure
              label="Amount each year (the expected value)"
              unit="money"
              value={value.amount}
              status={status}
              note={status === 'match' ? 'Matches the expected value' : status === 'mismatch' ? 'Does not match the expected value' : undefined}
              onCommit={(amount) => onChange({ ...value, amount })}
            />
            <div className="planning-expected">
              <span className="field-label">Expected value of the estimates</span>
              <span className="mono">{money(expected)}</span>
            </div>
            <Button small variant="link" onClick={() => setEstimates([])}>
              Remove the estimates
            </Button>
          </div>
        </>
      )}

      {usedBy.map((benefit) => (
        <p key={benefit.index} className="planning-note">
          Used by the benefit {benefit.name ? `“${benefit.name}”` : `number ${benefit.index + 1}`} in the cash flow table.{' '}
          <Link className="btn-link" to="/feasibility" state={{ benefit: benefit.index }}>
            Open it in the feasibility analysis
          </Link>
        </p>
      ))}
    </div>
  );
}

export function SystemRequestScreen() {
  const model = useModel();
  const findings = useAreaFindings('systemRequest');
  const sr = systemRequest(model);
  const fa = feasibility(model);
  useArrival('value', 'planning-value-');

  const setValues = (businessValue: BusinessValue[]) => update({ businessValue });

  const removeValue = (index: number) => {
    if (!sr) return;
    // The benefits point at a value by its place in the list. The shared command only
    // clears a pointer that falls off the end, so move the pointers here first.
    const benefits = fa?.economic.benefits ?? [];
    if (benefits.some((line) => line.valueIndex !== null && line.valueIndex >= index))
      dispatch({
        type: 'updateFeasibility',
        economic: {
          benefits: benefits.map((line) => ({
            ...line,
            valueIndex: line.valueIndex === null || line.valueIndex === index ? null : line.valueIndex > index ? line.valueIndex - 1 : line.valueIndex,
          })),
        },
      });
    setValues(sr.businessValue.filter((_, i) => i !== index));
  };

  return (
    <>
      <WorkArea>
        <PageHeader breadcrumb={['Planning']} title="System request">
          <UndoRedo />
        </PageHeader>
        <div className="work-body scroll pad">
          {!sr ? (
            <StartHere action="Start the system request" onStart={() => update({})}>
              This project has no system request yet. It says who wants the system, why, what it must do and what it is worth.
            </StartHere>
          ) : (
            <div className="planning-form">
              <section className="planning-section">
                <Heading findings={emptyField(findings, 'project sponsor')}>Project sponsor</Heading>
                <DraftText label="Project sponsor" value={sr.sponsor} placeholder="No sponsor yet" onCommit={(sponsor) => update({ sponsor })} />
              </section>

              <section className="planning-section">
                <Heading findings={emptyField(findings, 'business need')}>Business need</Heading>
                <DraftText label="Business need" value={sr.businessNeed} rows={4} placeholder="No business need yet: the reason the business wants the system" onCommit={(businessNeed) => update({ businessNeed })} />
              </section>

              <section className="planning-section">
                <Heading findings={emptyField(findings, 'business requirements')}>Business requirements</Heading>
                <EditableRows<string>
                  label="Business requirements"
                  rows={sr.businessRequirements}
                  hideHeadings
                  emptyText="No business requirements yet"
                  addLabel="Add a requirement"
                  newRow={() => ''}
                  onChange={(businessRequirements) => update({ businessRequirements })}
                  columns={[
                    {
                      key: 'text',
                      heading: 'Requirement',
                      render: (row, i, set) => <CellText label={`Business requirement ${i + 1}`} value={row} placeholder="No requirement written yet" onCommit={set} />,
                    },
                  ]}
                />
              </section>

              <section className="planning-section">
                <Heading findings={emptyField(findings, 'business value')}>Business value</Heading>
                {sr.businessValue.length === 0 && (
                  <p>
                    <Missing>No business value yet</Missing>
                  </p>
                )}
                {sr.businessValue.map((value, index) => (
                  <ValueCard
                    key={index}
                    value={value}
                    index={index}
                    findings={findings.filter((f) => f.values.index === index)}
                    usedBy={(fa?.economic.benefits ?? []).flatMap((line, i) => (line.valueIndex === index ? [{ index: i, name: line.name }] : []))}
                    onChange={(next) => setValues(sr.businessValue.map((v, i) => (i === index ? next : v)))}
                    onRemove={() => removeValue(index)}
                  />
                ))}
                <div className="hstack">
                  <Button small onClick={() => setValues([...sr.businessValue, { text: '', tangible: true, amount: null, estimates: [] }])}>
                    Add a tangible value
                  </Button>
                  <Button small onClick={() => setValues([...sr.businessValue, { text: '', tangible: false, amount: null, estimates: [] }])}>
                    Add an intangible value
                  </Button>
                </div>
              </section>

              <section className="planning-section">
                <Heading findings={emptyField(findings, 'special issues or constraints')}>Special issues or constraints</Heading>
                <DraftText label="Special issues or constraints" value={sr.specialIssues} rows={3} placeholder="No special issues yet" onCommit={(specialIssues) => update({ specialIssues })} />
              </section>
            </div>
          )}
        </div>
      </WorkArea>
      <RightPanel label="Problems">
        <h2 className="panel-heading">Problems</h2>
        {sr ? <ProblemList findings={findings} emptyText="No problems in the system request." openFirst /> : <p className="muted">Nothing is checked until the system request is started.</p>}
      </RightPanel>
    </>
  );
}
