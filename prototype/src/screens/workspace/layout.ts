// Turns one diagram of the model into React Flow nodes and edges. All the geometry of
// the flows is worked out here, from the symbols' positions, so the edge component only
// has to draw the points it is given.

import type { Edge, Node } from '@xyflow/react';
import {
  childDiagram,
  controlFlowsOn,
  elementLabel,
  flowsOn,
  isNode,
  nodeTag,
  occurrencesOn,
  processNumber,
  type Id,
  type Model,
} from '../../model';
import { worstFor, type Finding } from '../../rules';

export type Side = 'top' | 'right' | 'bottom' | 'left';
export type MarkLevel = 'error' | 'warning' | null;

export type SymbolData = {
  kind: 'process' | 'dataStore' | 'externalEntity';
  elementId: Id;
  name: string;
  /** "1.2" for a process, "D1" for a data store. */
  tag: string;
  mark: MarkLevel;
  childDiagramId: Id | null;
};

/** A flow end that is not a symbol on this diagram. */
export type EndData = {
  /** "note" is an off-diagram end, "loose" is an unattached end, "origin" is where a control flow starts. */
  variant: 'note' | 'loose' | 'origin';
  text: string;
  flowId: Id;
  end: 'source' | 'target';
};

export type FlowData = {
  flowId: Id;
  control: boolean;
  label: string;
  mark: MarkLevel;
  sx: number;
  sy: number;
  sSide: Side;
  tx: number;
  ty: number;
  tSide: Side;
  /** True when one end is not a symbol. The line is then straight. */
  straight: boolean;
  looseSource: boolean;
  looseTarget: boolean;
};

export type SymbolNode = Node<SymbolData, 'symbol'>;
export type EndNode = Node<EndData, 'end'>;
export type CanvasNode = SymbolNode | EndNode;
export type CanvasEdge = Edge<FlowData, 'flow'>;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Pt {
  x: number;
  y: number;
}

/** How far from a symbol a note or a loose end sits. */
const STUB = 170;
const CONTROL_STUB = 110;
const END_SIZE: Record<EndData['variant'], { w: number; h: number }> = {
  note: { w: 132, h: 26 },
  loose: { w: 16, h: 16 },
  origin: { w: 8, h: 8 },
};

const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

const cx = (b: Box) => b.x + b.w / 2;
const cy = (b: Box) => b.y + b.h / 2;

/** The point a fraction `t` of the way along one side of a box. */
function sidePoint(b: Box, side: Side, t: number): Pt {
  switch (side) {
    case 'top':
      return { x: b.x + b.w * t, y: b.y };
    case 'bottom':
      return { x: b.x + b.w * t, y: b.y + b.h };
    case 'left':
      return { x: b.x, y: b.y + b.h * t };
    case 'right':
      return { x: b.x + b.w, y: b.y + b.h * t };
  }
}

/** The point `distance` straight out from a side. */
function out(p: Pt, side: Side, distance: number): Pt {
  switch (side) {
    case 'top':
      return { x: p.x, y: p.y - distance };
    case 'bottom':
      return { x: p.x, y: p.y + distance };
    case 'left':
      return { x: p.x - distance, y: p.y };
    case 'right':
      return { x: p.x + distance, y: p.y };
  }
}

/** The sides a line should leave and enter when the route gives no hint. */
function autoSides(a: Box, b: Box): [Side, Side] {
  const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0);
  const gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0);
  const dx = cx(b) - cx(a);
  const dy = cy(b) - cy(a);
  const horizontal = gapX === gapY ? Math.abs(dx) >= Math.abs(dy) : gapX > gapY;
  if (horizontal) return dx >= 0 ? ['right', 'left'] : ['left', 'right'];
  return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
}

interface EndPlan {
  occId: Id | null;
  side: Side;
  point: Pt;
  variant: EndData['variant'];
  text: string;
}

interface Line {
  id: Id;
  control: boolean;
  label: string;
  s: EndPlan;
  t: EndPlan;
  order: number;
}

export function endNodeId(flowId: Id, end: 'source' | 'target'): string {
  return `end|${flowId}|${end}`;
}

export function buildCanvas(
  model: Model,
  findings: Finding[],
  diagramId: Id,
  selected: ReadonlySet<Id>,
  /** Positions of symbols being dragged, by occurrence id. They win over the model. */
  live: Record<Id, Pt>,
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const nodes: CanvasNode[] = [];
  const boxes = new Map<Id, Box>();
  const firstOf = new Map<Id, Id>();

  for (const o of occurrencesOn(model, diagramId)) {
    const el = model.elements[o.elementId];
    if (!isNode(el)) continue;
    const pos = live[o.id] ?? { x: o.x, y: o.y };
    boxes.set(o.id, { x: pos.x, y: pos.y, w: o.width, h: o.height });
    if (!firstOf.has(el.id)) firstOf.set(el.id, o.id);
    nodes.push({
      id: o.id,
      type: 'symbol',
      position: pos,
      width: o.width,
      height: o.height,
      measured: { width: o.width, height: o.height },
      selected: selected.has(el.id),
      data: {
        kind: el.kind,
        elementId: el.id,
        name: el.name,
        tag: nodeTag(model, el.id),
        mark: worstFor(findings, el.id),
        childDiagramId: el.kind === 'process' ? (childDiagram(model, el.id)?.id ?? null) : null,
      },
    });
  }

  const resolve = (occId: Id | null | undefined, elementId: Id | null): Id | null => {
    if (occId && boxes.has(occId)) return occId;
    if (elementId && firstOf.has(elementId)) return firstOf.get(elementId)!;
    return null;
  };

  const endText = (end: 'source' | 'target', endId: Id | null): Pick<EndPlan, 'variant' | 'text'> => {
    if (!endId) return { variant: 'loose', text: 'Not attached' };
    const word = end === 'target' ? 'To' : 'From';
    if (model.elements[endId]?.kind === 'process')
      return { variant: 'note', text: `${word} process ${processNumber(model, endId)}` };
    return { variant: 'note', text: `${word} ${elementLabel(model, endId)}` };
  };

  // Pass 1: which symbol and which side each end uses.
  const lines: Line[] = [];
  const zero = { x: 0, y: 0 };
  for (const f of flowsOn(model, diagramId)) {
    const route = model.views.routes[f.id];
    const sOcc = resolve(route?.sourceOccurrenceId, f.sourceId);
    const tOcc = resolve(route?.targetOccurrenceId, f.targetId);
    let sSide: Side = route?.sourceSide ?? 'right';
    let tSide: Side = route?.targetSide ?? 'left';
    if (sOcc && tOcc) {
      const [a, b] = autoSides(boxes.get(sOcc)!, boxes.get(tOcc)!);
      sSide = route?.sourceSide ?? a;
      tSide = route?.targetSide ?? b;
    }
    lines.push({
      id: f.id,
      control: false,
      label: elementLabel(model, f.id),
      s: { occId: sOcc, side: sSide, point: zero, ...endText('source', f.sourceId) },
      t: { occId: tOcc, side: tSide, point: zero, ...endText('target', f.targetId) },
      order: lines.length,
    });
  }
  for (const c of controlFlowsOn(model, diagramId)) {
    const route = model.views.routes[c.id];
    const tOcc = resolve(route?.targetOccurrenceId, c.targetId);
    lines.push({
      id: c.id,
      control: true,
      label: c.name,
      s: { occId: null, side: 'bottom', point: zero, variant: 'origin', text: '' },
      t: { occId: tOcc, side: route?.targetSide ?? 'top', point: zero, ...endText('target', c.targetId) },
      order: lines.length,
    });
  }

  // Pass 2: spread the ends that share one side of one symbol along that side.
  const groups = new Map<string, { plan: EndPlan; key: number; order: number }[]>();
  for (const line of lines) {
    for (const [plan, other] of [
      [line.s, line.t],
      [line.t, line.s],
    ] as const) {
      if (!plan.occId) continue;
      const own = boxes.get(plan.occId)!;
      const far = other.occId ? boxes.get(other.occId)! : own;
      const key = plan.side === 'top' || plan.side === 'bottom' ? cx(far) : cy(far);
      const groupKey = `${plan.occId}|${plan.side}`;
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push({ plan, key, order: line.order });
    }
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.key - b.key || a.order - b.order);
    group.forEach((g, i) => {
      g.plan.point = sidePoint(boxes.get(g.plan.occId!)!, g.plan.side, (i + 1) / (group.length + 1));
    });
  }

  // Pass 3: place the ends that are not symbols, straight out from the end that is.
  const all = [...boxes.values()];
  // A flow with neither end on the diagram sits in a column to the left of everything else.
  const floatX = (all.length ? Math.min(...all.map((b) => b.x)) : 520) - (2 * END_SIZE.note.w + STUB + 40);
  const floatY = all.length ? Math.min(...all.map((b) => b.y)) : 40;
  let floatRow = 0;
  for (const line of lines) {
    const { s, t } = line;
    if (s.occId && !t.occId) {
      t.side = OPPOSITE[s.side];
      t.point = out(s.point, s.side, STUB);
    } else if (!s.occId && t.occId) {
      s.side = OPPOSITE[t.side];
      s.point = out(t.point, t.side, line.control ? CONTROL_STUB : STUB);
    } else if (!s.occId && !t.occId) {
      const y = floatY + floatRow++ * 56;
      s.side = 'right';
      s.point = { x: floatX + END_SIZE.note.w, y };
      t.side = 'left';
      t.point = { x: floatX + END_SIZE.note.w + STUB, y };
    }
  }

  const edges: CanvasEdge[] = [];
  for (const line of lines) {
    const isSelected = selected.has(line.id);
    for (const end of ['source', 'target'] as const) {
      const plan = end === 'source' ? line.s : line.t;
      if (plan.occId) continue;
      const { w, h } = END_SIZE[plan.variant];
      const p = plan.point;
      const position =
        plan.side === 'left'
          ? { x: p.x, y: p.y - h / 2 }
          : plan.side === 'right'
            ? { x: p.x - w, y: p.y - h / 2 }
            : plan.side === 'top'
              ? { x: p.x - w / 2, y: p.y }
              : { x: p.x - w / 2, y: p.y - h };
      nodes.push({
        id: endNodeId(line.id, end),
        type: 'end',
        position,
        width: w,
        height: h,
        measured: { width: w, height: h },
        draggable: false,
        selected: isSelected,
        data: { variant: plan.variant, text: plan.text, flowId: line.id, end },
      });
    }
    edges.push({
      id: line.id,
      type: 'flow',
      source: line.s.occId ?? endNodeId(line.id, 'source'),
      target: line.t.occId ?? endNodeId(line.id, 'target'),
      selected: isSelected,
      data: {
        flowId: line.id,
        control: line.control,
        label: line.label,
        mark: worstFor(findings, line.id),
        sx: line.s.point.x,
        sy: line.s.point.y,
        sSide: line.s.side,
        tx: line.t.point.x,
        ty: line.t.point.y,
        tSide: line.t.side,
        straight: !line.s.occId || !line.t.occId,
        looseSource: !line.s.occId && line.s.variant === 'loose',
        looseTarget: !line.t.occId && line.t.variant === 'loose',
      },
    });
  }

  return { nodes, edges };
}
