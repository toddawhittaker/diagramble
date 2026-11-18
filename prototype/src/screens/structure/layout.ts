// Works out where everything on a structure chart sits, from the model alone. A chart has
// no stored positions: the tree is laid out again after every change, so the student
// never arranges boxes by hand (docs/SPEC.md section 11.3).

import { coupleLabel, couplesOf, get, moduleChildren, originalModule, type Couple, type Id, type Model, type Module } from '../../model';

export const BOX_W = 156;
export const BOX_H = 64;
/** The space between two subtrees that sit side by side. */
const GAP_X = 26;
/** The height of the slanted part of a call line, just below the control module. */
const FAN_H = 62;
/** The height one couple takes beside the upright part of a call line. */
const ROW_H = 30;
/** Space above and below the couples on a line. */
const DROP_PAD = 8;
/** How far a couple's arrow sits from the call line. */
export const ARROW_OFF = 9;
/** How far a couple's name starts from the call line. */
export const LABEL_OFF = 17;
/** The widest a couple's name is drawn. A longer name wraps onto a second line. */
export const LABEL_MAX = 100;

export interface Point {
  x: number;
  y: number;
}

export interface LaidModule {
  module: Module;
  /** The module this box stands for: itself, or the module it repeats. */
  original: Module;
  number: string;
  depth: number;
  /** The top left corner of the box. */
  x: number;
  y: number;
}

export interface LaidCouple {
  couple: Couple;
  label: string;
  /** Down couples sit left of the line and up couples right of it. */
  side: 'left' | 'right';
  /** The middle of the arrow. */
  x: number;
  y: number;
}

export interface LaidCall {
  /** The lower module of the line. The call's marks and couples belong to it. */
  moduleId: Id;
  parentId: Id;
  /** Where the line leaves the control module, where it turns upright, and where it meets the lower module. */
  from: Point;
  bend: Point;
  to: Point;
  conditional: boolean;
  couples: LaidCouple[];
}

/** One curved arrow across the lines of repeated calls that sit side by side. */
export interface LaidLoop {
  key: string;
  path: string;
  /** The tip of the arrow and the angle it points at, in degrees. */
  tip: Point;
  angle: number;
}

export interface ChartLayout {
  modules: LaidModule[];
  calls: LaidCall[];
  loops: LaidLoop[];
  /** The size of the whole drawing, from the point (0, 0), with the couples' names. */
  width: number;
  height: number;
}

/** A rough width for a couple's name at 12 pixels, with room for a problem mark. */
function labelWidth(text: string): number {
  return Math.min(LABEL_MAX, Math.max(30, text.length * 6.6)) + 22;
}

export function layoutChart(model: Model, chartId: Id): ChartLayout {
  const chart = get(model, chartId, 'structureChart');
  const top = get(model, chart?.topModuleId, 'module');
  const result: ChartLayout = { modules: [], calls: [], loops: [], width: BOX_W, height: BOX_H };
  if (!top) return result;

  // ---- The tree, with a guard against a module met twice ----
  const seen = new Set<Id>();
  const children = new Map<Id, Module[]>();
  const depthOf = new Map<Id, number>();
  const numberOf = new Map<Id, string>();
  const order: Module[] = [];
  const visit = (m: Module, depth: number, number: string) => {
    seen.add(m.id);
    order.push(m);
    depthOf.set(m.id, depth);
    numberOf.set(m.id, number);
    const below = moduleChildren(model, m.id).filter((c) => !seen.has(c.id));
    children.set(m.id, below);
    for (const c of below) visit(c, depth + 1, `${number}.${c.ordinal}`);
  };
  visit(top, 0, String(top.ordinal));

  // ---- The couples of each line, and the room they need ----
  const downOf = new Map<Id, Couple[]>();
  const upOf = new Map<Id, Couple[]>();
  for (const m of order) {
    const couples = m.parentModuleId === null ? [] : couplesOf(model, m.id);
    downOf.set(m.id, couples.filter((c) => c.direction === 'down'));
    upOf.set(m.id, couples.filter((c) => c.direction === 'up'));
  }
  const widest = (couples: Couple[]) => couples.reduce((w, c) => Math.max(w, LABEL_OFF + labelWidth(coupleLabel(model, c))), 0);

  // The upright part of every line into one level is the same height, so the levels line up.
  const dropAt: number[] = [];
  for (const m of order) {
    const d = depthOf.get(m.id) ?? 0;
    const rows = Math.max(downOf.get(m.id)?.length ?? 0, upOf.get(m.id)?.length ?? 0);
    dropAt[d] = Math.max(dropAt[d] ?? 14, rows > 0 ? rows * ROW_H + DROP_PAD * 2 : 14);
  }
  const topAt: number[] = [0];
  for (let d = 1; d < dropAt.length; d++) topAt[d] = topAt[d - 1] + BOX_H + FAN_H + dropAt[d];

  // ---- Across: each subtree keeps to its own band, so nothing overlaps ----
  // `left` and `right` are how far a subtree reaches from the middle of its top box.
  const reach = new Map<Id, { left: number; right: number }>();
  /** The middle of each child, measured from the middle of its parent. */
  const offset = new Map<Id, number>();
  const measure = (m: Module): { left: number; right: number } => {
    let left = Math.max(BOX_W / 2, widest(downOf.get(m.id) ?? []));
    let right = Math.max(BOX_W / 2, widest(upOf.get(m.id) ?? []));
    const below = children.get(m.id) ?? [];
    if (below.length > 0) {
      const reaches = below.map(measure);
      const centres: number[] = [0];
      for (let i = 1; i < below.length; i++) centres[i] = centres[i - 1] + reaches[i - 1].right + GAP_X + reaches[i].left;
      const middle = (centres[0] + centres[centres.length - 1]) / 2;
      below.forEach((c, i) => offset.set(c.id, centres[i] - middle));
      left = Math.max(left, middle - (centres[0] - reaches[0].left));
      right = Math.max(right, centres[centres.length - 1] + reaches[reaches.length - 1].right - middle);
    }
    const r = { left, right };
    reach.set(m.id, r);
    return r;
  };
  const whole = measure(top);

  const centreOf = new Map<Id, number>();
  const place = (m: Module, centre: number) => {
    centreOf.set(m.id, centre);
    for (const c of children.get(m.id) ?? []) place(c, centre + (offset.get(c.id) ?? 0));
  };
  place(top, Math.round(whole.left));
  result.width = Math.round(whole.left + whole.right);
  result.height = topAt[topAt.length - 1] + BOX_H;

  for (const m of order) {
    const depth = depthOf.get(m.id) ?? 0;
    result.modules.push({
      module: m,
      original: originalModule(model, m.id) ?? m,
      number: numberOf.get(m.id) ?? '',
      depth,
      x: Math.round((centreOf.get(m.id) ?? 0) - BOX_W / 2),
      y: topAt[depth],
    });
  }

  // ---- The call lines, their couples, and the curved arrows of repeated calls ----
  for (const parent of order) {
    const below = children.get(parent.id) ?? [];
    if (below.length === 0) continue;
    const parentDepth = depthOf.get(parent.id) ?? 0;
    const parentLeft = (centreOf.get(parent.id) ?? 0) - BOX_W / 2;
    const fromY = topAt[parentDepth] + BOX_H;
    const bendY = fromY + FAN_H;
    const toY = topAt[parentDepth + 1];
    const calls: LaidCall[] = below.map((child, i) => {
      const cx = centreOf.get(child.id) ?? 0;
      // Each line leaves the control module at its own point, so a diamond belongs to one line.
      const from = { x: parentLeft + (BOX_W * (i + 1)) / (below.length + 1), y: fromY };
      const couples: LaidCouple[] = [];
      (downOf.get(child.id) ?? []).forEach((couple, row) =>
        couples.push({ couple, label: coupleLabel(model, couple), side: 'left', x: cx - ARROW_OFF, y: bendY + DROP_PAD + ROW_H * (row + 0.5) }),
      );
      (upOf.get(child.id) ?? []).forEach((couple, row) =>
        couples.push({ couple, label: coupleLabel(model, couple), side: 'right', x: cx + ARROW_OFF, y: bendY + DROP_PAD + ROW_H * (row + 0.5) }),
      );
      return { moduleId: child.id, parentId: parent.id, from, bend: { x: cx, y: bendY }, to: { x: cx, y: toY }, conditional: child.conditional, couples };
    });
    result.calls.push(...calls);

    // Repeated calls that sit side by side share one arrow.
    const loopY = fromY + 30;
    const xAt = (call: LaidCall) => call.from.x + ((call.bend.x - call.from.x) * (loopY - fromY)) / FAN_H;
    let run: LaidCall[] = [];
    const endRun = () => {
      if (run.length === 0) return;
      const x1 = Math.min(...run.map(xAt)) - 13;
      const x2 = Math.max(...run.map(xAt)) + 13;
      const mid = (x1 + x2) / 2;
      const sag = 15;
      result.loops.push({
        key: `${parent.id}-${run[0].moduleId}`,
        path: `M ${x1} ${loopY - 6} Q ${mid} ${loopY + sag} ${x2} ${loopY - 6}`,
        tip: { x: x2, y: loopY - 6 },
        angle: (Math.atan2(-6 - sag, x2 - mid) * 180) / Math.PI,
      });
      run = [];
    };
    below.forEach((child, i) => {
      if (child.repeated) run.push(calls[i]);
      else endRun();
    });
    endRun();
  }

  return result;
}
