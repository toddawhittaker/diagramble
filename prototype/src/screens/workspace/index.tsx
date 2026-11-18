// Screen 1 of docs/mockups/BRIEFS.md: the diagram canvas. Route: /diagram/:diagramId

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  type Connection,
  type EdgeTypes,
  type NodeChangeset,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './workspace.css';
import { Button, EntryFields, ProblemsPanel, TextField } from '../../components';
import { DiagramHeader, PageHeader, RightPanel, WorkArea } from '../../frame';
import {
  KIND_WORDS,
  all,
  childDiagram,
  dataDefinitions,
  elementLabel,
  get,
  getFragment,
  isAboveProject,
  isNode,
  isShownOn,
  occurrencesOn,
  processesOn,
  type Id,
  type Model,
} from '../../model';
import { clearSelection, dispatch, getModel, selectElements, useFindings, useModel, useSelection } from '../../store';
import { useTheme } from '../../theme/theme';
import { AddSymbolBox, ControlBox, DataBox, TOOLS, ToolIcon, type DataChoice } from './boxes';
import { FlowEdge } from './FlowEdge';
import { buildCanvas, type CanvasEdge, type CanvasNode } from './layout';
import { EndView, SymbolView } from './nodes';
import { CanvasUiContext, type CanvasUi, type Tool } from './ui';

const nodeTypes: NodeTypes = { symbol: SymbolView, end: EndView };
const edgeTypes: EdgeTypes = { flow: FlowEdge };

const BOX_WIDTH = 280;
const BOX_HEIGHT = 300;

type SymbolKind = 'process' | 'dataStore' | 'externalEntity';

/** The small box open on the canvas, if any. `left` and `top` are relative to the canvas. */
type OpenBox =
  | { type: 'add'; left: number; top: number; kind: SymbolKind; x: number; y: number }
  | { type: 'flow'; left: number; top: number; sourceOcc: Id; targetOcc: Id }
  | { type: 'data'; left: number; top: number; flowId: Id }
  | { type: 'control'; left: number; top: number; targetId: Id | null };

export function WorkspaceScreen() {
  const { diagramId = '' } = useParams();
  const model = useModel();
  if (!get(model, diagramId, 'diagram'))
    return (
      <WorkArea>
        <PageHeader breadcrumb={['Diagrams']} title="No such diagram" />
        <div className="work-body placeholder">This project has no diagram with that address.</div>
      </WorkArea>
    );
  return (
    <>
      <WorkArea>
        <DiagramHeader diagramId={diagramId} view="canvas" />
        <div className="work-body workspace-body">
          {/* The key makes a fresh canvas, fitted to its diagram, each time the route changes. */}
          <ReactFlowProvider key={diagramId}>
            <Workspace diagramId={diagramId} />
          </ReactFlowProvider>
        </div>
      </WorkArea>
      <RightPanel label="Problems">
        <ProblemsPanel diagramId={diagramId} />
      </RightPanel>
    </>
  );
}

/** The selected ids that are drawn on this diagram: its flows and the elements it shows. */
function selectedHere(model: Model, diagramId: Id, ids: Id[]): Id[] {
  return ids.filter((id) => {
    const e = model.elements[id];
    if (!e) return false;
    if (e.kind === 'dataFlow' || e.kind === 'controlFlow') return e.diagramId === diagramId;
    return isNode(e) && isShownOn(model, id, diagramId);
  });
}

function Workspace({ diagramId }: { diagramId: Id }) {
  const model = useModel();
  const findings = useFindings();
  const selection = useSelection();
  const theme = useTheme();
  const navigate = useNavigate();
  const flow = useReactFlow<CanvasNode, CanvasEdge>();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>('select');
  const [live, setLive] = useState<Record<Id, { x: number; y: number }>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [box, setBox] = useState<OpenBox | null>(null);
  /** The symbol last clicked, so that Delete removes that symbol and not another of the same element. */
  const [pickedOcc, setPickedOcc] = useState<Id | null>(null);
  const [confirming, setConfirming] = useState<Id[] | null>(null);

  /** The process shown as a fragment, if any. Everything not part of its fragment is dimmed. */
  const [fragmentOf, setFragmentOf] = useState<Id | null>(null);

  const selectedSet = useMemo(() => new Set(selection.elementIds), [selection.elementIds]);
  const built = useMemo(
    () => buildCanvas(model, findings, diagramId, selectedSet, live),
    [model, findings, diagramId, selectedSet, live],
  );
  const fragment = useMemo(() => {
    const found = fragmentOf ? getFragment(model, fragmentOf) : undefined;
    return found && found.diagramId === diagramId ? found : undefined;
  }, [model, fragmentOf, diagramId]);
  const { nodes, edges, dimmedFlows } = useMemo(() => {
    if (!fragment) return { ...built, dimmedFlows: NO_IDS };
    const keptFlows = new Set<Id>([...fragment.flows.map((f) => f.flow.id), ...fragment.controlFlows.map((c) => c.id)]);
    // Keep the process, and whatever sits at either end of a kept flow: a symbol, a note or a loose end.
    const keptNodes = new Set<string>();
    for (const e of built.edges) if (keptFlows.has(e.id)) keptNodes.add(e.source).add(e.target);
    for (const n of built.nodes) if (n.type === 'symbol' && n.data.elementId === fragment.process.id) keptNodes.add(n.id);
    return {
      nodes: built.nodes.map((n): CanvasNode => (keptNodes.has(n.id) ? n : { ...n, className: 'workspace-dim' })),
      edges: built.edges.map((e): CanvasEdge => (keptFlows.has(e.id) ? e : { ...e, className: 'workspace-dim' })),
      dimmedFlows: new Set(built.edges.filter((e) => !keptFlows.has(e.id)).map((e) => e.id)),
    };
  }, [built, fragment]);
  const here = useMemo(() => selectedHere(model, diagramId, selection.elementIds), [model, diagramId, selection.elementIds]);

  // A pending "are you sure" belongs to one selection. Drop it when the selection changes.
  useEffect(() => setConfirming(null), [selection.elementIds]);

  /** Where to open a box for a point of the window, kept inside the canvas. */
  const placeBox = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { left: 0, top: 0 };
    return {
      left: Math.max(8, Math.min(clientX - rect.left, rect.width - BOX_WIDTH - 8)),
      top: Math.max(8, Math.min(clientY - rect.top, rect.height - BOX_HEIGHT - 8)),
    };
  }, []);

  const closeBox = useCallback(() => {
    setBox(null);
    setTool('select');
  }, []);

  const chooseTool = (next: Tool) => {
    setTool(next);
    setBox(null);
    setEditing(null);
  };

  const ui = useMemo<CanvasUi>(
    () => ({
      tool,
      editing,
      setEditing,
      dimmedFlows,
      editFlow: (flowId, clientX, clientY) => {
        const e = getModel().elements[flowId];
        if (e?.kind === 'controlFlow') setEditing(flowId);
        else if (e?.kind === 'dataFlow') setBox({ type: 'data', flowId, ...placeBox(clientX, clientY) });
      },
      openDiagram: (id) => navigate(`/diagram/${id}`),
    }),
    [tool, editing, dimmedFlows, placeBox, navigate],
  );

  // ---- Deleting ----

  const performDelete = (ids: Id[]) => {
    for (const id of ids) {
      // An earlier step may already have removed this one: deleting a process removes its flows.
      const e = getModel().elements[id];
      if (!e) continue;
      if (e.kind === 'externalEntity' || e.kind === 'dataStore') {
        const occurrences = occurrencesOn(getModel(), diagramId).filter((o) => o.elementId === id);
        const occurrence = occurrences.find((o) => o.id === pickedOcc) ?? occurrences[0];
        if (occurrence) dispatch({ type: 'removeOccurrence', occurrenceId: occurrence.id });
      } else {
        dispatch({ type: 'deleteElement', id });
      }
    }
    setConfirming(null);
  };

  const requestDelete = () => {
    if (here.length === 0) return;
    const hasChild = here.some((id) => childDiagram(model, id));
    if (here.length > 1 || hasChild) setConfirming(here);
    else performDelete(here);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input, textarea, select')) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      requestDelete();
    } else if (e.key === 'Escape') {
      // The first press closes an open box or drops the tool. With neither, it leaves the fragment view.
      if (box || tool !== 'select') closeBox();
      else setFragmentOf(null);
    }
  };

  /** Brings down the flows added to a process's parent diagram since its child diagram was made, then shows them. */
  const bringDown = (processId: Id) => {
    const r = dispatch({ type: 'carryDown', processId });
    if (!r.ok) return;
    const child = childDiagram(getModel(), processId);
    selectElements(r.created);
    if (child && child.id !== diagramId) navigate(`/diagram/${child.id}`);
  };

  // ---- Canvas events ----

  const onNodesChange = useCallback((changes: NodeChangeset<CanvasNode>) => {
    // Only a drag moves a symbol. The position is kept here until the drag ends.
    const moves = changes.getByType('position').filter((c) => c.dragging && c.position);
    if (moves.length === 0) return;
    setLive((prev) => {
      const next = { ...prev };
      for (const c of moves) next[c.id] = c.position!;
      return next;
    });
  }, []);

  const onNodeDragStop = (_: unknown, _node: CanvasNode, dragged: CanvasNode[]) => {
    for (const n of dragged) {
      const occurrence = model.views.occurrences[n.id];
      if (!occurrence) continue;
      const x = Math.round(n.position.x);
      const y = Math.round(n.position.y);
      if (x !== occurrence.x || y !== occurrence.y) dispatch({ type: 'moveNode', occurrenceId: n.id, x, y });
    }
    setLive({});
  };

  const onNodeClick = (e: MouseEvent, node: CanvasNode) => {
    if (node.type === 'end') {
      selectElements([node.data.flowId]);
      return;
    }
    if (tool === 'controlFlow' && node.data.kind === 'process') {
      setBox({ type: 'control', targetId: node.data.elementId, ...placeBox(e.clientX, e.clientY) });
      return;
    }
    setPickedOcc(node.id);
    selectElements([node.data.elementId]);
  };

  const onPaneClick = (e: MouseEvent) => {
    setEditing(null);
    if (tool === 'process' || tool === 'dataStore' || tool === 'externalEntity') {
      const p = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setBox({ type: 'add', kind: tool, x: p.x, y: p.y, ...placeBox(e.clientX, e.clientY) });
    } else if (tool === 'controlFlow') {
      setBox({ type: 'control', targetId: null, ...placeBox(e.clientX, e.clientY) });
    } else {
      setBox(null);
      clearSelection();
    }
  };

  const onConnect = (c: Connection) => {
    const source = nodes.find((n) => n.id === c.source);
    const target = nodes.find((n) => n.id === c.target);
    if (!source || !target || source.id === target.id) return;

    // Dragging between a loose end and a symbol attaches that end of the flow.
    const loose = source.type === 'end' ? source : target.type === 'end' ? target : null;
    const symbol = source.type === 'symbol' ? source : target.type === 'symbol' ? target : null;
    if (loose && loose.type === 'end') {
      if (!symbol || symbol.type !== 'symbol' || loose.data.variant !== 'loose') return;
      const r = dispatch(
        loose.data.end === 'source'
          ? { type: 'setFlowEnds', flowId: loose.data.flowId, sourceId: symbol.data.elementId, sourceOccurrenceId: symbol.id }
          : { type: 'setFlowEnds', flowId: loose.data.flowId, targetId: symbol.data.elementId, targetOccurrenceId: symbol.id },
      );
      if (r.ok) selectElements([loose.data.flowId]);
      return;
    }

    // Otherwise it is a new flow. Ask what it carries, at the middle of the line.
    const centre = (n: CanvasNode) => ({ x: n.position.x + (n.width ?? 0) / 2, y: n.position.y + (n.height ?? 0) / 2 });
    const a = centre(source);
    const b = centre(target);
    const at = flow.flowToScreenPosition({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    setBox({ type: 'flow', sourceOcc: source.id, targetOcc: target.id, ...placeBox(at.x, at.y) });
  };

  // ---- What the boxes do ----

  const addSymbol = (b: Extract<OpenBox, { type: 'add' }>, name: string) => {
    const size = { process: [170, 96], dataStore: [200, 56], externalEntity: [120, 90] }[b.kind];
    const at = { x: Math.round(b.x - size[0] / 2), y: Math.round(b.y - size[1] / 2) };
    const type = b.kind === 'process' ? 'addProcess' : b.kind === 'dataStore' ? 'addDataStore' : 'addExternalEntity';
    const r = dispatch({ type, diagramId, name, ...at });
    if (!r.ok) return;
    setPickedOcc(r.created[1] ?? null);
    selectElements([r.created[0]]);
    closeBox();
  };

  const placeSymbol = (b: Extract<OpenBox, { type: 'add' }>, elementId: Id) => {
    const size = b.kind === 'dataStore' ? [200, 56] : [120, 90];
    const r = dispatch({
      type: 'placeExisting',
      diagramId,
      elementId,
      x: Math.round(b.x - size[0] / 2),
      y: Math.round(b.y - size[1] / 2),
    });
    if (!r.ok) return;
    setPickedOcc(r.created[0] ?? null);
    selectElements([elementId]);
    closeBox();
  };

  const addFlow = (b: Extract<OpenBox, { type: 'flow' }>, choice: DataChoice) => {
    const s = model.views.occurrences[b.sourceOcc];
    const t = model.views.occurrences[b.targetOcc];
    if (!s || !t) return closeBox();
    const r = dispatch({
      type: 'addFlow',
      diagramId,
      sourceId: s.elementId,
      targetId: t.elementId,
      sourceOccurrenceId: s.id,
      targetOccurrenceId: t.id,
      ...choice,
    });
    if (!r.ok) return;
    selectElements([r.created[0]]);
    closeBox();
  };

  const existingFor = (kind: SymbolKind) =>
    kind === 'process'
      ? []
      : all(model, kind)
          .filter((e) => !isShownOn(model, e.id, diagramId))
          .map((element) => ({ element, label: elementLabel(model, element.id) }));

  const isEmpty = nodes.length === 0 && edges.length === 0;
  const adding = tool === 'process' || tool === 'dataStore' || tool === 'externalEntity' || tool === 'controlFlow';

  return (
    <CanvasUiContext.Provider value={ui}>
      <div className="workspace-tools" role="toolbar" aria-label="Tools" aria-orientation="vertical">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`workspace-tool${tool === t.id ? ' is-selected' : ''}`}
            aria-pressed={tool === t.id}
            onClick={() => chooseTool(t.id)}
          >
            <ToolIcon tool={t.id} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="workspace-column">
        {isAboveProject(model, diagramId) && (
          <div className="workspace-notice">
            This diagram is above the project, so nothing on it is checked. <Link to="/project">Open the Project page</Link>
          </div>
        )}
        <div
          ref={canvasRef}
          className={`workspace-canvas${adding ? ' workspace-adding' : ''}${tool === 'dataFlow' ? ' workspace-connecting' : ''}`}
          tabIndex={-1}
          onKeyDown={onKeyDown}
        >
          <ReactFlow<CanvasNode, CanvasEdge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={onNodeClick}
            onEdgeClick={(_, edge) => selectElements([edge.id])}
            onPaneClick={onPaneClick}
            onConnect={onConnect}
            forceColorMode={theme}
            fitView
            fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
            minZoom={0.25}
            maxZoom={2}
            nodesDraggable={tool === 'select'}
            deleteKeyCode={null}
            selectionKeyCode={null}
            multiSelectionKeyCode={null}
            zoomOnDoubleClick={false}
            // No lifting of selected items: a lifted line would block clicks on a symbol it crosses.
            zIndexMode="manual"
            connectionLineType={ConnectionLineType.Straight}
            aria-label="Diagram canvas"
          >
            <Background variant={BackgroundVariant.Lines} gap={20} lineWidth={1} className="workspace-grid" />
            <ZoomControl />
            {isEmpty && (
              <Panel position="center-left" className="workspace-empty">
                This diagram is empty. Choose a tool on the left, then click here to add a symbol.
              </Panel>
            )}
            {fragment && (
              <Panel position="top-right" className="workspace-fragment">
                <span>
                  Fragment of <strong>{elementLabel(model, fragment.process.id)}</strong>
                </span>
                <Button small onClick={() => setFragmentOf(null)}>
                  Show the whole diagram
                </Button>
              </Panel>
            )}
            {tool !== 'select' && !box && (
              <Panel position="top-center" className="workspace-hint">
                {TOOL_HINTS[tool]}
              </Panel>
            )}
          </ReactFlow>

          {box?.type === 'add' && (
            <AddSymbolBox
              key={`${box.left},${box.top}`}
              left={box.left}
              top={box.top}
              kind={box.kind}
              existing={existingFor(box.kind)}
              onAdd={(name) => addSymbol(box, name)}
              onPlace={(id) => placeSymbol(box, id)}
              onCancel={closeBox}
            />
          )}
          {box?.type === 'flow' && (
            <DataBox
              left={box.left}
              top={box.top}
              title="What data does this flow carry?"
              initial=""
              definitions={dataDefinitions(model)}
              onPick={(choice) => addFlow(box, choice)}
              onCancel={closeBox}
            />
          )}
          {box?.type === 'data' && (
            <DataBox
              key={box.flowId}
              left={box.left}
              top={box.top}
              title="Change the data this flow carries"
              initial={elementLabel(model, box.flowId)}
              definitions={dataDefinitions(model)}
              onPick={(choice) => {
                const current = get(model, box.flowId, 'dataFlow');
                const same = 'dataId' in choice && choice.dataId === current?.dataId;
                if (same || dispatch({ type: 'setFlowData', flowId: box.flowId, ...choice }).ok) closeBox();
              }}
              onCancel={closeBox}
            />
          )}
          {box?.type === 'control' && (
            <ControlBox
              key={`${box.left},${box.top},${box.targetId}`}
              left={box.left}
              top={box.top}
              processes={processesOn(model, diagramId).map((process) => ({ process, label: elementLabel(model, process.id) }))}
              initialTargetId={box.targetId}
              onAdd={(targetId, name) => {
                const r = dispatch({ type: 'addControlFlow', diagramId, targetId, name });
                if (!r.ok) return;
                selectElements([r.created[0]]);
                closeBox();
              }}
              onCancel={closeBox}
            />
          )}
        </div>

        <DetailStrip
          model={model}
          diagramId={diagramId}
          ids={here}
          confirming={confirming !== null}
          onDelete={requestDelete}
          onConfirm={() => performDelete(confirming ?? [])}
          onCancel={() => setConfirming(null)}
          fragmentOf={fragment ? fragment.process.id : null}
          onFragment={setFragmentOf}
          onBringDown={bringDown}
          onExpand={(processId) => {
            const r = dispatch({ type: 'expandProcess', processId });
            if (r.ok) navigate(`/diagram/${r.created[0]}`);
          }}
        />
      </div>
    </CanvasUiContext.Provider>
  );
}

const NO_IDS: ReadonlySet<Id> = new Set();

const TOOL_HINTS: Record<Exclude<Tool, 'select'>, string> = {
  process: 'Click on the canvas where the new process should go.',
  dataStore: 'Click on the canvas where the data store should go.',
  externalEntity: 'Click on the canvas where the external entity should go.',
  dataFlow: 'Drag from one symbol to another.',
  controlFlow: 'Click the process the control flow goes into.',
};

/** "−", the percentage, "+", and "Fit", in the bottom left corner of the canvas. */
function ZoomControl() {
  const flow = useReactFlow();
  const { zoom } = useViewport();
  return (
    <Panel position="bottom-left" className="workspace-zoom">
      <button type="button" aria-label="Zoom out" onClick={() => flow.zoomOut()}>
        −
      </button>
      <span className="mono workspace-zoom-value" aria-label="Zoom">
        {Math.round(zoom * 100)}%
      </span>
      <button type="button" aria-label="Zoom in" onClick={() => flow.zoomIn()}>
        +
      </button>
      <button type="button" className="workspace-zoom-fit" onClick={() => flow.fitView({ padding: 0.12, maxZoom: 1 })}>
        Fit
      </button>
    </Panel>
  );
}

/** An element's description, saved when the field loses focus. */
function Description({ id, value }: { id: Id; value: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <TextField
      label="Description"
      hideLabel
      value={draft}
      placeholder="No description yet"
      onChange={setDraft}
      onCommit={(next) => {
        if (next !== value) dispatch({ type: 'describe', id, description: next });
      }}
    />
  );
}

/** The strip under the canvas: the selected item's name, description and actions. */
function DetailStrip({
  model,
  diagramId,
  ids,
  confirming,
  onDelete,
  onConfirm,
  onCancel,
  onExpand,
  fragmentOf,
  onFragment,
  onBringDown,
}: {
  model: Model;
  diagramId: Id;
  ids: Id[];
  confirming: boolean;
  onDelete: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onExpand: (processId: Id) => void;
  /** The process shown as a fragment, or null. */
  fragmentOf: Id | null;
  onFragment: (processId: Id | null) => void;
  onBringDown: (processId: Id) => void;
}) {
  /** Whether the aliases, the notes and the process description are open. It stays as it is from one selection to the next. */
  const [more, setMore] = useState(false);

  if (ids.length === 0) {
    // On a child diagram, offer to bring down what was added to the process it expands.
    const parentId = get(model, diagramId, 'diagram')?.decomposesProcessId ?? null;
    return (
      <div className="workspace-detail">
        <span className="muted">Select a symbol or a flow to see its description and what you can do with it.</span>
        {parentId && (
          <div className="hstack workspace-detail-actions">
            <Button small onClick={() => onBringDown(parentId)}>
              Bring down new flows
            </Button>
            <span className="muted">
              Copies here each flow added to {elementLabel(model, parentId)} on its own diagram since this diagram was made.
            </span>
          </div>
        )}
      </div>
    );
  }

  const element = model.elements[ids[0]];
  const single = ids.length === 1 ? element : null;
  const child = single?.kind === 'process' ? childDiagram(model, single.id) : undefined;

  let title = `${ids.length} items selected`;
  let detail = ids.map((id) => elementLabel(model, id)).join(', ');
  if (single) {
    title = elementLabel(model, single.id) || 'No name';
    detail = KIND_WORDS[single.kind];
    if (single.kind === 'dataFlow')
      detail = `data flow, from ${elementLabel(model, single.sourceId)} to ${elementLabel(model, single.targetId)}`;
    if (single.kind === 'controlFlow') detail = `control flow, into ${elementLabel(model, single.targetId)}`;
    if ((single.kind === 'externalEntity' || single.kind === 'dataStore') && !confirming) {
      const count = occurrencesOn(model, diagramId).filter((o) => o.elementId === single.id).length;
      if (count > 1) detail += `, shown ${count} times on this diagram`;
    }
  }

  const hasChild = ids.some((id) => childDiagram(model, id));
  const question = single
    ? `Delete '${single.name}' and its child diagram?`
    : `Delete these ${ids.length} items${hasChild ? ', and the child diagram of each process' : ''}?`;

  return (
    <div className="workspace-detail">
      <div className="workspace-detail-head">
        <span className="workspace-detail-title">{title}</span>
        <span className="muted workspace-detail-kind">{detail}</span>
        {single && (
          <Button small aria-expanded={more} title="Aliases, notes and, for a process, the process description" onClick={() => setMore(!more)}>
            {more ? 'Less' : 'More'}
          </Button>
        )}
      </div>
      {single && <Description key={single.id} id={single.id} value={single.description} />}
      {single && more && (
        <div className="workspace-entry">
          <EntryFields key={single.id} elementId={single.id} compact />
        </div>
      )}
      {confirming ? (
        <div className="hstack workspace-detail-actions">
          <span className="workspace-detail-question">{question}</span>
          <Button small variant="primary" onClick={onConfirm}>
            Delete
          </Button>
          <Button small onClick={onCancel}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="hstack workspace-detail-actions">
          {single?.kind === 'process' &&
            (child ? (
              <>
                <Link className="btn btn-small" to={`/diagram/${child.id}`}>
                  Open child diagram
                </Link>
                <Button
                  small
                  title="Copies onto the child diagram each flow added to this process since the child diagram was made"
                  onClick={() => onBringDown(single.id)}
                >
                  Bring down new flows
                </Button>
              </>
            ) : (
              <Button small onClick={() => onExpand(single.id)}>
                Expand into a child diagram
              </Button>
            ))}
          {single?.kind === 'process' && (
            <Button small aria-pressed={fragmentOf === single.id} onClick={() => onFragment(fragmentOf === single.id ? null : single.id)}>
              {fragmentOf === single.id ? 'Show the whole diagram' : 'Show as fragment'}
            </Button>
          )}
          {single?.kind === 'dataFlow' && (
            <Link className="btn btn-small" to={`/dictionary/${single.dataId}`}>
              Open in data dictionary
            </Link>
          )}
          <Button
            small
            onClick={onDelete}
            title={
              single?.kind === 'externalEntity' || single?.kind === 'dataStore'
                ? 'Removes this symbol from the diagram, with the flows attached to it'
                : undefined
            }
          >
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}
