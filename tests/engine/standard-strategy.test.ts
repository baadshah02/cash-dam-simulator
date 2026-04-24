import { describe, it, expect } from 'vitest';
import { simulateStandard } from '../../src/lib/engine/standard-strategy';
import { DEFAULT_PARAMS, type SimulationParams } from '../../src/lib/engine/types';
import { calcFixedPayment } from '../../src/lib/engine/mortgage';

describe('simulateStandard', () => {
  it('produces the correct number of monthly and annual records', () => {
    const result = simulateStandard(DEFAULT_PARAMS);
    const expectedMonths = DEFAULT_PARAMS.horizonYears * 12;
    expect(result.monthlyRecords).toHaveLength(expectedMonths);
    expect(result.annualRecords).toHaveLength(DEFAULT_PARAMS.horizonYears);
  });

  it('primary mortgage follows standard amortization (no rental income acceleration)', () => {
    const result = simulateStandard(DEFAULT_PARAMS);
    const payment = calcFixedPayment(
      DEFAULT_PARAMS.primaryMortgageStart,
      DEFAULT_PARAMS.primaryMortgageRate,
      DEFAULT_PARAMS.amortizationYears,
    );

    // First month: interest + principal should equal the fixed payment
    const m1 = result.monthlyRecords[0];
    const totalPayment = m1.primaryInterestPaid + m1.primaryPrincipalPaid;
    expect(totalPayment).toBeCloseTo(payment, 2);
  });

  it('primary mortgage balance is monotonically non-increasing and non-negative', () => {
    const result = simulateStandard(DEFAULT_PARAMS);
    for (let i = 1; i < result.monthlyRecords.length; i++) {
      expect(result.monthlyRecords[i].primaryMortgageBalance)
        .toBeLessThanOrEqual(result.monthlyRecords[i - 1].primaryMortgageBalance);
    }
    for (const rec of result.monthlyRecords) {
      expect(rec.primaryMortgageBalance).toBeGreaterThanOrEqual(0);
    }
  });

  it('investment mortgage is non-negative and non-increasing', () => {
    const result = simulateStandard(DEFAULT_PARAMS);
    for (const rec of result.monthlyRecords) {
      expect(rec.investmentMortgageBalance).toBeGreaterThanOrEqual(0);
    }
    for (let i = 1; i < result.monthlyRecords.length; i++) {
      expect(result.monthlyRecords[i].investmentMortgageBalance)
        .toBeLessThanOrEqual(result.monthlyRecords[i - 1].investmentMortgageBalance);
    }
  });

  it('draws from HELOC when rental income < operating costs + investment payment', () => {
    // Default params: rent $2500, operating ~$1150, investment payment ~$2450
    // Shortfall: ~$1100/mo → HELOC should grow
    const result = simulateStandard(DEFAULT_PARAMS);
    const lastMonth = result.monthlyRecords[result.monthlyRecords.length - 1];
    expect(lastMonth.helocBalance).toBeGreaterThan(DEFAULT_PARAMS.startingHelocBalance);
  });

  it('accumulates rental surplus when cash-flow positive', () => {
    const params: SimulationParams = {
      ...DEFAULT_PARAMS,
      expectedRent: 5_000,
      condoFees: 100,
      propertyTax: 50,
      propertyManagementPct: 0,
      insurance: 20,
      maintenance: 30,
      investmentMortgageStart: 50_000,
    };
    const result = simulateStandard(params);
    // With high rent and low costs, there should be surplus
    expect(result.cumulativeNetRentalSurplus).toBeGreaterThan(0);
  });

  it('rental income does NOT accelerate primary mortgage paydown', () => {
    // Changing rent should not affect primary mortgage balance
    const lowRent: SimulationParams = { ...DEFAULT_PARAMS, expectedRent: 1_500 };
    const highRent: SimulationParams = { ...DEFAULT_PARAMS, expectedRent: 5_000 };

    const resultLow = simulateStandard(lowRent);
    const resultHigh = simulateStandard(highRent);

    // Primary mortgage balances should be identical regardless of rent
    for (let i = 0; i < resultLow.monthlyRecords.length; i++) {
      expect(resultHigh.monthlyRecords[i].primaryMortgageBalance)
        .toBeCloseTo(resultLow.monthlyRecords[i].primaryMortgageBalance, 2);
    }
  });

  it('changing rent affects HELOC balance', () => {
    const lowRent: SimulationParams = { ...DEFAULT_PARAMS, expectedRent: 1_500 };
    const highRent: SimulationParams = { ...DEFAULT_PARAMS, expectedRent: 5_000 };

    const resultLow = simulateStandard(lowRent);
    const resultHigh = simulateStandard(highRent);

    const lastLow = resultLow.monthlyRecords[resultLow.monthlyRecords.length - 1];
    const lastHigh = resultHigh.monthlyRecords[resultHigh.monthlyRecords.length - 1];

    // Higher rent → less HELOC draws → lower HELOC balance
    expect(lastHigh.helocBalance).toBeLessThan(lastLow.helocBalance);
  });

  it('helocLimit equals globalLimit minus primaryMortgageBalance', () => {
    const result = simulateStandard(DEFAULT_PARAMS);
    for (const rec of result.monthlyRecords) {
      expect(rec.helocLimit).toBeCloseTo(
        DEFAULT_PARAMS.globalLimit - rec.primaryMortgageBalance, 2
      );
    }
  });

  it('tax calculation: investment interest deductible, HELOC interest not', () => {
    const result = simulateStandard(DEFAULT_PARAMS);
    const yr1 = result.annualRecords[0];
    const annualRent = DEFAULT_PARAMS.expectedRent * 12;
    const deductible = yr1.investmentInterestTotal + yr1.totalOperatingCosts;
    const taxableIncome = annualRent - deductible;

    if (taxableIncome > 0) {
      expect(yr1.taxRefundAmount).toBeCloseTo(0, 2);
    } else {
      const expectedRefund = Math.abs(taxableIncome) * DEFAULT_PARAMS.marginalTaxRate;
      expect(yr1.taxRefundAmount).toBeCloseTo(expectedRefund, 2);
    }
  });

  it('rate shock affects HELOC and investment but not primary', () => {
    const noShock: SimulationParams = { ...DEFAULT_PARAMS, rateShockIncrease: 0, shockStartYear: 3 };
    const withShock: SimulationParams = { ...DEFAULT_PARAMS, rateShockIncrease: 0.02, shockStartYear: 3 };

    const resultNo = simulateStandard(noShock);
    const resultYes = simulateStandard(withShock);

    // Primary mortgage should be identical
    for (let i = 0; i < resultNo.monthlyRecords.length; i++) {
      expect(resultYes.monthlyRecords[i].primaryMortgageBalance)
        .toBeCloseTo(resultNo.monthlyRecords[i].primaryMortgageBalance, 2);
    }

    // HELOC should diverge after shock
    const lastNo = resultNo.monthlyRecords[resultNo.monthlyRecords.length - 1];
    const lastYes = resultYes.monthlyRecords[resultYes.monthlyRecords.length - 1];
    expect(lastYes.helocBalance).toBeGreaterThan(lastNo.helocBalance);
  });

  it('cumulativeInterestPaid includes primary + investment + HELOC', () => {
    const result = simulateStandard(DEFAULT_PARAMS);
    const lastAnnual = result.annualRecords[result.annualRecords.length - 1];
    const total =
      lastAnnual.cumulativePrimaryInterest +
      lastAnnual.cumulativeInvestmentInterest +
      lastAnnual.cumulativeHelocInterest;
    expect(result.cumulativeInterestPaid).toBeCloseTo(total, 2);
  });

  it('final balance matches last monthly record', () => {
    const result = simulateStandard(DEFAULT_PARAMS);
    const last = result.monthlyRecords[result.monthlyRecords.length - 1];
    expect(result.finalPrimaryBalance).toBe(last.primaryMortgageBalance);
  });
});
