<script lang="ts">
  import { params } from '../stores/simulation';
  import { clampValue } from '../lib/validation';
  import ExportImport from './ExportImport.svelte';

  /**
   * Slider definition for each parameter control.
   */
  interface SliderDef {
    key: keyof import('../lib/engine/types').SimulationParams;
    label: string;
    min: number;
    max: number;
    step: number;
    format: 'currency' | 'percent' | 'percentWhole' | 'year';
  }

  const debtStack: SliderDef[] = [
    { key: 'globalLimit', label: 'Global Limit', min: 800_000, max: 3_000_000, step: 10_000, format: 'currency' },
    { key: 'primaryMortgageStart', label: 'Primary Mortgage', min: 0, max: 2_000_000, step: 5_000, format: 'currency' },
    { key: 'investmentMortgageStart', label: 'Investment Mortgage', min: 0, max: 1_000_000, step: 5_000, format: 'currency' },
    { key: 'startingHelocBalance', label: 'Starting HELOC Balance', min: 0, max: 1_000_000, step: 5_000, format: 'currency' },
  ];

  const borrowingRates: SliderDef[] = [
    { key: 'primaryMortgageRate', label: 'Primary Mortgage Rate', min: 0.01, max: 0.10, step: 0.0025, format: 'percent' },
    { key: 'investmentMortgageRate', label: 'Investment Mortgage Rate', min: 0.01, max: 0.10, step: 0.0025, format: 'percent' },
    { key: 'helocRate', label: 'HELOC Rate', min: 0.02, max: 0.10, step: 0.0025, format: 'percent' },
  ];

  const incomeCosts: SliderDef[] = [
    { key: 'expectedRent', label: 'Expected Rent', min: 1_500, max: 5_000, step: 50, format: 'currency' },
    { key: 'condoFees', label: 'Condo Fees', min: 0, max: 1_500, step: 10, format: 'currency' },
    { key: 'propertyTax', label: 'Property Tax', min: 0, max: 1_000, step: 10, format: 'currency' },
    { key: 'propertyManagementPct', label: 'Property Mgmt Fee', min: 0, max: 0.12, step: 0.005, format: 'percent' },
    { key: 'insurance', label: 'Insurance', min: 0, max: 200, step: 5, format: 'currency' },
    { key: 'maintenance', label: 'Maintenance', min: 0, max: 500, step: 10, format: 'currency' },
  ];

  const taxStrategy: SliderDef[] = [
    { key: 'marginalTaxRate', label: 'Marginal Tax Rate', min: 0.20, max: 0.54, step: 0.01, format: 'percent' },
  ];

  const stressTest: SliderDef[] = [
    { key: 'rateShockIncrease', label: 'Rate Shock Increase', min: 0, max: 0.05, step: 0.0025, format: 'percent' },
    { key: 'shockStartYear', label: 'Shock Start Year', min: 1, max: 30, step: 1, format: 'year' },
  ];

  const mortgageTerm: SliderDef[] = [
    { key: 'amortizationYears', label: 'Amortization Period', min: 15, max: 30, step: 1, format: 'year' },
  ];

  const sections: { title: string; sliders: SliderDef[]; }[] = [
    { title: 'Debt Stack', sliders: debtStack },
    { title: 'Borrowing Rates', sliders: borrowingRates },
    { title: 'Income & Costs', sliders: incomeCosts },
    { title: 'Tax & Strategy', sliders: taxStrategy },
    { title: 'Mortgage Term', sliders: mortgageTerm },
    { title: 'Stress Test', sliders: stressTest },
  ];

  function formatValue(value: number, format: SliderDef['format']): string {
    if (format === 'currency') {
      return '$' + Math.round(value).toLocaleString('en-CA');
    }
    if (format === 'percent') {
      return (value * 100).toFixed(1) + '%';
    }
    if (format === 'percentWhole') {
      return Math.round(value * 100) + '%';
    }
    if (format === 'year') {
      return 'Year ' + value;
    }
    return String(value);
  }

  function handleSliderInput(key: keyof import('../lib/engine/types').SimulationParams, min: number, max: number, event: Event) {
    const target = event.target as HTMLInputElement;
    const raw = parseFloat(target.value);
    const clamped = clampValue(raw, min, max);
    params.update(p => {
      const updated = { ...p, [key]: clamped };
      // Keep horizonYears in sync with amortizationYears
      if (key === 'amortizationYears') {
        updated.horizonYears = clamped;
      }
      return updated;
    });
  }

  function handleToggle(key: 'reinvestTaxRefunds' | 'equityBridgeEnabled', event: Event) {
    const target = event.target as HTMLInputElement;
    params.update(p => ({ ...p, [key]: target.checked }));
  }
</script>

<aside class="parameter-panel">
  <h2 class="panel-title">Parameters</h2>

  {#each sections as section}
    <div class="section">
      <h3 class="section-title">{section.title}</h3>

      {#each section.sliders as slider}
        <div class="slider-group">
          <div class="slider-header">
            <label for="slider-{slider.key}">{slider.label}</label>
            <span class="slider-value">{formatValue($params[slider.key] as number, slider.format)}</span>
          </div>
          <input
            id="slider-{slider.key}"
            type="range"
            min={slider.min}
            max={slider.max}
            step={slider.step}
            value={$params[slider.key]}
            oninput={(e) => handleSliderInput(slider.key, slider.min, slider.max, e)}
          />
        </div>
      {/each}

      {#if section.title === 'Tax & Strategy'}
        <div class="toggle-group">
          <label class="toggle-label">
            <input
              type="checkbox"
              checked={$params.reinvestTaxRefunds}
              onchange={(e) => handleToggle('reinvestTaxRefunds', e)}
            />
            <span class="toggle-switch"></span>
            <span>Reinvest Tax Refunds</span>
          </label>
        </div>
        <div class="toggle-group">
          <label class="toggle-label">
            <input
              type="checkbox"
              checked={$params.equityBridgeEnabled}
              onchange={(e) => handleToggle('equityBridgeEnabled', e)}
            />
            <span class="toggle-switch"></span>
            <span>Equity Bridge</span>
          </label>
        </div>
      {/if}
    </div>
  {/each}

  <div class="section export-section">
    <ExportImport />
  </div>
</aside>

<style>
  .parameter-panel {
    background: var(--color-panel-bg);
    border-right: 1px solid var(--color-border);
    padding: 1.25rem;
    overflow-y: auto;
    height: 100%;
    box-sizing: border-box;
  }

  .panel-title {
    color: var(--color-accent-primary);
    font-size: 1.1rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin: 0 0 1.25rem 0;
  }

  .section {
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--color-border);
  }

  .section:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }

  .section-title {
    color: var(--color-text-muted);
    font-size: 0.7rem;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin: 0 0 0.75rem 0;
  }

  .slider-group {
    margin-bottom: 0.75rem;
  }

  .slider-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.25rem;
  }

  .slider-header label {
    color: var(--color-text-main);
    font-size: 0.8rem;
    font-weight: 400;
  }

  .slider-value {
    color: var(--color-accent-primary);
    font-size: 0.8rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  /* Range slider styling */
  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    background: var(--color-border);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--color-accent-primary);
    cursor: pointer;
    border: 2px solid var(--color-panel-bg);
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
    transition: transform 0.15s ease;
  }

  input[type="range"]::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }

  input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--color-accent-primary);
    cursor: pointer;
    border: 2px solid var(--color-panel-bg);
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
  }

  input[type="range"]::-moz-range-track {
    height: 4px;
    background: var(--color-border);
    border-radius: 2px;
  }

  /* Toggle switch styling */
  .toggle-group {
    margin-bottom: 0.6rem;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    cursor: pointer;
    color: var(--color-text-main);
    font-size: 0.8rem;
    user-select: none;
  }

  .toggle-label input[type="checkbox"] {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-switch {
    position: relative;
    width: 36px;
    height: 20px;
    background: var(--color-border);
    border-radius: 10px;
    flex-shrink: 0;
    transition: background 0.2s ease;
  }

  .toggle-switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-text-muted);
    transition: transform 0.2s ease, background 0.2s ease;
  }

  .toggle-label input:checked + .toggle-switch {
    background: var(--color-accent-primary);
  }

  .toggle-label input:checked + .toggle-switch::after {
    transform: translateX(16px);
    background: var(--color-panel-bg);
  }

  .export-section {
    border-bottom: none;
  }
</style>
