/**
 * Parameter validation and value clamping.
 *
 * Checks SimulationParams for consistency issues and returns warnings.
 * Also provides a utility to clamp numeric values to defined ranges.
 */

import type { SimulationParams, ValidationWarning } from './engine/types';

/**
 * Validate simulation parameters for consistency issues.
 *
 * Checks:
 * - HELOC balance exceeds the initial HELOC limit (globalLimit - primaryMortgageStart)
 * - Total mortgages exceed the Global Limit
 * - Zero amortization period (prevents simulation — error severity)
 *
 * @param params - The simulation parameters to validate
 * @returns An array of validation warnings (may be empty if all checks pass)
 */
export function validateParams(params: SimulationParams): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Error: zero amortization period would produce mathematically undefined results
  if (params.amortizationYears === 0) {
    warnings.push({
      field: 'amortizationYears',
      message: 'Amortization period cannot be zero. The simulation cannot run without a valid amortization period.',
      severity: 'error',
    });
  }

  // Warning: HELOC balance exceeds the initial HELOC limit
  const initialHelocLimit = params.globalLimit - params.primaryMortgageStart;
  if (params.startingHelocBalance > initialHelocLimit) {
    warnings.push({
      field: 'startingHelocBalance',
      message: `Starting HELOC balance ($${params.startingHelocBalance.toLocaleString()}) exceeds the initial HELOC limit ($${initialHelocLimit.toLocaleString()}). The HELOC balance is already in collision at the start of the simulation.`,
      severity: 'warning',
    });
  }

  // Warning: total mortgages exceed Global Limit
  const totalMortgages = params.primaryMortgageStart + params.investmentMortgageStart;
  if (totalMortgages > params.globalLimit) {
    warnings.push({
      field: 'globalLimit',
      message: `Total mortgage debt ($${totalMortgages.toLocaleString()}) exceeds the Global Limit ($${params.globalLimit.toLocaleString()}). This configuration is not realistic.`,
      severity: 'warning',
    });
  }

  return warnings;
}

/**
 * Clamp a numeric value to the range [min, max].
 *
 * - Values below min are clamped to min
 * - Values above max are clamped to max
 * - Values within range are returned unchanged
 * - Clamping is idempotent: clamp(clamp(v, min, max), min, max) === clamp(v, min, max)
 *
 * @param value - The value to clamp
 * @param min - The minimum allowed value
 * @param max - The maximum allowed value
 * @returns The clamped value
 */
export function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
