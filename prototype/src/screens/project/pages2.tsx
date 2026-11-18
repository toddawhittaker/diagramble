// The page layouts of the second release for the export preview: the forms, the
// interface structure diagram, the binder, the structure chart, the program
// specifications, the physical data model and the storage size estimate.

import { Fragment, type ReactNode } from 'react';
import { Missing } from '../../components';
import {
  all,
  cashFlow,
  conversionEffects,
  couplesOf,
  coupleLabel,
  elementLabel,
  FACTOR_WORDS,
  feasibility,
  formatNumber,
  formatPercent,
  get,
  interfacesOn,
  isQuantityLine,
  isSystemRelated,
  matrixScores,
  moduleNumber,
  modulesOf,
  ORGANIZATIONAL_FACTORS,
  originalModule,
  parentEnd,
  programIo,
  requirementsOutline,
  storageEstimate,
  systemRequest,
  tableFields,
  TECHNICAL_FACTORS,
  testsInOrder,
  type BinderSection,
  type CashLine,
  type CashSection,
  type Id,
  type IoRow,
  type Model,
  type Module,
  type NumberedRequirement,
  type Requirement,
  type Test,
} from '../../model';
import { interfaceProcesses, StaticIsd, StaticStructureChart } from './drawings2';
import { capital, Page } from './pages';

/** A number with its thousands grouped, and two decimal places only when it has a fraction. */
function figure(n: number): string {
  return formatNumber(n, Number.isInteger(n) ? 0 : 2);
}

/** Typed text with its line breaks kept, or the "missing" mark when it is empty. */
function Text({ text, missing, mono }: { text: string; missing: string; mono?: boolean }) {
  if (!text.trim()) return <Missing>{missing}</Missing>;
  return <div className={mono ? 'project-text project-text-mono' : 'project-text'}>{text}</div>;
}

function Nothing({ children }: { children: ReactNode }) {
  return <p className="muted">{children}</p>;
}

// ---- The system request (section 10.1) ----

export function SystemRequestPage({ model }: { model: Model }) {
  const request = systemRequest(model);
  if (!request) {
    return (
      <Page title="System request">
        <Nothing>The project has no system request yet.</Nothing>
      </Page>
    );
  }
  return (
    <Page title="System request">
      <table className="table project-form">
        <tbody>
          <tr>
            <th>Project sponsor</th>
            <td>
              <Text text={request.sponsor} missing="No sponsor yet" />
            </td>
          </tr>
          <tr>
            <th>Business need</th>
            <td>
              <Text text={request.businessNeed} missing="No business need yet" />
            </td>
          </tr>
          <tr>
            <th>Business requirements</th>
            <td>
              {request.businessRequirements.length ? (
                <ol className="project-steps">
                  {request.businessRequirements.map((text, i) => (
                    <li key={i}>{text}</li>
                  ))}
                </ol>
              ) : (
                <Missing>No business requirements yet</Missing>
              )}
            </td>
          </tr>
          <tr>
            <th>Business value</th>
            <td>
              {request.businessValue.length ? (
                <ul className="project-plain-list project-spaced-list">
                  {request.businessValue.map((value, i) => (
                    <li key={i}>
                      {value.text || <Missing>No description yet</Missing>}{' '}
                      <span className="muted">
                        ({value.tangible ? 'tangible' : 'intangible'}
                        {value.tangible && value.amount !== null && `: ${figure(value.amount)}`})
                      </span>
                      {value.estimates.length > 0 && (
                        <table className="table project-inner-table">
                          <thead>
                            <tr>
                              <th>Estimate</th>
                              <th className="is-numeric">Amount</th>
                              <th className="is-numeric">Probability</th>
                            </tr>
                          </thead>
                          <tbody>
                            {value.estimates.map((estimate, j) => (
                              <tr key={j}>
                                <td>{estimate.label || <Missing>No label yet</Missing>}</td>
                                <td className="is-numeric">{estimate.amount === null ? '' : figure(estimate.amount)}</td>
                                <td className="is-numeric">{estimate.probability === null ? '' : formatPercent(estimate.probability, 0)}</td>
                              </tr>
                            ))}
                            <tr>
                              <td>Expected value, as typed</td>
                              <td className="is-numeric">
                                {value.amount === null ? <Missing>Not typed yet</Missing> : figure(value.amount)}
                              </td>
                              <td />
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <Missing>No business value yet</Missing>
              )}
            </td>
          </tr>
          <tr>
            <th>Special issues or constraints</th>
            <td>
              <Text text={request.specialIssues} missing="No special issues yet" />
            </td>
          </tr>
        </tbody>
      </table>
    </Page>
  );
}

// ---- The feasibility analysis (section 10.2) ----

const SECTION_WORDS: Record<CashSection, string> = {
  benefits: 'Benefits',
  developmentCosts: 'Development costs',
  operationalCosts: 'Operational costs',
};

/** How a line given as a quantity and a unit amount was worked out, such as "450 at 20, growing 5% a year". */
function lineBasis(line: CashLine): string {
  if (!isQuantityLine(line) || line.quantity === null || line.unitAmount === null) return '';
  const growth = line.growthRate ? `, growing ${formatPercent(line.growthRate, Number.isInteger(line.growthRate) ? 0 : 1)} a year` : '';
  return `${figure(line.quantity)} at ${figure(line.unitAmount)}${growth}`;
}

export function FeasibilityPage({ model }: { model: Model }) {
  const analysis = feasibility(model);
  if (!analysis) {
    return (
      <Page title="Feasibility analysis">
        <Nothing>The project has no feasibility analysis yet.</Nothing>
      </Page>
    );
  }
  const economic = analysis.economic;
  const flow = cashFlow(economic);
  const columns = flow.yearLabels.length;
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  // Present values are shown to the nearest whole unit of money.
  const round = (n: number | null) => (n === null ? null : Math.round(n));
  const cells = (values: number[]) =>
    Array.from({ length: columns }, (_, i) => (
      <td key={i} className="is-numeric">
        {values[i] === undefined ? '' : figure(Math.round(values[i] * 100) / 100)}
      </td>
    ));
  const totalRow = (label: string, values: number[], total: number | null) => (
    <tr className="project-total-row">
      <td>{label}</td>
      {cells(values)}
      <td className="is-numeric">{total === null ? '' : figure(Math.round(total * 100) / 100)}</td>
    </tr>
  );
  const section = (key: CashSection) => (
    <>
      <tr className="project-band-row">
        <td colSpan={columns + 2}>{SECTION_WORDS[key]}</td>
      </tr>
      {economic[key].length === 0 && (
        <tr>
          <td colSpan={columns + 2}>
            <Missing>No lines yet</Missing>
          </td>
        </tr>
      )}
      {economic[key].map((line, i) => {
        const amounts = flow.lines[key][i] ?? [];
        return (
          <tr key={i}>
            <td>
              {line.name || <Missing>No name yet</Missing>}
              {lineBasis(line) && <div className="muted">{lineBasis(line)}</div>}
            </td>
            {cells(amounts)}
            <td className="is-numeric">{figure(Math.round(sum(amounts) * 100) / 100)}</td>
          </tr>
        );
      })}
      {totalRow(`Total ${SECTION_WORDS[key].toLowerCase()}`, flow[key], flow.totals[key])}
    </>
  );
  const technicalEmpty = TECHNICAL_FACTORS.every((f) => !analysis.technical[f].assessment.trim() && !analysis.technical[f].reasons.trim());
  const organizationalEmpty = ORGANIZATIONAL_FACTORS.every((f) => !analysis.organizational[f].trim());
  const hasLines = economic.benefits.length + economic.developmentCosts.length + economic.operationalCosts.length > 0;

  return (
    <Page title="Feasibility analysis">
      {technicalEmpty && organizationalEmpty ? (
        <Nothing>The technical and organizational parts are empty. This analysis holds the economic part alone.</Nothing>
      ) : (
        <>
          <div className="table-caption project-caption">Technical feasibility</div>
          <table className="table">
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
                  <td>{capital(FACTOR_WORDS[factor])}</td>
                  <td>
                    <Text text={analysis.technical[factor].assessment} missing="No assessment yet" />
                  </td>
                  <td>
                    <Text text={analysis.technical[factor].reasons} missing="No reasons yet" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-caption project-caption">Organizational feasibility</div>
          <table className="table">
            <thead>
              <tr>
                <th>Factor</th>
                <th>Assessment</th>
              </tr>
            </thead>
            <tbody>
              {ORGANIZATIONAL_FACTORS.map((factor) => (
                <tr key={factor}>
                  <td>{capital(FACTOR_WORDS[factor])}</td>
                  <td>
                    <Text text={analysis.organizational[factor]} missing="No assessment yet" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="table-caption project-caption">Economic feasibility: cash flow</div>
      {!hasLines ? (
        <Nothing>The cash flow table has no lines yet.</Nothing>
      ) : (
        <table className="table project-cash">
          <thead>
            <tr>
              <th />
              {flow.yearLabels.map((year, i) => (
                <th key={i} className="is-numeric">
                  Year {i}
                  <div>{year}</div>
                </th>
              ))}
              <th className="is-numeric">Total</th>
            </tr>
          </thead>
          <tbody>
            {section('benefits')}
            {section('developmentCosts')}
            {section('operationalCosts')}
            <tr className="project-band-row">
              <td colSpan={columns + 2}>Totals</td>
            </tr>
            {totalRow('Total costs', flow.costs, flow.totals.costs)}
            {totalRow('Net benefit', flow.net, flow.totals.net)}
            {totalRow('Cumulative net cash flow', flow.cumulative, null)}
            {flow.pvBenefits.length > 0 && totalRow('Present value of total benefits', flow.pvBenefits.map(Math.round), round(flow.totals.pvBenefits))}
            {flow.pvCosts.length > 0 && totalRow('Present value of total costs', flow.pvCosts.map(Math.round), round(flow.totals.pvCosts))}
          </tbody>
        </table>
      )}
      <p className="muted project-caption">
        The totals, the net benefit, the cumulative figure and the present values are worked out from the lines. The three
        measures below are the ones typed into the form.
      </p>

      <div className="table-caption project-caption">Measures</div>
      <table className="table project-form">
        <tbody>
          <tr>
            <th>Required rate of return</th>
            <td>{economic.rate === null ? <Missing>No rate yet</Missing> : formatPercent(economic.rate, Number.isInteger(economic.rate) ? 0 : 1)}</td>
          </tr>
          <tr>
            <th>Return on investment</th>
            <td>{economic.roi === null ? <Missing>Not typed yet</Missing> : formatPercent(economic.roi, 1)}</td>
          </tr>
          <tr>
            <th>Break-even point</th>
            <td>{economic.breakEven === null ? <Missing>Not typed yet</Missing> : `${formatNumber(economic.breakEven, 2)} years`}</td>
          </tr>
          <tr>
            <th>Net present value</th>
            <td>{economic.npv === null ? <Missing>Not typed yet</Missing> : figure(economic.npv)}</td>
          </tr>
          <tr>
            <th>Intangible costs and benefits</th>
            <td>
              {economic.intangibles.length ? (
                <ul className="project-plain-list">
                  {economic.intangibles.map((text, i) => (
                    <li key={i}>{text}</li>
                  ))}
                </ul>
              ) : (
                <span className="muted">None listed</span>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </Page>
  );
}

// ---- The requirements definition (section 10.3) ----

function priorityWords(priority: Requirement['priority']): string {
  if (priority === null) return '';
  return typeof priority === 'number' ? `Release ${priority}` : `${capital(priority)} priority`;
}

function RequirementLine({ model, item }: { model: Model; item: NumberedRequirement }) {
  const r = item.requirement;
  const extras = [
    r.functionalType ? capital(r.functionalType) : '',
    r.subtype ? capital(r.subtype) : '',
    priorityWords(r.priority),
    r.traceIds.length ? `Carried out by ${r.traceIds.map((id) => elementLabel(model, id)).join(', ')}` : '',
  ].filter(Boolean);
  return (
    <div className="project-outline-item">
      <span className="mono">{item.number}</span>
      <span>
        {r.name || <Missing>No sentence yet</Missing>}
        {extras.length > 0 && <div className="muted">{extras.join('. ')}.</div>}
      </span>
    </div>
  );
}

/** The four types of nonfunctional requirement, each stated even when it holds nothing. */
function NonfunctionalOutline({ model }: { model: Model }) {
  return (
    <>
      {requirementsOutline(model).nonfunctional.map((group) => (
        <div key={group.type} className="project-outline-group">
          <div className="project-outline-head">
            <span className="mono">{group.number}.</span> {capital(group.type)}
          </div>
          {group.requirements.map((item) => (
            <RequirementLine key={item.requirement.id} model={model} item={item} />
          ))}
          {group.requirements.length === 0 &&
            (group.noneExpected ? (
              <div className="project-outline-item">
                <span />
                <span>No special {group.type} requirements are expected.</span>
              </div>
            ) : (
              <div className="project-outline-item">
                <span />
                <Missing>None listed yet</Missing>
              </div>
            ))}
        </div>
      ))}
    </>
  );
}

export function RequirementsPage({ model }: { model: Model }) {
  const outline = requirementsOutline(model);
  const any = all(model, 'requirement').length > 0 || model.project.noneExpected.length > 0;
  let lastUserGroup = '';
  return (
    <Page title="Requirements definition">
      {!any ? (
        <Nothing>The project has no requirements yet.</Nothing>
      ) : (
        <>
          {outline.user.length > 0 && (
            <>
              <h3 className="project-page-subtitle">User requirements</h3>
              <div className="project-outline-group">
                {outline.user.map((item) => (
                  <RequirementLine key={item.requirement.id} model={model} item={item} />
                ))}
              </div>
            </>
          )}
          <h3 className="project-page-subtitle project-caption">Functional requirements</h3>
          {outline.functional.length === 0 && <Missing>None listed yet</Missing>}
          {outline.functional.map((group) => {
            const heading = group.userGroup && group.userGroup !== lastUserGroup ? group.userGroup : '';
            lastUserGroup = group.userGroup;
            return (
              <Fragment key={group.number}>
                {heading && <div className="project-outline-user">{heading}</div>}
                <div className="project-outline-group">
                  <div className="project-outline-head">
                    <span className="mono">{group.number}.</span> {group.name || <Missing>No group named</Missing>}
                  </div>
                  {group.requirements.map((item) => (
                    <RequirementLine key={item.requirement.id} model={model} item={item} />
                  ))}
                </div>
              </Fragment>
            );
          })}
          <h3 className="project-page-subtitle project-caption">Nonfunctional requirements</h3>
          <NonfunctionalOutline model={model} />
        </>
      )}
    </Page>
  );
}

/** The nonfunctional requirements alone, with their sub-types, as the architecture design prints them. */
export function NonfunctionalPage({ model }: { model: Model }) {
  return (
    <Page title="Nonfunctional requirements">
      <p className="muted project-caption">Taken from the requirements definition, with the sub-type of each requirement.</p>
      <NonfunctionalOutline model={model} />
    </Page>
  );
}

// ---- The alternative matrix (section 10.4) ----

const CRITERION_GROUPS = ['technical', 'economic', 'organizational'] as const;

export function MatrixPage({ model, matrixId, title }: { model: Model; matrixId: Id; title: string }) {
  const matrix = get(model, matrixId, 'alternativeMatrix');
  if (!matrix) return null;
  const scores = matrixScores(matrix);
  const columns = matrix.alternatives.length;
  return (
    <Page title={title}>
      {matrix.criteria.length === 0 || columns === 0 ? (
        <Nothing>The matrix needs at least one alternative and one criterion.</Nothing>
      ) : (
        <table className="table project-matrix">
          <thead>
            <tr>
              <th>Criterion</th>
              <th className="is-numeric">Weight</th>
              {matrix.alternatives.map((name, a) => (
                <th key={a}>{name || 'No name'}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CRITERION_GROUPS.map((group) => {
              const rows = matrix.criteria.map((criterion, c) => ({ criterion, c })).filter((row) => row.criterion.group === group);
              if (rows.length === 0) return null;
              return (
                <Fragment key={group}>
                  <tr className="project-band-row">
                    <td colSpan={columns + 2}>{capital(group)}</td>
                  </tr>
                  {rows.map(({ criterion, c }) => (
                    <tr key={c}>
                      <td>{criterion.name || <Missing>No name yet</Missing>}</td>
                      <td className="is-numeric">{criterion.weight === null ? '' : figure(criterion.weight)}</td>
                      {matrix.alternatives.map((_, a) => {
                        const cell = matrix.cells[c]?.[a];
                        const weighted = scores.weighted[c]?.[a] ?? null;
                        return (
                          <td key={a}>
                            <Text text={cell?.supportingInformation ?? ''} missing="No supporting information yet" />
                            <div className="mono muted project-matrix-score">
                              {cell?.score === null || cell?.score === undefined
                                ? 'No score yet'
                                : `Score ${cell.score}${weighted === null ? '' : `, weighted ${figure(weighted)}`}`}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            <tr className="project-total-row">
              <td>Total</td>
              <td className="is-numeric">{figure(scores.weightTotal)}</td>
              {matrix.alternatives.map((_, a) => (
                <td key={a} className="mono">
                  {figure(scores.totals[a] ?? 0)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      )}
      <div className="table-caption project-caption">Recommendation</div>
      <Text text={matrix.recommendation} missing="No recommendation yet" />
    </Page>
  );
}

/** The recommendation of each alternative matrix, which opens the system specification. */
export function AcquisitionPage({ model }: { model: Model }) {
  const matrices = all(model, 'alternativeMatrix');
  return (
    <Page title="Recommended acquisition strategy">
      {matrices.map((matrix) => (
        <div key={matrix.id} className="project-block">
          {matrices.length > 1 && <h3 className="project-page-subtitle">{matrix.name || 'Matrix with no title'}</h3>}
          <Text text={matrix.recommendation} missing="No recommendation yet" />
        </div>
      ))}
      <p className="muted project-caption">The reasons are set out in the alternative matrix that follows.</p>
    </Page>
  );
}

// ---- The test plan (section 10.5) ----

function TestBlock({ model, test }: { model: Model; test: Test }) {
  const program = test.programId ? elementLabel(model, test.programId) : test.programText;
  const requirement = test.requirementId ? elementLabel(model, test.requirementId) : test.requirementText;
  const row = (label: string, value: ReactNode) => (
    <tr>
      <th>{label}</th>
      <td>{value}</td>
    </tr>
  );
  return (
    <div className="project-block">
      <h3 className="project-page-subtitle">
        <span className="mono">T-{test.ordinal}</span> {test.name || <Missing>No title yet</Missing>}
      </h3>
      <table className="table project-form">
        <tbody>
          {row('Stage and type', `${capital(test.stage)}${test.testType ? `, ${test.testType}` : ''}`)}
          {row('Program', program ? `${program}${test.version ? `, version ${test.version}` : ''}` : <span className="muted">None named</span>)}
          {row('Tester', test.tester || <span className="muted">None named</span>)}
          {row('Designed', test.dateDesigned || <span className="muted">No date</span>)}
          {row('Conducted', test.dateConducted || <span className="muted">Not conducted yet</span>)}
          {row('Requirement addressed', requirement || <span className="muted">None named</span>)}
          {row('Objective', <Text text={test.objective} missing="No objective yet" />)}
          {row(
            'Test cases',
            test.testCases.length ? (
              <table className="table project-inner-table">
                <thead>
                  <tr>
                    <th>Interface</th>
                    <th>Data field</th>
                    <th>Value entered</th>
                  </tr>
                </thead>
                <tbody>
                  {test.testCases.map((c, i) => (
                    <tr key={i}>
                      <td>{c.interfaceId ? elementLabel(model, c.interfaceId) : c.interfaceText}</td>
                      <td>{c.dataField}</td>
                      <td>{c.valueEntered}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <span className="muted">None</span>
            ),
          )}
          {row('Script', test.script.trim() ? <Text text={test.script} missing="" /> : <span className="muted">None</span>)}
          {row('Expected results', <Text text={test.expectedResults} missing="No expected results yet" />)}
          {row('Actual results', test.actualResults.trim() ? <Text text={test.actualResults} missing="" /> : <span className="muted">None yet</span>)}
          {row('Result', test.result ? capital(test.result) : <span className="muted">Not recorded yet</span>)}
        </tbody>
      </table>
    </div>
  );
}

export function TestPlanPage({ model }: { model: Model }) {
  const tests = testsInOrder(model);
  return (
    <Page title="Test plan">
      {tests.length === 0 ? (
        <Nothing>The project has no tests yet.</Nothing>
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Test</th>
                <th>Stage</th>
                <th>Type</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((test) => (
                <tr key={test.id}>
                  <td className="mono">T-{test.ordinal}</td>
                  <td>{test.name || <Missing>No title yet</Missing>}</td>
                  <td>{capital(test.stage)}</td>
                  <td>{test.testType ? capital(test.testType) : ''}</td>
                  <td>{test.result ? capital(test.result) : <span className="muted">Not recorded yet</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tests.map((test) => (
            <TestBlock key={test.id} model={model} test={test} />
          ))}
        </>
      )}
    </Page>
  );
}

// ---- The interface structure diagram (section 10.6) ----

export function IsdPage({ model, diagramId, title }: { model: Model; diagramId: Id; title: string }) {
  const interfaces = [...interfacesOn(model, diagramId)].sort((a, b) => a.number.localeCompare(b.number, 'en', { numeric: true }));
  return (
    <Page title={title}>
      <StaticIsd model={model} diagramId={diagramId} />
      {interfaces.length > 0 && (
        <>
          <p className="muted project-caption">
            Each box holds the interface&rsquo;s number, its name, and the numbers of the processes it carries out. A line
            means the user can move between the two interfaces.
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Interface</th>
                <th>Processes it carries out</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {interfaces.map((item) => (
                <tr key={item.id}>
                  <td className="mono">{item.number}</td>
                  <td>{item.name || <Missing>No name yet</Missing>}</td>
                  <td>
                    {interfaceProcesses(model, item.processIds)
                      ? item.processIds.filter((id) => model.elements[id]).map((id) => <div key={id}>{elementLabel(model, id)}</div>)
                      : <span className="muted">None</span>}
                  </td>
                  <td>{item.description.trim() || <span className="muted">None</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Page>
  );
}

// ---- A binder section (section 10.7) ----

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'text'; lines: string[] };

/**
 * Reads a binder section's plain text. A line that starts with "#" is a heading, "-" or
 * "1." a list item, and "|" a table row. Everything else is a paragraph. Nothing is
 * read as HTML.
 */
function readBody(body: string): Block[] {
  const blocks: Block[] = [];
  const last = () => blocks[blocks.length - 1];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) {
      // An empty line ends a paragraph or a list.
      blocks.push({ kind: 'text', lines: [] });
      continue;
    }
    const heading = /^(#+)\s*(.*)$/.exec(line);
    const bullet = /^-\s*(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s*(.*)$/.exec(line);
    if (heading) blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] });
    else if (line.startsWith('|')) {
      const cells = line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim());
      // A row of dashes only separates the headings from the rows, and is not shown.
      const rule = cells.every((cell) => /^:?-+:?$/.test(cell));
      const table = last();
      if (table?.kind === 'table') {
        if (!rule) table.rows.push(cells);
      } else if (!rule) blocks.push({ kind: 'table', rows: [cells] });
    } else if (bullet || numbered) {
      const ordered = !bullet;
      const text = (bullet ?? numbered)![1];
      const list = last();
      if (list?.kind === 'list' && list.ordered === ordered) list.items.push(text);
      else blocks.push({ kind: 'list', ordered, items: [text] });
    } else {
      const text = last();
      if (text?.kind === 'text') text.lines.push(line);
      else blocks.push({ kind: 'text', lines: [line] });
    }
  }
  return blocks.filter((block) => block.kind !== 'text' || block.lines.length > 0);
}

function BinderBody({ body }: { body: string }) {
  const blocks = readBody(body);
  if (blocks.length === 0) return <Missing>Nothing written yet</Missing>;
  return (
    <div className="project-binder-body">
      {blocks.map((block, i) => {
        if (block.kind === 'heading') {
          return (
            <div key={i} className={block.level === 1 ? 'project-binder-h1' : 'project-binder-h2'}>
              {block.text}
            </div>
          );
        }
        if (block.kind === 'list') {
          const items = block.items.map((text, j) => <li key={j}>{text}</li>);
          return block.ordered ? (
            <ol key={i} className="project-steps">
              {items}
            </ol>
          ) : (
            <ul key={i} className="project-plain-list">
              {items}
            </ul>
          );
        }
        if (block.kind === 'table') {
          const [head, ...rows] = block.rows;
          const width = Math.max(...block.rows.map((row) => row.length));
          const fill = (row: string[]) => Array.from({ length: width }, (_, c) => row[c] ?? '');
          return (
            <table key={i} className="table project-binder-table">
              <thead>
                <tr>
                  {fill(head).map((cell, c) => (
                    <th key={c}>{cell}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, r) => (
                  <tr key={r}>
                    {fill(row).map((cell, c) => (
                      <td key={c}>{cell || ' '}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        return <p key={i}>{block.lines.join(' ')}</p>;
      })}
    </div>
  );
}

function fileSize(bytes: number): string {
  return bytes >= 1024 ? `${formatNumber(Math.round(bytes / 1024))} KB` : `${formatNumber(bytes)} bytes`;
}

function ConversionTable({ section }: { section: BinderSection }) {
  if (!section.conversion) return null;
  const effects = conversionEffects(section.conversion);
  const words = { style: 'Conversion style', location: 'Conversion locations', modules: 'Conversion modules' } as const;
  return (
    <>
      <div className="table-caption project-caption">Conversion strategy</div>
      {effects.length === 0 ? (
        <Missing>No choices made yet</Missing>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Choice</th>
              <th>Chosen</th>
              <th>Risk</th>
              <th>Cost</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {effects.map((effect) => (
              <tr key={effect.choice}>
                <td>{words[effect.choice]}</td>
                <td>
                  {effect.title}
                  <div className="muted">{effect.meaning}</div>
                </td>
                <td>{capital(effect.risk)}</td>
                <td>{capital(effect.cost)}</td>
                <td>{capital(effect.time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="table-caption project-caption">Reasons for the strategy</div>
      <Text text={section.conversion.reasons} missing="No reasons yet" />
    </>
  );
}

export function BinderPage({ model, sectionId, title }: { model: Model; sectionId: Id; title: string }) {
  const section = get(model, sectionId, 'binderSection');
  if (!section) return null;
  // Only a picture is shown in place. Every other file is listed by its name.
  const isPicture = (a: BinderSection['attachments'][number]) => a.mimeType.startsWith('image/') && a.dataUrl.startsWith('data:image/');
  const pictures = section.attachments.filter(isPicture);
  const others = section.attachments.filter((a) => !isPicture(a));
  return (
    <Page title={title}>
      <BinderBody body={section.body} />
      <ConversionTable section={section} />
      {pictures.map((picture) => (
        <figure key={picture.id} className="project-figure">
          <img src={picture.dataUrl} alt={picture.name} />
          <figcaption className="muted">{picture.name}</figcaption>
        </figure>
      ))}
      {others.length > 0 && (
        <>
          <div className="table-caption project-caption">Attached files, kept with the project</div>
          <ul className="project-plain-list">
            {others.map((file) => (
              <li key={file.id}>
                {file.name} <span className="muted">({fileSize(file.size)})</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Page>
  );
}

// ---- The structure chart (section 11.3) ----

function howCalled(module: Module): string {
  const words = [module.conditional ? 'In some cases' : '', module.repeated ? 'More than once' : ''].filter(Boolean);
  return words.join(', ') || 'Once';
}

export function ChartPage({ model, chartId, title }: { model: Model; chartId: Id; title: string }) {
  const rows = modulesOf(model, chartId);
  const couples = (id: Id, direction: 'down' | 'up') =>
    couplesOf(model, id)
      .filter((c) => c.direction === direction)
      .map((c) => `${coupleLabel(model, c) || 'No name'}${c.coupleKind === 'control' ? ' (flag)' : ''}`)
      .join(', ');
  return (
    <Page title={title}>
      <StaticStructureChart model={model} chartId={chartId} />
      {rows.length > 0 && (
        <>
          <p className="muted project-caption">
            A bar inside each side marks a library module. A diamond marks a call made only in some cases, and a curved arrow a
            call made more than once. Each small arrow is a couple: an empty circle for data and a filled circle for a flag.
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Module</th>
                <th>Called</th>
                <th>Passed down to it</th>
                <th>Passed up from it</th>
                <th>Process</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ module, number, depth }) => {
                const original = originalModule(model, module.id) ?? module;
                return (
                  <tr key={module.id}>
                    <td className="mono">{number}</td>
                    <td>
                      {original.name || <Missing>No name yet</Missing>}
                      {original.library && <div className="muted">Library module</div>}
                      {module.repeatsId && <div className="muted">Shown again: the same module as {moduleNumber(model, original.id)}</div>}
                    </td>
                    <td>{depth === 0 ? <span className="muted">Top module</span> : howCalled(module)}</td>
                    <td>{couples(module.id, 'down')}</td>
                    <td>{couples(module.id, 'up')}</td>
                    <td>{original.processId && model.elements[original.processId] ? elementLabel(model, original.processId) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </Page>
  );
}

// ---- The program specifications (section 11.4) ----

/** Every module that has a specification of its own, in module order, chart by chart. */
export function specifiedModules(model: Model): { module: Module; number: string }[] {
  return all(model, 'structureChart').flatMap((chart) =>
    modulesOf(model, chart.id)
      .filter((row) => !row.module.repeatsId)
      .map((row) => ({ module: row.module, number: row.number })),
  );
}

function IoTable({ rows, from }: { rows: IoRow[]; from: string }) {
  if (rows.length === 0) return <span className="muted">None</span>;
  return (
    <table className="table project-inner-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>{from}</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.couple.id}>
            <td>{row.name || <Missing>No name yet</Missing>}</td>
            <td>{row.type}</td>
            <td>{row.otherLabel}</td>
            <td>{row.notes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SpecsPage({ model }: { model: Model }) {
  const modules = specifiedModules(model);
  return (
    <Page title="Program specifications">
      {modules.length === 0 && <Nothing>The project has no modules yet, so there are no program specifications.</Nothing>}
      {modules.map(({ module, number }) => {
        const io = programIo(model, module.id);
        return (
          <div key={module.id} className="project-block">
            <h3 className="project-page-subtitle">
              <span className="mono">{number}</span> {module.name || <Missing>No name yet</Missing>}
            </h3>
            <table className="table project-form">
              <tbody>
                <tr>
                  <th>Purpose</th>
                  <td>
                    <Text text={module.purpose} missing="No purpose yet" />
                  </td>
                </tr>
                <tr>
                  <th>Programmer</th>
                  <td>{module.programmer || <span className="muted">None named</span>}</td>
                </tr>
                <tr>
                  <th>Date due</th>
                  <td>{module.dateDue || <span className="muted">No date</span>}</td>
                </tr>
                <tr>
                  <th>Language</th>
                  <td>{module.language || <span className="muted">None named</span>}</td>
                </tr>
                <tr>
                  <th>Events</th>
                  <td>{module.events.trim() ? <Text text={module.events} missing="" /> : <span className="muted">None: it runs in a fixed order</span>}</td>
                </tr>
                <tr>
                  <th>Inputs</th>
                  <td>
                    <IoTable rows={io.inputs} from="From" />
                  </td>
                </tr>
                <tr>
                  <th>Outputs</th>
                  <td>
                    <IoTable rows={io.outputs} from="To" />
                  </td>
                </tr>
                <tr>
                  <th>Pseudocode</th>
                  <td>
                    <Text text={module.pseudocode} missing="No pseudocode yet" mono />
                  </td>
                </tr>
                <tr>
                  <th>Other</th>
                  <td>{module.other.trim() ? <Text text={module.other} missing="" /> : <span className="muted">None</span>}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </Page>
  );
}

// ---- The physical data model (section 11.5) ----

export function PhysicalDataModelPage({ model }: { model: Model }) {
  const entities = all(model, 'entity');
  const relationships = all(model, 'relationship');
  const tableName = (id: Id | null) => {
    const entity = id ? get(model, id, 'entity') : undefined;
    return entity ? entity.tableName.trim() || entity.name || 'No name' : '';
  };
  return (
    <Page title="Physical data model">
      {entities.length === 0 && <Nothing>The data model has no entities yet, so there are no tables.</Nothing>}
      {entities.length > 0 && (
        <p className="muted project-caption">
          One table for each entity. PK marks a field of the primary key, and FK a field that holds the key of another table. A
          copy repeats a field that another table owns.
        </p>
      )}
      {entities.map((entity) => {
        const fields = tableFields(model, entity.id);
        return (
          <div key={entity.id} className="project-block">
            <h3 className="project-page-subtitle">
              {entity.tableName.trim() ? <span className="mono">{entity.tableName}</span> : <Missing>No table name yet</Missing>}
              <span className="muted project-subtitle-note">
                Entity: {entity.name || 'No name'}
                {isSystemRelated(entity) && ', system-related'}
              </span>
            </h3>
            {fields.length === 0 ? (
              <Missing>No fields yet</Missing>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Field</th>
                    <th>Data type</th>
                    <th className="is-numeric">Length</th>
                    <th>Null</th>
                    <th>Default</th>
                    <th>Comes from</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, i) => (
                    <tr key={`${field.dataId}:${i}`}>
                      <td className="mono">{[field.pk ? 'PK' : '', field.fk ? 'FK' : ''].filter(Boolean).join(', ')}</td>
                      <td>
                        {field.element.fieldName.trim() ? (
                          <span className="mono">{field.element.fieldName}</span>
                        ) : (
                          <>
                            {field.element.name} <Missing>No field name yet</Missing>
                          </>
                        )}
                        {isSystemRelated(field.element) && <div className="muted">System-related</div>}
                      </td>
                      <td>{field.element.dataType || <Missing>No data type yet</Missing>}</td>
                      <td className="is-numeric">{field.element.length ?? ''}</td>
                      <td>{field.element.nullable === null ? '' : field.element.nullable ? 'Allowed' : 'Not allowed'}</td>
                      <td>{field.element.defaultValue}</td>
                      <td>
                        {field.copy
                          ? `Copy of a field of ${tableName(field.fromEntityId)}`
                          : field.fk
                            ? `Key of ${tableName(field.fromEntityId)}`
                            : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
      {relationships.length > 0 && (
        <>
          <div className="table-caption project-caption">Foreign keys</div>
          <table className="table">
            <thead>
              <tr>
                <th>Relationship</th>
                <th>Foreign key</th>
              </tr>
            </thead>
            <tbody>
              {relationships.map((rel) => {
                const parent = parentEnd(rel);
                const child = parent === null ? null : rel.ends[parent === 0 ? 1 : 0].entityId;
                return (
                  <tr key={rel.id}>
                    <td>{elementLabel(model, rel.id)}</td>
                    <td>
                      {rel.foreignKey ? (
                        `Placed${child ? ` in ${tableName(child)}` : ''}`
                      ) : parent === null ? (
                        <span className="muted">None: the relationship is many-to-many or not decided yet</span>
                      ) : (
                        <Missing>Not placed yet</Missing>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </Page>
  );
}

// ---- The storage size estimate (section 11.6) ----

export function StoragePage({ model }: { model: Model }) {
  const estimate = storageEstimate(model);
  const whole = (n: number) => formatNumber(Math.round(n));
  const after = `after ${estimate.months} ${estimate.months === 1 ? 'month' : 'months'}`;
  return (
    <Page title="Storage size estimate">
      {estimate.tables.length === 0 ? (
        <Nothing>The data model has no entities yet, so there is nothing to estimate.</Nothing>
      ) : (
        <>
          <table className="table project-form">
            <tbody>
              <tr>
                <th>Overhead</th>
                <td>
                  {model.project.overheadRate === null ? <Missing>No overhead rate yet</Missing> : formatPercent(estimate.overheadRate, Number.isInteger(estimate.overheadRate) ? 0 : 1)}
                </td>
              </tr>
              <tr>
                <th>Estimated for</th>
                <td>{model.project.months === null ? <Missing>No number of months yet</Missing> : `${estimate.months} months ahead`}</td>
              </tr>
            </tbody>
          </table>
          <div className="table-caption project-caption">Tables</div>
          <table className="table project-cash">
            <thead>
              <tr>
                <th>Table</th>
                <th className="is-numeric">Record size</th>
                <th className="is-numeric">With overhead</th>
                <th className="is-numeric">Initial records</th>
                <th className="is-numeric">Growth</th>
                <th className="is-numeric">Records {after}</th>
                <th className="is-numeric">Initial volume</th>
                <th className="is-numeric">Volume {after}</th>
              </tr>
            </thead>
            <tbody>
              {estimate.tables.map((table) => (
                <tr key={table.entity.id}>
                  <td>
                    {table.name || 'No name'}
                    {table.typedSize && <div className="muted">Record size typed</div>}
                  </td>
                  <td className="is-numeric">{figure(table.recordSize)}</td>
                  <td className="is-numeric">{figure(Math.round(table.totalRecordSize * 100) / 100)}</td>
                  <td className="is-numeric">{table.entity.initialRecords === null ? '' : whole(table.entity.initialRecords)}</td>
                  <td className="is-numeric">
                    {table.growthBy === 'month'
                      ? `${figure(table.entity.growthPerMonth ?? 0)} a month`
                      : table.growthBy === 'year'
                        ? `${figure(table.entity.growthPerYear ?? 0)}% a year`
                        : ''}
                  </td>
                  <td className="is-numeric">{whole(table.finalRecords)}</td>
                  <td className="is-numeric">{whole(table.initialVolume)}</td>
                  <td className="is-numeric">{whole(table.finalVolume)}</td>
                </tr>
              ))}
              <tr className="project-total-row">
                <td colSpan={6}>Database size</td>
                <td className="is-numeric">{whole(estimate.initialVolume)}</td>
                <td className="is-numeric">{whole(estimate.finalVolume)}</td>
              </tr>
            </tbody>
          </table>
          <p className="muted project-caption">
            Sizes are in characters. A record size is the average widths of the table&rsquo;s fields added up, and the overhead
            is added to it. Growth given as a percentage for each year is compounded once a year.
          </p>
          <div className="table-caption project-caption">Average width of each field</div>
          <table className="table">
            <thead>
              <tr>
                <th>Table</th>
                <th>Fields, each with its average width</th>
              </tr>
            </thead>
            <tbody>
              {estimate.tables.map((table) => (
                <tr key={table.entity.id}>
                  <td>{table.name || 'No name'}</td>
                  <td>
                    {table.fields.length === 0 ? (
                      <span className="muted">No fields</span>
                    ) : (
                      table.fields.map((field, i) => (
                        <Fragment key={`${field.dataId}:${i}`}>
                          {i > 0 && ', '}
                          {field.name}{' '}
                          {field.element.averageWidth === null ? <Missing>no width yet</Missing> : <span className="mono">{figure(field.element.averageWidth)}</span>}
                        </Fragment>
                      ))
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Page>
  );
}
