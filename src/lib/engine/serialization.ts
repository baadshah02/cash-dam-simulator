/**
 * JSON serialization and deserialization for SimulationParams.
 *
 * Provides export (serialize) and import (deserialize + validate) functions
 * for saving and loading simulation parameter sets.
 */

import type { SimulationParams } from './types';

/**
 * Validation error returned when import fails.
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Result type for importParams.
 */
export type ImportResult =
  | { success: true; params: SimulationParams }
  | { success: false; errors: ValidationError[] };

/**
 * Field definition for validation: name, type, and allowed range.
 */
interface FieldDef {
  name: keyof SimulationParams;
  type: 'number' | 'boolean';
  min?: number;
  max?: number;
}

/**
 * All required fields with their types and valid ranges, derived from the
 * design document's SimulationParams interface.
 */
const FIELD_DEFS: FieldDef[] = [
  // Debt Stack
  { name: 'globalLimit', type: 'number', min: 800_000, max: 3_000_000 },
  { name: 'primaryMortgageStart', type: 'number', min: 0, max: 2_000_000 },
  { name: 'investmentMortgageStart', type: 'number', min: 0, max: 1_000_000 },
  { name: 'startingHelocBalance', type: 'number', min: 0, max: 1_000_000 },

  // Borrowing Rates (as decimals)
  { name: 'primaryMortgageRate', type: 'number', min: 0.01, max: 0.10 },
  { name: 'investmentMortgageRate', type: 'number', min: 0.01, max: 0.10 },
  { name: 'helocRate', type: 'number', min: 0.02, max: 0.10 },

  // Income & Costs (monthly amounts)
  { name: 'expectedRent', type: 'number', min: 1_500, max: 5_000 },
  { name: 'condoFees', type: 'number', min: 0, max: 1_500 },
  { name: 'propertyTax', type: 'number', min: 0, max: 1_000 },
  { name: 'propertyManagementPct', type: 'number', min: 0, max: 0.12 },
  { name: 'insurance', type: 'number', min: 0, max: 200 },
  { name: 'maintenance', type: 'number', min: 0, max: 500 },

  // Tax & Strategy
  { name: 'marginalTaxRate', type: 'number', min: 0.20, max: 0.54 },
  { name: 'reinvestTaxRefunds', type: 'boolean' },
  { name: 'equityBridgeEnabled', type: 'boolean' },

  // Stress Test
  { name: 'rateShockIncrease', type: 'number', min: 0, max: 0.05 },
  { name: 'shockStartYear', type: 'number', min: 1, max: 30 },

  // Mortgage Term
  { name: 'amortizationYears', type: 'number', min: 15, max: 30 },
  { name: 'horizonYears', type: 'number', min: 15, max: 30 },
];

/**
 * Serialize all parameters to a JSON string with 2-space indentation.
 *
 * @param params - The simulation parameters to serialize
 * @returns A formatted JSON string
 */
export function exportParams(params: SimulationParams): string {
  return JSON.stringify(params, null, 2);
}

/**
 * Deserialize and validate a JSON string back to SimulationParams.
 *
 * Validates:
 * - JSON syntax
 * - Non-empty input
 * - All required fields are present
 * - Field types are correct (number vs boolean)
 * - Numeric fields are within their defined ranges
 *
 * @param json - The JSON string to parse and validate
 * @returns Either the valid params or a list of validation errors
 */
export function importParams(json: string): ImportResult {
  // Handle empty input
  if (!json || json.trim() === '') {
    return {
      success: false,
      errors: [{ field: 'input', message: 'No data found in file' }],
    };
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      success: false,
      errors: [{ field: 'input', message: 'Invalid JSON format' }],
    };
  }

  // Must be a non-null object
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      success: false,
      errors: [{ field: 'input', message: 'Invalid JSON format: expected an object' }],
    };
  }

  const obj = parsed as Record<string, unknown>;
  const errors: ValidationError[] = [];

  // Check each required field
  for (const def of FIELD_DEFS) {
    const value = obj[def.name];

    // Missing field
    if (value === undefined) {
      errors.push({
        field: def.name,
        message: `Missing required field: ${def.name}`,
      });
      continue;
    }

    // Type check
    if (def.type === 'boolean') {
      if (typeof value !== 'boolean') {
        errors.push({
          field: def.name,
          message: `${def.name} must be a boolean, got ${typeof value}`,
        });
      }
    } else if (def.type === 'number') {
      if (typeof value !== 'number' || !isFinite(value)) {
        errors.push({
          field: def.name,
          message: `${def.name} must be a finite number`,
        });
        continue;
      }

      // Range check
      if (def.min !== undefined && value < def.min) {
        errors.push({
          field: def.name,
          message: `${def.name} must be at least ${def.min}, got ${value}`,
        });
      } else if (def.max !== undefined && value > def.max) {
        errors.push({
          field: def.name,
          message: `${def.name} must be at most ${def.max}, got ${value}`,
        });
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  // All validations passed — cast to SimulationParams
  return { success: true, params: obj as unknown as SimulationParams };
}
