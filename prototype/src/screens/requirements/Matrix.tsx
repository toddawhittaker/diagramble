// The alternative matrix: SPEC 10.4. Routes: /alternatives and /alternatives/:matrixId

import { Fragment, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { Button, CellText, Count, FindingMarks, Mark, Missing, NumberField, ProblemList, SelectField } from '../../components';
import { ListColumn, PageHeader, RightPanel, UndoRedo, WorkArea } from '../../frame';
import { all, formatNumber, get, matrixScores, type AlternativeMatrix, type Criterion, type MatrixCell, type MatrixPatch } from '../../model';
import { findingsForHome, type Finding } from '../../rules';
import { dispatch, useAreaFindings, useHomeFindings, useModel } from '../../store';
import { capital, ConfirmButton, DraftField, plural } from './shared';
import './requirements.css';

type CriterionGroup = Criterion['group'];
const GROUPS: CriterionGroup[] = ['technical', 'economic', 'organizational'];

function swapped<T>(list: T[], i: number, j: number): T[] {
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function figure(n: number): string {
  return formatNumber(n, Number.isInteger(n) ? 0 : 1);
}

function joined(names: string[]): string {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The cells a finding of this rule names, as "criterion:alternative" keys. */
function cellsOf(findings: Finding[], ruleId: string, field: 'cells' | 'where'): Set<string> {
  const out = new Set<string>();
  for (const f of findings) {
    if (f.ruleId !== ruleId) continue;
    const cells = f.values[field];
    if (Array.isArray(cells)) for (const c of cells as { criterion: number; alternative: number }[]) out.add(`${c.criterion}:${c.alternative}`);
  }
  return out;
}

/** Which alternative comes out best, in plain words. */
function bestInWords(matrix: AlternativeMatrix): string {
  const { weighted, totals } = matrixScores(matrix);
  const worked = weighted.flat().filter((w) => w !== null).length;
  if (matrix.alternatives.length === 0 || matrix.criteria.length === 0) return 'There are no totals yet. Add the alternatives and the criteria first.';
  if (worked === 0) return 'There are no totals yet. Give each criterion a weight and each cell a score.';
  const best = Math.max(...totals);
  const names = matrix.alternatives.map((name, a) => name.trim() || `Alternative ${a + 1}`).filter((_, a) => totals[a] === best);
  const sentence =
    names.length === 1
      ? `${names[0]} has the best total, ${figure(best)}.`
      : names.length === matrix.alternatives.length
        ? `Every alternative has the same total, ${figure(best)}.`
        : `${joined(names)} share the best total, ${figure(best)}.`;
  const gaps = weighted.flat().length - worked;
  return gaps === 0 ? sentence : `${sentence} ${plural(gaps, 'cell has', 'cells have')} no score or no weight yet, so the totals are not complete.`;
}

function weightsInWords(total: number, any: boolean): string {
  if (!any) return 'No criterion has a weight yet. The weights should add up to 100.';
  if (Math.abs(total - 100) < 1e-9) return 'The weights add up to 100.';
  return total < 100 ? `The weights add up to ${figure(total)}, which is ${figure(100 - total)} short of 100.` : `The weights add up to ${figure(total)}, which is ${figure(total - 100)} over 100.`;
}

// ---- The grid ----

function MatrixEditor({ matrix, findings, isNew }: { matrix: AlternativeMatrix; findings: Finding[]; isNew: boolean }) {
  const navigate = useNavigate();
  /** The name box of the row or column just added, so that typing can start at once. */
  const [focus, setFocus] = useState<string | null>(null);
  const { alternatives, criteria, cells } = matrix;
  const scores = matrixScores(matrix);
  const badScores = cellsOf(findings, 'AM-02', 'cells');
  const noSupport = cellsOf(findings, 'AM-03', 'where');

  const update = (patch: MatrixPatch) => dispatch({ type: 'updateAlternativeMatrix', id: matrix.id, ...patch });
  const setCriterion = (c: number, change: Partial<Criterion>) => update({ criteria: criteria.map((x, i) => (i === c ? { ...x, ...change } : x)) });
  const setCell = (c: number, a: number, change: Partial<MatrixCell>) =>
    update({ cells: cells.map((row, i) => (i === c ? row.map((cell, j) => (j === a ? { ...cell, ...change } : cell)) : row)) });
  const moveAlternative = (a: number, by: number) => update({ alternatives: swapped(alternatives, a, a + by), cells: cells.map((row) => swapped(row, a, a + by)) });
  const moveCriterion = (c: number, other: number) => update({ criteria: swapped(criteria, c, other), cells: swapped(cells, c, other) });
  const addAlternative = () => {
    if (update({ alternatives: [...alternatives, ''] }).ok) setFocus(`a${alternatives.length}`);
  };
  const addCriterion = (group: CriterionGroup) => {
    if (update({ criteria: [...criteria, { name: '', group, weight: null }] }).ok) setFocus(`c${criteria.length}`);
  };
  const altName = (a: number) => alternatives[a].trim() || `alternative ${a + 1}`;

  return (
    <div className="requirements-matrix-page">
      <DraftField
        label="Title: the decision this matrix is for"
        value={matrix.name}
        placeholder="No title yet"
        selectOnMount={isNew}
        onCommit={(name) => dispatch({ type: 'rename', id: matrix.id, name }).ok}
      />
      <p className="muted requirements-matrix-help">
        Give each criterion a weight, so that the weights share out 100 points. Score each alternative on each criterion from 1, a poor fit, to 5, a perfect
        fit, and say what the score is based on.
      </p>

      <div className="requirements-matrix-scroll">
        <table className="requirements-matrix" aria-label={`Alternative matrix: ${matrix.name}`}>
          <thead>
            <tr>
              <th scope="col" className="requirements-matrix-criterion">
                Criterion
              </th>
              <th scope="col" className="requirements-matrix-weight">
                Weight
              </th>
              {alternatives.map((name, a) => (
                <th scope="col" key={a} className="requirements-matrix-alt">
                  <span className="field-label">Alternative {a + 1}</span>
                  <DraftField
                    hideLabel
                    label={`Name of alternative ${a + 1}`}
                    value={name}
                    placeholder="No name yet"
                    selectOnMount={focus === `a${a}`}
                    onCommit={(next) => update({ alternatives: alternatives.map((x, i) => (i === a ? next : x)) }).ok}
                  />
                  <span className="requirements-tools">
                    <Button small variant="link" disabled={a === 0} aria-label={`Move ${altName(a)} left`} onClick={() => moveAlternative(a, -1)}>
                      Left
                    </Button>
                    <Button small variant="link" disabled={a === alternatives.length - 1} aria-label={`Move ${altName(a)} right`} onClick={() => moveAlternative(a, 1)}>
                      Right
                    </Button>
                    <Button small variant="link" aria-label={`Remove ${altName(a)}`} onClick={() => dispatch({ type: 'removeAlternative', id: matrix.id, index: a })}>
                      Remove
                    </Button>
                  </span>
                </th>
              ))}
              <th scope="col" className="requirements-matrix-add">
                <Button small onClick={addAlternative}>
                  Add an alternative
                </Button>
              </th>
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((group) => {
              const inGroup = criteria.map((_, c) => c).filter((c) => criteria[c].group === group);
              return (
                <Fragment key={group}>
                  <tr className="requirements-matrix-group">
                    <th scope="rowgroup" colSpan={alternatives.length + 3}>
                      <span className="requirements-matrix-stay">{capital(group)} criteria</span>
                    </th>
                  </tr>
                  {inGroup.map((c, at) => {
                    const criterion = criteria[c];
                    const label = criterion.name.trim() || `criterion ${c + 1}`;
                    return (
                      <tr key={c}>
                        <th scope="row" className="requirements-matrix-criterion">
                          <DraftField
                            hideLabel
                            rows={2}
                            label={`Name of criterion ${c + 1}`}
                            value={criterion.name}
                            placeholder="No name yet"
                            selectOnMount={focus === `c${c}`}
                            onCommit={(name) => setCriterion(c, { name }).ok}
                          />
                          <SelectField<CriterionGroup>
                            hideLabel
                            label={`Kind of ${label}`}
                            value={criterion.group}
                            options={GROUPS.map((g) => ({ value: g, label: capital(g) }))}
                            onChange={(g) => setCriterion(c, { group: g })}
                          />
                          <span className="requirements-tools">
                            <Button small variant="link" disabled={at === 0} aria-label={`Move ${label} up`} onClick={() => moveCriterion(c, inGroup[at - 1])}>
                              Up
                            </Button>
                            <Button small variant="link" disabled={at === inGroup.length - 1} aria-label={`Move ${label} down`} onClick={() => moveCriterion(c, inGroup[at + 1])}>
                              Down
                            </Button>
                            <Button small variant="link" aria-label={`Remove ${label}`} onClick={() => dispatch({ type: 'removeCriterion', id: matrix.id, index: c })}>
                              Remove
                            </Button>
                          </span>
                        </th>
                        <td className="requirements-matrix-weight">
                          <NumberField hideLabel label={`Weight of ${label}`} size={3} value={criterion.weight} placeholder="?" onCommit={(weight) => setCriterion(c, { weight })} />
                        </td>
                        {alternatives.map((_, a) => {
                          const cell = cells[c]?.[a] ?? { supportingInformation: '', score: null };
                          const weighted = scores.weighted[c]?.[a] ?? null;
                          return (
                            <td key={a} className="requirements-matrix-cell">
                              <CellText
                                rows={3}
                                label={`Supporting information for ${altName(a)} on ${label}`}
                                value={cell.supportingInformation}
                                placeholder="No supporting information yet"
                                onCommit={(supportingInformation) => setCell(c, a, { supportingInformation })}
                              />
                              <div className="requirements-matrix-score">
                                <span className="field-label">Score</span>
                                <NumberField hideLabel label={`Score of ${altName(a)} on ${label}, from 1 to 5`} size={1} value={cell.score} placeholder="?" onCommit={(score) => setCell(c, a, { score })} />
                                {weighted === null ? (
                                  <Missing>{cell.score === null ? 'No score yet' : 'No weight yet'}</Missing>
                                ) : (
                                  <span className="mono" title="The score multiplied by the weight">
                                    × {figure(criterion.weight ?? 0)} = {figure(weighted)}
                                  </span>
                                )}
                                {badScores.has(`${c}:${a}`) && <Mark kind="error" label="This score is missing or is not a whole number from 1 to 5" />}
                                {noSupport.has(`${c}:${a}`) && <Mark kind="warning" label="This cell has no supporting information" />}
                              </div>
                            </td>
                          );
                        })}
                        <td />
                      </tr>
                    );
                  })}
                  <tr className="requirements-matrix-addrow">
                    <td colSpan={alternatives.length + 3}>
                      <span className="requirements-matrix-stay">
                        {inGroup.length === 0 && <Missing>No {group} criteria yet</Missing>}
                        <Button small onClick={() => addCriterion(group)}>
                          Add {group === 'technical' ? 'a' : 'an'} {group} criterion
                        </Button>
                      </span>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="requirements-matrix-criterion">
                Total
              </th>
              <td className="requirements-matrix-weight mono">{figure(scores.weightTotal)}</td>
              {alternatives.map((_, a) => (
                <td key={a} className="requirements-matrix-total mono">
                  {figure(scores.totals[a] ?? 0)}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="requirements-matrix-words" role="status">
        <p>{weightsInWords(scores.weightTotal, criteria.some((c) => c.weight !== null))}</p>
        <p>{bestInWords(matrix)}</p>
      </div>

      <DraftField
        label="Recommendation: the alternative you recommend, and the reasons"
        rows={5}
        value={matrix.recommendation}
        placeholder="No recommendation yet"
        onCommit={(recommendation) => update({ recommendation }).ok}
      />

      <div>
        <ConfirmButton
          label="Delete this matrix"
          question="Delete this matrix with everything in it?"
          confirmLabel="Delete it"
          onConfirm={() => {
            if (dispatch({ type: 'deleteElement', id: matrix.id }).ok) navigate('/alternatives');
          }}
        />
      </div>
    </div>
  );
}

// ---- The screen ----

export function AlternativeMatrixScreen() {
  const { matrixId } = useParams();
  const model = useModel();
  const navigate = useNavigate();
  const location = useLocation();
  const areaFindings = useAreaFindings('alternatives');

  const matrices = all(model, 'alternativeMatrix');
  const current = matrixId ? get(model, matrixId, 'alternativeMatrix') : matrices[0];
  const findings = useHomeFindings(current?.id);
  const isNew = (location.state as { newMatrix?: string } | null)?.newMatrix === current?.id;

  const addMatrix = () => {
    const taken = new Set(matrices.map((m) => m.name.toLowerCase()));
    let name = 'New alternative matrix';
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `New alternative matrix ${n}`;
    // The textbook's examples compare three alternatives, so a new matrix starts with three columns.
    const result = dispatch({ type: 'addAlternativeMatrix', name, alternatives: ['', '', ''] });
    if (result.ok) navigate(`/alternatives/${result.created[0]}`, { state: { newMatrix: result.created[0] } });
  };

  return (
    <>
      <ListColumn width={240} label="Alternative matrices">
        <div className="requirements-list-heading">
          Matrices <Count n={matrices.length} />
        </div>
        {matrices.map((m) => (
          <Link key={m.id} to={`/alternatives/${m.id}`} className={`row requirements-list-row${m.id === current?.id ? ' is-selected' : ''}`}>
            <span className="requirements-list-name">{m.name.trim() || <Missing>No title yet</Missing>}</span>
            <FindingMarks findings={findingsForHome(areaFindings, m.id)} />
          </Link>
        ))}
        <div className="requirements-list-foot">
          <Button small onClick={addMatrix}>
            New matrix
          </Button>
        </div>
      </ListColumn>
      <WorkArea>
        <PageHeader breadcrumb={['Design', { label: 'Alternative matrix', to: '/alternatives' }]} title={current ? current.name.trim() || 'Alternative matrix' : 'Alternative matrix'}>
          <UndoRedo />
        </PageHeader>
        <div className="work-body scroll pad">
          {current ? (
            <MatrixEditor key={current.id} matrix={current} findings={findings} isNew={isNew} />
          ) : matrixId ? (
            <div className="requirements-empty">
              <p>There is no alternative matrix at this address. It may have been deleted.</p>
              {matrices.length > 0 && <Link to="/alternatives">Open the first matrix</Link>}
            </div>
          ) : (
            <div className="requirements-empty">
              <p>An alternative matrix compares the ways to get the system, such as building it or buying it, against weighted criteria.</p>
              <div>
                <Button variant="primary" onClick={addMatrix}>
                  New matrix
                </Button>
              </div>
            </div>
          )}
        </div>
      </WorkArea>
      <RightPanel label="Problems">
        <h2 className="panel-heading">
          Problems <Count n={findings.length} />
        </h2>
        {current ? (
          <ProblemList findings={findings} emptyText="No problems in this matrix." />
        ) : (
          <p className="muted">The problems of a matrix are listed here when one is open.</p>
        )}
      </RightPanel>
    </>
  );
}
