// The canvas of an interface structure diagram: the tool strip, the interface boxes, the
// navigation links and the zoom control. Drawing follows docs/SPEC.md section 10.6.

import { createContext, useContext, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  ConnectionLineType,
  Handle,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useConnection,
  useNodes,
  useReactFlow,
  useViewport,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { INTERFACE_SIZE, get, interfacesOn, linksOn, processNumber, type Id, type Model } from '../../model';
import { clearSelection, dispatch, selectElements, useElementFindings, useIsSelected, useModel, useSelection } from '../../store';
import { FindingMarks, Missing } from '../../components';
import { useTheme } from '../../theme/theme';

type Tool = 'select' | 'interface' | 'link';

const ToolContext = createContext<Tool>('select');

// ---- An interface box: its number, its name and its process numbers ----

function InterfaceNode({ id }: NodeProps) {
  const model = useModel();
  const selected = useIsSelected(id);
  const findings = useElementFindings(id);
  const tool = useContext(ToolContext);
  const connecting = useConnection((c) => c.inProgress);
  const face = get(model, id, 'interface');
  if (!face) return null;
  const linking = tool === 'link';
  const processes = face.processIds
    .filter((p) => get(model, p, 'process'))
    .map((p) => processNumber(model, p))
    .join(', ');

  return (
    <div className={`interface-box${selected ? ' is-selected' : ''}`} style={{ width: INTERFACE_SIZE.width, minHeight: INTERFACE_SIZE.height }}>
      <div className="interface-box-number">
        {face.number}
        <FindingMarks findings={findings} counts={false} />
      </div>
      <div className="interface-box-name">{face.name || <Missing>No name yet</Missing>}</div>
      <div className="interface-box-processes" title="The processes this interface carries out">
        {processes || ' '}
      </div>
      {/* Both handles cover the box. A drag starts on the source and ends on the target. */}
      <Handle type="source" position={Position.Bottom} isConnectable={linking} className={`interface-handle${linking && !connecting ? '' : ' interface-handle-off'}`} />
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={linking}
        isConnectableStart={false}
        className={`interface-handle${linking && connecting ? '' : ' interface-handle-off'}`}
      />
    </div>
  );
}

// ---- A navigation link: a line with no arrowhead ----

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The line between two boxes. When one is below the other it leaves the bottom of the
 * upper box and enters the top of the lower one, with a level piece half way, so that a
 * tree reads as a tree. Otherwise it runs straight between the facing sides.
 */
function linePath(a: Rect, b: Rect): string {
  const [upper, lower] = a.y <= b.y ? [a, b] : [b, a];
  const y1 = upper.y + upper.h;
  const y2 = lower.y;
  if (y2 - y1 >= 16) {
    const x1 = upper.x + upper.w / 2;
    const x2 = lower.x + lower.w / 2;
    const level = (y1 + y2) / 2;
    return `M ${x1} ${y1} V ${level} H ${x2} V ${y2}`;
  }
  const [left, right] = a.x <= b.x ? [a, b] : [b, a];
  if (right.x >= left.x + left.w) return `M ${left.x + left.w} ${left.y + left.h / 2} L ${right.x} ${right.y + right.h / 2}`;
  return `M ${a.x + a.w / 2} ${a.y + a.h / 2} L ${b.x + b.w / 2} ${b.y + b.h / 2}`;
}

function LinkEdge({ id, source, target }: EdgeProps) {
  const selected = useIsSelected(id);
  const nodes = useNodes();
  const rect = (nodeId: Id): Rect | undefined => {
    const n = nodes.find((x) => x.id === nodeId);
    if (!n) return undefined;
    return { x: n.position.x, y: n.position.y, w: n.measured?.width ?? INTERFACE_SIZE.width, h: n.measured?.height ?? INTERFACE_SIZE.height };
  };
  const a = rect(source);
  const b = rect(target);
  if (!a || !b) return null;
  return <BaseEdge path={linePath(a, b)} interactionWidth={18} style={{ stroke: selected ? 'var(--select)' : 'var(--ink)', strokeWidth: selected ? 2 : 1.25, fill: 'none' }} />;
}

const nodeTypes = { interface: InterfaceNode };
const edgeTypes = { link: LinkEdge };

// ---- The zoom control ----

function ZoomControl() {
  const flow = useReactFlow();
  const { zoom } = useViewport();
  return (
    <Panel position="bottom-left">
      <div className="interface-zoom" role="group" aria-label="Zoom">
        <button type="button" aria-label="Zoom out" onClick={() => void flow.zoomOut()}>
          −
        </button>
        <span className="interface-zoom-value">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Zoom in" onClick={() => void flow.zoomIn()}>
          +
        </button>
        <button type="button" className="interface-zoom-fit" onClick={() => void flow.fitView({ padding: '8%', maxZoom: 1 })}>
          Fit
        </button>
      </div>
    </Panel>
  );
}

// ---- The tool strip ----

const TOOLS: { id: Tool; label: string; icon: ReactNode }[] = [
  { id: 'select', label: 'Select', icon: <path d="M6 3 L6 19 L10 15 L13 21 L15 20 L12 14 L18 14 Z" /> },
  {
    id: 'interface',
    label: 'Interface',
    icon: (
      <>
        <rect x="3" y="4" width="18" height="16" />
        <path d="M3 9 H21 M3 16 H21" />
      </>
    ),
  },
  {
    id: 'link',
    label: 'Link',
    icon: (
      <>
        <rect x="8" y="2" width="8" height="5" />
        <rect x="8" y="17" width="8" height="5" />
        <path d="M12 7 V17" />
      </>
    ),
  },
];

// ---- The canvas ----

function buildNodes(model: Model, diagramId: Id, selectedIds: Id[], previous: Node[]): Node[] {
  const old = new Map(previous.map((n) => [n.id, n]));
  return interfacesOn(model, diagramId).map((face) => ({
    // Keeping the old node keeps the size React Flow measured for it.
    ...old.get(face.id),
    id: face.id,
    type: 'interface',
    position: model.views.isd[face.id] ?? { x: 60, y: 60 },
    data: {},
    selected: selectedIds.includes(face.id),
  }));
}

function Canvas({ diagramId }: { diagramId: Id }) {
  const model = useModel();
  const selection = useSelection();
  const theme = useTheme();
  const flow = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [nodes, setNodes] = useState<Node[]>(() => buildNodes(model, diagramId, selection.elementIds, []));
  // The small box that names a new interface: where it sits on screen, and where the interface will go.
  const [naming, setNaming] = useState<{ left: number; top: number; x: number; y: number } | null>(null);
  const namingDone = useRef(false);

  useEffect(() => {
    setNodes((previous) => buildNodes(model, diagramId, selection.elementIds, previous));
  }, [model, diagramId, selection.elementIds]);

  const edges = useMemo<Edge[]>(
    () =>
      linksOn(model, diagramId).map((link) => ({
        id: link.id,
        type: 'link',
        source: link.aId,
        target: link.bId,
        selected: selection.elementIds.includes(link.id),
      })),
    [model, diagramId, selection.elementIds],
  );

  const onNodesChange: OnNodesChange<Node> = (changes) => setNodes((current) => changes.applyTo(current));

  const chooseTool = (next: Tool) => {
    setTool(next);
    setNaming(null);
  };

  const onPaneClick = (event: ReactMouseEvent) => {
    if (tool === 'interface') {
      const box = wrapper.current?.getBoundingClientRect();
      if (!box) return;
      const at = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      namingDone.current = false;
      setNaming({ left: event.clientX - box.left, top: event.clientY - box.top, x: Math.round(at.x), y: Math.round(at.y) });
    } else if (tool === 'select') {
      clearSelection();
    }
  };

  const finishNaming = (name: string) => {
    if (namingDone.current || !naming) return;
    namingDone.current = true;
    setNaming(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    const result = dispatch({ type: 'addInterface', diagramId, name: trimmed, x: naming.x, y: naming.y });
    if (result.ok) {
      selectElements([result.created[0]]);
      setTool('select');
    }
  };

  const onConnect = (connection: Connection) => {
    const result = dispatch({ type: 'addNavigationLink', diagramId, aId: connection.source, bId: connection.target });
    if (result.ok) selectElements([result.created[0]]);
  };

  const hint =
    tool === 'interface'
      ? nodes.length === 0
        ? 'Click on the paper where the first interface should go, then type its name. It becomes interface 0, the main menu.'
        : 'Click on the paper where the new interface should go, then type its name. Change its number in the details.'
      : tool === 'link'
        ? 'Drag from one interface to another to say that the user can move between them.'
        : nodes.length === 0
          ? 'No interfaces yet. Choose "Interface" in the tool strip, then click on the paper to add one. Start with interface 0, the main menu.'
          : null;

  return (
    <div className="interface-work">
      <div className="interface-tools" role="toolbar" aria-label="Tools" aria-orientation="vertical">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" className={`interface-tool${tool === t.id ? ' is-selected' : ''}`} aria-pressed={tool === t.id} onClick={() => chooseTool(t.id)}>
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              {t.icon}
            </svg>
            {t.label}
          </button>
        ))}
      </div>
      <div ref={wrapper} className={`interface-canvas interface-canvas-${tool}`}>
        <ToolContext.Provider value={tool}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onNodeClick={(_, node) => selectElements([node.id])}
            onNodeDragStart={(_, node) => selectElements([node.id])}
            onNodeDragStop={(_, node) => {
              const was = model.views.isd[node.id];
              const x = Math.round(node.position.x);
              const y = Math.round(node.position.y);
              if (!was || was.x !== x || was.y !== y) dispatch({ type: 'moveInterface', interfaceId: node.id, x, y });
            }}
            onEdgeClick={(_, edge) => selectElements([edge.id])}
            onPaneClick={onPaneClick}
            onConnect={onConnect}
            nodesDraggable={tool === 'select'}
            nodesConnectable={tool === 'link'}
            connectionLineType={ConnectionLineType.Straight}
            deleteKeyCode={null}
            selectionKeyCode={null}
            multiSelectionKeyCode={null}
            forceColorMode={theme}
            fitView
            fitViewOptions={{ padding: '8%', maxZoom: 1 }}
            minZoom={0.25}
            maxZoom={2}
            zoomOnDoubleClick={false}
          >
            <Background variant={BackgroundVariant.Lines} gap={24} lineWidth={0.5} />
            <ZoomControl />
          </ReactFlow>
        </ToolContext.Provider>
        {hint && <div className="interface-hint">{hint}</div>}
        {naming && (
          <input
            className="input interface-name-box"
            style={{ left: naming.left, top: naming.top }}
            aria-label="Name of the new interface"
            placeholder="Interface name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') finishNaming(e.currentTarget.value);
              if (e.key === 'Escape') finishNaming('');
            }}
            onBlur={(e) => finishNaming(e.currentTarget.value)}
          />
        )}
      </div>
    </div>
  );
}

export function IsdCanvas({ diagramId }: { diagramId: Id }) {
  return (
    <ReactFlowProvider>
      <Canvas diagramId={diagramId} />
    </ReactFlowProvider>
  );
}
