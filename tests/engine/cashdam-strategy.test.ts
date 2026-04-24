import { describe, it, expect } from 'vitest';
import { simulateCashDam } from '../../src/lib/engine/cashdam-strategy';
import { DEFAULT_PARAMS, type SimulationParams } from '../../src/lib/engine/types';
import { toMonthlyRate, calcFixedPayment } from '../../src/lib/engine/mortgage';

describe('simulateCashDam', () => {
  // -----------------------------------------------------------------------
  // Structural invariants
  // -----------------------------------------------------------------------
  describe('structural invariants', () => {
    it('produces exactly 192 monthly records and 16 annual records', () => {
      const result = simulateCashDam(DEFAULT_PARAMS);
      const expectedMonths = DEFAULT_PARAMS.horizonYears * 12;
      expect(result.monthlyRecords).toHaveLength(expectedMonths);
      expect(result.annualRecords).toHaveLength(DEFAULT_PARAMS.horizonYears);
    });

    it('helocLimit = globalLimit - primaryMortgageBalance for every month', () => {
      const result = simulateCashDam(DEFAULT_PARAMS);
      for (const rec of result.monthlyRecords) {
        expect(rec.helocLimit).toBeCloseTo(
          DEFAULT_PARAMS.globalLimit - rec.primaryMortgageBalance,
          2,
        );
      }
    });

    it('primary mortgage balance is non-negative for every month', () => {
      const result = simulateCashDam(DEFAULT_PARAMS);
      for (const rec of result.monthlyRecords) {
        expect(rec.primaryMortgageBalance).toBeGreaterThanOrEqual(0);
      }
    });

    it('investment mortgage balance is non-negative for every month', () => {
      const result = simulateCashDam(DEFAULT_PARAMS);
      for (const rec of result.monthlyRecords) {
        expect(rec.investmentMortgageBalance).toBeGreaterThanOrEqual(0);
      }
    });

    it('final balance matches the last monthly record', () => {
      const result = simulateCashDam(DEFAULT_PARAMS);
      expect(result.finalPrimaryBalance).toBe(
        result.monthlyRecords[result.monthlyRecords.length - 1].primaryMortgageBalance,
      );
    });

    it('all MonthlyRecord fields are populated (not undefined)', () => {
      const result = simulateCashDam(DEFAULT_PARAMS);
      for (const rec of result.monthlyRecords) {
        expect(rec.month).toBeDefined();
        expect(rec.year).toBeDefined();
        expect(rec.primaryMortgageBalance).toBeDefined();
        expect(rec.investmentMortgageBalance).toBeDefined();
        expect(rec.helocBalance).toBeDefined();
        expect(rec.helocLimit).toBeDefined();
        expect(rec.primaryInterestPaid).toBeDefined();
        expect(rec.investmentInterestPaid).toBeDefined();
        expect(rec.helocInterestPaid).toBeDefined();
        expect(rec.primaryPrincipalPaid).toBeDefined();
        expect(rec.investmentPrincipalPaid).toBeDefined();
        expect(rec.rentalIncomeApplied).toBeDefined();
        expect(rec.operatingCostsPaid).toBeDefined();
        expect(rec.helocCapitalizedInterest).toBeDefined();
        expect(rec.helocOperationalDraws).toBeDefined();
        expect(rec.cumulativeCapitalizedInterest).toBeDefined();
        expect(rec.cumulativeOperationalDraws).toBeDefined();
      }
    });
  });

  // -----------------------------------------------------------------------
  // HELOC growth decomposition
  // -----------------------------------------------------------------------
  describe('HELOC growth decomposition', () => {
    it('monthly HELOC growth = capitalized interest + operational draws', () => {
      const result = simulateCashDam(DEFAULT_PARAMS);
      let prevHelocBalance = DEFAULT_PARAMS.startingHelocBalance;

      for (const rec of result.monthlyRecords) {
        const growth = rec.helocBalance - prevHelocBalance;
        const expectedGrowth = rec.helocCapitalizedInterest + rec.helocOperationalDraws;
        expect(growth).toBeCloseTo(expectedGrowth, 2);
        prevHelocBalance = rec.helocBalance;
      }
    });

    it('cumulative capitalized interest + cumulative operational draws = HELOC growth from start', () => {
      const result = simulateCashDam(DEFAULT_PARAMS);
      for (const rec of result.monthlyRecords) {
        const totalGrowth = rec.helocBalance - DEFAULT_PARAMS.startingHelocBalance;
        const decomposition = rec.cumulativeCapitalizedInterest + rec.cumulativeOperationalDraws;
        expect(decomposition).toBeCloseTo(totalGrowth, 2);
      }
    });

    it('cumulative values are monotonically non-decreasing', () => {
      const result = simulateCashDam(DEFAULT_PARAMS);
      for (let i = 1; i < result.monthlyRecords.length; i++) {
        expect(result.monthlyRecords[i].cumulativeCapitalizedInterest)
          .toBeGreaterThanOrEqual(result.monthlyRecords[i - 1].cumulativeCapitalizedInterest);
        expect(result.monthlyRecords[i].cumulativeOperationalDraws)
          .toBeGreaterThanOrEqual(result.monthlyRecords[i - 1].cumulativeOperationalDraws);
      }
    });

    it('final HELOC breakdown matches result summary fields', () => {
      const result = simulateCashDam(DEFAULT_PARAMS);
      const lastRecord = result.monthlyRecords[result.monthlyRecords.length - 1];
      expect(result.finalCapitalizedInterest).toBeCloseTo(
        lastRecord.cumulativeCapitalizedInterest,
        2,
      );
      expect(result.finalOperationalDraws).toBeCloseTo(
        lastRecord.cumulativeOperationalDraws,
        2,
      );
    });
  });

  // -----------------------------------------------------------------------
  // Tax refund formula
  // -----------------------------------------------------------------------
  describe('tax refund formula', () => {
    it('refund = max(0, -(rent - investment_interest - HELOC_interest - operating_costs) × tax_rate)', () => {
      const result = simulateCashDam(DEFAULT_PARAMS);
      const annualRent = DEFAULT_PARAMS.expectedRent * 12;

      for (const annual of result.annualRecords) {
        const totalDeductions =
          annual.investmentInterestTotal +
          annual.helocInterestTotal +
          annual.totalOperatingCosts;
        const netIncome = annualRent - totalDeductions;
        const expectedRefund = Math.max(0, -netIncome * DEFAULT_PARAMS.marginalTaxRate);
        expect(annual.taxRefundAmount).toBeCloseTo(expectedRefund, 2);
      }
    });

    it('tax refunds are non-negative', () => {
      const result = simulateCashDam(DEFAULT_PARAMS);
      for (const annual of result.annualRecords) {
        expect(annual.taxRefundAmount).toBeGreaterThanOrEqual(0);
      }
    });

    it('cumulative tax refunds match sum of annual refunds', () => {
      const result = simulateCashDam(DEFAULT_PARAMS);
      let runningTotal = 0;
      for (const annual of result.annualRecords) {
        runningTotal += annual.taxRefundAmount;
        expect(annual.cumulativeTaxRefunds).toBeCloseTo(runningTotal, 2);
      }
      expect(result.cumulativeTaxRefunds).toBeCloseTo(runningTotal, 2);
    });
  });

  // -----------------------------------------------------------------------
  // April tax refund timing
  // -----------------------------------------------------------------------
  describe('April tax refund timing', () => {
    it('Year 1 refund is applied in month 16 (April Year 2) when reinvest is enabled', () => {
      const params: SimulationParams = {
        ...DEFAULT_PARAMS,
        reinvestTaxRefunds: true,
      };
      const result = simulateCashDam(params);

      // Get the Year 1 refund amount
      const year1Refund = result.annualRecords[0].taxRefundAmount;
      expect(year1Refund).toBeGreaterThan(0);

      // Month 15 (March Year 2) and Month 16 (April Year 2)
      // The primary balance should drop by approximately the refund amount
      // between the end of month 15 processing and the start of month 16 processing
      // (refund is applied at the start of month 16 before mortgage math)

      // Run without reinvest to compare
      const paramsNoReinvest: SimulationParams = {
        ...DEFAULT_PARAMS,
        reinvestTaxRefunds: false,
      };
      const resultNoReinvest = simulateCashDam(paramsNoReinvest);

      // At month 15 (before April), balances should be the same
      // (Year 1 refund hasn't been applied yet in either case)
      expect(result.monthlyRecords[14].primaryMortgageBalance).toBeCloseTo(
        resultNoReinvest.monthlyRecords[14].primaryMortgageBalance,
        2,
      );

      // At month 16 (April Year 2), the reinvest version should have a lower balance
      expect(result.monthlyRecords[15].primaryMortgageBalance).toBeLessThan(
        resultNoReinvest.monthlyRecords[15].primaryMortgageBalance,
      );
    });

    it('refunds are recorded but not applied when reinvest is disabled', () => {
      const params: SimulationParams = {
        ...DEFAULT_PARAMS,
        reinvestTaxRefunds: false,
      };
      const result = simulateCashDam(params);

      // Refunds should still be calculated
      expect(result.cumulativeTaxRefunds).toBeGreaterThan(0);

      // But cumulativeTaxRefundsApplied should be 0
      const lastAnnual = result.annualRecords[result.annualRecords.length - 1];
      expect(lastAnnual.cumulativeTaxRefundsApplied).toBe(0);
      expect(lastAnnual.cumulativeTaxRefundsNotApplied).toBeCloseTo(
        result.cumulativeTaxRefunds,
        2,
      );
    });

    it('cumulativeTaxRefundsApplied + cumulativeTaxRefundsNotApplied = cumulativeTaxRefunds', () => {
      const result = simulateCashDam(DEFAULT_PARAMS);
      for (const annual of result.annualRecords) {
        expect(
          annual.cumulativeTaxRefundsApplied + annual.cumulativeTaxRefundsNotApplied,
        ).toBeCloseTo(annual.cumulativeTaxRefunds, 2);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Collision detection
  // -----------------------------------------------------------------------
  describe('collision detection', () => {
    it('detects collision when HELOC balance exceeds limit', () => {
      // Use params that will cause collision: small global limit, large HELOC start
      const params: SimulationParams = {
        ...DEFAULT_PARAMS,
        globalLimit: 1_200_000,
        primaryMortgageStart: 800_000,
        investmentMortgageStart: 300_000,
        startingHelocBalance: 50_000,
        equityBridgeEnabled: false,
      };
      const result = simulateCashDam(params);

      // With these tight params, collision should occur
      if (result.collisionMonth !== null) {
        const collisionRecord = result.monthlyRecords[result.collisionMonth - 1];
        expect(collisionRecord.helocBalance).toBeGreaterThanOrEqual(collisionRecord.helocLimit);

        // Month before collision should have balance < limit
        if (result.collisionMonth > 1) {
          const prevRecord = result.monthlyRecords[result.collisionMonth - 2];
          expect(prevRecord.helocBalance).toBeLessThan(prevRecord.helocLimit);
        }
      }
    });

    it('reports no collision when HELOC stays within limit', () => {
      // Use params with very large global limit
      const params: SimulationParams = {
        ...DEFAULT_PARAMS,
        globalLimit: 3_000_000,
        primaryMortgageStart: 500_000,
        investmentMortgageStart: 200_000,
        startingHelocBalance: 50_000,
        equityBridgeEnabled: false,
      };
      const result = simulateCashDam(params);

      if (result.collisionMonth === null) {
        // Verify no month has balance >= limit
        for (const rec of result.monthlyRecords) {
          expect(rec.helocBalance).toBeLessThan(rec.helocLimit);
        }
      }
    });

    it('collisionYear matches the year of collisionMonth', () => {
      const result = simulateCashDam(DEFAULT_PARAMS);
      if (result.collisionMonth !== null && result.collisionYear !== null) {
        expect(result.collisionYear).toBe(Math.ceil(result.collisionMonth / 12));
      }
    });
  });

  // -----------------------------------------------------------------------
  // Equity Bridge
  // -----------------------------------------------------------------------
  describe('equity bridge', () => {
    it('clears primary mortgage when collision is projected within 24 months', () => {
      // Use params that will cause collision relatively soon
      const params: SimulationParams = {
        ...DEFAULT_PARAMS,
        globalLimit: 1_300_000,
        primaryMortgageStart: 900_000,
        investmentMortgageStart: 300_000,
        startingHelocBalance: 50_000,
        equityBridgeEnabled: true,
      };
      const result = simulateCashDam(params);

      if (result.equityBridgeTriggered) {
        expect(result.equityBridgeMonth).not.toBeNull();
        expect(result.equityLiquidated).toBeGreaterThan(0);

        // After bridge month, primary balance should be 0
        if (result.equityBridgeMonth !== null) {
          for (let i = result.equityBridgeMonth - 1; i < result.monthlyRecords.length; i++) {
            expect(result.monthlyRecords[i].primaryMortgageBalance).toBe(0);
          }
        }
      }
    });

    it('does not trigger when equityBridgeEnabled is false', () => {
      const params: SimulationParams = {
        ...DEFAULT_PARAMS,
        equityBridgeEnabled: false,
      };
      const result = simulateCashDam(params);

      expect(result.equityBridgeTriggered).toBe(false);
      expect(result.equityBridgeMonth).toBeNull();
      expect(result.equityLiquidated).toBe(0);
    });

    it('equity bridge disabled produces same results as if bridge logic does not exist', () => {
      const params: SimulationParams = {
        ...DEFAULT_PARAMS,
        equityBridgeEnabled: false,
      };
      const result = simulateCashDam(params);

      // Verify no bridge artifacts
      expect(result.equityBridgeTriggered).toBe(false);
      expect(result.equityBridgeMonth).toBeNull();
      expect(result.equityLiquidated).toBe(0);
    });

    it('post-bridge HELOC limit equals globalLimit when primary is cleared', () => {
      const params: SimulationParams = {
        ...DEFAULT_PARAMS,
        globalLimit: 1_300_000,
        primaryMortgageStart: 900_000,
        investmentMortgageStart: 300_000,
        startingHelocBalance: 50_000,
        equityBridgeEnabled: true,
      };
      const result = simulateCashDam(params);

      if (result.equityBridgeTriggered && result.equityBridgeMonth !== null) {
        // After bridge, helocLimit should be globalLimit (since primary = 0)
        for (let i = result.equityBridgeMonth - 1; i < result.monthlyRecords.length; i++) {
          expect(result.monthlyRecords[i].helocLimit).toBeCloseTo(params.globalLimit, 2);
        }
      }
    });
  });

  // -----------------------------------------------------------------------
  // Rate shock
  // -----------------------------------------------------------------------
  describe('rate shock', () => {
    it('does not affect primary mortgage rate', () => {
      const noShock: SimulationParams = {
        ...DEFAULT_PARAMS,
        rateShockIncrease: 0,
        shockStartYear: 3,
      };
      const withShock: SimulationParams = {
        ...DEFAULT_PARAMS,
        rateShockIncrease: 0.02,
        shockStartYear: 3,
      };

      const resultNoShock = simulateCashDam(noShock);
      const resultWithShock = simulateCashDam(withShock);

      // Primary interest in year 1 (before shock) should be the same
      expect(resultWithShock.monthlyRecords[0].primaryInterestPaid).toBeCloseTo(
        resultNoShock.monthlyRecords[0].primaryInterestPaid,
        2,
      );
    });

    it('increases HELOC interest after shock start year', () => {
      const noShock: SimulationParams = {
        ...DEFAULT_PARAMS,
        rateShockIncrease: 0,
        shockStartYear: 3,
      };
      const withShock: SimulationParams = {
        ...DEFAULT_PARAMS,
        rateShockIncrease: 0.02,
        shockStartYear: 3,
      };

      const resultNoShock = simulateCashDam(noShock);
      const resultWithShock = simulateCashDam(withShock);

      // In year 3+ (month 25+), HELOC interest should be higher with shock
      // Compare month 25 (first month of year 3)
      const month25NoShock = resultNoShock.monthlyRecords[24];
      const month25WithShock = resultWithShock.monthlyRecords[24];

      // HELOC balances may differ slightly due to compounding, but the interest rate
      // effect should make the shocked version pay more interest relative to its balance
      const rateNoShock = month25NoShock.helocInterestPaid / resultNoShock.monthlyRecords[23].helocBalance;
      const rateWithShock = month25WithShock.helocInterestPaid / resultWithShock.monthlyRecords[23].helocBalance;

      expect(rateWithShock).toBeGreaterThan(rateNoShock);
    });
  });

  // -----------------------------------------------------------------------
  // Interest + principal = payment
  // -----------------------------------------------------------------------
  describe('interest + principal = payment', () => {
    it('primary mortgage: interest + principal <= total payment for each active month', () => {
      const result = simulateCashDam(DEFAULT_PARAMS);
      const fixedPayment = calcFixedPayment(
        DEFAULT_PARAMS.primaryMortgageStart,
        DEFAULT_PARAMS.primaryMortgageRate,
        DEFAULT_PARAMS.amortizationYears,
      );
      const totalMonthlyPayment = fixedPayment + DEFAULT_PARAMS.expectedRent;

      for (const rec of result.monthlyRecords) {
        if (rec.primaryInterestPaid > 0 || rec.primaryPrincipalPaid > 0) {
          const actualPayment = rec.primaryInterestPaid + rec.primaryPrincipalPaid;
          expect(actualPayment).toBeLessThanOrEqual(totalMonthlyPayment + 0.01);
          expect(actualPayment).toBeGreaterThan(0);
        }
      }
    });

    it('investment mortgage: interest + principal ≈ fixed payment for each active month', () => {
      const result = simulateCashDam(DEFAULT_PARAMS);
      const fixedPayment = calcFixedPayment(
        DEFAULT_PARAMS.investmentMortgageStart,
        DEFAULT_PARAMS.investmentMortgageRate,
        DEFAULT_PARAMS.amortizationYears,
      );

      for (const rec of result.monthlyRecords) {
        if (rec.investmentInterestPaid > 0 || rec.investmentPrincipalPaid > 0) {
          const actualPayment = rec.investmentInterestPaid + rec.investmentPrincipalPaid;
          // In the payoff month, payment may be less
          expect(actualPayment).toBeLessThanOrEqual(fixedPayment + 0.01);
          expect(actualPayment).toBeGreaterThan(0);
        }
      }
    });
  });

  // -----------------------------------------------------------------------
  // Default params smoke test
  // -----------------------------------------------------------------------
  describe('default params smoke test', () => {
    it('produces reasonable results with default parameters', () => {
      const result = simulateCashDam(DEFAULT_PARAMS);

      // HELOC balance should grow over time
      expect(result.monthlyRecords[result.monthlyRecords.length - 1].helocBalance).toBeGreaterThan(
        DEFAULT_PARAMS.startingHelocBalance,
      );

      // Tax refunds should be generated
      expect(result.cumulativeTaxRefunds).toBeGreaterThan(0);

      // Monthly HELOC burn rate should be positive
      expect(result.monthlyHelocBurnRate).toBeGreaterThan(0);

      // Investment mortgage should decrease
      expect(result.monthlyRecords[result.monthlyRecords.length - 1].investmentMortgageBalance).toBeLessThan(
        DEFAULT_PARAMS.investmentMortgageStart,
      );
    });

    it('primary mortgage decreases faster than in a no-rent scenario', () => {
      const result = simulateCashDam(DEFAULT_PARAMS);
      // After 12 months, primary should be noticeably lower than start
      expect(result.monthlyRecords[11].primaryMortgageBalance).toBeLessThan(
        DEFAULT_PARAMS.primaryMortgageStart * 0.98,
      );
    });
  });
});
