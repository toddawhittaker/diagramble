// The canvas of a structure chart: the tool strip, the module boxes, the call lines with
// their marks, and the couples beside each line. Symbols follow docs/SPEC.md section 11.3.
// Nothing is dragged: the tree is laid out from the model after every change.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  getViewportForBounds,
  useReactFlow,
  useViewport,
  type Node,
  type NodeProps,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { get, moduleNumber, originalModule, type Couple, type Id, type Module } from '../../model';
import { findingsForElement } from '../../rules';
import { clearSelection, selectElements, useElementFindings, useFindings, useIsSelected, useSelection, useViewModel } from '../../store';
import { FindingMarks, Missing } from '../../components';
import { useTheme } from '../../theme/theme';
import { AddBox, type Box } from './AddBox';
import { BOX_H, BOX_W, LABEL_OFF, layoutChart, type ChartLayout, type LaidCouple } from './layout';

// ---- A module box ----

function ModuleNode({ id }: NodeProps) {
  const model = useViewModel();
  const selected = useIsSelected(id);
  // A missing purpose or pseudocode is shown on the program specification, not on the chart.
  const findings = useElementFindings(id).filter((f) => f.ruleId !== 'PS-01');
  const module = get(model, id, 'module');
  if (!module) return null;
  const original = originalModule(model, id) ?? module;
  return (
    <div
      className={`structure-module${original.library ? ' structure-module-library' : ''}${selected ? ' is-selected' : ''}`}
      title={module.repeatsId ? `One more appearance of ${moduleNumber(model, original.id)} ${original.name}` : undefined}
    >
      <div className="structure-module-number">
        {moduleNumber(model, id)}
        <FindingMarks findings={findings} counts={false} />
      </div>
      <div className="structure-module-name">{original.name || <Missing>No name yet</Missing>}</div>
    </div>
  );
}

const nodeTypes = { module: ModuleNode };

// ---- The lines and the couples ----

/** A short arrow with a circle at its tail: empty for data, filled for control. It points the way the couple travels. */
function CoupleArrow({ laid, selected, onSelect }: { laid: LaidCouple; selected: boolean; onSelect: () => void }) {
  const { couple, x, y } = laid;
  const colour = selected ? 'var(--select)' : 'var(--ink)';
  return (
    <g
      className="structure-couple"
      transform={`translate(${x} ${y})${couple.direction === 'up' ? ' rotate(180)' : ''}`}
      style={{ stroke: colour }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <rect className="structure-hit" x={-7} y={-11} width={14} height={22} />
      <path d="M 0 -4 L 0 8 M -3.5 3.5 L 0 8 L 3.5 3.5" />
      <circle cx={0} cy={-6.5} r={3} style={{ fill: couple.coupleKind === 'control' ? colour : 'var(--paper)' }} />
    </g>
  );
}

function Lines({ layout }: { layout: ChartLayout }) {
  const selection = useSelection();
  const findings = useFindings();
  const isSelected = (id: Id) => selection.elementIds.includes(id);
  const pick = (id: Id) => selectElements([id]);

  return (
    <ViewportPortal>
      <svg className="structure-lines" aria-hidden="true">
        {layout.calls.map((call) => {
          const selected = isSelected(call.moduleId);
          const d = `M ${call.from.x} ${call.from.y} L ${call.bend.x} ${call.bend.y} L ${call.to.x} ${call.to.y}`;
          const { x, y } = call.from;
          return (
            <g key={call.moduleId} style={{ stroke: selected ? 'var(--select)' : 'var(--ink)', strokeWidth: selected ? 2 : 1.25 }}>
              <path
                className="structure-hit structure-hit-line"
                d={d}
                onClick={(e) => {
                  e.stopPropagation();
                  pick(call.moduleId);
                }}
              />
              <path className="structure-call" d={d} />
              {call.conditional && <path className="structure-diamond" d={`M ${x} ${y} L ${x + 6} ${y + 8} L ${x} ${y + 16} L ${x - 6} ${y + 8} Z`} />}
            </g>
          );
        })}
        {layout.loops.map((loop) => (
          <g key={loop.key} className="structure-loop">
            <path d={loop.path} />
            <path d="M -7 -4 L 0 0 L -7 4" transform={`translate(${loop.tip.x} ${loop.tip.y}) rotate(${loop.angle})`} />
          </g>
        ))}
        {layout.calls.flatMap((call) =>
          call.couples.map((laid) => <CoupleArrow key={laid.couple.id} laid={laid} selected={isSelected(laid.couple.id)} onSelect={() => pick(laid.couple.id)} />),
        )}
      </svg>
      {layout.calls.flatMap((call) =>
        call.couples.map((laid) => {
          const left = laid.side === 'left';
          return (
            <button
              key={laid.couple.id}
              type="button"
              className={`structure-couple-label nodrag nopan${left ? ' structure-couple-label-left' : ''}${isSelected(laid.couple.id) ? ' is-selected' : ''}`}
              style={{ left: call.to.x + (left ? -LABEL_OFF : LABEL_OFF), top: laid.y }}
              title={`${laid.couple.coupleKind === 'data' ? 'Data couple' : 'Control couple'}, passed ${laid.couple.direction}: ${laid.label}`}
              onClick={(e) => {
                e.stopPropagation();
                pick(laid.couple.id);
              }}
            >
              <span className="structure-couple-name">{laid.label || <Missing>no name</Missing>}</span>
              <FindingMarks findings={findingsForElement(findings, laid.couple.id).filter((f) => f.elementIds[0] === laid.couple.id)} counts={false} />
            </button>
          );
        }),
      )}
    </ViewportPortal>
  );
}

// ---- The zoom control ----

function ZoomControl({ fit }: { fit: () => void }) {
  const flow = useReactFlow();
  const { zoom } = useViewport();
  return (
    <Panel position="bottom-left">
      <div className="structure-zoom" role="group" aria-label="Zoom">
        <button type="button" aria-label="Zoom out" onClick={() => void flow.zoomOut()}>
          −
        </button>
        <span className="structure-zoom-value">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Zoom in" onClick={() => void flow.zoomIn()}>
          +
        </button>
        <button type="button" className="structure-zoom-fit" onClick={fit}>
          Fit
        </button>
      </div>
    </Panel>
  );
}

// ---- The key to the symbols ----

function Key() {
  return (
    <Panel position="bottom-right">
      <div className="structure-key">
        <svg width="18" height="22" viewBox="-9 -11 18 22" aria-hidden="true">
          <path d="M 0 -4 L 0 8 M -3.5 3.5 L 0 8 L 3.5 3.5" />
          <circle cx="0" cy="-6.5" r="3" style={{ fill: 'var(--paper)' }} />
        </svg>
        Data couple
        <svg width="18" height="22" viewBox="-9 -11 18 22" aria-hidden="true">
          <path d="M 0 -4 L 0 8 M -3.5 3.5 L 0 8 L 3.5 3.5" />
          <circle cx="0" cy="-6.5" r="3" style={{ fill: 'var(--ink)' }} />
        </svg>
        Control couple
        <svg width="16" height="22" viewBox="-8 -3 16 22" aria-hidden="true">
          <path d="M 0 0 L 6 8 L 0 16 L -6 8 Z" style={{ fill: 'var(--paper)' }} />
        </svg>
        Conditional call
        <svg width="30" height="22" viewBox="0 0 30 22" aria-hidden="true">
          <path d="M 3 5 Q 15 24 27 5 M 20 8 L 27 5 L 27 13" />
        </svg>
        Repeated call
      </div>
    </Panel>
  );
}

// ---- The tool strip ----

const TOOLS: { id: Exclude<Box, null>; label: string; icon: ReactNode }[] = [
  {
    id: 'module',
    label: 'Module',
    icon: (
      <>
        <rect x="3" y="6" width="18" height="12" />
        <path d="M12 9 V15 M9 12 H15" />
      </>
    ),
  },
  {
    id: 'library',
    label: 'Library module',
    icon: (
      <>
        <rect x="3" y="6" width="18" height="12" />
        <path d="M6 6 V18 M18 6 V18" />
      </>
    ),
  },
  {
    id: 'couple',
    label: 'Couple',
    icon: (
      <>
        <circle cx="12" cy="5" r="2.5" />
        <path d="M12 7.5 V20 M8 16 L12 20 L16 16" />
      </>
    ),
  },
  {
    id: 'remove',
    label: 'Remove',
    icon: <path d="M6 6 L18 18 M18 6 L6 18" />,
  },
];

// ---- The canvas ----

function buildNodes(layout: ChartLayout, selectedIds: Id[], previous: Node[]): Node[] {
  const old = new Map(previous.map((n) => [n.id, n]));
  return layout.modules.map((laid) => ({
    // Keeping the old node keeps the size React Flow measured for it.
    ...old.get(laid.module.id),
    id: laid.module.id,
    type: 'module',
    position: { x: laid.x, y: laid.y },
    width: BOX_W,
    height: BOX_H,
    data: {},
    draggable: false,
    selected: selectedIds.includes(laid.module.id),
  }));
}

export interface ChartCanvasProps {
  chartId: Id;
  box: Box;
  setBox: (box: Box) => void;
  /** The selected module of this chart, or the lower module of the selected couple's line. */
  module: Module | undefined;
  couple: Couple | undefined;
}

function Canvas({ chartId, box, setBox, module, couple }: ChartCanvasProps) {
  const model = useViewModel();
  const selection = useSelection();
  const theme = useTheme();
  const flow = useReactFlow();
  const layout = useMemo(() => layoutChart(model, chartId), [model, chartId]);
  const [nodes, setNodes] = useState<Node[]>(() => buildNodes(layout, selection.elementIds, []));

  useEffect(() => {
    setNodes((previous) => buildNodes(layout, selection.elementIds, previous));
  }, [layout, selection.elementIds]);

  // Brings the whole drawing into view, with the couples' names, at no more than full size.
  const wrapper = useRef<HTMLDivElement>(null);
  const { width, height } = layout;
  const fit = useCallback(
    (duration = 0) => {
      const box = wrapper.current?.getBoundingClientRect();
      if (!box || box.width === 0 || box.height === 0) return;
      // The top 56 pixels are kept clear for the hint and the bottom 48 for the zoom control.
      const view = getViewportForBounds({ x: 0, y: 0, width, height }, box.width, box.height - 104, 0.2, 1, 0.04);
      void flow.setViewport({ ...view, y: view.y + 56 }, { duration });
    },
    [flow, width, height],
  );

  // The chart is fitted when it opens (see onInit), and again when a module is added or
  // removed, because the tree then changes shape.
  const count = layout.modules.length;
  const lastCount = useRef(count);
  useEffect(() => {
    if (lastCount.current === count) return;
    lastCount.current = count;
    const timer = window.setTimeout(() => fit(200), 60);
    return () => window.clearTimeout(timer);
  }, [count, fit]);

  const onNodesChange: OnNodesChange<Node> = (changes) => setNodes((current) => changes.applyTo(current));

  const isTop = module?.parentModuleId === null;
  const isRepeat = Boolean(module?.repeatsId);
  const why: Record<Exclude<Box, null>, string | null> = {
    module: !module || couple ? 'Select the module to add below first.' : isRepeat ? 'This box repeats another module, so it has nothing below it.' : null,
    library: !module || couple ? 'Select the module to add below first.' : isRepeat ? 'This box repeats another module, so it has nothing below it.' : null,
    couple: !module ? 'Select the module at the lower end of the line first.' : isTop ? 'The top module has no line above it.' : null,
    remove: couple ? null : !module ? 'Select a module or a couple first.' : isTop ? 'The top module cannot be removed. Delete the chart instead.' : null,
  };

  // A form that no longer fits what is selected is closed.
  useEffect(() => {
    if (box && why[box]) setBox(null);
  });

  const hint = box
    ? null
    : !module
      ? 'Click a module to select it. The tools on the left then add a module below it, add a couple to the line above it, or remove it.'
      : null;

  return (
    <div className="structure-work">
      <div className="structure-tools" role="toolbar" aria-label="Tools" aria-orientation="vertical">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`structure-tool${box === t.id ? ' is-selected' : ''}`}
            aria-pressed={box === t.id}
            disabled={why[t.id] !== null}
            title={why[t.id] ?? undefined}
            onClick={() => setBox(box === t.id ? null : t.id)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              {t.icon}
            </svg>
            {t.label}
          </button>
        ))}
      </div>
      <div ref={wrapper} className="structure-canvas">
        <ReactFlow
          nodes={nodes}
          edges={[]}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onInit={() => fit(0)}
          onNodeClick={(_, node) => selectElements([node.id])}
          onPaneClick={() => {
            clearSelection();
            setBox(null);
          }}
          nodesDraggable={false}
          nodesConnectable={false}
          deleteKeyCode={null}
          selectionKeyCode={null}
          multiSelectionKeyCode={null}
          forceColorMode={theme}
          minZoom={0.2}
          maxZoom={2}
          zoomOnDoubleClick={false}
        >
          <Background variant={BackgroundVariant.Lines} gap={24} lineWidth={0.5} />
          <Lines layout={layout} />
          <ZoomControl fit={() => fit(200)} />
          <Key />
        </ReactFlow>
        {hint && <div className="structure-hint">{hint}</div>}
        {box && !why[box] && <AddBox model={model} box={box} module={module} couple={couple} onClose={() => setBox(null)} />}
      </div>
    </div>
  );
}

export function ChartCanvas(props: ChartCanvasProps) {
  return (
    <ReactFlowProvider key={props.chartId}>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
