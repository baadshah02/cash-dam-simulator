import { describe, it, expect } from 'vitest';
import { validateParams, clampValue } from '../src/lib/validation';
import { DEFAULT_PARAMS } from '../src/lib/engine/types';
import type { SimulationParams } from '../src/lib/engine/types';

describe('validateParams', () => {
  it('returns no warnings for consistent params', () => {
    // Use params where total mortgages fit within global limit
    const params: SimulationParams = {
      ...DEFAULT_PARAMS,
      globalLimit: 2_000_000,
      primaryMortgageStart: 1_000_000,
      investmentMortgageStart: 400_000,
      startingHelocBalance: 200_000,
    };
    const warnings = validateParams(params);
    expect(warnings).toEqual([]);
  });

  it('returns error when amortization period is zero', () => {
    const params: SimulationParams = {
      ...DEFAULT_PARAMS,
      amortizationYears: 0,
      // Use consistent debt stack to isolate the amortization error
      globalLimit: 2_000_000,
      primaryMortgageStart: 1_000_000,
      investmentMortgageStart: 400_000,
      startingHelocBalance: 200_000,
    };
    const warnings = validateParams(params);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].field).toBe('amortizationYears');
    expect(warnings[0].severity).toBe('error');
  });

  it('returns warning when HELOC balance exceeds initial HELOC limit', () => {
    // HELOC limit = globalLimit - primaryMortgageStart
    // With defaults: 1,490,953.91 - 1,086,000 = 404,953.91
    const params: SimulationParams = {
      ...DEFAULT_PARAMS,
      startingHelocBalance: 500_000, // exceeds 404,953.91
    };
    const warnings = validateParams(params);
    expect(warnings.some(w => w.field === 'startingHelocBalance' && w.severity === 'warning')).toBe(true);
  });

  it('does not warn when HELOC balance equals initial HELOC limit', () => {
    const helocLimit = DEFAULT_PARAMS.globalLimit - DEFAULT_PARAMS.primaryMortgageStart;
    const params: SimulationParams = {
      ...DEFAULT_PARAMS,
      startingHelocBalance: helocLimit,
    };
    const warnings = validateParams(params);
    expect(warnings.some(w => w.field === 'startingHelocBalance')).toBe(false);
  });

  it('returns warning when total mortgages exceed global limit', () => {
    const params: SimulationParams = {
      ...DEFAULT_PARAMS,
      primaryMortgageStart: 1_500_000,
      investmentMortgageStart: 500_000,
      globalLimit: 1_800_000,
    };
    // total = 2,000,000 > 1,800,000
    const warnings = validateParams(params);
    expect(warnings.some(w => w.field === 'globalLimit' && w.severity === 'warning')).toBe(true);
  });

  it('does not warn when total mortgages equal global limit', () => {
    const params: SimulationParams = {
      ...DEFAULT_PARAMS,
      primaryMortgageStart: 1_000_000,
      investmentMortgageStart: 500_000,
      globalLimit: 1_500_000,
    };
    const warnings = validateParams(params);
    expect(warnings.some(w => w.field === 'globalLimit')).toBe(false);
  });

  it('can return multiple warnings at once', () => {
    const params: SimulationParams = {
      ...DEFAULT_PARAMS,
      amortizationYears: 0,
      startingHelocBalance: 999_999,
      primaryMortgageStart: 1_500_000,
      investmentMortgageStart: 800_000,
      globalLimit: 2_000_000,
    };
    // amortization = 0 → error
    // helocLimit = 2,000,000 - 1,500,000 = 500,000; heloc balance 999,999 > 500,000 → warning
    // total mortgages = 2,300,000 > 2,000,000 → warning
    const warnings = validateParams(params);
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });
});

describe('clampValue', () => {
  it('returns value when within range', () => {
    expect(clampValue(5, 0, 10)).toBe(5);
  });

  it('clamps to min when value is below range', () => {
    expect(clampValue(-5, 0, 10)).toBe(0);
  });

  it('clamps to max when value is above range', () => {
    expect(clampValue(15, 0, 10)).toBe(10);
  });

  it('returns min when value equals min', () => {
    expect(clampValue(0, 0, 10)).toBe(0);
  });

  it('returns max when value equals max', () => {
    expect(clampValue(10, 0, 10)).toBe(10);
  });

  it('is idempotent', () => {
    const values = [-100, -1, 0, 5, 10, 100, 999];
    for (const v of values) {
      const once = clampValue(v, 0, 10);
      const twice = clampValue(once, 0, 10);
      expect(twice).toBe(once);
    }
  });

  it('handles single-point range', () => {
    expect(clampValue(5, 3, 3)).toBe(3);
    expect(clampValue(3, 3, 3)).toBe(3);
    expect(clampValue(1, 3, 3)).toBe(3);
  });
});
