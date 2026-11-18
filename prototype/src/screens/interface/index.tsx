// The interface structure diagram and the test plan: SPEC 10.6 and 10.5.
// Routes: /interfaces, /interfaces/:diagramId, /test-plan and /test-plan/:testId.

import { Link, useNavigate, useParams } from 'react-router';
import { all, get } from '../../model';
import { ProblemList, Button } from '../../components';
import { PageHeader, RightPanel, UndoRedo, WorkArea } from '../../frame';
import { clearSelection, dispatch, useAreaFindings, useModel } from '../../store';
import { IsdCanvas } from './IsdCanvas';
import { IsdDetails } from './IsdDetails';
import './interface.css';

export { TestPlanScreen } from './TestPlan';

export function InterfaceDiagramScreen() {
  const model = useModel();
  const areaFindings = useAreaFindings('interface');
  const { diagramId } = useParams();
  const navigate = useNavigate();

  const diagrams = all(model, 'interfaceDiagram');
  const diagram = diagramId ? get(model, diagramId, 'interfaceDiagram') : diagrams[0];
  // ISD-04 is about the whole project, so it is shown beside every diagram.
  const findings = areaFindings.filter((f) => f.homeId === null || f.homeId === diagram?.id);

  const addDiagram = () => {
    const name = diagrams.length === 0 ? `${model.name} interfaces` : `Interface structure diagram ${diagrams.length + 1}`;
    const result = dispatch({ type: 'addInterfaceDiagram', name });
    if (result.ok) {
      clearSelection();
      void navigate(`/interfaces/${result.created[0]}`);
    }
  };

  return (
    <>
      <WorkArea>
        <PageHeader breadcrumb={['Design', { label: 'Interface structure', to: '/interfaces' }]} title={diagram ? diagram.name || 'Untitled diagram' : 'Interface structure diagram'}>
          {diagrams.length > 1 && diagram && (
            <select
              className="input interface-diagram-choice"
              aria-label="Open another interface structure diagram"
              value={diagram.id}
              onChange={(e) => {
                clearSelection();
                void navigate(`/interfaces/${e.target.value}`);
              }}
            >
              {diagrams.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name || 'Untitled diagram'}
                </option>
              ))}
            </select>
          )}
          {diagrams.length > 0 && <Button onClick={addDiagram}>New diagram</Button>}
          <UndoRedo />
        </PageHeader>
        {diagram ? (
          <div className="work-body">
            <IsdCanvas key={diagram.id} diagramId={diagram.id} />
          </div>
        ) : (
          <div className="work-body scroll pad">
            {diagramId ? (
              <p className="placeholder">
                There is no interface structure diagram here. It may have been deleted. <Link to="/interfaces">Open the interface structure</Link>
              </p>
            ) : (
              <div className="vstack interface-empty">
                <p className="placeholder">
                  The project has no interface structure diagram yet. It shows every screen, form and report as a box, and a line wherever the user can move from one to another. Interface 0 is the
                  main menu.
                </p>
                <div>
                  <Button variant="primary" onClick={addDiagram}>
                    Start an interface structure diagram
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </WorkArea>
      <RightPanel label="Details and problems">
        {diagram && (
          <>
            <IsdDetails diagram={diagram} />
            <hr className="interface-divider" />
          </>
        )}
        <h2 className="panel-heading">Problems</h2>
        {diagram || findings.length > 0 ? (
          <ProblemList findings={findings} emptyText="No problems in this diagram." />
        ) : (
          <div className="muted">Nothing is checked until the project has an interface structure diagram.</div>
        )}
      </RightPanel>
    </>
  );
}
