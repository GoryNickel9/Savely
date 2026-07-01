import { describe, expect, it } from 'vitest';
import {
  calculateBaristaFIRE,
  calculateStandardFIRE,
  formatCurrency,
  formatPercent,
  futureValue,
  presentValue,
  yearsToTarget,
} from './calculations';

describe('FIRE calculations', () => {
  it('calculates future value with and without return rate', () => {
    expect(futureValue(1000, 100, 0, 3)).toBe(1300);
    expect(futureValue(1000, 100, 0.1, 2)).toBeCloseTo(1420);
  });

  it('calculates present value and years to target', () => {
    expect(presentValue(1210, 0.1, 2)).toBeCloseTo(1000);
    expect(yearsToTarget(1000, 0, 0, 1300)).toBe(Infinity);
    expect(yearsToTarget(1000, 100, 0, 1300)).toBe(3);
  });

  it('calculates standard FIRE metrics from annual expenses and contributions', () => {
    const result = calculateStandardFIRE({
      currentAge: 30,
      retirementAge: 60,
      currentSavings: 100000,
      annualContribution: 24000,
      annualIncome: 60000,
      expectedReturn: 0.07,
      inflationRate: 0.03,
      withdrawalRate: 0.04,
      annualExpenses: 48000,
    });

    expect(result.fireNumber).toBe(1200000);
    expect(result.monthlyContribution).toBe(2000);
    expect(result.savingsRate).toBe(0.4);
    expect(result.fireAge).toBeGreaterThan(30);
    expect(result.projections[0]).toMatchObject({
      age: 30,
      portfolio: 100000,
      contributions: 100000,
      totalContributions: 100000,
    });
  });

  it('calculates Barista FIRE target reduced by part-time income', () => {
    const result = calculateBaristaFIRE(35, 50000, 12000, 0.06, 0.02, 36000, 0.04, 12000);

    expect(result.fullFireNumber).toBe(900000);
    expect(result.baristaNumber).toBe(600000);
    expect(result.savingsFromPartTime).toBe(300000);
  });

  it('formats currency and percentage for Italian display', () => {
    expect(formatCurrency(1200000)).toContain('1.200.000');
    expect(formatPercent(0.1234)).toBe('12.3%');
  });
});
