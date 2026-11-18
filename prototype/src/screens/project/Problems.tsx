// Every finding in the project, grouped by the place it is counted. Route: /problems

import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button, FindingMarks, Mark, ModeSwitch, ProblemCard, Tabs } from '../../components';
import { PageHeader, WorkArea } from '../../frame';
import { countFindings, physicalDataModelStarted, physicalDfdStarted, storageStarted, type Finding } from '../../rules';
import { checkNow, selectFinding, useFindings, useFindingsVisible, useMode, useModel, useSelection } from '../../store';
import { groupFindings, isPhysicalOnly, placeOf, plural } from './shared';
import './project.css';

type Filter = 'all' | 'error' | 'warning';

export function ProblemsScreen() {
  const model = useModel();
  const mode = useMode();
  const findings = useFindings();
  const visible = useFindingsVisible();
  const selection = useSelection();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const { errors, warnings } = countFindings(findings);
  const shown = filter === 'all' ? findings : findings.filter((f) => f.severity === filter);
  const groups = groupFindings(model, shown);
  const physicalCount = findings.filter(isPhysicalOnly).length;
  // The three sets of physical rules each wait until that part of the physical model is started.
  const waiting = [
    physicalDfdStarted(model) ? '' : 'the physical data flow diagrams',
    physicalDataModelStarted(model) ? '' : 'the tables and fields',
    storageStarted(model) ? '' : 'the storage size estimate',
  ].filter(Boolean);
  // The card of a finding outside the diagrams, the dictionary and the data model offers its own link once it is open.
  const cardHasLink = (f: Finding) => f.diagramId === null && f.area !== 'dataModel' && f.area !== 'dictionary' && f.area !== 'diagram';

  // Selecting the finding first means the canvas highlights what it names when it opens.
  const goTo = (finding: Finding) => {
    selectFinding(finding.id);
    navigate(placeOf(model, finding).to);
  };

  const toggle = (finding: Finding) => {
    if (selection.findingId === finding.id) setOpenId(openId === finding.id ? null : finding.id);
    else {
      selectFinding(finding.id);
      setOpenId(finding.id);
    }
  };

  let empty: string | null = null;
  if (findings.length === 0) empty = 'The rules found no problems in this project.';
  else if (shown.length === 0) {
    empty =
      filter === 'error'
        ? `The rules found no errors. There ${warnings === 1 ? 'is' : 'are'} ${plural(warnings, 'warning')}.`
        : `The rules found no warnings. There ${errors === 1 ? 'is' : 'are'} ${plural(errors, 'error')}.`;
  }

  // While the problems are held back, the page says so. It shows no list and no OK mark.
  if (!visible) {
    return (
      <WorkArea>
        <PageHeader breadcrumb={['Project']} title="Problems" />
        <div className="work-body scroll pad">
          <div className="project-column">
            <p>
              Problems are hidden for this project. The rules still run, but nothing is shown until you ask, so that you can
              look for the mistakes yourself first.
            </p>
            <div>
              <Button variant="primary" onClick={checkNow}>
                Check now
              </Button>
            </div>
            <p className="muted">
              To show problems as you work, change the setting on the <Link to="/project">Project page</Link>.
            </p>
          </div>
        </div>
      </WorkArea>
    );
  }

  return (
    <WorkArea>
      <PageHeader breadcrumb={['Project']} title="Problems" />
      <div className="work-body scroll pad">
        <div className="project-column">
          {model.settings.showFindings === 'onRequest' && (
            <p className="muted">
              This project shows problems only when asked. They will be hidden again at your next change.
            </p>
          )}
          <div className="project-mode-note">
            <ModeSwitch small />
            {mode === 'logical' ? (
              <span>
                These are the problems of the logical model. The rules for the physical data flow diagrams, the tables and
                fields, and the storage size estimate run in physical mode only.
              </span>
            ) : (
              <span>
                These are the problems of the physical model: everything the logical model reports, and{' '}
                {plural(physicalCount, 'problem')} that {physicalCount === 1 ? 'belongs' : 'belong'} to physical mode only.
                {waiting.length > 0 && ` Nothing is reported yet about ${waiting.join(' or ')}, because that work has not been started.`}
              </span>
            )}
          </div>
          <div className="project-filter">
            <Tabs
              label="Which problems to show"
              value={filter}
              onChange={setFilter}
              tabs={[
                { id: 'all', label: 'All', count: findings.length },
                { id: 'error', label: 'Errors', count: errors },
                { id: 'warning', label: 'Warnings', count: warnings },
              ]}
            />
          </div>

          {empty && (
            <p className="hstack">
              <Mark kind="ok" /> {empty}
            </p>
          )}

          {groups.map((group) => (
            <section key={group.key} className="project-group">
              <h2 className="section-heading project-group-heading">
                <Link to={group.to}>{group.title}</Link>
                <FindingMarks findings={group.findings} />
                {group.physicalOnly && <span className="project-group-note">Physical mode only</span>}
              </h2>
              <div className="problem-list">
                {group.findings.map((finding) => (
                  <div key={finding.id} className="project-problem">
                    <ProblemCard
                      finding={finding}
                      open={openId === finding.id}
                      selected={selection.findingId === finding.id}
                      // Naming the finding's own diagram stops the card from offering a second link to it.
                      currentDiagramId={finding.diagramId ?? undefined}
                      onToggle={() => toggle(finding)}
                    />
                    <div className="project-problem-side">
                      {!(openId === finding.id && cardHasLink(finding)) && (
                        <Button small onClick={() => goTo(finding)}>
                          {placeOf(model, finding).text}
                        </Button>
                      )}
                      {isPhysicalOnly(finding) && <span className="muted">Physical mode only</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </WorkArea>
  );
}
