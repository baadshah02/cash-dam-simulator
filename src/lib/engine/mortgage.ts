/**
 * Canadian mortgage math using semi-annual compounding.
 *
 * Canadian mortgages compound interest semi-annually (twice per year),
 * even though payments are made monthly. This module converts the
 * nominal annual rate to a monthly effective rate and computes the
 * fixed monthly payment that fully amortizes the loan.
 */

/**
 * Convert a nominal annual rate (compounded semi-annually) to a monthly effective rate.
 *
 * Formula:
 *   effective_annual = (1 + nominalAnnualRate / 2)^2
 *   monthly_rate     = effective_annual^(1/12) - 1
 *
 * @param nominalAnnualRate - The nominal annual interest rate as a decimal (e.g. 0.0365 for 3.65%)
 * @returns The monthly effective interest rate as a decimal
 */
export function toMonthlyRate(nominalAnnualRate: number): number {
  const effectiveAnnual = Math.pow(1 + nominalAnnualRate / 2, 2);
  return Math.pow(effectiveAnnual, 1 / 12) - 1;
}

/**
 * Calculate the fixed monthly payment for a Canadian mortgage.
 *
 * Uses semi-annual compounding per Canadian standard. When the nominal
 * rate is zero, returns principal / total_months to avoid division by zero.
 *
 * Formula (rate > 0):
 *   m = toMonthlyRate(nominalAnnualRate)
 *   n = amortizationYears * 12
 *   payment = principal * (m * (1 + m)^n) / ((1 + m)^n - 1)
 *
 * @param principal - The loan principal amount in dollars
 * @param nominalAnnualRate - The nominal annual interest rate as a decimal
 * @param amortizationYears - The amortization period in years
 * @returns The fixed monthly payment amount in dollars
 */
export function calcFixedPayment(
  principal: number,
  nominalAnnualRate: number,
  amortizationYears: number,
): number {
  const totalMonths = amortizationYears * 12;

  if (nominalAnnualRate === 0) {
    return principal / totalMonths;
  }

  const m = toMonthlyRate(nominalAnnualRate);
  const compoundFactor = Math.pow(1 + m, totalMonths);
  return principal * (m * compoundFactor) / (compoundFactor - 1);
}
