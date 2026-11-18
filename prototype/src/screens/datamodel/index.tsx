// The entity relationship diagram, the CRUD matrix and the storage size estimate.
// Routes: /data-model, /crud and /storage

import { PageHeader, RightPanel, UndoRedo, WorkArea } from '../../frame';
import { ProblemList } from '../../components';
import { useFindings, useMode } from '../../store';
import { ErdCanvas } from './ErdCanvas';
import { DetailsPanel } from './DetailsPanel';
import { CrudMatrix } from './CrudMatrix';
import './datamodel.css';

export { StorageScreen } from './Storage';

export function DataModelScreen() {
  const findings = useFindings().filter((f) => f.area === 'dataModel');
  const physical = useMode() === 'physical';
  return (
    <>
      <WorkArea>
        <PageHeader breadcrumb={['Data model']} title={physical ? 'Physical entity relationship diagram' : 'Entity relationship diagram'}>
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
  const physical = useMode() === 'physical';
  return (
    <WorkArea>
      <PageHeader breadcrumb={['Data model']} title={physical ? 'CRUD matrix of the physical model' : 'CRUD matrix'}>
        <UndoRedo />
      </PageHeader>
      <div className="work-body">
        <CrudMatrix />
      </div>
    </WorkArea>
  );
}
