// The symbols of a data flow diagram, in the Gane and Sarson style, and the small nodes
// that stand for a flow end that is not a symbol.

import { useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Mark } from '../../components';
import { dispatch } from '../../store';
import type { EndNode, SymbolNode } from './layout';
import { useCanvasUi } from './ui';

/** A text box that renames in place. Enter or leaving the box keeps the change. Escape drops it. */
export function InlineName({ value, onDone, label }: { value: string; onDone: (name: string | null) => void; label: string }) {
  const cancelled = useRef(false);
  return (
    <input
      className="input nodrag nopan workspace-inline-name"
      aria-label={label}
      defaultValue={value}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          cancelled.current = true;
          e.currentTarget.blur();
        }
        e.stopPropagation();
      }}
      onBlur={(e) => onDone(cancelled.current ? null : e.currentTarget.value.trim())}
    />
  );
}

/**
 * Two handles that cover the whole node, so a flow can start anywhere on a symbol and
 * end anywhere on another. They take no clicks unless a flow can start or end there.
 */
function CoverHandles({ canStart, canEnd, title }: { canStart: boolean; canEnd: boolean; title?: string }) {
  return (
    <>
      <Handle type="target" position={Position.Left} className="workspace-handle" isConnectable={canEnd} isConnectableStart={false} />
      <Handle
        type="source"
        position={Position.Right}
        className="workspace-handle"
        isConnectable={canStart}
        isConnectableEnd={false}
        title={title}
      />
    </>
  );
}

const SYSTEM_TITLE = 'System-related: shown only in physical mode';

export function SymbolView({ id, data, selected }: NodeProps<SymbolNode>) {
  const ui = useCanvasUi();
  const editing = ui.editing === id;
  /** In physical mode a data store shows its physical name in place of its name, and that is what is edited in place. */
  const physicalStore = data.physical && data.kind === 'dataStore';
  const shown = physicalStore && data.physicalName ? data.physicalName : data.name;

  const name = editing ? (
    <InlineName
      value={physicalStore ? data.physicalName : data.name}
      label={physicalStore ? 'Physical name' : 'Name'}
      onDone={(next) => {
        ui.setEditing(null);
        if (next === null) return;
        if (physicalStore) {
          if (next !== data.physicalName) dispatch({ type: 'setPhysical', id: data.elementId, physicalName: next });
        } else if (next !== '' && next !== data.name) dispatch({ type: 'rename', id: data.elementId, name: next });
      }}
    />
  ) : (
    <span
      className="workspace-symbol-name"
      title={
        physicalStore
          ? data.physicalName
            ? `The data store '${data.name}'. Double-click to change its physical name`
            : 'Double-click to give it a physical name'
          : 'Double-click to rename'
      }
      onDoubleClick={(e) => {
        e.stopPropagation();
        ui.setEditing(id);
      }}
    >
      {shown ? shown : <span className="missing">No name</span>}
      {data.mark && <Mark kind={data.mark} size={14} />}
    </span>
  );

  const system = data.physical && data.systemRelated && (
    <span className="workspace-system" title={SYSTEM_TITLE}>
      system
    </span>
  );
  // A process the software carries out. The "Shade the software side" switch shades these.
  const software = data.physical && data.kind === 'process' && !data.human;
  const classes = `workspace-symbol workspace-${data.kind}${software ? ' workspace-software' : ''}${selected ? ' is-selected' : ''}`;
  const handles = <CoverHandles canStart={ui.tool === 'dataFlow'} canEnd />;

  if (data.kind === 'process')
    return (
      <div
        className={classes}
        title={data.childDiagramId ? 'Double-click to open the child diagram' : undefined}
        onDoubleClick={() => {
          if (data.childDiagramId) ui.openDiagram(data.childDiagramId);
        }}
      >
        <div className="workspace-process-band mono">
          {data.tag}
          {system && <span className="workspace-process-system">{system}</span>}
        </div>
        <div className="workspace-process-name">{name}</div>
        {data.physical && (
          <div className="workspace-process-impl" title={data.human ? 'A person does this work' : 'What carries out this process'}>
            {data.implementation ? (
              data.implementation
            ) : data.human ? (
              'Done by a person'
            ) : (
              <span className="missing">No implementation yet</span>
            )}
          </div>
        )}
        {handles}
      </div>
    );

  if (data.kind === 'dataStore')
    return (
      <div className={classes}>
        <div className="workspace-store-tag mono">{data.tag}</div>
        <div className="workspace-store-name">
          {name}
          {data.physical && (!data.physicalName || system) && !editing && (
            <div className="workspace-store-sub">
              {!data.physicalName && <span className="missing workspace-sub">no physical name</span>}
              {system}
            </div>
          )}
        </div>
        {handles}
      </div>
    );

  return (
    <div className={classes}>
      <div className="workspace-entity-body">
        {name}
        {data.physical && data.human && <div className="workspace-sub muted">a person</div>}
      </div>
      {handles}
    </div>
  );
}

export function EndView({ data, selected }: NodeProps<EndNode>) {
  if (data.variant === 'origin')
    return (
      <div className="workspace-origin">
        <CoverHandles canStart={false} canEnd={false} />
      </div>
    );
  if (data.variant === 'loose')
    return (
      <div className={`workspace-loose${selected ? ' is-selected' : ''}`}>
        <span className="missing workspace-loose-text">{data.text}</span>
        <CoverHandles canStart canEnd title="Not attached. Drag from here to a symbol to attach this end." />
      </div>
    );
  return (
    <div className={`workspace-note${selected ? ' is-selected' : ''}`}>
      {data.text}
      <CoverHandles canStart={false} canEnd={false} />
    </div>
  );
}
