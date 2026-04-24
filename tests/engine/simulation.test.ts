import { describe, it, expect } from 'vitest';
import { runSimulation } from '../../src/lib/engine/simulation';
import { DEFAULT_PARAMS } from '../../src/lib/engine/types';

describe('runSimulation', () => {
  it('returns a complete SimulationDataStore with default params', () => {
    const store = runSimulation(DEFAULT_PARAMS);

    // Contains the input params
    expect(store.params).toBe(DEFAULT_PARAMS);

    // Has a timestamp
    expect(store.computedAt).toBeGreaterThan(0);
    expect(typeof store.computedAt).toBe('number');

    // Standard result
    const expectedMonths = DEFAULT_PARAMS.horizonYears * 12;
    expect(store.standard.monthlyRecords).toHaveLength(expectedMonths);
    expect(store.standard.annualRecords).toHaveLength(DEFAULT_PARAMS.horizonYears);

    // Cash Dam result
    expect(store.cashDam.monthlyRecords).toHaveLength(expectedMonths);
    expect(store.cashDam.annualRecords).toHaveLength(DEFAULT_PARAMS.horizonYears);
  });

  it('produces a recent computedAt timestamp', () => {
    const before = Date.now();
    const store = runSimulation(DEFAULT_PARAMS);
    const after = Date.now();

    expect(store.computedAt).toBeGreaterThanOrEqual(before);
    expect(store.computedAt).toBeLessThanOrEqual(after);
  });

  it('both strategies start with the same debt structure', () => {
    const store = runSimulation(DEFAULT_PARAMS);

    const firstStd = store.standard.monthlyRecords[0];
    const firstCd = store.cashDam.monthlyRecords[0];

    // Both should start with the same primary mortgage interest
    // (first month interest is based on same starting balance and rate)
    expect(firstStd.primaryInterestPaid).toBeCloseTo(firstCd.primaryInterestPaid, 2);
  });

  it('cash dam strategy produces tax refunds while standard may not', () => {
    const store = runSimulation(DEFAULT_PARAMS);

    // Cash Dam should generate refunds (HELOC interest is deductible)
    expect(store.cashDam.cumulativeTaxRefunds).toBeGreaterThan(0);
  });

  it('both strategies track HELOC balances', () => {
    const store = runSimulation(DEFAULT_PARAMS);

    const lastStdMonth = store.standard.monthlyRecords[store.standard.monthlyRecords.length - 1];
    const lastCdMonth = store.cashDam.monthlyRecords[store.cashDam.monthlyRecords.length - 1];

    // Both should have non-zero HELOC balances with default params
    expect(lastStdMonth.helocBalance).toBeGreaterThan(0);
    expect(lastCdMonth.helocBalance).toBeGreaterThan(0);

    // Both strategies grow the HELOC, but through different mechanisms:
    // Standard: HELOC covers cash-flow shortfalls (operating costs + mortgage payments - rent)
    // Cash Dam: HELOC funds investment mortgage payments + operating costs strategically
    // The relative size depends on parameters; just verify both are tracked
    expect(lastStdMonth.helocBalance).not.toBe(lastCdMonth.helocBalance);
  });
});
