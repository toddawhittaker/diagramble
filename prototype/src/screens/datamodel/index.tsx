// The entity relationship diagram and the CRUD matrix. Routes: /data-model and /crud

import { PageHeader, RightPanel, UndoRedo, WorkArea } from '../../frame';
import { ProblemList } from '../../components';
import { useFindings } from '../../store';
import { ErdCanvas } from './ErdCanvas';
import { DetailsPanel } from './DetailsPanel';
import { CrudMatrix } from './CrudMatrix';
import './datamodel.css';

export function DataModelScreen() {
  const findings = useFindings().filter((f) => f.area === 'dataModel');
  return (
    <>
      <WorkArea>
        <PageHeader breadcrumb={['Data model']} title="Entity relationship diagram">
          <UndoRedo />
        </PageHeader>
        <div className="work-body">
          <ErdCanvas />
        </div>
      </WorkArea>
      <RightPanel label="Details and problems">
        <DetailsPanel />
        <hr className="datamodel-divider" />
        <h2 className="panel-heading">Problems</h2>
        <ProblemList findings={findings} emptyText="No problems in the data model." />
      </RightPanel>
    </>
  );
}

export function CrudScreen() {
  return (
    <WorkArea>
      <PageHeader breadcrumb={['Data model']} title="CRUD matrix">
        <UndoRedo />
      </PageHeader>
      <div className="work-body">
        <CrudMatrix />
      </div>
    </WorkArea>
  );
}
