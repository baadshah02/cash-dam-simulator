/**
 * Svelte stores for simulation state management.
 *
 * - `params`: writable store holding all user-adjustable simulation parameters
 * - `viewMode`: writable store controlling which strategy view is active
 * - `dataStore`: derived store that runs the simulation whenever params change
 * - `warnings`: derived store that validates params whenever they change
 */

import { writable, derived } from 'svelte/store';
import type { SimulationParams, SimulationDataStore, ValidationWarning } from '../lib/engine/types';
import { DEFAULT_PARAMS } from '../lib/engine/types';
import { runSimulation } from '../lib/engine/simulation';
import { validateParams } from '../lib/validation';

/**
 * Writable store for all user-adjustable simulation parameters.
 * Initialized with DEFAULT_PARAMS from the strategy document.
 */
export const params = writable<SimulationParams>(DEFAULT_PARAMS);

/**
 * Writable store for the active view mode.
 * Controls which strategy results are displayed in the UI.
 */
export const viewMode = writable<'standard' | 'cashdam' | 'comparison'>('comparison');

/**
 * Derived store that runs both strategy simulations whenever params change.
 * This is the single source of truth for all UI components.
 */
export const dataStore = derived<typeof params, SimulationDataStore>(
  params,
  ($params) => runSimulation($params)
);

/**
 * Derived store that validates parameters whenever they change.
 * Produces an array of warnings for display in the UI.
 */
export const warnings = derived<typeof params, ValidationWarning[]>(
  params,
  ($params) => validateParams($params)
);
