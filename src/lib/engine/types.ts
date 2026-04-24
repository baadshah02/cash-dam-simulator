/**
 * Core TypeScript interfaces and types for the Cash Dam Simulator engine.
 *
 * All data models are defined here as the single source of truth for the
 * simulation engine, UI components, and serialization layer.
 */

// ---------------------------------------------------------------------------
// Simulation Parameters
// ---------------------------------------------------------------------------

export interface SimulationParams {
  // Debt Stack
  globalLimit: number;              // $800K–$3M
  primaryMortgageStart: number;     // $0–$2M
  investmentMortgageStart: number;  // $0–$1M
  startingHelocBalance: number;     // $0–$1M

  // Borrowing Rates (as decimals, e.g., 0.0365)
  primaryMortgageRate: number;      // 1–10%
  investmentMortgageRate: number;   // 1–10%
  helocRate: number;                // 2–10%

  // Income & Costs (monthly amounts)
  expectedRent: number;             // $1,500–$5,000
  condoFees: number;                // $0–$1,500
  propertyTax: number;              // $0–$1,000
  propertyManagementPct: number;    // 0–12% (as decimal)
  insurance: number;                // $0–$200
  maintenance: number;              // $0–$500

  // Tax & Strategy
  marginalTaxRate: number;          // 20–54% (as decimal)
  reinvestTaxRefunds: boolean;
  equityBridgeEnabled: boolean;

  // Stress Test
  rateShockIncrease: number;        // 0–5% (as decimal)
  shockStartYear: number;           // 1–30

  // Mortgage Term
  amortizationYears: number;        // 15–30 (user-adjustable)
  horizonYears: number;             // Always equals amortizationYears (derived)
}

// ---------------------------------------------------------------------------
// Monthly Record
// ---------------------------------------------------------------------------

export interface MonthlyRecord {
  month: number;                       // 1–(horizonYears*12)
  year: number;                        // 1–horizonYears

  primaryMortgageBalance: number;
  investmentMortgageBalance: number;
  helocBalance: number;
  helocLimit: number;                  // globalLimit - primaryMortgageBalance

  primaryInterestPaid: number;
  investmentInterestPaid: number;
  helocInterestPaid: number;

  primaryPrincipalPaid: number;
  investmentPrincipalPaid: number;

  rentalIncomeApplied: number;
  operatingCostsPaid: number;

  // HELOC breakdown (Cash Dam only)
  helocCapitalizedInterest: number;    // Interest added to HELOC this month
  helocOperationalDraws: number;       // Investment mortgage pmt + operating costs added this month

  // Cumulative HELOC breakdown
  cumulativeCapitalizedInterest: number;
  cumulativeOperationalDraws: number;
}

// ---------------------------------------------------------------------------
// Annual Record
// ---------------------------------------------------------------------------

export interface AnnualRecord {
  year: number;

  // Per-facility annual totals
  primaryInterestTotal: number;
  primaryPrincipalTotal: number;
  investmentInterestTotal: number;
  investmentPrincipalTotal: number;
  helocInterestTotal: number;

  totalOperatingCosts: number;
  netRentalIncome: number;
  taxRefundAmount: number;
  taxRefundApplied: boolean;           // Whether refund was applied as prepayment

  // Cumulative from simulation start
  cumulativePrimaryInterest: number;
  cumulativeInvestmentInterest: number;
  cumulativeHelocInterest: number;
  cumulativeOperatingCosts: number;
  cumulativeTaxRefunds: number;
  cumulativeTaxRefundsApplied: number;
  cumulativeTaxRefundsNotApplied: number;

  // Cumulative HELOC breakdown
  cumulativeCapitalizedInterest: number;
  cumulativeOperationalDraws: number;
}

// ---------------------------------------------------------------------------
// Strategy Results
// ---------------------------------------------------------------------------

export interface StandardResult {
  monthlyRecords: MonthlyRecord[];
  annualRecords: AnnualRecord[];
  payoffMonth: number | null;          // Month when primary mortgage reaches 0
  finalPrimaryBalance: number;
  investmentPayoffMonth: number | null;
  cumulativeTaxRefunds: number;
  cumulativeTaxesPaid: number;
  cumulativeInterestPaid: number;

  // HELOC tracking (Standard uses HELOC for cash-flow shortfalls)
  collisionMonth: number | null;
  collisionYear: number | null;
  monthlyHelocBurnRate: number;

  // Net rental surplus: accumulated idle cash from rent minus operating costs minus investment payment
  cumulativeNetRentalSurplus: number;
}

export interface CashDamResult {
  monthlyRecords: MonthlyRecord[];
  annualRecords: AnnualRecord[];
  payoffMonth: number | null;
  finalPrimaryBalance: number;
  investmentPayoffMonth: number | null;
  cumulativeTaxRefunds: number;
  cumulativeTaxesPaid: number;
  cumulativeInterestPaid: number;
  monthlyHelocBurnRate: number;

  // Collision
  collisionMonth: number | null;
  collisionYear: number | null;

  // HELOC breakdown
  finalCapitalizedInterest: number;
  finalOperationalDraws: number;

  // Equity Bridge
  equityBridgeTriggered: boolean;
  equityBridgeMonth: number | null;
  equityLiquidated: number;
  revisedCollisionStatus: string;
}

// ---------------------------------------------------------------------------
// Simulation Data Store
// ---------------------------------------------------------------------------

export interface SimulationDataStore {
  params: SimulationParams;
  standard: StandardResult;
  cashDam: CashDamResult;
  computedAt: number;                  // Timestamp for cache invalidation
}

// ---------------------------------------------------------------------------
// Theme Definition
// ---------------------------------------------------------------------------

export interface ThemeDefinition {
  id: string;
  name: string;
  colors: {
    bgColor: string;
    panelBg: string;
    textMain: string;
    textMuted: string;
    borderColor: string;
    accentPrimary: string;             // Primary accent (brand color)
    accentGreen: string;               // Gains / positive indicators
    accentRed: string;                 // Losses / negative indicators
    accentBlue: string;                // Info / neutral highlights
    chartBg: string;
    chartGrid: string;
    tooltipBg: string;
    tooltipBorder: string;
  };
}

// ---------------------------------------------------------------------------
// Validation Warning
// ---------------------------------------------------------------------------

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'warning' | 'error';
}

// ---------------------------------------------------------------------------
// Default Parameters
// ---------------------------------------------------------------------------

/**
 * Baseline parameter values from the Universal Cash Damming Strategy document.
 */
export const DEFAULT_PARAMS: SimulationParams = {
  // Debt Stack
  globalLimit: 1_490_953.91,
  primaryMortgageStart: 1_086_000,
  investmentMortgageStart: 455_920,
  startingHelocBalance: 275_545.91,

  // Borrowing Rates
  primaryMortgageRate: 0.0365,
  investmentMortgageRate: 0.05,
  helocRate: 0.047,

  // Income & Costs (monthly)
  expectedRent: 2_500,
  condoFees: 610,
  propertyTax: 240,
  propertyManagementPct: 0.06,
  insurance: 50,
  maintenance: 100,

  // Tax & Strategy
  marginalTaxRate: 0.46,
  reinvestTaxRefunds: true,
  equityBridgeEnabled: false,

  // Stress Test
  rateShockIncrease: 0,
  shockStartYear: 3,

  // Mortgage Term
  amortizationYears: 30,
  horizonYears: 30,
};
