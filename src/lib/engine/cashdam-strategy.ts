/**
 * Cash Dam Strategy simulation.
 *
 * Simulates the Cash Damming debt conversion strategy over a 16-year
 * (192-month) horizon. Rental income pays down the primary mortgage while
 * a HELOC funds investment mortgage payments and operating costs, converting
 * non-deductible debt into tax-deductible debt and generating annual tax
 * refunds.
 *
 * Key mechanics:
 * - Primary mortgage paydown with rental income (same as Standard)
 * - HELOC grows monthly: capitalized interest + investment mortgage payment + operating costs
 * - Annual tax refunds calculated and optionally applied in April of following year
 * - HELOC collision detection
 * - Rate shock applied to HELOC and investment mortgage rates
 * - Equity Bridge failsafe modeling
 * - Tracks capitalized interest vs operational draws separately
 */

import type { SimulationParams, MonthlyRecord, AnnualRecord, CashDamResult } from './types';
import { toMonthlyRate, calcFixedPayment } from './mortgage';
import { computePayoffMetrics } from './payoff-metrics';

/**
 * Simulate the Cash Dam Strategy over the full 16-year horizon.
 */
export function simulateCashDam(params: SimulationParams): CashDamResult {
  const totalMonths = params.horizonYears * 12; // 192

  // Primary mortgage: fixed rate, fixed payment (not affected by rate shock)
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

  // Monthly operating costs
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

  // Collision tracking
  let collisionMonth: number | null = null;
  let collisionYear: number | null = null;

  // Equity Bridge tracking
  let equityBridgeTriggered = false;
  let equityBridgeMonth: number | null = null;
  let equityLiquidated = 0;

  // Cumulative trackers
  let cumulativePrimaryInterest = 0;
  let cumulativeInvestmentInterest = 0;
  let cumulativeHelocInterest = 0;
  let cumulativeOperatingCosts = 0;
  let cumulativeTaxRefunds = 0;
  let cumulativeTaxRefundsApplied = 0;
  let cumulativeTaxRefundsNotApplied = 0;
  let cumulativeCapitalizedInterest = 0;
  let cumulativeOperationalDraws = 0;

  // Annual accumulators (reset each year)
  let annualPrimaryInterest = 0;
  let annualPrimaryPrincipal = 0;
  let annualInvestmentInterest = 0;
  let annualInvestmentPrincipal = 0;
  let annualHelocInterest = 0;
  let annualOperatingCosts = 0;
  let annualRentalIncome = 0;

  // Payoff tracking
  let primaryPayoffMonth: number | null = null;
  let investmentPayoffMonth: number | null = null;

  // Tax refund schedule: refunds[year] = refund amount for that year
  // Applied in April (month 4) of year+1
  const pendingRefunds: Map<number, number> = new Map();

  // Track current monthly HELOC burn rate
  let monthlyHelocBurnRate = 0;

  // Track whether rate shock has been applied (to recalculate investment payment once)
  let shockApplied = false;

  const monthlyRecords: MonthlyRecord[] = [];
  const annualRecords: AnnualRecord[] = [];

  for (let m = 1; m <= totalMonths; m++) {
    const year = Math.ceil(m / 12);
    const monthInYear = ((m - 1) % 12) + 1; // 1-12

    // --- Rate Shock ---
    let currentHelocRate = params.helocRate;
    let currentInvestmentRate = params.investmentMortgageRate;

    if (year >= params.shockStartYear && params.rateShockIncrease > 0) {
      currentHelocRate += params.rateShockIncrease;
      currentInvestmentRate += params.rateShockIncrease;

      // Recalculate investment mortgage payment at the start of the shock year
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

    // HELOC uses simple monthly rate (not semi-annual compounding)
    const helocMonthlyRate = currentHelocRate / 12;

    // --- April Tax Refund Application ---
    // Apply Year Y refund in April (month 4) of Year Y+1
    if (monthInYear === 4 && params.reinvestTaxRefunds) {
      const refundYear = year - 1; // Refund from previous year
      const refund = pendingRefunds.get(refundYear);
      if (refund !== undefined && refund > 0 && primaryBalance > 0) {
        const applied = Math.min(refund, primaryBalance);
        primaryBalance -= applied;
        if (primaryBalance < 0.005) {
          primaryBalance = 0;
        }
        // Record payoff if the refund cleared the mortgage
        if (primaryBalance === 0 && primaryPayoffMonth === null) {
          primaryPayoffMonth = m;
        }
      }
    }

    // --- Equity Bridge Lookahead ---
    if (
      params.equityBridgeEnabled &&
      !equityBridgeTriggered &&
      primaryBalance > 0
    ) {
      // Do a 24-month lookahead to see if collision is projected
      const projectedCollision = projectCollisionWithin(
        primaryBalance,
        investmentBalance,
        helocBalance,
        params,
        primaryMonthlyRate,
        primaryFixedPayment,
        investmentMonthlyRate,
        investmentFixedPayment,
        currentHelocRate,
        monthlyOperatingCosts,
        24,
      );

      if (projectedCollision) {
        equityBridgeTriggered = true;
        equityBridgeMonth = m;
        equityLiquidated = primaryBalance;
        primaryBalance = 0;
        if (primaryPayoffMonth === null) {
          primaryPayoffMonth = m;
        }
      }
    }

    // --- Primary Mortgage Math ---
    let primaryInterestPaid = 0;
    let primaryPrincipalPaid = 0;
    let rentalIncomeApplied = 0;

    if (primaryBalance > 0) {
      primaryInterestPaid = primaryBalance * primaryMonthlyRate;
      const totalPayment = primaryFixedPayment + params.expectedRent;
      let principalPaydown = totalPayment - primaryInterestPaid;

      if (principalPaydown >= primaryBalance) {
        principalPaydown = primaryBalance;
      }

      primaryPrincipalPaid = principalPaydown;
      rentalIncomeApplied = params.expectedRent;
      primaryBalance -= principalPaydown;

      if (primaryBalance < 0.005) {
        primaryBalance = 0;
      }

      if (primaryBalance === 0 && primaryPayoffMonth === null) {
        primaryPayoffMonth = m;
      }
    }

    const helocLimit = params.globalLimit - primaryBalance;

    // --- Investment Mortgage Math ---
    let investmentInterestPaid = 0;
    let investmentPrincipalPaid = 0;
    let currentInvestmentPayment = 0;

    if (investmentBalance > 0) {
      // Use the current (possibly shocked) monthly rate
      const effectiveInvestmentMonthlyRate = toMonthlyRate(currentInvestmentRate);
      investmentInterestPaid = investmentBalance * effectiveInvestmentMonthlyRate;
      const principalPaydown = investmentFixedPayment - investmentInterestPaid;

      if (principalPaydown >= investmentBalance) {
        investmentPrincipalPaid = investmentBalance;
      } else {
        investmentPrincipalPaid = Math.max(0, principalPaydown);
      }

      investmentBalance -= investmentPrincipalPaid;

      if (investmentBalance < 0.005) {
        investmentBalance = 0;
      }

      if (investmentBalance === 0 && investmentPayoffMonth === null) {
        investmentPayoffMonth = m;
      }

      currentInvestmentPayment = investmentFixedPayment;
    }

    // --- HELOC Math ---
    // HELOC interest is capitalized (added to HELOC balance)
    const helocInterestThisMonth = helocBalance * helocMonthlyRate;

    // Operational draws: investment mortgage payment + operating costs
    // Only add investment payment if investment mortgage is still active
    const operationalDraws = currentInvestmentPayment + monthlyOperatingCosts;

    // HELOC grows by capitalized interest + operational draws
    helocBalance += helocInterestThisMonth + operationalDraws;

    // Track HELOC breakdown
    cumulativeCapitalizedInterest += helocInterestThisMonth;
    cumulativeOperationalDraws += operationalDraws;

    // Update monthly HELOC burn rate
    monthlyHelocBurnRate = operationalDraws;

    // --- Collision Detection ---
    if (collisionMonth === null && helocBalance >= helocLimit) {
      collisionMonth = m;
      collisionYear = year;
    }

    // --- Cumulative Trackers ---
    cumulativePrimaryInterest += primaryInterestPaid;
    cumulativeInvestmentInterest += investmentInterestPaid;
    cumulativeHelocInterest += helocInterestThisMonth;
    cumulativeOperatingCosts += monthlyOperatingCosts;

    // Annual accumulators
    annualPrimaryInterest += primaryInterestPaid;
    annualPrimaryPrincipal += primaryPrincipalPaid;
    annualInvestmentInterest += investmentInterestPaid;
    annualInvestmentPrincipal += investmentPrincipalPaid;
    annualHelocInterest += helocInterestThisMonth;
    annualOperatingCosts += monthlyOperatingCosts;
    annualRentalIncome += rentalIncomeApplied;

    // --- Build Monthly Record ---
    const record: MonthlyRecord = {
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
      rentalIncomeApplied,
      operatingCostsPaid: monthlyOperatingCosts,
      helocCapitalizedInterest: helocInterestThisMonth,
      helocOperationalDraws: operationalDraws,
      cumulativeCapitalizedInterest,
      cumulativeOperationalDraws,
    };

    monthlyRecords.push(record);

    // --- Year Boundary: Tax Refund Calculation ---
    if (m % 12 === 0) {
      // Tax refund: max(0, -(annual_rent - investment_interest - HELOC_interest - operating_costs) × tax_rate)
      const annualRent = params.expectedRent * 12;
      const totalDeductions = annualInvestmentInterest + annualHelocInterest + annualOperatingCosts;
      const netIncome = annualRent - totalDeductions;
      const taxRefund = Math.max(0, -netIncome * params.marginalTaxRate);

      cumulativeTaxRefunds += taxRefund;

      // Store pending refund for April application
      pendingRefunds.set(year, taxRefund);

      // Track applied vs not-applied
      let refundApplied = false;
      if (params.reinvestTaxRefunds && taxRefund > 0) {
        // Will be applied in April of next year (if primary mortgage still has balance)
        // We mark it as "applied" conceptually; actual application happens in the April logic above
        refundApplied = true;
        cumulativeTaxRefundsApplied += taxRefund;
      } else {
        cumulativeTaxRefundsNotApplied += taxRefund;
      }

      const annualRecord: AnnualRecord = {
        year,
        primaryInterestTotal: annualPrimaryInterest,
        primaryPrincipalTotal: annualPrimaryPrincipal,
        investmentInterestTotal: annualInvestmentInterest,
        investmentPrincipalTotal: annualInvestmentPrincipal,
        helocInterestTotal: annualHelocInterest,
        totalOperatingCosts: annualOperatingCosts,
        netRentalIncome: annualRent - annualOperatingCosts,
        taxRefundAmount: taxRefund,
        taxRefundApplied: refundApplied,
        cumulativePrimaryInterest,
        cumulativeInvestmentInterest,
        cumulativeHelocInterest,
        cumulativeOperatingCosts,
        cumulativeTaxRefunds,
        cumulativeTaxRefundsApplied,
        cumulativeTaxRefundsNotApplied,
        cumulativeCapitalizedInterest,
        cumulativeOperationalDraws,
      };

      annualRecords.push(annualRecord);

      // Reset annual accumulators
      annualPrimaryInterest = 0;
      annualPrimaryPrincipal = 0;
      annualInvestmentInterest = 0;
      annualInvestmentPrincipal = 0;
      annualHelocInterest = 0;
      annualOperatingCosts = 0;
      annualRentalIncome = 0;
    }
  }

  // Compute cumulative interest paid (all facilities)
  const cumulativeInterestPaid =
    cumulativePrimaryInterest + cumulativeInvestmentInterest + cumulativeHelocInterest;

  // Compute cumulative taxes paid for Cash Dam strategy.
  // Under Cash Dam, the gross rental income tax is the same as Standard:
  //   gross_tax_per_year = max(0, (annual_rent - annual_operating_costs)) × marginal_tax_rate
  // The net tax burden is the gross tax minus the refunds generated by deductible interest.
  // We sum the actual annual gross taxes from the annual records for accuracy.
  let cumulativeGrossTax = 0;
  for (const ar of annualRecords) {
    // Gross tax on rental income (same formula as Standard Strategy)
    const annualRent = params.expectedRent * 12;
    const grossTax = Math.max(0, (annualRent - ar.totalOperatingCosts)) * params.marginalTaxRate;
    cumulativeGrossTax += grossTax;
  }
  const cumulativeTaxesPaid = Math.max(0, cumulativeGrossTax - cumulativeTaxRefunds);

  // Determine revised collision status for equity bridge
  let revisedCollisionStatus = 'Clear Runway';
  if (equityBridgeTriggered) {
    // After bridge, check if collision still occurs
    if (collisionMonth !== null && (equityBridgeMonth === null || collisionMonth > equityBridgeMonth)) {
      revisedCollisionStatus = `Collision Year ${collisionYear} (Mo ${collisionMonth}) — Post-Bridge`;
    } else if (collisionMonth !== null && equityBridgeMonth !== null && collisionMonth <= equityBridgeMonth) {
      revisedCollisionStatus = `Bridge triggered at Month ${equityBridgeMonth}`;
    } else {
      revisedCollisionStatus = `Bridge triggered at Month ${equityBridgeMonth} — Clear Runway`;
    }
  } else if (collisionMonth !== null) {
    revisedCollisionStatus = `Collision Year ${collisionYear} (Mo ${collisionMonth})`;
  }

  const payoffMetrics = computePayoffMetrics(
    monthlyRecords,
    annualRecords,
    primaryPayoffMonth,
    params,
    { cumulativeInterestPaid, cumulativeTaxesPaid, cumulativeTaxRefunds },
  );

  return {
    monthlyRecords,
    annualRecords,
    payoffMonth: primaryPayoffMonth,
    finalPrimaryBalance: primaryBalance,
    investmentPayoffMonth,
    cumulativeTaxRefunds,
    cumulativeTaxesPaid,
    cumulativeInterestPaid,
    monthlyHelocBurnRate,
    collisionMonth,
    collisionYear,
    finalCapitalizedInterest: cumulativeCapitalizedInterest,
    finalOperationalDraws: cumulativeOperationalDraws,
    equityBridgeTriggered,
    equityBridgeMonth,
    equityLiquidated,
    revisedCollisionStatus,
    interestUntilPayoff: payoffMetrics.interestUntilPayoff,
    taxesUntilPayoff: payoffMetrics.taxesUntilPayoff,
    refundsUntilPayoff: payoffMetrics.refundsUntilPayoff,
    rentalIncomeUntilPayoff: payoffMetrics.rentalIncomeUntilPayoff,
  };
}

/**
 * Project whether HELOC collision will occur within the given number of months.
 * Uses a simplified forward simulation (no tax refunds, no equity bridge)
 * to estimate if helocBalance >= helocLimit within the lookahead window.
 */
function projectCollisionWithin(
  primaryBal: number,
  investmentBal: number,
  helocBal: number,
  params: SimulationParams,
  primaryMonthlyRate: number,
  primaryFixedPayment: number,
  investmentMonthlyRate: number,
  investmentFixedPayment: number,
  currentHelocRate: number,
  monthlyOpCosts: number,
  lookaheadMonths: number,
): boolean {
  let pBal = primaryBal;
  let iBal = investmentBal;
  let hBal = helocBal;
  const helocMRate = currentHelocRate / 12;

  for (let i = 0; i < lookaheadMonths; i++) {
    // Primary mortgage paydown
    if (pBal > 0) {
      const pInt = pBal * primaryMonthlyRate;
      let pPrincipal = (primaryFixedPayment + params.expectedRent) - pInt;
      if (pPrincipal >= pBal) pPrincipal = pBal;
      pBal -= pPrincipal;
      if (pBal < 0.005) pBal = 0;
    }

    // Investment mortgage
    let iPayment = 0;
    if (iBal > 0) {
      const iInt = iBal * investmentMonthlyRate;
      let iPrincipal = investmentFixedPayment - iInt;
      if (iPrincipal >= iBal) iPrincipal = iBal;
      iBal -= Math.max(0, iPrincipal);
      if (iBal < 0.005) iBal = 0;
      iPayment = investmentFixedPayment;
    }

    // HELOC growth
    const hInt = hBal * helocMRate;
    hBal += hInt + iPayment + monthlyOpCosts;

    // Check collision
    const hLimit = params.globalLimit - pBal;
    if (hBal >= hLimit) {
      return true;
    }
  }

  return false;
}
