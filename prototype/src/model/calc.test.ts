// The calculations of docs/SPEC.md sections 10.1, 10.2, 10.4 and 11.6, against figures worked by hand.

import { describe, expect, it } from 'vitest';
import { cashFlow, checkMeasures, expectedValue, growthRecords, lineAmounts, matrixScores, presentValue, probabilityTotal, recordSizeOf, tableVolume } from './calc';
import type { CashLine, Economic } from './types';

const line = (name: string, amounts: (number | null)[], rest: Partial<CashLine> = {}): CashLine => ({
  name,
  amounts,
  quantity: null,
  unitAmount: null,
  growthRate: null,
  valueIndex: null,
  ...rest,
});

/** The worked example of SPEC 10.2. */
const worked = (typed: Partial<Economic> = {}): Economic => ({
  firstYear: 2027,
  years: 3,
  rate: 8,
  benefits: [line('Benefits', [0, 40000, 50000, 60000])],
  developmentCosts: [line('Development', [80000, 0, 0, 0])],
  operationalCosts: [line('Operations', [0, 10000, 10000, 10000])],
  intangibles: [],
  roi: null,
  breakEven: null,
  npv: null,
  ...typed,
});

describe('The cash flow table', () => {
  const cf = cashFlow(worked());
  const rounded = (values: number[]) => values.map(Math.round);

  it('adds up each year and overall', () => {
    expect(cf.yearLabels).toEqual([2027, 2028, 2029, 2030]);
    expect(cf.benefits).toEqual([0, 40000, 50000, 60000]);
    expect(cf.costs).toEqual([80000, 10000, 10000, 10000]);
    expect(cf.net).toEqual([-80000, 30000, 40000, 50000]);
    expect(cf.cumulative).toEqual([-80000, -50000, -10000, 40000]);
    expect(cf.totals).toMatchObject({ benefits: 150000, developmentCosts: 80000, operationalCosts: 30000, costs: 110000, net: 40000 });
  });

  it('gives the present values of the specification’s table', () => {
    expect(rounded(cf.pvBenefits)).toEqual([0, 37037, 42867, 47630]);
    expect(rounded(cf.pvCosts)).toEqual([80000, 9259, 8573, 7938]);
    expect(Math.round(cf.totals.pvBenefits!)).toBe(127534);
    expect(Math.round(cf.totals.pvCosts!)).toBe(105771);
    expect(presentValue(100, 8, 0)).toBe(100);
  });

  it('gives return on investment 36.4%, break-even 2.20 years and net present value 21,763', () => {
    expect(cf.roi!.toFixed(1)).toBe('36.4');
    expect(cf.breakEvenYear).toBe(3);
    expect(cf.breakEven!.toFixed(2)).toBe('2.20');
    expect(Math.round(cf.npv!)).toBe(21763);
  });

  it('has no break-even point when the cumulative figure never turns positive', () => {
    const never = cashFlow(worked({ benefits: [line('Benefits', [0, 20000, 20000, 20000])] }));
    expect(never.cumulative[3]).toBe(-50000);
    expect(never.breakEven).toBeNull();
  });

  it('has no net present value without a rate, and no return on investment without costs', () => {
    expect(cashFlow(worked({ rate: null })).npv).toBeNull();
    expect(cashFlow(worked({ developmentCosts: [], operationalCosts: [] })).roi).toBeNull();
  });

  it('fills in a line given as a quantity, a unit amount and a growth rate', () => {
    const hours = line('Hours saved', [], { quantity: 450, unitAmount: 20, growthRate: 5 });
    // 450 x 20 = 9,000 in year 1, then 5% more each year.
    expect(lineAmounts(hours, 3, 'benefits')).toEqual([0, 9000, 9450, 9922.5]);
    expect(lineAmounts(hours, 3, 'operationalCosts')).toEqual([0, 9000, 9450, 9922.5]);
    // A development cost falls in year 0 and nowhere else.
    expect(lineAmounts(line('Training', [], { quantity: 40, unitAmount: 25 }), 3, 'developmentCosts')).toEqual([1000, 0, 0, 0]);
    // With no growth rate the amount stays level. A typed line counts an empty amount as 0.
    expect(lineAmounts(line('Level', [], { quantity: 2, unitAmount: 50 }), 2, 'benefits')).toEqual([0, 100, 100]);
    expect(lineAmounts(line('Typed', [5, null]), 2, 'benefits')).toEqual([5, 0, 0]);
  });
});

describe('Checking the typed measures', () => {
  const status = (typed: Partial<Economic>) => {
    const c = checkMeasures(worked(typed));
    return [c.roi.status, c.breakEven.status, c.npv.status];
  };

  it('passes the right answers and says nothing about empty ones', () => {
    expect(status({ roi: 36.4, breakEven: 2.2, npv: 21763 })).toEqual(['match', 'match', 'match']);
    expect(status({})).toEqual(['empty', 'empty', 'empty']);
  });

  it('allows 0.1 of a point, 0.01 of a year, and one unit of money for each of the four columns', () => {
    // The formula gives 36.3636...%, 2.20 years and 21,762.94.
    expect(status({ roi: 36.3, breakEven: 2.21, npv: 21766 })).toEqual(['match', 'match', 'match']);
    expect(status({ roi: 36.5, breakEven: 2.22, npv: 21768 })).toEqual(['mismatch', 'mismatch', 'mismatch']);
  });

  it('shows the working', () => {
    const c = checkMeasures(worked({ roi: 30 }));
    expect(c.roi.working).toEqual([
      'Total benefits less total costs: 150,000 − 110,000 = 40,000.',
      'Divided by total costs: 40,000 ÷ 110,000 = 36.4%.',
    ]);
    expect(c.breakEven.working[1]).toBe('The part of year 3 needed: (50,000 − 40,000) ÷ 50,000 = 0.20.');
    expect(c.npv.working[2]).toBe('Benefits less costs: 127,534 − 105,771 = 21,763.');
  });

  it('marks a break-even point typed when there is none', () => {
    const c = checkMeasures(worked({ benefits: [line('Benefits', [0, 20000, 20000, 20000])], breakEven: 3 }));
    expect(c.breakEven.status).toBe('none');
  });
});

describe('Expected value, weighted scores and storage', () => {
  it('works out an expected value', () => {
    const estimates = [
      { label: 'Cautious', amount: 12000, probability: 30 },
      { label: 'Likely', amount: 18000, probability: 50 },
      { label: 'Hopeful', amount: 27000, probability: 20 },
    ];
    // 3,600 + 9,000 + 5,400.
    expect(expectedValue(estimates)).toBe(18000);
    expect(probabilityTotal(estimates)).toBe(100);
  });

  it('multiplies each score by its weight and totals each alternative', () => {
    const scores = matrixScores({
      alternatives: ['A', 'B'],
      criteria: [
        { name: 'Fit', group: 'technical', weight: 60 },
        { name: 'Cost', group: 'economic', weight: 40 },
      ],
      cells: [
        [{ supportingInformation: '', score: 5 }, { supportingInformation: '', score: 3 }],
        [{ supportingInformation: '', score: 2 }, { supportingInformation: '', score: null }],
      ],
    });
    expect(scores.weighted).toEqual([[300, 180], [80, null]]);
    expect(scores.totals).toEqual([380, 180]);
    expect(scores.weightTotal).toBe(100);
  });

  it('gives the storage figures of the specification’s worked example', () => {
    const size = recordSizeOf([6, 20, 10, 4]);
    expect(size).toBe(40);
    const v = tableVolume(size, 25, { initialRecords: 2000, growthPerMonth: 100, growthPerYear: null }, 24);
    expect(v).toEqual({ recordSize: 40, totalRecordSize: 50, initialVolume: 100000, growth: 2400, finalRecords: 4400, finalVolume: 220000 });
  });

  it('compounds growth given as a yearly percentage once for each whole year', () => {
    // 1,000 records at 10% a year for 30 months: two whole years, so 1,210 records.
    const input = { initialRecords: 1000, growthPerMonth: 999, growthPerYear: 10 };
    expect(growthRecords(input, 30)).toBeCloseTo(210, 6);
    expect(growthRecords(input, 11)).toBe(0);
    expect(recordSizeOf([4, null])).toBe(4);
  });
});
