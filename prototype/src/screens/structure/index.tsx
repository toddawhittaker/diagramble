// The structure chart and the program specifications: SPEC 11.3 and 11.4.
// Routes: /structure, /structure/:chartId, /programs and /programs/:moduleId.

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { all, get } from '../../model';
import { ProblemList } from '../../components';
import { PageHeader, RightPanel, UndoRedo, WorkArea } from '../../frame';
import { clearSelection, useAreaFindings, useSelection, useViewModel } from '../../store';
import type { Box } from './AddBox';
import { ChartCanvas } from './ChartCanvas';
import { Details, NewChartForm, selectionOn } from './Details';
import './structure.css';

export { ProgramSpecScreen } from './Programs';

export function StructureChartScreen() {
  const model = useViewModel();
  const navigate = useNavigate();
  const { chartId } = useParams();
  const selection = useSelection();
  const [box, setBox] = useState<Box>(null);
  const charts = all(model, 'structureChart');
  const chart = chartId ? get(model, chartId, 'structureChart') : charts[0];
  // The chart's own findings, and SC-07, which is about the whole project. A missing
  // purpose or pseudocode (PS-01) is shown with the program specifications.
  const findings = useAreaFindings('structure').filter((f) => f.ruleId !== 'PS-01' && (f.homeId === null || f.homeId === chart?.id));

  if (!chart) {
    return (
      <>
        <WorkArea>
          <PageHeader breadcrumb={['Design']} title="Structure chart">
            <UndoRedo />
          </PageHeader>
          <div className="work-body scroll pad">
            <div className="structure-blank vstack">
              {chartId ? (
                <p>There is no structure chart with this address. It may have been deleted.</p>
              ) : (
                <p>
                  This project has no structure chart yet. A structure chart shows the modules of a program as a tree, with the data and the flags passed between
                  them. Give the chart a title to start: its top module takes the same name, and you can rename it.
                </p>
              )}
              {charts.length > 0 && (
                <ul className="structure-couples">
                  {charts.map((c) => (
                    <li key={c.id}>
                      <button type="button" className="row" onClick={() => void navigate(`/structure/${c.id}`)}>
                        {c.name || '(no title)'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <NewChartForm model={model} first={charts.length === 0} />
            </div>
          </div>
        </WorkArea>
        <RightPanel label="Problems">
          <h2 className="panel-heading">Problems</h2>
          <ProblemList findings={findings} emptyText="No problems here." />
        </RightPanel>
      </>
    );
  }

  const { module, couple } = selectionOn(model, chart.id, selection.elementIds);

  return (
    <>
      <WorkArea>
        <PageHeader breadcrumb={['Design', { label: 'Structure charts', to: '/structure' }]} title={chart.name || 'Structure chart'}>
          {charts.length > 1 && (
            <select
              className="input structure-chart-select"
              aria-label="Structure chart"
              value={chart.id}
              onChange={(e) => {
                clearSelection();
                setBox(null);
                void navigate(`/structure/${e.target.value}`);
              }}
            >
              {charts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || '(no title)'}
                </option>
              ))}
            </select>
          )}
          <UndoRedo />
        </PageHeader>
        <div className="work-body">
          <ChartCanvas chartId={chart.id} box={box} setBox={setBox} module={module} couple={couple} />
        </div>
      </WorkArea>
      <RightPanel label="Details and problems">
        <Details model={model} chart={chart} module={module} couple={couple} setBox={setBox} />
        <hr className="structure-divider" />
        <h2 className="panel-heading">Problems</h2>
        <ProblemList findings={findings} emptyText="No problems in this structure chart." />
      </RightPanel>
    </>
  );
}
