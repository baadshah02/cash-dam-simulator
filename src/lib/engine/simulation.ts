/**
 * Simulation orchestrator.
 *
 * Runs both the Standard and Cash Dam strategies and combines the results
 * into a single SimulationDataStore. This is the single entry point called
 * on every parameter change.
 */

import type { SimulationParams, SimulationDataStore } from './types';
import { simulateStandard } from './standard-strategy';
import { simulateCashDam } from './cashdam-strategy';

/**
 * Run both strategies and produce the complete SimulationDataStore.
 *
 * @param params - The full set of user-adjustable simulation parameters
 * @returns A SimulationDataStore containing results for both strategies
 */
export function runSimulation(params: SimulationParams): SimulationDataStore {
  const standard = simulateStandard(params);
  const cashDam = simulateCashDam(params);

  return {
    params,
    standard,
    cashDam,
    computedAt: Date.now(),
  };
}
