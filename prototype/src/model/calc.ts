// The calculations of SPEC sections 10.1, 10.2, 10.4 and 11.6. All are pure functions of
// their arguments. None reads the model, so each can be tested against hand-worked figures.

import type { AlternativeMatrix, CashLine, Economic, ValueEstimate } from './types';

// ---- Numbers as text ----

/** "21,763", or "36.4" with `digits` 1. A minus sign for a negative number. */
export function formatNumber(n: number, digits = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** "36.4%". */
export function formatPercent(n: number, digits = 1): string {
  return `${formatNumber(n, digits)}%`;
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

// ---- The system request (SPEC 10.1) ----

/** The expected value of a set of estimates: each amount multiplied by its probability, added up. */
export function expectedValue(estimates: ValueEstimate[]): number {
  return sum(estimates.map((e) => ((e.amount ?? 0) * (e.probability ?? 0)) / 100));
}

/** The probabilities of a set of estimates, added up. They should come to 100. */
export function probabilityTotal(estimates: ValueEstimate[]): number {
  return sum(estimates.map((e) => e.probability ?? 0));
}

// ---- The cash flow table (SPEC 10.2) ----

export type CashSection = 'benefits' | 'developmentCosts' | 'operationalCosts';

/** True when the tool fills the line in from a quantity and a unit amount. */
export function isQuantityLine(line: CashLine): boolean {
  return line.quantity !== null && line.unitAmount !== null;
}

/**
 * The amounts of one line, one for each column, year 0 first.
 *
 * A typed line gives its amounts, with an empty one counted as 0. A line given as a
 * quantity and a unit amount is filled in: its first amount is the quantity multiplied by
 * the unit amount, and each later year is the year before increased by the growth rate.
 * A development cost falls in year 0 and nowhere else. A benefit or an operational cost
 * starts in year 1, the first year the system runs.
 */
export function lineAmounts(line: CashLine, years: number, section: CashSection): number[] {
  const columns = years + 1;
  if (!isQuantityLine(line)) return Array.from({ length: columns }, (_, i) => line.amounts[i] ?? 0);
  const first = line.quantity! * line.unitAmount!;
  if (section === 'developmentCosts') return Array.from({ length: columns }, (_, i) => (i === 0 ? first : 0));
  const growth = 1 + (line.growthRate ?? 0) / 100;
  const out = [0];
  for (let year = 1; year < columns; year++) out.push(year === 1 ? first : out[year - 1] * growth);
  return out;
}

/** The present value of an amount in year `year`. Year 0 is not discounted. `rate` is a percentage. */
export function presentValue(value: number, rate: number, year: number): number {
  return value / Math.pow(1 + rate / 100, year);
}

export interface CashFlow {
  /** The calendar year of each column. */
  yearLabels: number[];
  /** The amounts of each line, in the order of the form. */
  lines: Record<CashSection, number[][]>;
  // One figure for each column, year 0 first.
  benefits: number[];
  developmentCosts: number[];
  operationalCosts: number[];
  /** Development costs and operational costs together. */
  costs: number[];
  /** Total benefits less total costs. */
  net: number[];
  /** The running total of `net`: the cumulative net cash flow. */
  cumulative: number[];
  /** Empty while the form has no rate. */
  pvBenefits: number[];
  pvCosts: number[];
  totals: {
    benefits: number;
    developmentCosts: number;
    operationalCosts: number;
    costs: number;
    net: number;
    /** null while the form has no rate. */
    pvBenefits: number | null;
    pvCosts: number | null;
  };
  /** Return on investment as a percentage. null when the total costs are zero. */
  roi: number | null;
  /** The column in which the cumulative net cash flow turns positive, or null if it never does. */
  breakEvenYear: number | null;
  /** The break-even point in years, or null when there is none. */
  breakEven: number | null;
  /** Net present value. null while the form has no rate. */
  npv: number | null;
}

/** Every worked-out figure of the cash flow table, by the formulas of SPEC 10.2. */
export function cashFlow(ec: Economic): CashFlow {
  const columns = ec.years + 1;
  const sections: CashSection[] = ['benefits', 'developmentCosts', 'operationalCosts'];
  const lines = Object.fromEntries(sections.map((s) => [s, ec[s].map((l) => lineAmounts(l, ec.years, s))])) as Record<CashSection, number[][]>;
  const column = (rows: number[][]) => Array.from({ length: columns }, (_, i) => sum(rows.map((r) => r[i])));
  const benefits = column(lines.benefits);
  const developmentCosts = column(lines.developmentCosts);
  const operationalCosts = column(lines.operationalCosts);
  const costs = benefits.map((_, i) => developmentCosts[i] + operationalCosts[i]);
  const net = benefits.map((b, i) => b - costs[i]);
  const cumulative: number[] = [];
  net.forEach((n, i) => cumulative.push((cumulative[i - 1] ?? 0) + n));
  const hasRate = ec.rate !== null;
  const pvBenefits = hasRate ? benefits.map((b, i) => presentValue(b, ec.rate!, i)) : [];
  const pvCosts = hasRate ? costs.map((c, i) => presentValue(c, ec.rate!, i)) : [];
  const totals = {
    benefits: sum(benefits),
    developmentCosts: sum(developmentCosts),
    operationalCosts: sum(operationalCosts),
    costs: sum(costs),
    net: sum(net),
    pvBenefits: hasRate ? sum(pvBenefits) : null,
    pvCosts: hasRate ? sum(pvCosts) : null,
  };

  // The break-even point: the first year in which the running total stops being negative.
  let breakEvenYear: number | null = null;
  for (let i = 1; i < columns && breakEvenYear === null; i++)
    if (cumulative[i - 1] < 0 && cumulative[i] >= 0 && net[i] > 0) breakEvenYear = i;
  const breakEven = breakEvenYear === null ? null : breakEvenYear - 1 + (net[breakEvenYear] - cumulative[breakEvenYear]) / net[breakEvenYear];

  return {
    yearLabels: Array.from({ length: columns }, (_, i) => ec.firstYear + i),
    lines,
    benefits,
    developmentCosts,
    operationalCosts,
    costs,
    net,
    cumulative,
    pvBenefits,
    pvCosts,
    totals,
    roi: totals.costs === 0 ? null : ((totals.benefits - totals.costs) / totals.costs) * 100,
    breakEvenYear,
    breakEven,
    npv: hasRate ? totals.pvBenefits! - totals.pvCosts! : null,
  };
}

export type Measure = 'roi' | 'breakEven' | 'npv';

export interface MeasureCheck {
  measure: Measure;
  /** What the student typed, or null. */
  typed: number | null;
  /** What the formula gives, or null when it gives nothing (no costs, no rate, or no break-even point). */
  expected: number | null;
  /**
   * 'empty': nothing typed. 'match': within the allowance. 'mismatch': outside it.
   * 'none': a break-even point is typed but the cumulative figure never turns positive.
   * 'unknown': typed, but the table cannot give a figure to check it against yet.
   */
  status: 'empty' | 'match' | 'mismatch' | 'none' | 'unknown';
  /** How far a typed figure may be from the formula's. */
  allowance: number;
  /** The typed and expected figures as text, with their units. Empty when there is none. */
  typedText: string;
  expectedText: string;
  /** The formula step by step, with this table's figures, ready to show. */
  working: string[];
}

const EPSILON = 1e-9;

/**
 * Checks the three measures the student types against the formulas. A typed result
 * passes within 0.1 of a percentage point for return on investment, 0.01 of a year for
 * the break-even point, and one unit of money for each year of the table for net present value.
 */
export function checkMeasures(ec: Economic): Record<Measure, MeasureCheck> {
  const cf = cashFlow(ec);
  const n = formatNumber;
  const columns = ec.years + 1;
  const make = (
    measure: Measure,
    typed: number | null,
    expected: number | null,
    allowance: number,
    text: (v: number) => string,
    working: string[],
    none = false,
  ): MeasureCheck => {
    let status: MeasureCheck['status'] = 'empty';
    if (typed !== null)
      status = expected === null ? (none ? 'none' : 'unknown') : Math.abs(typed - expected) <= allowance + EPSILON ? 'match' : 'mismatch';
    return {
      measure,
      typed,
      expected,
      status,
      allowance,
      typedText: typed === null ? '' : text(typed),
      expectedText: expected === null ? '' : text(expected),
      working,
    };
  };

  const roiWorking =
    cf.roi === null
      ? ['The total costs are 0, so there is nothing to divide by.']
      : [
          `Total benefits less total costs: ${n(cf.totals.benefits)} − ${n(cf.totals.costs)} = ${n(cf.totals.benefits - cf.totals.costs)}.`,
          `Divided by total costs: ${n(cf.totals.benefits - cf.totals.costs)} ÷ ${n(cf.totals.costs)} = ${formatPercent(cf.roi)}.`,
        ];

  const y = cf.breakEvenYear;
  const breakEvenWorking =
    y === null || cf.breakEven === null
      ? [`The cumulative net cash flow ends at ${n(cf.cumulative[columns - 1] ?? 0)} and never turns positive, so there is no break-even point.`]
      : [
          `The cumulative net cash flow turns positive in year ${y}, so ${y - 1} whole ${y - 1 === 1 ? 'year passes' : 'years pass'} first.`,
          `The part of year ${y} needed: (${n(cf.net[y])} − ${n(cf.cumulative[y])}) ÷ ${n(cf.net[y])} = ${n((cf.net[y] - cf.cumulative[y]) / cf.net[y], 2)}.`,
          `Together: ${y - 1} + ${n((cf.net[y] - cf.cumulative[y]) / cf.net[y], 2)} = ${n(cf.breakEven, 2)} years.`,
        ];

  const npvWorking =
    cf.npv === null
      ? ['The table has no required rate of return yet, so present values cannot be worked out.']
      : [
          `Present value of each year's total benefits at ${formatPercent(ec.rate!, 2).replace(/\.?0+%$/, '%')}: ${cf.pvBenefits.map((v) => n(v)).join(' + ')} = ${n(cf.totals.pvBenefits!)}.`,
          `Present value of each year's total costs: ${cf.pvCosts.map((v) => n(v)).join(' + ')} = ${n(cf.totals.pvCosts!)}.`,
          `Benefits less costs: ${n(cf.totals.pvBenefits!)} − ${n(cf.totals.pvCosts!)} = ${n(cf.npv)}.`,
        ];

  return {
    roi: make('roi', ec.roi, cf.roi, 0.1, (v) => formatPercent(v), roiWorking),
    breakEven: make('breakEven', ec.breakEven, cf.breakEven, 0.01, (v) => `${n(v, 2)} years`, breakEvenWorking, true),
    npv: make('npv', ec.npv, cf.npv, columns, (v) => n(v), npvWorking),
  };
}

// ---- The alternative matrix (SPEC 10.4) ----

export interface MatrixScores {
  /** `weighted[c][a]`: the score multiplied by the weight, or null while either is missing. */
  weighted: (number | null)[][];
  /** The total for each alternative. A missing cell counts as 0. */
  totals: number[];
  /** The weights added up. They should come to 100. */
  weightTotal: number;
}

export function matrixScores(matrix: Pick<AlternativeMatrix, 'alternatives' | 'criteria' | 'cells'>): MatrixScores {
  const weighted = matrix.criteria.map((criterion, c) =>
    matrix.alternatives.map((_, a) => {
      const score = matrix.cells[c]?.[a]?.score ?? null;
      return score === null || criterion.weight === null ? null : score * criterion.weight;
    }),
  );
  return {
    weighted,
    totals: matrix.alternatives.map((_, a) => sum(weighted.map((row) => row[a] ?? 0))),
    weightTotal: sum(matrix.criteria.map((c) => c.weight ?? 0)),
  };
}

// ---- The storage size estimate (SPEC 11.6) ----

/** The size of one record: the average widths of its fields, added up. A missing width counts as 0. */
export function recordSizeOf(widths: (number | null)[]): number {
  return sum(widths.map((w) => w ?? 0));
}

export interface GrowthInput {
  initialRecords: number | null;
  /** Records added each month. */
  growthPerMonth: number | null;
  /** A percentage for each year. When set, it is used in place of `growthPerMonth`. */
  growthPerYear: number | null;
}

/**
 * The records added over `months`. Growth for each month is simply multiplied. Growth as a
 * yearly percentage is compounded once at the end of each whole year, so a part of a year
 * at the end adds nothing. The textbook does not say how it should be done.
 */
export function growthRecords(input: GrowthInput, months: number): number {
  const initial = input.initialRecords ?? 0;
  if (input.growthPerYear !== null) return initial * Math.pow(1 + input.growthPerYear / 100, Math.floor(months / 12)) - initial;
  return (input.growthPerMonth ?? 0) * months;
}

export interface TableVolume {
  recordSize: number;
  /** The record size with the overhead added. */
  totalRecordSize: number;
  initialVolume: number;
  /** The records added over the chosen months. */
  growth: number;
  /** The records there will be after the chosen months. */
  finalRecords: number;
  finalVolume: number;
}

/** The volume of one table. `overheadRate` is a percentage. */
export function tableVolume(recordSize: number, overheadRate: number, input: GrowthInput, months: number): TableVolume {
  const totalRecordSize = recordSize * (1 + overheadRate / 100);
  const initial = input.initialRecords ?? 0;
  const growth = growthRecords(input, months);
  return {
    recordSize,
    totalRecordSize,
    initialVolume: totalRecordSize * initial,
    growth,
    finalRecords: initial + growth,
    finalVolume: totalRecordSize * (initial + growth),
  };
}
