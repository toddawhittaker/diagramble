// Static SVG drawings of the second release, for the export preview and the help page:
// the interface structure diagram and the structure chart. They only draw what the
// model holds, in the same plain way as the drawings in drawings.tsx.

import type { ReactNode } from 'react';
import {
  couplesOf,
  coupleLabel,
  INTERFACE_SIZE,
  interfacesOn,
  linksOn,
  moduleChildren,
  moduleNumber,
  modulesOf,
  originalModule,
  processNumber,
  type Id,
  type Model,
} from '../../model';
import { borderPoint, INK, Lines, PAPER, Picture, wrap, type Box } from './drawings';

const MONO = 'var(--font-mono)';

// ---- The interface structure diagram ----

const PART_H = 22;

/** An interface: a box in three parts, with its number on top, its name in the middle and its process numbers at the bottom. */
export function InterfaceSymbol({ box, number, name, processes }: { box: Box; number: string; name: string; processes: string }) {
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  return (
    <g>
      <rect x={box.x} y={box.y} width={box.width} height={box.height} fill={PAPER} stroke={INK} strokeWidth={1.5} />
      <line x1={box.x} y1={box.y + PART_H} x2={right} y2={box.y + PART_H} stroke={INK} strokeWidth={1} />
      <line x1={box.x} y1={bottom - PART_H} x2={right} y2={bottom - PART_H} stroke={INK} strokeWidth={1} />
      <text x={box.x + box.width / 2} y={box.y + 15} textAnchor="middle" fontSize={12} fill={INK} fontFamily={MONO}>
        {number}
      </text>
      <Lines
        x={box.x + box.width / 2}
        y={box.y + box.height / 2}
        lines={name ? wrap(name, (box.width - 12) / 6.6).slice(0, 2) : ['No name']}
        muted={!name}
        size={12}
      />
      <text x={box.x + box.width / 2} y={bottom - 7} textAnchor="middle" fontSize={11} fill={INK} fontFamily={MONO}>
        {processes}
      </text>
    </g>
  );
}

/** The numbers of the processes an interface carries out, such as "1.1, 1.2". */
export function interfaceProcesses(model: Model, processIds: Id[]): string {
  return processIds
    .filter((id) => model.elements[id]?.kind === 'process')
    .map((id) => processNumber(model, id))
    .join(', ');
}

/** One interface structure diagram as a picture: the boxes at their stored places, and each link as a plain line. */
export function StaticIsd({ model, diagramId }: { model: Model; diagramId: Id }) {
  const interfaces = interfacesOn(model, diagramId);
  if (interfaces.length === 0) return <p className="muted">This diagram has no interfaces yet.</p>;

  const boxes = new Map<Id, Box>();
  interfaces.forEach((item, i) => {
    // An interface with no stored place is put in a row, so that it is still drawn.
    const at = model.views.isd[item.id] ?? { x: (i % 5) * (INTERFACE_SIZE.width + 40), y: Math.floor(i / 5) * (INTERFACE_SIZE.height + 50) };
    boxes.set(item.id, { x: at.x, y: at.y, ...INTERFACE_SIZE });
  });

  const lines: ReactNode[] = [];
  for (const link of linksOn(model, diagramId)) {
    const a = boxes.get(link.aId);
    const b = boxes.get(link.bId);
    if (!a || !b) continue;
    const pa = borderPoint(a, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
    const pb = borderPoint(b, { x: a.x + a.width / 2, y: a.y + a.height / 2 });
    lines.push(<line key={link.id} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={INK} strokeWidth={1.25} />);
  }

  const every = [...boxes.values()];
  const pad = 30;
  const minX = Math.min(...every.map((b) => b.x)) - pad;
  const minY = Math.min(...every.map((b) => b.y)) - pad;
  const width = Math.max(...every.map((b) => b.x + b.width)) + pad - minX;
  const height = Math.max(...every.map((b) => b.y + b.height)) + pad - minY;

  return (
    <svg
      className="project-drawing"
      viewBox={`${minX} ${minY} ${width} ${height}`}
      style={{ maxWidth: width }}
      role="img"
      aria-label={`Interface structure diagram: ${model.elements[diagramId]?.name || 'no title'}`}
    >
      {lines}
      {interfaces.map((item) => {
        const box = boxes.get(item.id);
        return box ? (
          <InterfaceSymbol key={item.id} box={box} number={item.number} name={item.name} processes={interfaceProcesses(model, item.processIds)} />
        ) : null;
      })}
    </svg>
  );
}

// ---- The structure chart ----

const MODULE_W = 136;
const MODULE_H = 52;
const SLOT_W = 180;
const COUPLE_H = 16;

/** A module: a rectangle holding its number and name. A library module has a bar inside each side. */
export function ModuleSymbol({ box, number, name, library }: { box: Box; number: string; name: string; library?: boolean }) {
  const inset = library ? 8 : 0;
  return (
    <g>
      <rect x={box.x} y={box.y} width={box.width} height={box.height} fill={PAPER} stroke={INK} strokeWidth={1.5} />
      {library && (
        <>
          <line x1={box.x + inset} y1={box.y} x2={box.x + inset} y2={box.y + box.height} stroke={INK} strokeWidth={1} />
          <line x1={box.x + box.width - inset} y1={box.y} x2={box.x + box.width - inset} y2={box.y + box.height} stroke={INK} strokeWidth={1} />
        </>
      )}
      <text x={box.x + box.width / 2} y={box.y + 14} textAnchor="middle" fontSize={11} fill={INK} fontFamily={MONO}>
        {number}
      </text>
      <Lines
        x={box.x + box.width / 2}
        y={box.y + 14 + (box.height - 14) / 2}
        lines={name ? wrap(name, (box.width - 2 * inset - 10) / 6.4).slice(0, 2) : ['No name']}
        muted={!name}
        size={12}
      />
    </g>
  );
}

/** The diamond on the line of a conditional call. */
export function CallDiamond({ x, y }: { x: number; y: number }) {
  return <polygon points={`${x},${y - 8} ${x + 7},${y} ${x},${y + 8} ${x - 7},${y}`} fill={PAPER} stroke={INK} strokeWidth={1.25} />;
}

/** The curved arrow across the line of a repeated call. */
export function CallLoop({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x - 12} ${y + 3}A13 9 0 0 0 ${x + 12} ${y + 3}`} fill="none" stroke={INK} strokeWidth={1.25} />
      <polygon points={`${x + 12},${y - 3} ${x + 8},${y + 5} ${x + 16},${y + 5}`} fill={INK} />
    </g>
  );
}

/** A couple: a short arrow with a circle at its tail. The circle is empty for data and filled for a flag. */
export function CoupleArrow({ x, y, up, control, length = 12 }: { x: number; y: number; up: boolean; control: boolean; length?: number }) {
  // `y` is the top of the arrow's row. The arrow runs down the row, or up it.
  const tail = up ? y + length : y;
  const head = up ? y : y + length;
  const back = up ? head + 5 : head - 5;
  return (
    <g>
      <line x1={x} y1={tail} x2={x} y2={back} stroke={INK} strokeWidth={1.25} />
      <polygon points={`${x},${head} ${x - 3.5},${back} ${x + 3.5},${back}`} fill={INK} />
      <circle cx={x} cy={tail} r={3} fill={control ? INK : PAPER} stroke={INK} strokeWidth={1.25} />
    </g>
  );
}

function shorten(text: string, most: number): string {
  return text.length > most ? `${text.slice(0, most - 1)}…` : text;
}

/**
 * One structure chart as a picture. The chart stores no positions, so it is laid out as
 * a tree: each module sits above the middle of the modules it calls. The couples of a
 * line are listed beside its lower end, each with its own small arrow.
 */
export function StaticStructureChart({ model, chartId }: { model: Model; chartId: Id }) {
  const rows = modulesOf(model, chartId);
  if (rows.length === 0) return <p className="muted">This chart has no modules yet.</p>;

  // Across: the modules with nothing below them take the next free place, left to right.
  const centre = new Map<Id, number>();
  let nextPlace = 0;
  const place = (id: Id, seen: Set<Id>) => {
    if (seen.has(id)) return;
    seen.add(id);
    const below = moduleChildren(model, id).filter((m) => !seen.has(m.id));
    if (below.length === 0) {
      centre.set(id, nextPlace * SLOT_W);
      nextPlace += 1;
      return;
    }
    for (const m of below) place(m.id, seen);
    centre.set(id, (centre.get(below[0].id)! + centre.get(below[below.length - 1].id)!) / 2);
  };
  place(rows[0].module.id, new Set());

  // Down: one level for each step from the top, with room on each line for its marks and couples.
  const mostCouples = Math.max(1, ...rows.map((row) => couplesOf(model, row.module.id).length));
  const BUS = 16;
  const MARKS = 38;
  const levelGap = BUS + MARKS + mostCouples * COUPLE_H + 10;
  const topOf = (depth: number) => depth * (MODULE_H + levelGap);

  const lines: ReactNode[] = [];
  const marks: ReactNode[] = [];
  let reachRight = 0;

  for (const row of rows) {
    const x = centre.get(row.module.id);
    if (x === undefined) continue;
    const below = moduleChildren(model, row.module.id).filter((m) => centre.has(m.id));
    if (below.length === 0) continue;
    const bottom = topOf(row.depth) + MODULE_H;
    const busY = bottom + BUS;
    const xs = below.map((m) => centre.get(m.id)!);
    lines.push(
      <g key={row.module.id}>
        <line x1={x} y1={bottom} x2={x} y2={busY} stroke={INK} strokeWidth={1.25} />
        <line x1={Math.min(x, ...xs)} y1={busY} x2={Math.max(x, ...xs)} y2={busY} stroke={INK} strokeWidth={1.25} />
      </g>,
    );
    for (const child of below) {
      const cx = centre.get(child.id)!;
      const childTop = topOf(row.depth + 1);
      lines.push(<line key={`${child.id}:line`} x1={cx} y1={busY} x2={cx} y2={childTop} stroke={INK} strokeWidth={1.25} />);
      if (child.conditional) marks.push(<CallDiamond key={`${child.id}:if`} x={cx} y={busY + 11} />);
      if (child.repeated) marks.push(<CallLoop key={`${child.id}:loop`} x={cx} y={busY + 27} />);
      couplesOf(model, child.id).forEach((couple, i) => {
        const y = busY + MARKS + i * COUPLE_H;
        const label = shorten(coupleLabel(model, couple) || 'No name', 24);
        reachRight = Math.max(reachRight, cx + 26 + label.length * 6);
        marks.push(
          <g key={couple.id}>
            <CoupleArrow x={cx + 12} y={y} up={couple.direction === 'up'} control={couple.coupleKind === 'control'} />
            <Lines x={cx + 22} y={y + 6} anchor="start" lines={[label]} size={11} halo />
          </g>,
        );
      });
    }
  }

  const pad = 24;
  const minX = -MODULE_W / 2 - pad;
  const depth = Math.max(...rows.map((row) => row.depth));
  const width = Math.max((nextPlace - 1) * SLOT_W + MODULE_W / 2, reachRight) + pad - minX;
  const height = topOf(depth) + MODULE_H + 2 * pad;

  return (
    <svg
      className="project-drawing"
      viewBox={`${minX} ${-pad} ${width} ${height}`}
      style={{ maxWidth: width }}
      role="img"
      aria-label={`Structure chart: ${model.elements[chartId]?.name || 'no title'}`}
    >
      {lines}
      {rows.map((row) => {
        const x = centre.get(row.module.id);
        if (x === undefined) return null;
        const original = originalModule(model, row.module.id) ?? row.module;
        return (
          <ModuleSymbol
            key={row.module.id}
            box={{ x: x - MODULE_W / 2, y: topOf(row.depth), width: MODULE_W, height: MODULE_H }}
            number={moduleNumber(model, row.module.id)}
            name={original.name}
            library={original.library}
          />
        );
      })}
      {marks}
    </svg>
  );
}

// ---- Small pictures for the help page ----

export function InterfacePicture() {
  return (
    <Picture width={150} height={96} label="An interface: a box in three parts, holding its number, its name and its process numbers">
      <InterfaceSymbol box={{ x: 18, y: 6, width: 114, height: 84 }} number="1.2" name="Order Form" processes="2.1, 2.2" />
    </Picture>
  );
}

export function LinkPicture() {
  return (
    <Picture width={150} height={96} label="A navigation link: a plain line between two interfaces, with no arrowhead">
      <path d="M36 6V28H114V6" fill={PAPER} stroke={INK} strokeWidth={1.5} />
      <line x1={75} y1={28} x2={75} y2={68} stroke={INK} strokeWidth={1.25} />
      <path d="M36 90V68H114V90" fill={PAPER} stroke={INK} strokeWidth={1.5} />
    </Picture>
  );
}

export function ModulePicture({ library }: { library?: boolean }) {
  return (
    <Picture
      width={150}
      height={84}
      label={library ? 'A library module: a rectangle with a vertical bar inside each side' : 'A module: a rectangle holding its number and name'}
    >
      <ModuleSymbol
        box={{ x: 10, y: 14, width: 130, height: 52 }}
        number={library ? '1.3' : '1.1'}
        name={library ? 'Read Orders' : 'Check Stock'}
        library={library}
      />
    </Picture>
  );
}

/** The line between a module and the module it calls, with one mark on it or one couple beside it. */
function CallPicture({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Picture width={150} height={96} label={label}>
      <path d="M30 4V22H120V4" fill={PAPER} stroke={INK} strokeWidth={1.5} />
      <line x1={75} y1={22} x2={75} y2={74} stroke={INK} strokeWidth={1.25} />
      <path d="M30 92V74H120V92" fill={PAPER} stroke={INK} strokeWidth={1.5} />
      {children}
    </Picture>
  );
}

export function ConditionalPicture() {
  return (
    <CallPicture label="A conditional call: a diamond on the line between two modules">
      <CallDiamond x={75} y={36} />
    </CallPicture>
  );
}

export function RepeatedPicture2() {
  return (
    <CallPicture label="A repeated call: a curved arrow across the line between two modules">
      <CallLoop x={75} y={42} />
    </CallPicture>
  );
}

export function CouplePicture({ control }: { control?: boolean }) {
  return (
    <CallPicture
      label={
        control
          ? 'A control couple: a short arrow beside the line, with a filled circle at its tail'
          : 'A data couple: a short arrow beside the line, with an empty circle at its tail'
      }
    >
      <CoupleArrow x={88} y={36} up={!!control} control={!!control} length={22} />
      <Lines x={97} y={47} anchor="start" lines={[control ? 'No stock' : 'Order']} size={11} />
    </CallPicture>
  );
}
