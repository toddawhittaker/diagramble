// A data flow (solid) or a control flow (dotted), with its arrowhead and its label.

import { EdgeLabelRenderer, Position, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { Mark } from '../../components';
import { dispatch, selectElements } from '../../store';
import type { CanvasEdge, Side } from './layout';
import { InlineName } from './nodes';
import { useCanvasUi } from './ui';

const POSITION: Record<Side, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

/** The arrowhead: a small solid triangle whose tip is at the point where the line enters. */
function arrowPoints(x: number, y: number, side: Side): string {
  const L = 11;
  const W = 4.5;
  switch (side) {
    case 'left':
      return `${x},${y} ${x - L},${y - W} ${x - L},${y + W}`;
    case 'right':
      return `${x},${y} ${x + L},${y - W} ${x + L},${y + W}`;
    case 'top':
      return `${x},${y} ${x - W},${y - L} ${x + W},${y - L}`;
    case 'bottom':
      return `${x},${y} ${x - W},${y + L} ${x + W},${y + L}`;
  }
}

export function FlowEdge({ data, selected }: EdgeProps<CanvasEdge>) {
  const ui = useCanvasUi();
  if (!data) return null;
  const { sx, sy, tx, ty } = data;

  let full: string;
  let solid: string;
  let dashed: string | null = null;
  let labelX: number;
  let labelY: number;
  /** True when the line is level where the label sits. The label then goes above the line. */
  let above = false;
  let maxWidth: number | undefined;

  if (data.straight) {
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2;
    full = `M${sx},${sy} L${tx},${ty}`;
    solid = full;
    if (data.looseTarget) {
      solid = `M${sx},${sy} L${mx},${my}`;
      dashed = `M${mx},${my} L${tx},${ty}`;
    } else if (data.looseSource) {
      dashed = `M${sx},${sy} L${mx},${my}`;
      solid = `M${mx},${my} L${tx},${ty}`;
    }
    labelX = mx;
    labelY = my;
    above = Math.abs(sy - ty) < 1;
    if (above) maxWidth = Math.max(60, Math.abs(tx - sx) - 16);
  } else {
    [full, labelX, labelY] = getSmoothStepPath({
      sourceX: sx,
      sourceY: sy,
      sourcePosition: POSITION[data.sSide],
      targetX: tx,
      targetY: ty,
      targetPosition: POSITION[data.tSide],
      borderRadius: 0,
    });
    solid = full;
    const vertical = (side: Side) => side === 'top' || side === 'bottom';
    if (Math.abs(sy - ty) < 1 && !vertical(data.sSide) && !vertical(data.tSide)) {
      // One level line between two symbols side by side: keep the label inside the gap.
      above = true;
      maxWidth = Math.max(60, Math.abs(tx - sx) - 16);
    } else if (vertical(data.sSide) && vertical(data.tSide) && Math.abs(sx - tx) >= 1) {
      above = true;
    }
  }

  const lineClass = `react-flow__edge-path workspace-flow-line${data.control ? ' workspace-flow-control' : ''}`;
  const editing = data.control && ui.editing === data.flowId;

  return (
    <>
      <path className={lineClass} d={solid} />
      {dashed && <path className="react-flow__edge-path workspace-flow-line workspace-flow-loose" d={dashed} />}
      <polygon className={`workspace-flow-arrow${selected ? ' is-on' : ''}`} points={arrowPoints(tx, ty, data.tSide)} />
      <path className="react-flow__edge-interaction" d={full} fill="none" strokeOpacity={0} strokeWidth={20} />
      <EdgeLabelRenderer>
        <div
          className={`workspace-flow-label nodrag nopan${selected ? ' is-selected' : ''}${above ? ' workspace-flow-label-above' : ''}${ui.dimmedFlows.has(data.flowId) ? ' workspace-dim' : ''}`}
          style={{
            transform: `translate(-50%, ${above ? '-100%' : '-50%'}) translate(${labelX}px, ${above ? labelY - 4 : labelY}px)`,
            maxWidth,
          }}
          title={
            data.control
              ? 'Double-click to rename'
              : data.physical && data.physicalName
                ? `Carries ${data.label || 'data with no name'}. Double-click to change the data this flow carries`
                : 'Double-click to change the data this flow carries'
          }
          onClick={() => selectElements([data.flowId])}
          onDoubleClick={(e) => {
            e.stopPropagation();
            ui.editFlow(data.flowId, e.clientX, e.clientY);
          }}
        >
          {editing ? (
            <InlineName
              value={data.label}
              label="Name"
              onDone={(next) => {
                ui.setEditing(null);
                if (next !== null && next !== '' && next !== data.label) dispatch({ type: 'rename', id: data.flowId, name: next });
              }}
            />
          ) : (
            <>
              {data.physical && data.physicalName ? (
                data.physicalName
              ) : data.label ? (
                data.label
              ) : (
                <span className="missing">No name</span>
              )}
              {data.physical && !data.physicalName && <span className="missing workspace-sub">no physical name</span>}
              {data.physical && data.systemRelated && (
                <span className="workspace-system" title="System-related: shown only in physical mode">
                  system
                </span>
              )}
              {data.mark && <Mark kind={data.mark} size={14} bare />}
            </>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
