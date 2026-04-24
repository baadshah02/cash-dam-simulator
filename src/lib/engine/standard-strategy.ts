/**
 * Standard Strategy simulation.
 *
 * Models a conventional investment property owner who has:
 *   - A primary mortgage (paid from owner's pocket, standard amortization)
 *   - An investment mortgage on the rental property
 *   - A HELOC for covering cash-flow shortfalls on the investment side
 *
 * Cash flow model:
 *   1. Primary mortgage is paid by the owner from personal income (not rental income).
 *      It follows the standard amortization schedule with no acceleration.
 *   2. Rental income covers operating costs first, then the investment mortgage payment.
 *   3. If rental income < operating costs + investment mortgage payment → shortfall from HELOC.
 *   4. If rental income > operating costs + investment mortgage payment → surplus accumulates
 *      as idle net rental income (tracked but not applied to any debt).
 *   5. HELOC interest capitalizes monthly.
 *
 * Tax treatment:
 *   - Investment mortgage interest IS deductible (investment property loan)
 *   - HELOC interest is NOT deductible (covers cash-flow gaps, not strategic investment)
 *   - Tax refund = max(0, -(rental_income - investment_interest - operating_costs) × tax_rate)
 *
 * Rate shock does NOT affect the primary mortgage (fixed at origination)
 * but DOES affect the HELOC rate and investment mortgage rate.
 */

import type { SimulationParams, MonthlyRecord, AnnualRecord, StandardResult } from './types';
import { toMonthlyRate, calcFixedPayment } from './mortgage';

export function simulateStandard(params: SimulationParams): StandardResult {
  const totalMonths = params.horizonYears * 12;

  // Primary mortgage: fixed rate, fixed payment, owner pays from pocket
  const primaryMonthlyRate = toMonthlyRate(params.primaryMortgageRate);
  const primaryFixedPayment = calcFixedPayment(
    params.primaryMortgageStart,
    params.primaryMortgageRate,
    params.amortizationYears,
  );

  // Investment mortgage: base rate and payment (may be recalculated on shock)
  let investmentMonthlyRate = toMonthlyRate(params.investmentMortgageRate);
  let investmentFixedPayment = calcFixedPayment(
    params.investmentMortgageStart,
    params.investmentMortgageRate,
    params.amortizationYears,
  );

  // Monthly operating costs on the investment property
  const propertyManagement = params.expectedRent * params.propertyManagementPct;
  const monthlyOperatingCosts =
    params.condoFees +
    params.propertyTax +
    propertyManagement +
    params.insurance +
    params.maintenance;

  // State variables
  let primaryBalance = params.primaryMortgageStart;
  let investmentBalance = params.investmentMortgageStart;
  let helocBalance = params.startingHelocBalance;

  // Payoff tracking
  let primaryPayoffMonth: number | null = null;
  let investmentPayoffMonth: number | null = null;

  // Collision tracking
  let collisionMonth: number | null = null;
  let collisionYear: number | null = null;

  // Cumulative trackers
  let cumulativePrimaryInterest = 0;
  let cumulativeInvestmentInterest = 0;
  let cumulativeHelocInterest = 0;
  let cumulativeOperatingCosts = 0;
  let cumulativeTaxesPaid = 0;
  let cumulativeTaxRefunds = 0;
  let cumulativeNetRentalSurplus = 0;

  // Annual accumulators (reset each year)
  let annualPrimaryInterest = 0;
  let annualPrimaryPrincipal = 0;
  let annualInvestmentInterest = 0;
  let annualInvestmentPrincipal = 0;
  let annualHelocInterest = 0;
  let annualOperatingCosts = 0;

  // Rate shock tracking
  let shockApplied = false;
  let monthlyHelocBurnRate = 0;

  // HELOC breakdown trackers
  let cumulativeCapitalizedInterest = 0;
  let cumulativeOperationalDraws = 0;

  const monthlyRecords: MonthlyRecord[] = [];
  const annualRecords: AnnualRecord[] = [];

  for (let m = 1; m <= totalMonths; m++) {
    const year = Math.ceil(m / 12);

    // --- Rate Shock ---
    let currentHelocRate = params.helocRate;
    let currentInvestmentRate = params.investmentMortgageRate;

    if (year >= params.shockStartYear && params.rateShockIncrease > 0) {
      currentHelocRate += params.rateShockIncrease;
      currentInvestmentRate += params.rateShockIncrease;

      if (!shockApplied) {
        shockApplied = true;
        investmentMonthlyRate = toMonthlyRate(currentInvestmentRate);
        const remainingYears = params.amortizationYears - (year - 1);
        if (remainingYears > 0 && investmentBalance > 0) {
          investmentFixedPayment = calcFixedPayment(
            investmentBalance,
            currentInvestmentRate,
            remainingYears,
          );
        }
      }
    }

    const helocMonthlyRate = currentHelocRate / 12;

    // =========================================================
    // PRIMARY MORTGAGE — paid by owner from pocket, no rental income
    // =========================================================
    let primaryInterestPaid = 0;
    let primaryPrincipalPaid = 0;

    if (primaryBalance > 0) {
      primaryInterestPaid = primaryBalance * primaryMonthlyRate;
      primaryPrincipalPaid = primaryFixedPayment - primaryInterestPaid;

      if (primaryPrincipalPaid >= primaryBalance) {
        primaryPrincipalPaid = primaryBalance;
      }
      if (primaryPrincipalPaid < 0) {
        primaryPrincipalPaid = 0;
      }

      primaryBalance -= primaryPrincipalPaid;
      if (primaryBalance < 0.005) {
        primaryBalance = 0;
      }
      if (primaryBalance === 0 && primaryPayoffMonth === null) {
        primaryPayoffMonth = m;
      }
    }

    // =========================================================
    // INVESTMENT SIDE — rental income covers operating costs, then investment mortgage
    // =========================================================
    let investmentInterestPaid = 0;
    let investmentPrincipalPaid = 0;
    let investmentPaymentDue = 0;

    if (investmentBalance > 0) {
      const effectiveRate = toMonthlyRate(currentInvestmentRate);
      investmentInterestPaid = investmentBalance * effectiveRate;
      investmentPaymentDue = investmentFixedPayment;
    }

    // Cash flow on the investment side:
    // Rental income covers operating costs first, then investment mortgage payment
    const investmentOutflows = monthlyOperatingCosts + investmentPaymentDue;
    const investmentCashFlow = params.expectedRent - investmentOutflows;

    let helocDraw = 0;
    let rentalSurplus = 0;

    if (investmentCashFlow < 0) {
      // Shortfall: draw from HELOC
      helocDraw = Math.abs(investmentCashFlow);
    } else {
      // Surplus: idle cash (tracked but not applied to any debt)
      rentalSurplus = investmentCashFlow;
    }

    cumulativeNetRentalSurplus += rentalSurplus;

    // Apply investment mortgage payment
    if (investmentBalance > 0) {
      investmentPrincipalPaid = investmentPaymentDue - investmentInterestPaid;

      if (investmentPrincipalPaid >= investmentBalance) {
        investmentPrincipalPaid = investmentBalance;
      }
      if (investmentPrincipalPaid < 0) {
        investmentPrincipalPaid = 0;
      }

      investmentBalance -= investmentPrincipalPaid;
      if (investmentBalance < 0.005) {
        investmentBalance = 0;
      }
      if (investmentBalance === 0 && investmentPayoffMonth === null) {
        investmentPayoffMonth = m;
      }
    }

    // =========================================================
    // HELOC — interest capitalizes + shortfall draws
    // =========================================================
    const helocInterestThisMonth = helocBalance * helocMonthlyRate;
    helocBalance += helocInterestThisMonth + helocDraw;

    cumulativeCapitalizedInterest += helocInterestThisMonth;
    cumulativeOperationalDraws += helocDraw;
    monthlyHelocBurnRate = helocDraw;

    const helocLimit = params.globalLimit - primaryBalance;

    // Collision detection
    if (collisionMonth === null && helocBalance >= helocLimit) {
      collisionMonth = m;
      collisionYear = year;
    }

    // =========================================================
    // CUMULATIVE TRACKERS
    // =========================================================
    cumulativePrimaryInterest += primaryInterestPaid;
    cumulativeInvestmentInterest += investmentInterestPaid;
    cumulativeHelocInterest += helocInterestThisMonth;
    cumulativeOperatingCosts += monthlyOperatingCosts;

    annualPrimaryInterest += primaryInterestPaid;
    annualPrimaryPrincipal += primaryPrincipalPaid;
    annualInvestmentInterest += investmentInterestPaid;
    annualInvestmentPrincipal += investmentPrincipalPaid;
    annualHelocInterest += helocInterestThisMonth;
    annualOperatingCosts += monthlyOperatingCosts;

    // =========================================================
    // MONTHLY RECORD
    // =========================================================
    monthlyRecords.push({
      month: m,
      year,
      primaryMortgageBalance: primaryBalance,
      investmentMortgageBalance: investmentBalance,
      helocBalance,
      helocLimit,
      primaryInterestPaid,
      investmentInterestPaid,
      helocInterestPaid: helocInterestThisMonth,
      primaryPrincipalPaid,
      investmentPrincipalPaid,
      rentalIncomeApplied: params.expectedRent,
      operatingCostsPaid: monthlyOperatingCosts,
      helocCapitalizedInterest: helocInterestThisMonth,
      helocOperationalDraws: helocDraw,
      cumulativeCapitalizedInterest,
      cumulativeOperationalDraws,
    });

    // =========================================================
    // YEAR BOUNDARY — tax calculation
    // =========================================================
    if (m % 12 === 0) {
      // Investment mortgage interest IS deductible, HELOC interest is NOT
      const annualRent = params.expectedRent * 12;
      const deductibleExpenses = annualInvestmentInterest + annualOperatingCosts;
      const taxableIncome = annualRent - deductibleExpenses;
      const annualTax = Math.max(0, taxableIncome) * params.marginalTaxRate;
      const annualRefund = Math.max(0, -taxableIncome * params.marginalTaxRate);

      cumulativeTaxesPaid += annualTax;
      cumulativeTaxRefunds += annualRefund;

      annualRecords.push({
        year,
        primaryInterestTotal: annualPrimaryInterest,
        primaryPrincipalTotal: annualPrimaryPrincipal,
        investmentInterestTotal: annualInvestmentInterest,
        investmentPrincipalTotal: annualInvestmentPrincipal,
        helocInterestTotal: annualHelocInterest,
        totalOperatingCosts: annualOperatingCosts,
        netRentalIncome: annualRent - annualOperatingCosts,
        taxRefundAmount: annualRefund,
        taxRefundApplied: false,
        cumulativePrimaryInterest,
        cumulativeInvestmentInterest,
        cumulativeHelocInterest,
        cumulativeOperatingCosts,
        cumulativeTaxRefunds,
        cumulativeTaxRefundsApplied: 0,
        cumulativeTaxRefundsNotApplied: cumulativeTaxRefunds,
        cumulativeCapitalizedInterest,
        cumulativeOperationalDraws,
      });

      // Reset annual accumulators
      annualPrimaryInterest = 0;
      annualPrimaryPrincipal = 0;
      annualInvestmentInterest = 0;
      annualInvestmentPrincipal = 0;
      annualHelocInterest = 0;
      annualOperatingCosts = 0;
    }
  }

  const cumulativeInterestPaid =
    cumulativePrimaryInterest + cumulativeInvestmentInterest + cumulativeHelocInterest;

  return {
    monthlyRecords,
    annualRecords,
    payoffMonth: primaryPayoffMonth,
    finalPrimaryBalance: primaryBalance,
    investmentPayoffMonth,
    cumulativeTaxRefunds,
    cumulativeTaxesPaid,
    cumulativeInterestPaid,
    collisionMonth,
    collisionYear,
    monthlyHelocBurnRate,
    cumulativeNetRentalSurplus,
  };
}
