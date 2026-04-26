/**
 * Utility for computing strategy metrics up to the primary mortgage payoff date.
 *
 * Rationale: Once the primary mortgage is paid off, continuing to accumulate HELOC
 * interest and other metrics over the remaining simulation horizon doesn't reflect
 * the strategy's real-world outcome. Users naturally compare strategies by "when am
 * I done with my primary mortgage?" — so we truncate cumulative totals at that point.
 *
 * If the primary mortgage doesn't pay off within the horizon, we fall back to
 * full-horizon values.
 */

import type { MonthlyRecord, AnnualRecord, SimulationParams } from './types';

export interface PayoffMetrics {
  interestUntilPayoff: number;
  taxesUntilPayoff: number;
  refundsUntilPayoff: number;
  rentalIncomeUntilPayoff: number;
}

/**
 * Compute interest, taxes, refunds, and rental income accumulated up to the
 * primary mortgage payoff month. If payoff never occurs within the horizon,
 * returns the full-horizon totals.
 *
 * @param monthlyRecords  All monthly records from the simulation
 * @param annualRecords   All annual records from the simulation
 * @param payoffMonth     The month primary mortgage hit zero (or null if never)
 * @param params          Simulation parameters (for rental income calculation)
 * @param fallback        Full-horizon totals to use if payoff never occurs
 */
export function computePayoffMetrics(
  monthlyRecords: MonthlyRecord[],
  annualRecords: AnnualRecord[],
  payoffMonth: number | null,
  params: SimulationParams,
  fallback: {
    cumulativeInterestPaid: number;
    cumulativeTaxesPaid: number;
    cumulativeTaxRefunds: number;
  },
): PayoffMetrics {
  // No payoff within horizon — use full-horizon totals
  if (payoffMonth === null) {
    return {
      interestUntilPayoff: fallback.cumulativeInterestPaid,
      taxesUntilPayoff: fallback.cumulativeTaxesPaid,
      refundsUntilPayoff: fallback.cumulativeTaxRefunds,
      rentalIncomeUntilPayoff: params.expectedRent * monthlyRecords.length,
    };
  }

  // Sum interest across all facilities up to and including the payoff month
  let interestUntilPayoff = 0;
  let rentalIncomeUntilPayoff = 0;

  for (let i = 0; i < payoffMonth && i < monthlyRecords.length; i++) {
    const rec = monthlyRecords[i];
    interestUntilPayoff +=
      rec.primaryInterestPaid + rec.investmentInterestPaid + rec.helocInterestPaid;
    rentalIncomeUntilPayoff += rec.rentalIncomeApplied;
  }

  // Taxes and refunds are tracked annually. Include all complete years up to payoff.
  // If payoff occurs mid-year, include that partial year's annual totals too.
  const payoffYear = Math.ceil(payoffMonth / 12);
  let taxesUntilPayoff = 0;
  let refundsUntilPayoff = 0;

  for (const ar of annualRecords) {
    if (ar.year > payoffYear) break;
    // Tax refund amount for this year (could be refund or zero if taxes owed)
    refundsUntilPayoff += ar.taxRefundAmount;
  }

  // For taxes paid up to payoff, we compute from the annual records.
  // cumulativeTaxesPaid isn't stored per-year in annual records directly,
  // so we derive it: gross tax on rental income minus refunds (clamped to zero).
  for (const ar of annualRecords) {
    if (ar.year > payoffYear) break;
    const annualRent = params.expectedRent * 12;
    const grossTax =
      Math.max(0, annualRent - ar.totalOperatingCosts) * params.marginalTaxRate;
    // Net annual tax = gross tax minus this year's refund (clamped to 0)
    taxesUntilPayoff += Math.max(0, grossTax - ar.taxRefundAmount);
  }

  return {
    interestUntilPayoff,
    taxesUntilPayoff,
    refundsUntilPayoff,
    rentalIncomeUntilPayoff,
  };
}
