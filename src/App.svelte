<script lang="ts">
  import { warnings } from './stores/simulation';
  import ParameterPanel from './components/ParameterPanel.svelte';
  import StrategyToggle from './components/StrategyToggle.svelte';
  import ComparisonDashboard from './components/ComparisonDashboard.svelte';
  import TimeSeriesChart from './components/TimeSeriesChart.svelte';
  import RefundTable from './components/RefundTable.svelte';
  import AdvisoryCard from './components/AdvisoryCard.svelte';
  import ThemeSelector from './components/ThemeSelector.svelte';

  let currentWarnings = $derived($warnings);
  let hasWarnings = $derived(currentWarnings.length > 0);
</script>

<div class="app-layout">
  <header class="app-header">
    <h1 class="app-title">Cash Dam Simulator</h1>
    <ThemeSelector />
  </header>

  {#if hasWarnings}
    <div class="warning-banner" role="alert" aria-live="polite">
      {#each currentWarnings as warning}
        <div
          class="warning-item"
          class:warning-error={warning.severity === 'error'}
        >
          <svg class="warning-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>{warning.message}</span>
        </div>
      {/each}
    </div>
  {/if}

  <div class="app-body">
    <aside class="sidebar">
      <ParameterPanel />
    </aside>

    <main class="main-content">
      <div class="content-header">
        <StrategyToggle />
      </div>

      <ComparisonDashboard />
      <TimeSeriesChart />
      <RefundTable />
      <AdvisoryCard />
    </main>
  </div>
</div>

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(body) {
    background: var(--color-bg);
    color: var(--color-text-main);
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow-x: hidden;
  }

  .app-layout {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--color-bg);
  }

  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.25rem;
    background: var(--color-panel-bg);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    transition: background 0.3s ease, border-color 0.3s ease;
  }

  .app-title {
    color: var(--color-accent-primary);
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  /* Warning banner */
  .warning-banner {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.6rem 1.25rem;
    background: rgba(212, 168, 67, 0.08);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    transition: background 0.3s ease;
  }

  .warning-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.78rem;
    color: #D4A843;
    line-height: 1.4;
  }

  .warning-item.warning-error {
    color: var(--color-accent-red);
  }

  .warning-icon {
    flex-shrink: 0;
  }

  /* Two-column body */
  .app-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .sidebar {
    width: 350px;
    min-width: 350px;
    max-width: 350px;
    overflow-y: auto;
    border-right: 1px solid var(--color-border);
    background: var(--color-panel-bg);
    transition: background 0.3s ease, border-color 0.3s ease;
  }

  .main-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-width: 0;
    transition: background 0.3s ease;
  }

  .content-header {
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }

  /* Responsive: single-column on ≤ 1024px */
  @media (max-width: 1024px) {
    .app-body {
      flex-direction: column;
      overflow: visible;
    }

    .sidebar {
      width: 100%;
      min-width: 100%;
      max-width: 100%;
      max-height: none;
      overflow-y: visible;
      border-right: none;
      border-bottom: 1px solid var(--color-border);
    }

    .main-content {
      overflow-y: visible;
      padding: 1rem;
    }
  }

  /* Ensure no horizontal scroll on small viewports */
  @media (max-width: 375px) {
    .app-header {
      padding: 0.5rem 0.75rem;
    }

    .app-title {
      font-size: 0.95rem;
    }

    .main-content {
      padding: 0.75rem;
    }
  }
</style>
