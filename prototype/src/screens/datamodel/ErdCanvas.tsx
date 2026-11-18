// The canvas of the entity relationship diagram: the tool strip, the entity boxes, the
// relationship lines with their crow's foot ends, and the zoom control.
// Drawing follows docs/SPEC.md section 9.2.

import { createContext, useContext, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  ConnectionLineType,
  EdgeLabelRenderer,
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
import { all, fullIdentifier, get, isDependent, tableFields, type Entity, type Id, type Model, type Relationship, type RelationshipEnd, type TableField } from '../../model';
import { clearSelection, dispatch, selectElements, useElementFindings, useIsSelected, useMode, useSelection, useViewModel } from '../../store';
import { typeAndLength } from './shared';
import { FindingMarks, Missing } from '../../components';
import { useTheme } from '../../theme/theme';

type Tool = 'select' | 'entity' | 'relationship';

const ToolContext = createContext<Tool>('select');

// ---- An entity box ----

/**
 * The inside of a table, as section 11.5 draws it: the primary key fields above the dashed
 * line, PK and FK as small tags in front of the field name, and the type and length after it.
 */
function TableBody({ model, entity, namedIds }: { model: Model; entity: Entity; namedIds: Id[] }) {
  const fields = tableFields(model, entity.id);
  const keys = fields.filter((f) => f.pk);
  const rest = fields.filter((f) => !f.pk);
  const from = (f: TableField) => (f.fromEntityId ? model.elements[f.fromEntityId]?.name || 'another table' : 'another table');
  const row = (f: TableField, index: number) => {
    const tags = [f.pk && 'PK', f.fk && 'FK'].filter(Boolean).join(' ');
    const title = f.fk
      ? `Foreign key: the primary key of ${from(f)}`
      : f.copy
        ? `A copy of a field of ${from(f)}, kept here for speed`
        : f.element.systemRelated
          ? `${f.element.name}: a system-related field`
          : f.element.name;
    return (
      <li
        key={`${f.dataId}:${index}`}
        title={title}
        className={`datamodel-field${f.copy ? ' datamodel-field-copy' : ''}${!f.fk && !f.copy && namedIds.includes(f.dataId) ? ' datamodel-field-named' : ''}`}
      >
        <span className="datamodel-field-tags">{tags}</span>
        <span className="datamodel-field-name">{f.element.fieldName.trim() ? f.name : <Missing>{f.element.name}</Missing>}</span>
        <span className="datamodel-field-type">{typeAndLength(f.element)}</span>
      </li>
    );
  };
  return (
    <>
      {entity.systemRelated && <div className="datamodel-entity-system">system-related</div>}
      {keys.length > 0 && <ul className="datamodel-entity-list">{keys.map(row)}</ul>}
      {(rest.length > 0 || keys.length === 0) && (
        <ul className="datamodel-entity-list">
          {rest.map(row)}
          {fields.length === 0 && (
            <li>
              <Missing>No fields yet</Missing>
            </li>
          )}
        </ul>
      )}
    </>
  );
}

function EntityNode({ id }: NodeProps) {
  const model = useViewModel();
  const physical = useMode() === 'physical';
  const selection = useSelection();
  const selected = useIsSelected(id);
  const findings = useElementFindings(id);
  const tool = useContext(ToolContext);
  const connecting = useConnection((c) => c.inProgress);
  const entity = get(model, id, 'entity');
  if (!entity) return null;

  const ownIds = entity.attributes.filter((a) => a.identifier).map((a) => a.dataId);
  const inherited = fullIdentifier(model, id).filter((dataId) => !ownIds.includes(dataId));
  const others = entity.attributes.filter((a) => !a.identifier);
  const nameOf = (dataId: Id) => model.elements[dataId]?.name ?? '';
  /** A repeating attribute is drawn in braces. */
  const shown = (dataId: Id) => (entity.attributes.some((a) => a.dataId === dataId && a.repeats) ? `{${nameOf(dataId)}}` : nameOf(dataId));
  const linking = tool === 'relationship';
  const hasIdentifiers = ownIds.length + inherited.length > 0;

  return (
    <div className={`datamodel-entity${isDependent(model, id) ? ' datamodel-entity-dependent' : ''}${selected ? ' is-selected' : ''}`}>
      <div className="datamodel-entity-name" title={physical ? `The table for the entity ${entity.name}` : undefined}>
        {physical ? entity.tableName.trim() || <Missing>{entity.name || 'No table name yet'}</Missing> : entity.name || <Missing>No name yet</Missing>}
        <FindingMarks findings={findings} counts={false} />
      </div>
      {physical && <TableBody model={model} entity={entity} namedIds={selection.elementIds} />}
      {!physical && hasIdentifiers && (
        <ul className="datamodel-entity-list">
          {ownIds.map((dataId) => (
            <li key={dataId}>
              <span className="datamodel-entity-star">*</span>
              {shown(dataId)}
            </li>
          ))}
          {inherited.map((dataId) => (
            <li key={dataId} className="datamodel-entity-inherited" title="Inherited from a parent entity">
              <span className="datamodel-entity-star">*</span>
              {nameOf(dataId)}
            </li>
          ))}
        </ul>
      )}
      {!physical && (others.length > 0 || !hasIdentifiers) && (
        <ul className="datamodel-entity-list">
          {others.map((a) => (
            <li key={a.dataId}>
              <span className="datamodel-entity-star" />
              {shown(a.dataId)}
            </li>
          ))}
          {entity.attributes.length === 0 && !hasIdentifiers && (
            <li>
              <Missing>No attributes yet</Missing>
            </li>
          )}
        </ul>
      )}
      {/* Both handles cover the box. A drag starts on the source and ends on the target. */}
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={linking}
        className={`datamodel-handle${linking && !connecting ? '' : ' datamodel-handle-off'}`}
      />
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={linking}
        isConnectableStart={false}
        className={`datamodel-handle${linking && connecting ? '' : ' datamodel-handle-off'}`}
      />
    </div>
  );
}

// ---- A relationship line ----

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where a line meets a box, and the direction pointing away from the box. */
interface EndPoint {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

/** The length of the straight piece beside each box, which holds the two symbols. */
const STUB = 32;

type Side = 'left' | 'right' | 'top' | 'bottom';

interface Line {
  path: string;
  ends: [EndPoint, EndPoint];
}

/** A point on one side of a box, `along` pixels from the start of that side. */
function pointOn(r: Rect, side: Side, along: number): EndPoint {
  if (side === 'left') return { x: r.x, y: r.y + along, dx: -1, dy: 0 };
  if (side === 'right') return { x: r.x + r.w, y: r.y + along, dx: 1, dy: 0 };
  if (side === 'top') return { x: r.x + along, y: r.y, dx: 0, dy: -1 };
  return { x: r.x + along, y: r.y + r.h, dx: 0, dy: 1 };
}

/**
 * Works out every relationship line at once. Each line joins the facing sides of its two
 * boxes. Lines that meet the same side of a box are spread along that side, in the order
 * of the boxes they come from, so that they do not sit on top of each other.
 */
function layoutLines(relationships: Relationship[], rects: Map<Id, Rect>): Map<Id, Line> {
  const lines = new Map<Id, Line>();
  interface Attachment {
    relId: Id;
    end: 0 | 1;
    side: Side;
    /** Where the other box's middle is, along this side. Used to put the lines in order. */
    towards: number;
  }
  const bySide = new Map<string, Attachment[]>();
  const attach = (entityId: Id, a: Attachment) => {
    const key = `${entityId}|${a.side}`;
    bySide.set(key, [...(bySide.get(key) ?? []), a]);
  };

  for (const rel of relationships) {
    const a = rects.get(rel.ends[0].entityId);
    const b = rects.get(rel.ends[1].entityId);
    if (!a || !b) continue;
    if (rel.ends[0].entityId === rel.ends[1].entityId) {
      // A relationship from an entity to itself loops out of the right side.
      const right = a.x + a.w;
      const middle = a.y + a.h / 2;
      const off = Math.max(6, Math.min(22, a.h / 2 - 4));
      const far = right + STUB + 18;
      lines.set(rel.id, {
        path: `M ${right} ${middle - off} H ${far} V ${middle + off} H ${right}`,
        ends: [
          { x: right, y: middle - off, dx: 1, dy: 0 },
          { x: right, y: middle + off, dx: 1, dy: 0 },
        ],
      });
      continue;
    }
    const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
    const gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
    if (gapX >= gapY) {
      const bIsRight = b.x + b.w / 2 >= a.x + a.w / 2;
      attach(rel.ends[0].entityId, { relId: rel.id, end: 0, side: bIsRight ? 'right' : 'left', towards: b.y + b.h / 2 });
      attach(rel.ends[1].entityId, { relId: rel.id, end: 1, side: bIsRight ? 'left' : 'right', towards: a.y + a.h / 2 });
    } else {
      const bIsBelow = b.y + b.h / 2 >= a.y + a.h / 2;
      attach(rel.ends[0].entityId, { relId: rel.id, end: 0, side: bIsBelow ? 'bottom' : 'top', towards: b.x + b.w / 2 });
      attach(rel.ends[1].entityId, { relId: rel.id, end: 1, side: bIsBelow ? 'top' : 'bottom', towards: a.x + a.w / 2 });
    }
  }

  // Spread the lines along each side.
  const points = new Map<string, { point: EndPoint; alone: boolean; side: Side }>();
  for (const [key, list] of bySide) {
    const rect = rects.get(key.split('|')[0]);
    if (!rect) continue;
    const sorted = [...list].sort((p, q) => p.towards - q.towards || p.relId.localeCompare(q.relId) || p.end - q.end);
    sorted.forEach((a, i) => {
      const length = a.side === 'left' || a.side === 'right' ? rect.h : rect.w;
      points.set(`${a.relId}|${a.end}`, { point: pointOn(rect, a.side, (length * (i + 1)) / (sorted.length + 1)), alone: sorted.length === 1, side: a.side });
    });
  }

  for (const rel of relationships) {
    const p = points.get(`${rel.id}|0`);
    const q = points.get(`${rel.id}|1`);
    const a = rects.get(rel.ends[0].entityId);
    const b = rects.get(rel.ends[1].entityId);
    if (!p || !q || !a || !b) continue;
    let [from, to] = [p.point, q.point];
    // The only line on both of its sides is drawn straight when the two sides overlap.
    if (p.alone && q.alone) {
      const across = p.side === 'left' || p.side === 'right';
      const start = Math.max(across ? a.y : a.x, across ? b.y : b.x) + 10;
      const stop = Math.min(across ? a.y + a.h : a.x + a.w, across ? b.y + b.h : b.x + b.w) - 10;
      if (start <= stop) {
        const shared = (start + stop) / 2;
        from = across ? { ...from, y: shared } : { ...from, x: shared };
        to = across ? { ...to, y: shared } : { ...to, x: shared };
      }
    }
    lines.set(rel.id, {
      path: `M ${from.x} ${from.y} L ${from.x + from.dx * STUB} ${from.y + from.dy * STUB} L ${to.x + to.dx * STUB} ${to.y + to.dy * STUB} L ${to.x} ${to.y}`,
      ends: [from, to],
    });
  }
  return lines;
}

/** A question mark on the line, kept upright, in place of a symbol that is not decided yet. */
function Undecided({ x, angle, colour }: { x: number; angle: number; colour: string }) {
  return (
    <g transform={`rotate(${-angle} ${x} 0)`}>
      <rect className="datamodel-rel-unknown-back" x={x - 5} y={-8} width={10} height={16} />
      <text className="datamodel-rel-unknown" x={x} y={0} style={{ fill: colour }}>
        ?
      </text>
    </g>
  );
}

/**
 * The two symbols at one end. Next to the entity: a bar for "one", a crow's foot for
 * "many". Beyond it: a bar for "at least one", a circle for "zero". A value that is not
 * decided yet gets a question mark in place of its symbol.
 */
function EndSymbols({ at, end, colour }: { at: EndPoint; end: RelationshipEnd; colour: string }) {
  const angle = (Math.atan2(at.dy, at.dx) * 180) / Math.PI;
  const many = end.max === 'many';
  // The second symbol sits a little further out when the first is not a plain bar.
  const one = end.max === 'one';
  return (
    <g transform={`translate(${at.x} ${at.y}) rotate(${angle})`}>
      {end.max === null ? <Undecided x={8} angle={angle} colour={colour} /> : many ? <path d="M 16 0 L 0 -8 M 16 0 L 0 8" /> : <path d="M 10 -8 L 10 8" />}
      {end.min === null ? (
        <Undecided x={one ? 21 : 25} angle={angle} colour={colour} />
      ) : end.min === 0 ? (
        <circle cx={one ? 21 : 22} cy={0} r={5} />
      ) : (
        <path d={one ? 'M 17 -8 L 17 8' : 'M 22 -8 L 22 8'} />
      )}
    </g>
  );
}

/** Where a verb phrase sits: beside its own end, the first above or right of the line, the second below or left. */
function labelTransform(at: EndPoint, which: 0 | 1): string {
  const px = at.x + at.dx * (STUB + 2);
  const py = at.y + at.dy * (STUB + 2);
  if (at.dx !== 0) {
    const shiftX = at.dx > 0 ? '0%' : '-100%';
    return which === 0 ? `translate(${px}px, ${py - 5}px) translate(${shiftX}, -100%)` : `translate(${px}px, ${py + 5}px) translate(${shiftX}, 0%)`;
  }
  const shiftY = at.dy > 0 ? '0%' : '-100%';
  return which === 0 ? `translate(${px + 7}px, ${py}px) translate(0%, ${shiftY})` : `translate(${px - 7}px, ${py}px) translate(-100%, ${shiftY})`;
}

function RelationshipEdge({ id }: EdgeProps) {
  const model = useViewModel();
  const selected = useIsSelected(id);
  const findings = useElementFindings(id);
  const nodes = useNodes();
  const rel = get(model, id, 'relationship');
  if (!rel) return null;
  const rects = new Map<Id, Rect>();
  for (const n of nodes) {
    if (n.measured?.width && n.measured.height) rects.set(n.id, { x: n.position.x, y: n.position.y, w: n.measured.width, h: n.measured.height });
  }
  const line = layoutLines(all(model, 'relationship'), rects).get(id);
  if (!line) return null;
  const { path, ends } = line;
  const stroke = selected ? 'var(--select)' : 'var(--ink)';
  const strokeWidth = selected ? 2 : 1.25;

  return (
    <>
      <BaseEdge path={path} interactionWidth={18} style={{ stroke, strokeWidth, fill: 'none' }} />
      <g className="datamodel-rel-symbols" style={{ stroke, strokeWidth }}>
        <EndSymbols at={ends[0]} end={rel.ends[0]} colour={stroke} />
        <EndSymbols at={ends[1]} end={rel.ends[1]} colour={stroke} />
      </g>
      <EdgeLabelRenderer>
        {([0, 1] as const).map((i) => (
          <div
            key={i}
            className={`datamodel-rel-label nodrag nopan${selected ? ' datamodel-rel-label-selected' : ''}`}
            style={{ transform: labelTransform(ends[i], i) }}
            onClick={() => selectElements([id])}
          >
            {rel.ends[i].verbPhrase || <Missing>verb phrase</Missing>}
            {i === 0 && <FindingMarks findings={findings} counts={false} />}
          </div>
        ))}
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { entity: EntityNode };
const edgeTypes = { relationship: RelationshipEdge };

// ---- The zoom control ----

function ZoomControl() {
  const flow = useReactFlow();
  const { zoom } = useViewport();
  return (
    <Panel position="bottom-left">
      <div className="datamodel-zoom" role="group" aria-label="Zoom">
        <button type="button" aria-label="Zoom out" onClick={() => void flow.zoomOut()}>
          −
        </button>
        <span className="datamodel-zoom-value">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Zoom in" onClick={() => void flow.zoomIn()}>
          +
        </button>
        <button type="button" className="datamodel-zoom-fit" onClick={() => void flow.fitView({ padding: 0.2, maxZoom: 1 })}>
          Fit
        </button>
      </div>
    </Panel>
  );
}

// ---- The tool strip ----

const TOOLS: { id: Tool; label: string; icon: ReactNode }[] = [
  {
    id: 'select',
    label: 'Select',
    icon: <path d="M6 3 L6 19 L10 15 L13 21 L15 20 L12 14 L18 14 Z" />,
  },
  {
    id: 'entity',
    label: 'Entity',
    icon: (
      <>
        <rect x="3" y="4" width="18" height="16" />
        <path d="M3 9 H21" />
      </>
    ),
  },
  {
    id: 'relationship',
    label: 'Relationship',
    icon: (
      <>
        <path d="M2 12 H22 M6 7 V17" />
        <path d="M22 7 L15 12 L22 17" />
      </>
    ),
  },
];

// ---- The canvas ----

function buildNodes(model: Model, selectedIds: Id[], previous: Node[]): Node[] {
  const old = new Map(previous.map((n) => [n.id, n]));
  return all(model, 'entity').map((en) => ({
    // Keeping the old node keeps the size React Flow measured for it.
    ...old.get(en.id),
    id: en.id,
    type: 'entity',
    position: model.views.erd[en.id] ?? { x: 60, y: 60 },
    data: {},
    selected: selectedIds.includes(en.id),
  }));
}

function Canvas() {
  const model = useViewModel();
  const physical = useMode() === 'physical';
  const thing = physical ? 'table' : 'entity';
  const selection = useSelection();
  const theme = useTheme();
  const flow = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [nodes, setNodes] = useState<Node[]>(() => buildNodes(model, selection.elementIds, []));
  // The small box that names a new entity: where it sits on screen, and where the entity will go.
  const [naming, setNaming] = useState<{ left: number; top: number; x: number; y: number } | null>(null);
  const namingDone = useRef(false);

  useEffect(() => {
    setNodes((previous) => buildNodes(model, selection.elementIds, previous));
  }, [model, selection.elementIds]);

  const edges = useMemo<Edge[]>(() => {
    return all(model, 'relationship').map((rel) => ({
      id: rel.id,
      type: 'relationship',
      source: rel.ends[0].entityId,
      target: rel.ends[1].entityId,
      selected: selection.elementIds.includes(rel.id),
    }));
  }, [model, selection.elementIds]);

  const onNodesChange: OnNodesChange<Node> = (changes) => setNodes((current) => changes.applyTo(current));

  const chooseTool = (next: Tool) => {
    setTool(next);
    setNaming(null);
  };

  const onPaneClick = (event: ReactMouseEvent) => {
    if (tool === 'entity') {
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
    const result = dispatch({ type: 'addEntity', name: trimmed, x: naming.x, y: naming.y });
    if (result.ok) {
      selectElements([result.created[0]]);
      setTool('select');
    }
  };

  const onConnect = (connection: Connection) => {
    const result = dispatch({
      type: 'addRelationship',
      // Nothing is decided for the student: all four values start as "not decided yet".
      ends: [{ entityId: connection.source }, { entityId: connection.target }],
    });
    if (result.ok) {
      selectElements([result.created[0]]);
      setTool('select');
    }
  };

  const hint =
    nodes.length === 0 && tool !== 'entity'
      ? `No ${physical ? 'tables' : 'entities'} yet. Choose "${physical ? 'Table' : 'Entity'}" in the tool strip, then click on the paper to add one.`
      : tool === 'entity'
        ? `Click on the paper where the new ${thing} should go, then type its name.`
        : tool === 'relationship'
          ? `Drag from one ${thing} to another. How many of each there can be is left undecided, shown as question marks, until you choose it in the details.`
          : null;

  return (
    <div className="datamodel-work">
      <div className="datamodel-tools" role="toolbar" aria-label="Tools" aria-orientation="vertical">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`datamodel-tool${tool === t.id ? ' is-selected' : ''}`}
            aria-pressed={tool === t.id}
            onClick={() => chooseTool(t.id)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              {t.icon}
            </svg>
            {t.id === 'entity' && physical ? 'Table' : t.label}
          </button>
        ))}
      </div>
      <div ref={wrapper} className={`datamodel-canvas datamodel-canvas-${tool}`}>
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
              const was = model.views.erd[node.id];
              const x = Math.round(node.position.x);
              const y = Math.round(node.position.y);
              if (!was || was.x !== x || was.y !== y) dispatch({ type: 'moveEntity', entityId: node.id, x, y });
            }}
            onEdgeClick={(_, edge) => selectElements([edge.id])}
            onPaneClick={onPaneClick}
            onConnect={onConnect}
            nodesDraggable={tool === 'select'}
            nodesConnectable={tool === 'relationship'}
            connectionLineType={ConnectionLineType.Straight}
            deleteKeyCode={null}
            selectionKeyCode={null}
            multiSelectionKeyCode={null}
            forceColorMode={theme}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
            minZoom={0.25}
            maxZoom={2}
            zoomOnDoubleClick={false}
          >
            <Background variant={BackgroundVariant.Lines} gap={24} lineWidth={0.5} />
            <ZoomControl />
          </ReactFlow>
        </ToolContext.Provider>
        {hint && <div className="datamodel-hint">{hint}</div>}
        {naming && (
          <input
            className="input datamodel-name-box"
            style={{ left: naming.left, top: naming.top }}
            aria-label={`Name of the new ${thing}`}
            placeholder={physical ? 'Name of the entity' : 'Entity name'}
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

export function ErdCanvas() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
