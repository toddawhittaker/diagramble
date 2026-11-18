import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { diagramTitle, parentDiagram } from '../model/queries';
import type { Id } from '../model/types';
import { isBalanceFinding, type Finding } from '../rules/engine';
import { explain } from '../rules/explain';
import { checkNow, selectFinding, useDiagramFindings, useFindings, useFindingsVisible, useModel, useSelection } from '../store/store';
import { Button, Tabs } from './controls';
import { Count, Mark } from './Mark';

export interface AiBoxProps {
  /** Default "AI explanation". */
  title?: string;
  children: ReactNode;
}

/** A box with a dashed border in the AI colour. Put only AI-written text in it. */
export function AiBox({ title = 'AI explanation', children }: AiBoxProps) {
  return (
    <div className="ai-box">
      <div className="ai-box-head">
        <Mark kind="ai" />
        <span>{title}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

export interface ProblemCardProps {
  finding: Finding;
  /** Whether the card is opened out to show "Why", "How to fix" and the rest. */
  open: boolean;
  /** Called when the card's heading is clicked. */
  onToggle: () => void;
  /** Gives the card the selection look. */
  selected?: boolean;
  /** The diagram the card is shown beside, if any. It decides which link the card offers. */
  currentDiagramId?: Id;
}

/** One finding: its mark, rule code and message, and when open its reason, fix, table and explanation. */
export function ProblemCard({ finding, open, onToggle, selected, currentDiagramId }: ProblemCardProps) {
  const model = useModel();
  const [explained, setExplained] = useState(false);
  const here = finding.diagramId !== null && finding.diagramId === currentDiagramId;
  const parent = finding.diagramId ? parentDiagram(model, finding.diagramId) : undefined;
  const isBalancing = finding.ruleId.startsWith('BAL-');

  let link: { to: string; text: string } | null = null;
  if (here && isBalancing && parent) link = { to: `/diagram/${parent.id}`, text: 'Open parent diagram' };
  else if (!here && finding.diagramId)
    link = { to: `/diagram/${finding.diagramId}`, text: `Open ${diagramTitle(model, finding.diagramId)}` };
  else if (finding.area === 'dataModel' && currentDiagramId) link = { to: '/data-model', text: 'Open data model' };
  else if (finding.area === 'dictionary' && currentDiagramId)
    link = { to: `/dictionary/${finding.elementIds[0]}`, text: 'Open in data dictionary' };

  return (
    <div className={`problem-card${open ? ' is-open' : ''}${selected ? ' is-selected' : ''}`}>
      <button type="button" className="problem-card-head" aria-expanded={open} onClick={onToggle}>
        <div className="problem-card-tags">
          <Mark kind={finding.severity} word />
          <span className="mono">{finding.ruleId}</span>
        </div>
        <div className="problem-card-message">{finding.message}</div>
      </button>
      {open && (
        <div className="problem-card-body">
          <div>
            <div className="problem-card-label">Why</div>
            <div>{finding.why}</div>
          </div>
          <div>
            <div className="problem-card-label">How to fix</div>
            <div>{finding.fix}</div>
          </div>
          {isBalanceFinding(finding) && (
            <div>
              <div className="table-caption">{finding.values.data} is made of</div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Part</th>
                    <th>{here || !finding.diagramId ? 'On this diagram' : `On ${diagramTitle(model, finding.diagramId)}`}</th>
                  </tr>
                </thead>
                <tbody>
                  {finding.values.parts.map((part) => {
                    const verb = finding.values.direction === 'in' ? 'Enters' : 'Leaves';
                    const at = part.at.map((a) => a.label).join(', ');
                    return (
                      <tr key={part.dataId}>
                        <td>{part.name}</td>
                        <td>
                          <span className="hstack">
                            {part.crosses ? (
                              <>
                                {at ? `${verb} at ${at}` : verb} <Mark kind="ok" />
                              </>
                            ) : (
                              <>
                                {at ? `Partly missing. Some ${verb.toLowerCase()} at ${at}` : 'Missing'} <Mark kind="error" />
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {explained && <AiBox>{explain(model, finding)}</AiBox>}
          <div className="problem-card-actions">
            <Button small onClick={() => setExplained((v) => !v)} aria-pressed={explained}>
              {explained ? 'Hide explanation' : 'Explain'}
            </Button>
            {link && (
              <Link className="btn-link" to={link.to}>
                {link.text}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export interface ProblemListProps {
  findings: Finding[];
  currentDiagramId?: Id;
  /** Shown with an OK mark when the list is empty. Default "No problems." */
  emptyText?: string;
  /** Open the first card to begin with. Default false. */
  openFirst?: boolean;
}

/**
 * A stack of problem cards. Clicking a card selects its finding in the shared selection
 * store and opens it. A finding selected elsewhere, such as on the canvas, opens here too.
 */
export function ProblemList({ findings, currentDiagramId, emptyText = 'No problems.', openFirst = false }: ProblemListProps) {
  const selection = useSelection();
  const visible = useFindingsVisible();
  const [openId, setOpenId] = useState<string | null>(openFirst ? (findings[0]?.id ?? null) : null);

  useEffect(() => {
    if (selection.findingId) setOpenId(selection.findingId);
  }, [selection.findingId]);

  if (!visible)
    return (
      <div className="hstack">
        <span className="muted">Problems are hidden in this project until you ask for them.</span>
        <Button small onClick={checkNow}>
          Check now
        </Button>
      </div>
    );
  if (findings.length === 0)
    return (
      <div className="hstack">
        <Mark kind="ok" /> {emptyText}
      </div>
    );
  return (
    <div className="problem-list">
      {findings.map((f) => (
        <ProblemCard
          key={f.id}
          finding={f}
          open={openId === f.id}
          selected={selection.findingId === f.id}
          currentDiagramId={currentDiagramId}
          onToggle={() => {
            if (selection.findingId === f.id) setOpenId(openId === f.id ? null : f.id);
            else {
              selectFinding(f.id);
              setOpenId(f.id);
            }
          }}
        />
      ))}
    </div>
  );
}

export interface ProblemsPanelProps {
  /** The diagram the panel sits beside. */
  diagramId: Id;
}

/** The contents of the right panel on a diagram screen: "Problems", two tabs, and the cards. */
export function ProblemsPanel({ diagramId }: ProblemsPanelProps) {
  const all = useFindings();
  const own = useDiagramFindings(diagramId);
  const [tab, setTab] = useState<'diagram' | 'project'>('diagram');
  return (
    <>
      <h2 className="panel-heading">Problems</h2>
      <Tabs
        label="Which problems to show"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'diagram', label: 'This diagram', count: own.length },
          { id: 'project', label: 'Whole project', count: all.length },
        ]}
      />
      <ProblemList
        key={`${tab}:${diagramId}`}
        findings={tab === 'diagram' ? own : all}
        currentDiagramId={diagramId}
        emptyText={tab === 'diagram' ? 'No problems on this diagram.' : 'No problems in this project.'}
        openFirst={tab === 'diagram'}
      />
    </>
  );
}

/** A heading with a count, such as "Problems 1", for a section of the right panel. */
export function SectionHeading({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <h3 className="section-heading">
      {children}
      {count !== undefined && <Count n={count} />}
    </h3>
  );
}
