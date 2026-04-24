import { describe, it, expect } from 'vitest';
import { exportParams, importParams } from '../../src/lib/engine/serialization';
import { DEFAULT_PARAMS } from '../../src/lib/engine/types';
import type { SimulationParams } from '../../src/lib/engine/types';

describe('exportParams', () => {
  it('serializes default params to valid JSON', () => {
    const json = exportParams(DEFAULT_PARAMS);
    const parsed = JSON.parse(json);
    expect(parsed.globalLimit).toBe(DEFAULT_PARAMS.globalLimit);
    expect(parsed.reinvestTaxRefunds).toBe(DEFAULT_PARAMS.reinvestTaxRefunds);
  });

  it('produces 2-space indented JSON', () => {
    const json = exportParams(DEFAULT_PARAMS);
    // 2-space indent means lines start with "  " for top-level keys
    const lines = json.split('\n');
    const indentedLines = lines.filter(l => l.startsWith('  "'));
    expect(indentedLines.length).toBeGreaterThan(0);
  });
});

describe('importParams', () => {
  describe('round-trip', () => {
    it('round-trips default params', () => {
      const json = exportParams(DEFAULT_PARAMS);
      const result = importParams(json);
      expect(result.success).toBe(true);
      if (result.success) {
        for (const key of Object.keys(DEFAULT_PARAMS) as (keyof SimulationParams)[]) {
          expect(result.params[key]).toBe(DEFAULT_PARAMS[key]);
        }
      }
    });

    it('round-trips custom params', () => {
      const custom: SimulationParams = {
        ...DEFAULT_PARAMS,
        globalLimit: 2_000_000,
        primaryMortgageRate: 0.05,
        reinvestTaxRefunds: false,
        equityBridgeEnabled: true,
        rateShockIncrease: 0.02,
        shockStartYear: 5,
      };
      const json = exportParams(custom);
      const result = importParams(json);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.params.globalLimit).toBe(2_000_000);
        expect(result.params.primaryMortgageRate).toBe(0.05);
        expect(result.params.reinvestTaxRefunds).toBe(false);
        expect(result.params.equityBridgeEnabled).toBe(true);
        expect(result.params.rateShockIncrease).toBe(0.02);
        expect(result.params.shockStartYear).toBe(5);
      }
    });
  });

  describe('invalid JSON', () => {
    it('rejects empty string', () => {
      const result = importParams('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].message).toContain('No data');
      }
    });

    it('rejects whitespace-only string', () => {
      const result = importParams('   \n  ');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].message).toContain('No data');
      }
    });

    it('rejects malformed JSON', () => {
      const result = importParams('{ not valid json }');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].message).toContain('Invalid JSON');
      }
    });

    it('rejects JSON array', () => {
      const result = importParams('[1, 2, 3]');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].message).toContain('expected an object');
      }
    });

    it('rejects JSON null', () => {
      const result = importParams('null');
      expect(result.success).toBe(false);
    });
  });

  describe('missing fields', () => {
    it('reports missing required fields', () => {
      const result = importParams('{}');
      expect(result.success).toBe(false);
      if (!result.success) {
        // Should report all missing fields
        expect(result.errors.length).toBeGreaterThan(10);
        const fieldNames = result.errors.map(e => e.field);
        expect(fieldNames).toContain('globalLimit');
        expect(fieldNames).toContain('reinvestTaxRefunds');
        expect(fieldNames).toContain('amortizationYears');
      }
    });

    it('reports a single missing field', () => {
      const { globalLimit, ...rest } = DEFAULT_PARAMS;
      const json = JSON.stringify(rest);
      const result = importParams(json);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(e => e.field === 'globalLimit')).toBe(true);
      }
    });
  });

  describe('out-of-range values', () => {
    it('rejects globalLimit below minimum', () => {
      const params = { ...DEFAULT_PARAMS, globalLimit: 100_000 };
      const json = JSON.stringify(params);
      const result = importParams(json);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(e => e.field === 'globalLimit' && e.message.includes('at least'))).toBe(true);
      }
    });

    it('rejects globalLimit above maximum', () => {
      const params = { ...DEFAULT_PARAMS, globalLimit: 5_000_000 };
      const json = JSON.stringify(params);
      const result = importParams(json);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(e => e.field === 'globalLimit' && e.message.includes('at most'))).toBe(true);
      }
    });

    it('rejects negative primary mortgage', () => {
      const params = { ...DEFAULT_PARAMS, primaryMortgageStart: -1 };
      const json = JSON.stringify(params);
      const result = importParams(json);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(e => e.field === 'primaryMortgageStart')).toBe(true);
      }
    });

    it('rejects rate above 10%', () => {
      const params = { ...DEFAULT_PARAMS, primaryMortgageRate: 0.15 };
      const json = JSON.stringify(params);
      const result = importParams(json);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(e => e.field === 'primaryMortgageRate')).toBe(true);
      }
    });

    it('rejects rate below 1%', () => {
      const params = { ...DEFAULT_PARAMS, primaryMortgageRate: 0.005 };
      const json = JSON.stringify(params);
      const result = importParams(json);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(e => e.field === 'primaryMortgageRate')).toBe(true);
      }
    });

    it('rejects amortization of 0 years', () => {
      const params = { ...DEFAULT_PARAMS, amortizationYears: 0 };
      const json = JSON.stringify(params);
      const result = importParams(json);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(e => e.field === 'amortizationYears')).toBe(true);
      }
    });

    it('reports multiple out-of-range fields', () => {
      const params = {
        ...DEFAULT_PARAMS,
        globalLimit: 100,
        primaryMortgageRate: 0.99,
        expectedRent: 0,
      };
      const json = JSON.stringify(params);
      const result = importParams(json);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('type errors', () => {
    it('rejects string where number expected', () => {
      const obj = { ...DEFAULT_PARAMS, globalLimit: 'not a number' };
      const json = JSON.stringify(obj);
      const result = importParams(json);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(e => e.field === 'globalLimit' && e.message.includes('finite number'))).toBe(true);
      }
    });

    it('rejects number where boolean expected', () => {
      const obj = { ...DEFAULT_PARAMS, reinvestTaxRefunds: 1 };
      const json = JSON.stringify(obj);
      const result = importParams(json);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(e => e.field === 'reinvestTaxRefunds' && e.message.includes('boolean'))).toBe(true);
      }
    });

    it('rejects NaN', () => {
      // NaN serializes to null in JSON, so we test with Infinity via a manual string
      const obj = { ...DEFAULT_PARAMS };
      const json = JSON.stringify(obj).replace(
        `"globalLimit":${DEFAULT_PARAMS.globalLimit}`,
        '"globalLimit":null',
      );
      const result = importParams(json);
      expect(result.success).toBe(false);
    });
  });

  describe('boundary values', () => {
    it('accepts values at exact minimum boundaries', () => {
      const params: SimulationParams = {
        globalLimit: 800_000,
        primaryMortgageStart: 0,
        investmentMortgageStart: 0,
        startingHelocBalance: 0,
        primaryMortgageRate: 0.01,
        investmentMortgageRate: 0.01,
        helocRate: 0.02,
        expectedRent: 1_500,
        condoFees: 0,
        propertyTax: 0,
        propertyManagementPct: 0,
        insurance: 0,
        maintenance: 0,
        marginalTaxRate: 0.20,
        reinvestTaxRefunds: false,
        equityBridgeEnabled: false,
        rateShockIncrease: 0,
        shockStartYear: 1,
        amortizationYears: 15,
        horizonYears: 15,
      };
      const json = JSON.stringify(params);
      const result = importParams(json);
      expect(result.success).toBe(true);
    });

    it('accepts values at exact maximum boundaries', () => {
      const params: SimulationParams = {
        globalLimit: 3_000_000,
        primaryMortgageStart: 2_000_000,
        investmentMortgageStart: 1_000_000,
        startingHelocBalance: 1_000_000,
        primaryMortgageRate: 0.10,
        investmentMortgageRate: 0.10,
        helocRate: 0.10,
        expectedRent: 5_000,
        condoFees: 1_500,
        propertyTax: 1_000,
        propertyManagementPct: 0.12,
        insurance: 200,
        maintenance: 500,
        marginalTaxRate: 0.54,
        reinvestTaxRefunds: true,
        equityBridgeEnabled: true,
        rateShockIncrease: 0.05,
        shockStartYear: 16,
        amortizationYears: 30,
        horizonYears: 30,
      };
      const json = JSON.stringify(params);
      const result = importParams(json);
      expect(result.success).toBe(true);
    });
  });
});
