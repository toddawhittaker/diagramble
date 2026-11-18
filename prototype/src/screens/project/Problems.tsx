// Every finding in the project, grouped by the place it is counted. Route: /problems

import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button, FindingMarks, Mark, ProblemCard, Tabs } from '../../components';
import { PageHeader, WorkArea } from '../../frame';
import { countFindings, type Finding } from '../../rules';
import { checkNow, selectFinding, useFindings, useFindingsVisible, useModel, useSelection } from '../../store';
import { groupFindings, placeOf, plural } from './shared';
import './project.css';

type Filter = 'all' | 'error' | 'warning';

export function ProblemsScreen() {
  const model = useModel();
  const findings = useFindings();
  const visible = useFindingsVisible();
  const selection = useSelection();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const { errors, warnings } = countFindings(findings);
  const shown = filter === 'all' ? findings : findings.filter((f) => f.severity === filter);
  const groups = groupFindings(model, shown);

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
                    <Button small onClick={() => goTo(finding)}>
                      {placeOf(model, finding).text}
                    </Button>
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
