/**
 * Theme definitions and persistence for the Cash Dam Simulator.
 *
 * Three dark themes are provided, all designed for an institutional
 * capital markets aesthetic. Theme selection persists to localStorage.
 */

import type { ThemeDefinition } from './engine/types';

// ---------------------------------------------------------------------------
// Theme Definitions
// ---------------------------------------------------------------------------

/**
 * Obsidian Capital — Near-black with gold accents, private equity trading floor feel.
 * This is the default theme.
 */
export const obsidianCapital: ThemeDefinition = {
  id: 'obsidian-capital',
  name: 'Obsidian Capital',
  colors: {
    bgColor: '#0B0E11',
    panelBg: '#141920',
    textMain: '#E8ECF1',
    textMuted: '#6B7A8D',
    borderColor: '#1E2A36',
    accentPrimary: '#D4A843',
    accentGreen: '#00C896',
    accentRed: '#FF4757',
    accentBlue: '#4A9EFF',
    chartBg: '#141920',
    chartGrid: '#1E2A36',
    tooltipBg: '#1E2A36',
    tooltipBorder: '#D4A843',
  },
};

/**
 * Meridian — Deep navy with teal accents, Canadian wealth management dashboard.
 */
export const meridian: ThemeDefinition = {
  id: 'meridian',
  name: 'Meridian',
  colors: {
    bgColor: '#0A1628',
    panelBg: '#111D32',
    textMain: '#E2E8F0',
    textMuted: '#64748B',
    borderColor: '#1B2D4A',
    accentPrimary: '#14B8A6',
    accentGreen: '#34D399',
    accentRed: '#F43F5E',
    accentBlue: '#3B82F6',
    chartBg: '#111D32',
    chartGrid: '#1B2D4A',
    tooltipBg: '#1B2D4A',
    tooltipBorder: '#14B8A6',
  },
};

/**
 * Carbon — Pure dark grays with electric blue, Bloomberg/Refinitiv terminal aesthetic.
 */
export const carbon: ThemeDefinition = {
  id: 'carbon',
  name: 'Carbon',
  colors: {
    bgColor: '#0D0D0D',
    panelBg: '#1A1A1A',
    textMain: '#FAFAFA',
    textMuted: '#737373',
    borderColor: '#262626',
    accentPrimary: '#2563EB',
    accentGreen: '#22C55E',
    accentRed: '#EF4444',
    accentBlue: '#38BDF8',
    chartBg: '#1A1A1A',
    chartGrid: '#262626',
    tooltipBg: '#262626',
    tooltipBorder: '#2563EB',
  },
};

/**
 * All available themes, ordered with the default first.
 */
export const themes: ThemeDefinition[] = [obsidianCapital, meridian, carbon];

// ---------------------------------------------------------------------------
// localStorage key
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'cash-dam-simulator-theme';

// ---------------------------------------------------------------------------
// Theme Application
// ---------------------------------------------------------------------------

/**
 * Apply a theme by setting CSS custom properties on document.documentElement.
 *
 * Each color in the theme definition is mapped to a `--color-*` CSS variable
 * so that all UI components can reference them without importing this module.
 */
export function applyTheme(theme: ThemeDefinition): void {
  const root = document.documentElement;
  const { colors } = theme;

  root.style.setProperty('--color-bg', colors.bgColor);
  root.style.setProperty('--color-panel-bg', colors.panelBg);
  root.style.setProperty('--color-text-main', colors.textMain);
  root.style.setProperty('--color-text-muted', colors.textMuted);
  root.style.setProperty('--color-border', colors.borderColor);
  root.style.setProperty('--color-accent-primary', colors.accentPrimary);
  root.style.setProperty('--color-accent-green', colors.accentGreen);
  root.style.setProperty('--color-accent-red', colors.accentRed);
  root.style.setProperty('--color-accent-blue', colors.accentBlue);
  root.style.setProperty('--color-chart-bg', colors.chartBg);
  root.style.setProperty('--color-chart-grid', colors.chartGrid);
  root.style.setProperty('--color-tooltip-bg', colors.tooltipBg);
  root.style.setProperty('--color-tooltip-border', colors.tooltipBorder);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Load the saved theme from localStorage, falling back to Obsidian Capital.
 *
 * Handles localStorage being unavailable (e.g. private browsing) gracefully
 * by returning the default theme without throwing.
 */
export function loadSavedTheme(): ThemeDefinition {
  try {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) {
      const found = themes.find((t) => t.id === savedId);
      if (found) return found;
    }
  } catch {
    // localStorage unavailable — fall back silently
  }
  return obsidianCapital;
}

/**
 * Persist the selected theme ID to localStorage.
 *
 * If localStorage is unavailable (private browsing, storage quota exceeded),
 * the call is silently ignored — the theme will still be applied for the
 * current session but won't persist across reloads.
 */
export function saveTheme(themeId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, themeId);
  } catch {
    // localStorage unavailable — disable persistence silently
  }
}
