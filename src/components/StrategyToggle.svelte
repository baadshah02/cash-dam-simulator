<script lang="ts">
  import { viewMode } from '../stores/simulation';

  type Mode = 'standard' | 'cashdam' | 'comparison';

  const modes: { value: Mode; label: string }[] = [
    { value: 'standard', label: 'Standard' },
    { value: 'cashdam', label: 'Cash Dam' },
    { value: 'comparison', label: 'Comparison' },
  ];

  function selectMode(mode: Mode) {
    viewMode.set(mode);
  }
</script>

<div class="strategy-toggle" role="group" aria-label="Strategy view mode">
  {#each modes as mode}
    <button
      class="toggle-btn"
      class:active={$viewMode === mode.value}
      onclick={() => selectMode(mode.value)}
      aria-pressed={$viewMode === mode.value}
    >
      {mode.label}
    </button>
  {/each}
</div>

<style>
  .strategy-toggle {
    display: inline-flex;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--color-border);
    background: var(--color-panel-bg);
  }

  .toggle-btn {
    padding: 0.5rem 1.25rem;
    font-size: 0.8rem;
    font-weight: 500;
    letter-spacing: 0.03em;
    border: none;
    background: var(--color-panel-bg);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: background 0.25s ease, color 0.25s ease;
    position: relative;
  }

  .toggle-btn:not(:last-child) {
    border-right: 1px solid var(--color-border);
  }

  .toggle-btn:hover:not(.active) {
    color: var(--color-text-main);
    background: var(--color-border);
  }

  .toggle-btn.active {
    background: var(--color-accent-primary);
    color: var(--color-bg);
    font-weight: 600;
  }
</style>
