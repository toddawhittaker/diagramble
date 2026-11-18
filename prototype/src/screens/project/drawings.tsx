// Static SVG drawings for the export preview and the help page. Nothing here can be
// edited or selected: it only draws what the model holds.

import type { ReactNode } from 'react';
import {
  all,
  controlFlowsOn,
  elementLabel,
  flowsOn,
  fullIdentifier,
  getFragment,
  isDependent,
  occurrencesOn,
  processNumber,
  storeLabel,
  type Entity,
  type Id,
  type Model,
  type NodeOccurrence,
  type Side,
} from '../../model';

export const INK = 'var(--ink)';
export const PAPER = 'var(--paper)';
export const MUTED = 'var(--muted)';

export interface Pt {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const OUT: Record<Side, Pt> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

/** The middle of one side of a box, moved along the side by `shift`. */
function sideMiddle(b: Box, side: Side, shift = 0): Pt {
  const limitX = Math.max(0, b.width / 2 - 10);
  const limitY = Math.max(0, b.height / 2 - 10);
  const sx = Math.max(-limitX, Math.min(limitX, shift));
  const sy = Math.max(-limitY, Math.min(limitY, shift));
  switch (side) {
    case 'top':
      return { x: b.x + b.width / 2 + sx, y: b.y };
    case 'bottom':
      return { x: b.x + b.width / 2 + sx, y: b.y + b.height };
    case 'left':
      return { x: b.x, y: b.y + b.height / 2 + sy };
    case 'right':
      return { x: b.x + b.width, y: b.y + b.height / 2 + sy };
  }
}

/** The side of `from` that faces `to`, for a flow with no stored hint. */
function facingSide(from: Box, to: Box): Side {
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

/** Breaks a name into lines of about `maxChars` characters. */
export function wrap(text: string, maxChars: number): string[] {
  const limit = Math.max(6, Math.floor(maxChars));
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && (line + ' ' + word).length > limit) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

interface LinesProps {
  x: number;
  /** The middle of the block of lines. */
  y: number;
  lines: string[];
  anchor?: 'start' | 'middle' | 'end';
  size?: number;
  muted?: boolean;
  /** Paint a paper-coloured edge round the letters, so they read over a line. */
  halo?: boolean;
  bold?: boolean;
}

export function Lines({ x, y, lines, anchor = 'middle', size = 13, muted, halo, bold }: LinesProps) {
  const lineHeight = size + 3;
  const spans = lines.map((line, i) => (
    <tspan key={i} x={x} y={y + (i - (lines.length - 1) / 2) * lineHeight + size * 0.35}>
      {line}
    </tspan>
  ));
  const shared = { textAnchor: anchor, fontSize: size, fontWeight: bold ? 600 : 400, fontStyle: muted ? 'italic' : undefined } as const;
  return (
    <g>
      {halo && (
        // A paper-coloured copy underneath, wider than the letters.
        <text {...shared} fill={PAPER} stroke={PAPER} strokeWidth={4} strokeLinejoin="round" aria-hidden>
          {spans}
        </text>
      )}
      <text {...shared} fill={muted ? MUTED : INK}>
        {spans}
      </text>
    </g>
  );
}

/** A straight line with one arrowhead at the end it points to. */
export function Arrow({ from, to, dotted }: { from: Pt; to: Pt; dotted?: boolean }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const back = { x: to.x - ux * 10, y: to.y - uy * 10 };
  const head = `${to.x},${to.y} ${back.x - uy * 4.5},${back.y + ux * 4.5} ${back.x + uy * 4.5},${back.y - ux * 4.5}`;
  return (
    <g>
      <line
        x1={from.x}
        y1={from.y}
        x2={back.x}
        y2={back.y}
        stroke={INK}
        strokeWidth={1.25}
        strokeDasharray={dotted ? '2 4' : undefined}
        strokeLinecap={dotted ? 'round' : undefined}
      />
      <polygon points={head} fill={INK} />
    </g>
  );
}

// ---- The three symbols of a data flow diagram ----

function ProcessSymbol({ box, number, name, implementation }: { box: Box; number: string; name: string; implementation?: string }) {
  const band = 24;
  // In physical mode the last line of the symbol says how the process is carried out.
  const foot = implementation === undefined ? 0 : 18;
  return (
    <g>
      <rect x={box.x} y={box.y} width={box.width} height={box.height} rx={12} fill={PAPER} stroke={INK} strokeWidth={1.5} />
      <line x1={box.x} y1={box.y + band} x2={box.x + box.width} y2={box.y + band} stroke={INK} strokeWidth={1} />
      <text x={box.x + box.width / 2} y={box.y + 16} textAnchor="middle" fontSize={12} fill={INK} fontFamily="var(--font-mono)">
        {number}
      </text>
      <Lines
        x={box.x + box.width / 2}
        y={box.y + band + (box.height - band - foot) / 2}
        lines={name ? wrap(name, (box.width - 16) / 7) : ['No name']}
        muted={!name}
      />
      {implementation !== undefined && (
        <>
          <line x1={box.x} y1={box.y + box.height - foot} x2={box.x + box.width} y2={box.y + box.height - foot} stroke={INK} strokeWidth={1} />
          <Lines
            x={box.x + box.width / 2}
            y={box.y + box.height - foot / 2}
            lines={[implementation || 'No implementation']}
            size={11}
            muted={!implementation}
          />
        </>
      )}
    </g>
  );
}

function StoreSymbol({ box, label, name }: { box: Box; label: string; name: string }) {
  const tag = 36;
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  return (
    <g>
      <path d={`M${right} ${box.y}H${box.x}V${bottom}H${right}`} fill={PAPER} stroke={INK} strokeWidth={1.5} />
      <line x1={box.x + tag} y1={box.y} x2={box.x + tag} y2={bottom} stroke={INK} strokeWidth={1} />
      <text x={box.x + tag / 2} y={box.y + box.height / 2 + 4} textAnchor="middle" fontSize={12} fill={INK} fontFamily="var(--font-mono)">
        {label}
      </text>
      <Lines
        x={box.x + tag + 8}
        y={box.y + box.height / 2}
        anchor="start"
        lines={name ? wrap(name, (box.width - tag - 14) / 7) : ['No name']}
        muted={!name}
      />
    </g>
  );
}

function ExternalSymbol({ box, name }: { box: Box; name: string }) {
  return (
    <g>
      <rect x={box.x} y={box.y} width={box.width} height={box.height} fill={PAPER} stroke={INK} strokeWidth={1.5} />
      <Lines
        x={box.x + box.width / 2}
        y={box.y + box.height / 2}
        lines={name ? wrap(name, (box.width - 12) / 7) : ['No name']}
        muted={!name}
      />
    </g>
  );
}

function NodeSymbol({ model, occ, physical }: { model: Model; occ: NodeOccurrence; physical?: boolean }) {
  const element = model.elements[occ.elementId];
  if (!element) return null;
  // Work a person does is marked with a dashed outline: the human side of the human-machine boundary.
  const human = physical && (element.kind === 'process' || element.kind === 'externalEntity') && element.human;
  const outline = human ? (
    <rect
      x={occ.x - 9}
      y={occ.y - 9}
      width={occ.width + 18}
      height={occ.height + 18}
      fill="none"
      stroke={INK}
      strokeWidth={1}
      strokeDasharray="6 4"
    />
  ) : null;
  let symbol: ReactNode;
  if (element.kind === 'process')
    symbol = (
      <ProcessSymbol
        box={occ}
        number={processNumber(model, element.id)}
        name={element.name}
        implementation={physical ? (element.human ? element.implementation || 'Done by a person' : element.implementation) : undefined}
      />
    );
  else if (element.kind === 'dataStore')
    symbol = <StoreSymbol box={occ} label={storeLabel(model, element.id)} name={(physical && element.physicalName) || element.name} />;
  else symbol = <ExternalSymbol box={occ} name={element.name} />;
  return (
    <g>
      {outline}
      {symbol}
    </g>
  );
}

// ---- A whole data flow diagram ----

const STUB = 70;

/**
 * One data flow diagram as a picture: the symbols at their stored places and sizes, and
 * each flow as a straight line between the middles of the sides its route names.
 */
export function StaticDfd({ model, diagramId, physical }: { model: Model; diagramId: Id; physical?: boolean }) {
  const occs = occurrencesOn(model, diagramId);
  const byId = new Map(occs.map((o) => [o.id, o]));
  const firstOf = (elementId: Id | null) => (elementId ? occs.find((o) => o.elementId === elementId) : undefined);

  if (occs.length === 0) return <p className="muted">Nothing is drawn on this diagram yet.</p>;

  const lines: ReactNode[] = [];
  const labels: ReactNode[] = [];
  const reach: Pt[] = [];
  const stubsAt = new Map<string, number>();

  // Stubs that share a side are spread along it, so that they do not lie on top of each other.
  const stubShift = (occ: NodeOccurrence, side: Side) => {
    const key = `${occ.id}:${side}`;
    const n = stubsAt.get(key) ?? 0;
    stubsAt.set(key, n + 1);
    return n === 0 ? 0 : (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 24;
  };

  const stubNote = (key: string, far: Pt, side: Side, text: string) => {
    const out = OUT[side];
    // Leave room in the picture for the words, at about 6.6 pixels a letter.
    const long = 6 + text.length * 6.6;
    if (out.x !== 0) reach.push({ x: far.x + out.x * long, y: far.y });
    else reach.push({ x: far.x - long / 2, y: far.y + out.y * 22 }, { x: far.x + long / 2, y: far.y + out.y * 22 });
    labels.push(
      <Lines
        key={key}
        x={far.x + out.x * 6}
        y={far.y + out.y * 12}
        anchor={side === 'left' ? 'end' : side === 'right' ? 'start' : 'middle'}
        lines={[text]}
        size={12}
        halo
      />,
    );
  };

  for (const flow of flowsOn(model, diagramId)) {
    const route = model.views.routes[flow.id];
    const data = (physical && flow.physicalName) || model.elements[flow.dataId]?.name || 'No data named';
    const source = (route?.sourceOccurrenceId ? byId.get(route.sourceOccurrenceId) : undefined) ?? firstOf(flow.sourceId);
    const target = (route?.targetOccurrenceId ? byId.get(route.targetOccurrenceId) : undefined) ?? firstOf(flow.targetId);

    if (source && target) {
      const from = sideMiddle(source, route?.sourceSide ?? facingSide(source, target));
      const to = sideMiddle(target, route?.targetSide ?? facingSide(target, source));
      lines.push(<Arrow key={flow.id} from={from} to={to} />);
      labels.push(<Lines key={flow.id} x={(from.x + to.x) / 2} y={(from.y + to.y) / 2} lines={[data]} size={12} halo />);
    } else if (target) {
      // The source is not on this diagram, or the end is not attached.
      const side = route?.targetSide ?? 'left';
      const to = sideMiddle(target, side, stubShift(target, side));
      const far = { x: to.x + OUT[side].x * STUB, y: to.y + OUT[side].y * STUB };
      const note = flow.sourceId === null ? 'start not attached' : `from ${elementLabel(model, flow.sourceId)}`;
      lines.push(<Arrow key={flow.id} from={far} to={to} />);
      stubNote(flow.id, far, side, `${data} (${note})`);
    } else if (source) {
      const side = route?.sourceSide ?? 'right';
      const from = sideMiddle(source, side, stubShift(source, side));
      const far = { x: from.x + OUT[side].x * STUB, y: from.y + OUT[side].y * STUB };
      const note = flow.targetId === null ? 'end not attached' : `to ${elementLabel(model, flow.targetId)}`;
      lines.push(<Arrow key={flow.id} from={from} to={far} />);
      stubNote(flow.id, far, side, `${data} (${note})`);
    }
  }

  for (const control of controlFlowsOn(model, diagramId)) {
    const target = firstOf(control.targetId);
    if (!target) continue;
    const to = sideMiddle(target, 'top', -target.width / 4 + stubShift(target, 'top'));
    const far = { x: to.x, y: to.y - 56 };
    lines.push(<Arrow key={control.id} from={far} to={to} dotted />);
    stubNote(control.id, far, 'top', control.name || 'No event named');
  }

  const padX = 50;
  const padY = 40;
  const xs = [...occs.flatMap((o) => [o.x, o.x + o.width]), ...reach.map((p) => p.x)];
  const ys = [...occs.flatMap((o) => [o.y, o.y + o.height]), ...reach.map((p) => p.y)];
  const minX = Math.min(...xs) - padX;
  const minY = Math.min(...ys) - padY;
  const width = Math.max(...xs) + padX - minX;
  const height = Math.max(...ys) + padY - minY;

  return (
    <svg
      className="project-drawing"
      viewBox={`${minX} ${minY} ${width} ${height}`}
      style={{ maxWidth: width }}
      role="img"
      aria-label={`${physical ? 'Physical data flow diagram' : 'Data flow diagram'}: ${elementLabel(model, diagramId)}`}
    >
      {lines}
      {occs.map((occ) => (
        <NodeSymbol key={occ.id} model={model} occ={occ} physical={physical} />
      ))}
      {labels}
    </svg>
  );
}

// ---- A DFD fragment: one process with its flows and what is at their other ends ----

/** `n` places along a side of length `length`, centred, `step` apart at most. */
function spread(n: number, i: number, length: number, step: number): number {
  if (n < 2) return 0;
  return (i - (n - 1) / 2) * Math.min(step, (length - 24) / (n - 1));
}

/**
 * One process of a diagram as a small picture of its own. The process is in the middle,
 * the external entities are on its left, the data stores on its right and other
 * processes below. An end that is not attached, and a control flow, come in from above.
 */
export function StaticFragment({ model, processId }: { model: Model; processId: Id }) {
  const fragment = getFragment(model, processId);
  if (!fragment) return null;
  const { process } = fragment;
  if (fragment.flows.length + fragment.controlFlows.length === 0) return <p className="muted">This process has no flows yet.</p>;

  const size = { process: { width: 170, height: 96 }, externalEntity: { width: 120, height: 90 }, dataStore: { width: 200, height: 56 } };
  const centre: Box = { x: -85, y: -48, ...size.process };
  const boxes = new Map<Id, Box>();
  const side = new Map<Id, Side>();
  const column = (kind: 'externalEntity' | 'dataStore') => {
    const items = fragment.elements.filter((e) => e.kind === kind);
    items.forEach((e, i) => {
      const { width, height } = size[kind];
      const y = (i - (items.length - 1) / 2) * 130 - height / 2;
      boxes.set(e.id, { x: kind === 'externalEntity' ? -335 - width : 335, y, width, height });
      side.set(e.id, kind === 'externalEntity' ? 'left' : 'right');
    });
    return items.length;
  };
  const tall = Math.max(column('externalEntity'), column('dataStore'), 1);
  const below = fragment.elements.filter((e) => e.kind === 'process');
  below.forEach((e, i) => {
    boxes.set(e.id, { x: (i - (below.length - 1) / 2) * 230 - 85, y: Math.max(170, (tall - 1) * 65 + 90), ...size.process });
    side.set(e.id, 'bottom');
  });

  const lines: ReactNode[] = [];
  const labels: ReactNode[] = [];
  const reach: Pt[] = [];
  const opposite: Record<Side, Side> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };

  // The flows drawn to a box, in the order the boxes are laid out, so that lines on one side do not cross.
  const drawn = fragment.flows.filter((f) => f.other && boxes.has(f.other.id));
  for (const s of ['left', 'right', 'bottom'] as Side[]) {
    const onSide = fragment.elements.flatMap((e) => (side.get(e.id) === s ? drawn.filter((f) => f.other?.id === e.id) : []));
    onSide.forEach((f, i) => {
      const box = boxes.get(f.other!.id)!;
      const pair = onSide.filter((g) => g.other?.id === f.other?.id);
      const j = pair.indexOf(f);
      const along = s === 'bottom' ? centre.width : centre.height;
      const near = sideMiddle(centre, s, spread(onSide.length, i, along, 24));
      const far = sideMiddle(box, opposite[s], spread(pair.length, j, s === 'bottom' ? box.width : box.height, 24));
      lines.push(f.direction === 'in' ? <Arrow key={f.flow.id} from={far} to={near} /> : <Arrow key={f.flow.id} from={near} to={far} />);
      // Labels of lines that share both ends sit at different places along them.
      const t = (j + 1) / (pair.length + 1);
      labels.push(
        <Lines
          key={f.flow.id}
          x={far.x + (near.x - far.x) * t}
          y={far.y + (near.y - far.y) * t}
          lines={[f.dataName || 'No data named']}
          size={12}
          halo
        />,
      );
    });
  }

  // What has no box to go to comes in from above, each a little higher than the last so the words do not collide.
  const loose = fragment.flows.filter((f) => !f.other || !boxes.has(f.other.id));
  const above: { key: string; text: string; dotted: boolean; out: boolean }[] = [
    ...loose.map((f) => ({
      key: f.flow.id,
      text: `${f.dataName || 'No data named'} (${f.other ? (f.direction === 'in' ? 'from' : 'to') + ' itself' : f.direction === 'in' ? 'start not attached' : 'end not attached'})`,
      dotted: false,
      out: f.direction === 'out',
    })),
    ...fragment.controlFlows.map((c) => ({ key: c.id, text: c.name || 'No event named', dotted: true, out: false })),
  ];
  above.forEach((item, i) => {
    const near = sideMiddle(centre, 'top', spread(above.length, i, centre.width, 36));
    const far = { x: near.x, y: near.y - 46 - i * 20 };
    lines.push(item.out ? <Arrow key={item.key} from={near} to={far} /> : <Arrow key={item.key} from={far} to={near} dotted={item.dotted} />);
    labels.push(<Lines key={item.key} x={far.x} y={far.y - 10} lines={[item.text]} size={12} halo />);
    const half = 6 + item.text.length * 3.3;
    reach.push({ x: far.x - half, y: far.y - 20 }, { x: far.x + half, y: far.y - 20 });
  });

  const every = [centre, ...boxes.values()];
  const pad = 30;
  const xs = [...every.flatMap((b) => [b.x, b.x + b.width]), ...reach.map((p) => p.x)];
  const ys = [...every.flatMap((b) => [b.y, b.y + b.height]), ...reach.map((p) => p.y)];
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const width = Math.max(...xs) + pad - minX;
  const height = Math.max(...ys) + pad - minY;

  return (
    <svg
      className="project-drawing"
      viewBox={`${minX} ${minY} ${width} ${height}`}
      style={{ maxWidth: width }}
      role="img"
      aria-label={`DFD fragment: ${elementLabel(model, process.id)}`}
    >
      {lines}
      <ProcessSymbol box={centre} number={processNumber(model, process.id)} name={process.name} />
      {fragment.elements.map((e) => {
        const box = boxes.get(e.id);
        if (!box) return null;
        if (e.kind === 'process') return <ProcessSymbol key={e.id} box={box} number={processNumber(model, e.id)} name={e.name} />;
        if (e.kind === 'dataStore') return <StoreSymbol key={e.id} box={box} label={storeLabel(model, e.id)} name={e.name} />;
        return <ExternalSymbol key={e.id} box={box} name={e.name} />;
      })}
      {labels}
    </svg>
  );
}

// ---- The entity relationship diagram ----

const ENTITY_W = 190;
const ROW_H = 17;
const BAND_H = 26;

interface EntityRows {
  identifiers: string[];
  others: string[];
}

function entityRows(model: Model, entity: Entity): EntityRows {
  // A repeating attribute is written in braces.
  const repeats = new Set(entity.attributes.filter((a) => a.repeats).map((a) => a.dataId));
  const nameOf = (id: Id) => {
    const name = model.elements[id]?.name || 'No name';
    return repeats.has(id) ? `{${name}}` : name;
  };
  const identifierIds = fullIdentifier(model, entity.id);
  return {
    identifiers: identifierIds.map(nameOf),
    others: entity.attributes.filter((a) => !a.identifier && !identifierIds.includes(a.dataId)).map((a) => nameOf(a.dataId)),
  };
}

function entityHeight(rows: EntityRows): number {
  const gap = rows.identifiers.length && rows.others.length ? 9 : 0;
  return Math.max(58, BAND_H + 8 + (rows.identifiers.length + rows.others.length) * ROW_H + gap + 6);
}

/** An entity: its name in capitals in a band, the identifier first with an asterisk, then the rest. */
export function EntitySymbol({ box, name, rows, dependent }: { box: Box; name: string; rows: EntityRows; dependent?: boolean }) {
  let y = box.y + BAND_H + 8 + ROW_H / 2;
  const texts: ReactNode[] = [];
  rows.identifiers.forEach((text, i) => {
    texts.push(<Lines key={`i${i}`} x={box.x + 10} y={y} anchor="start" lines={[`* ${text}`]} size={12} />);
    y += ROW_H;
  });
  let divider: ReactNode = null;
  if (rows.identifiers.length && rows.others.length) {
    const lineY = y - ROW_H / 2 + 4;
    divider = <line x1={box.x} y1={lineY} x2={box.x + box.width} y2={lineY} stroke={INK} strokeWidth={1} strokeDasharray="4 3" />;
    y += 9;
  }
  rows.others.forEach((text, i) => {
    texts.push(<Lines key={`o${i}`} x={box.x + 10} y={y} anchor="start" lines={[text]} size={12} />);
    y += ROW_H;
  });
  return (
    <g>
      <rect x={box.x} y={box.y} width={box.width} height={box.height} fill={PAPER} stroke={INK} strokeWidth={1.5} />
      {dependent && (
        <rect x={box.x + 4} y={box.y + 4} width={box.width - 8} height={box.height - 8} fill="none" stroke={INK} strokeWidth={1} />
      )}
      <line x1={box.x} y1={box.y + BAND_H} x2={box.x + box.width} y2={box.y + BAND_H} stroke={INK} strokeWidth={1} />
      <Lines x={box.x + box.width / 2} y={box.y + BAND_H / 2} lines={[name ? name.toUpperCase() : 'No name']} muted={!name} bold />
      {divider}
      {texts}
    </g>
  );
}

/**
 * The symbols at one end of a relationship line. `at` is the point where the line meets
 * the entity and `u` points away from the entity along the line. The symbol next to the
 * entity shows the most (a bar for one, a crow's foot for many). The one beyond it shows
 * the least (a bar for one, a circle for zero). A value not decided yet is a question
 * mark in the place of its symbol, and one question mark alone when neither is decided.
 */
export function CrowsFootEnd({ at, u, min, max }: { at: Pt; u: Pt; min: 0 | 1 | null; max: 'one' | 'many' | null }) {
  const p = (along: number, across: number): Pt => ({ x: at.x + u.x * along - u.y * across, y: at.y + u.y * along + u.x * across });
  const seg = (a: Pt, b: Pt, key: string) => <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={INK} strokeWidth={1.25} />;
  const parts: ReactNode[] = [];
  const question = (along: number, key: string) => {
    const c = p(along, 0);
    const shared = { x: c.x, y: c.y + 5, textAnchor: 'middle', fontSize: 15, fontWeight: 700 } as const;
    return (
      <g key={key}>
        <text {...shared} fill={PAPER} stroke={PAPER} strokeWidth={5} strokeLinejoin="round" aria-hidden>
          ?
        </text>
        <text {...shared} fill={INK}>
          ?
        </text>
      </g>
    );
  };
  if (min === null && max === null) return <g>{question(13, 'both')}</g>;
  let next: number;
  if (max === null) {
    parts.push(question(9, 'max'));
    next = 20;
  } else if (max === 'one') {
    parts.push(seg(p(8, -7), p(8, 7), 'max'));
    next = 15;
  } else {
    parts.push(seg(p(14, 0), p(0, -8), 'foot1'), seg(p(14, 0), p(0, 8), 'foot2'));
    next = 20;
  }
  if (min === null) parts.push(question(next + 6, 'min'));
  else if (min === 1) parts.push(seg(p(next, -7), p(next, 7), 'min'));
  else {
    const c = p(next + 4.5, 0);
    parts.push(<circle key="min" cx={c.x} cy={c.y} r={4.5} fill={PAPER} stroke={INK} strokeWidth={1.25} />);
  }
  return <g>{parts}</g>;
}

/** The point where the line from the middle of a box towards `toward` leaves the box. */
export function borderPoint(box: Box, toward: Pt): Pt {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: box.y };
  const t = Math.min(dx === 0 ? Infinity : box.width / 2 / Math.abs(dx), dy === 0 ? Infinity : box.height / 2 / Math.abs(dy));
  return { x: cx + dx * t, y: cy + dy * t };
}

/** The one entity relationship diagram as a picture, from the positions in `views.erd`. */
export function StaticErd({ model }: { model: Model }) {
  const entities = all(model, 'entity');
  if (entities.length === 0) return <p className="muted">The data model has no entities yet.</p>;

  const boxes = new Map<Id, Box & { rows: EntityRows }>();
  entities.forEach((entity, i) => {
    const rows = entityRows(model, entity);
    const at = model.views.erd[entity.id] ?? { x: i * (ENTITY_W + 60), y: 0 };
    boxes.set(entity.id, { x: at.x, y: at.y, width: ENTITY_W, height: entityHeight(rows), rows });
  });

  const lines: ReactNode[] = [];
  const labels: ReactNode[] = [];
  let loops = 0;
  for (const rel of all(model, 'relationship')) {
    const [first, second] = rel.ends;
    const a = boxes.get(first.entityId);
    const b = boxes.get(second.entityId);
    if (!a || !b) continue;
    if (first.entityId === second.entityId) {
      // An entity related to itself: a loop round its top right corner.
      const right = a.x + a.width;
      const top = { x: a.x + a.width * 0.7, y: a.y };
      const side = { x: right, y: a.y + 14 };
      lines.push(
        <g key={rel.id}>
          <polyline
            points={`${top.x},${top.y} ${top.x},${a.y - 34} ${right + 40},${a.y - 34} ${right + 40},${side.y} ${side.x},${side.y}`}
            fill="none"
            stroke={INK}
            strokeWidth={1.25}
          />
          <CrowsFootEnd at={top} u={{ x: 0, y: -1 }} min={first.min} max={first.max} />
          <CrowsFootEnd at={side} u={{ x: 1, y: 0 }} min={second.min} max={second.max} />
        </g>,
      );
      labels.push(
        <Lines
          key={rel.id}
          x={right + 46}
          y={a.y - 30}
          anchor="start"
          lines={[first.verbPhrase, second.verbPhrase].filter(Boolean)}
          size={12}
          halo
        />,
      );
      loops += 1;
      continue;
    }
    const centreA = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
    const centreB = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const pa = borderPoint(a, centreB);
    const pb = borderPoint(b, centreA);
    const length = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1;
    const u = { x: (pb.x - pa.x) / length, y: (pb.y - pa.y) / length };
    lines.push(
      <g key={rel.id}>
        <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={INK} strokeWidth={1.25} />
        <CrowsFootEnd at={pa} u={u} min={first.min} max={first.max} />
        <CrowsFootEnd at={pb} u={{ x: -u.x, y: -u.y }} min={second.min} max={second.max} />
      </g>,
    );
    // Each verb phrase sits near its own entity, a little to one side of the line.
    const phrase = (key: string, t: number, text: string, side: number) =>
      text && (
        <Lines
          key={key}
          x={pa.x + (pb.x - pa.x) * t - u.y * 12 * side}
          y={pa.y + (pb.y - pa.y) * t + u.x * 12 * side}
          lines={[text]}
          size={12}
          halo
        />
      );
    labels.push(phrase(`${rel.id}:0`, 0.3, first.verbPhrase, 1), phrase(`${rel.id}:1`, 0.7, second.verbPhrase, -1));
  }

  const all_ = [...boxes.values()];
  const pad = 40;
  const minX = Math.min(...all_.map((b) => b.x)) - pad;
  const minY = Math.min(...all_.map((b) => b.y)) - pad - (loops ? 24 : 0);
  const width = Math.max(...all_.map((b) => b.x + b.width)) + pad + (loops ? 170 : 0) - minX;
  const height = Math.max(...all_.map((b) => b.y + b.height)) + pad - minY;

  return (
    <svg
      className="project-drawing"
      viewBox={`${minX} ${minY} ${width} ${height}`}
      style={{ maxWidth: width }}
      role="img"
      aria-label="Entity relationship diagram"
    >
      {lines}
      {entities.map((entity) => {
        const box = boxes.get(entity.id);
        return box ? (
          <EntitySymbol key={entity.id} box={box} name={entity.name} rows={box.rows} dependent={isDependent(model, entity.id)} />
        ) : null;
      })}
      {labels}
    </svg>
  );
}

// ---- Small pictures for the help page ----

export function Picture({ width, height, label, children }: { width: number; height: number; label: string; children: ReactNode }) {
  return (
    <svg className="project-picture" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      {children}
    </svg>
  );
}

export function ProcessPicture() {
  return (
    <Picture width={150} height={84} label="A process: a rounded rectangle with its number in a band across the top">
      <ProcessSymbol box={{ x: 8, y: 6, width: 134, height: 72 }} number="1" name="Take Order" />
    </Picture>
  );
}

export function StorePicture() {
  return (
    <Picture width={150} height={84} label="A data store: a wide rectangle, open on its right, with a label box at its left end">
      <StoreSymbol box={{ x: 8, y: 20, width: 134, height: 44 }} label="D1" name="Orders" />
    </Picture>
  );
}

export function ExternalPicture() {
  return (
    <Picture width={150} height={84} label="An external entity: a plain rectangle holding its name">
      <ExternalSymbol box={{ x: 30, y: 10, width: 90, height: 64 }} name="Customer" />
    </Picture>
  );
}

export function FlowPicture({ dotted }: { dotted?: boolean }) {
  return (
    <Picture
      width={150}
      height={84}
      label={dotted ? 'A control flow: a dotted line with one arrowhead' : 'A data flow: a solid line with one arrowhead and a label'}
    >
      <Arrow from={{ x: 10, y: 50 }} to={{ x: 140, y: 50 }} dotted={dotted} />
      <Lines x={75} y={36} lines={[dotted ? 'End of day' : 'Order']} size={12} />
    </Picture>
  );
}

export function EntityPicture() {
  return (
    <Picture width={150} height={112} label="An entity: a box with its name in capitals and its attributes listed below">
      <EntitySymbol
        box={{ x: 8, y: 6, width: 134, height: 100 }}
        name="Customer"
        rows={{ identifiers: ['Customer Number'], others: ['Name', 'Phone'] }}
      />
    </Picture>
  );
}

export function RepeatingPicture() {
  return (
    <Picture width={150} height={112} label="A repeating attribute: its name written in braces">
      <EntitySymbol
        box={{ x: 8, y: 6, width: 134, height: 100 }}
        name="Student"
        rows={{ identifiers: ['Student Number'], others: ['Name', '{Instrument}'] }}
      />
    </Picture>
  );
}

export function IdentifierPicture() {
  return (
    <Picture width={150} height={98} label="An identifier: the attribute marked with an asterisk, above a dashed line">
      <rect x={8} y={24} width={134} height={50} fill={PAPER} stroke={INK} strokeWidth={1.5} />
      <Lines x={18} y={40} anchor="start" lines={['* Customer Number']} size={12} bold />
      <line x1={8} y1={52} x2={142} y2={52} stroke={INK} strokeWidth={1} strokeDasharray="4 3" />
      <Lines x={18} y={63} anchor="start" lines={['Name']} size={12} muted />
    </Picture>
  );
}

/** One end of a relationship line, with the entity it meets drawn as the edge of a box on the right. */
export function EndPicture({ min, max, label }: { min: 0 | 1 | null; max: 'one' | 'many' | null; label: string }) {
  return (
    <Picture width={150} height={60} label={label}>
      <line x1={10} y1={30} x2={104} y2={30} stroke={INK} strokeWidth={1.25} />
      <path d="M146 8H104V52H146" fill={PAPER} stroke={INK} strokeWidth={1.5} />
      <CrowsFootEnd at={{ x: 104, y: 30 }} u={{ x: -1, y: 0 }} min={min} max={max} />
    </Picture>
  );
}
