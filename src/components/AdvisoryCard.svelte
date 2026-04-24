<script lang="ts">
  import { dataStore } from '../stores/simulation';

  /**
   * Format a number as Canadian currency ($X,XXX).
   */
  function fmtCurrency(value: number): string {
    return '$' + Math.round(value).toLocaleString('en-CA');
  }

  /**
   * Format a month number as "Month X (Year Y)".
   */
  function fmtMonth(month: number): string {
    const year = Math.ceil(month / 12);
    return `Month ${month} (Year ${year})`;
  }

  let cashDam = $derived($dataStore.cashDam);
  let params = $derived($dataStore.params);

  // Collision detection
  let hasCollision = $derived(cashDam.collisionMonth !== null);
  let collisionMonth = $derived(cashDam.collisionMonth);
  let collisionYear = $derived(cashDam.collisionYear);

  // Equity Bridge state
  let bridgeEnabled = $derived(params.equityBridgeEnabled);
  let bridgeTriggered = $derived(cashDam.equityBridgeTriggered);
  let bridgeMonth = $derived(cashDam.equityBridgeMonth);
  let equityLiquidated = $derived(cashDam.equityLiquidated);
  let revisedStatus = $derived(cashDam.revisedCollisionStatus);

  // Is collision projected within 24 months? (for advisory display)
  let collisionImminent = $derived(hasCollision && collisionMonth !== null && collisionMonth <= 24);

  // Determine card type
  let cardType = $derived.by(() => {
    if (bridgeEnabled && bridgeTriggered) return 'bridge-executed' as const;
    if (bridgeEnabled && collisionImminent) return 'bridge-advisory' as const;
    if (hasCollision) return 'collision-warning' as const;
    return 'clear' as const;
  });
</script>

<div class="advisory-card" class:clear={cardType === 'clear'} class:warning={cardType === 'collision-warning'} class:advisory={cardType === 'bridge-advisory'} class:executed={cardType === 'bridge-executed'}>
  {#if cardType === 'clear'}
    <div class="card-icon clear-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    </div>
    <div class="card-content">
      <h4 class="card-title">Clear Runway</h4>
      <p class="card-text">No HELOC collision detected within the 16-year horizon. The Cash Dam strategy can sustain itself through the full simulation period.</p>
    </div>

  {:else if cardType === 'collision-warning'}
    <div class="card-icon warning-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    </div>
    <div class="card-content">
      <h4 class="card-title">HELOC Collision Warning</h4>
      <p class="card-text">
        HELOC balance will reach the limit at <strong>{fmtMonth(collisionMonth!)}</strong>.
        The Cash Dam strategy cannot sustain itself beyond this point.
      </p>
      {#if bridgeEnabled === false}
        <p class="card-hint">Enable the Equity Bridge toggle to model a failsafe liquidation scenario.</p>
      {/if}
    </div>

  {:else if cardType === 'bridge-advisory'}
    <div class="card-icon advisory-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    </div>
    <div class="card-content">
      <h4 class="card-title">Equity Bridge Advisory</h4>
      <p class="card-text">
        Collision projected at <strong>{fmtMonth(collisionMonth!)}</strong>.
        Equity Bridge is enabled but has not triggered yet.
      </p>
    </div>

  {:else if cardType === 'bridge-executed'}
    <div class="card-icon executed-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
        <line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    </div>
    <div class="card-content">
      <h4 class="card-title">Equity Bridge Executed</h4>
      <div class="bridge-details">
        <div class="detail-row">
          <span class="detail-label">Triggered At</span>
          <span class="detail-value">{bridgeMonth !== null ? fmtMonth(bridgeMonth) : 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Equity Liquidated</span>
          <span class="detail-value">{fmtCurrency(equityLiquidated)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Revised Status</span>
          <span class="detail-value">{revisedStatus}</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .advisory-card {
    display: flex;
    gap: 0.85rem;
    align-items: flex-start;
    background: var(--color-panel-bg);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1rem 1.15rem;
    transition: border-color 0.25s ease, box-shadow 0.25s ease;
  }

  .advisory-card.clear {
    border-color: rgba(0, 200, 150, 0.25);
  }

  .advisory-card.warning {
    border-color: var(--color-accent-red);
    box-shadow: 0 0 10px rgba(255, 71, 87, 0.08);
  }

  .advisory-card.advisory {
    border-color: var(--color-accent-primary);
    box-shadow: 0 0 10px rgba(212, 168, 67, 0.08);
  }

  .advisory-card.executed {
    border-color: var(--color-accent-blue);
    box-shadow: 0 0 10px rgba(74, 158, 255, 0.08);
  }

  .card-icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    margin-top: 0.1rem;
  }

  .clear-icon {
    color: var(--color-accent-green);
    background: rgba(0, 200, 150, 0.1);
  }

  .warning-icon {
    color: var(--color-accent-red);
    background: rgba(255, 71, 87, 0.1);
  }

  .advisory-icon {
    color: var(--color-accent-primary);
    background: rgba(212, 168, 67, 0.1);
  }

  .executed-icon {
    color: var(--color-accent-blue);
    background: rgba(74, 158, 255, 0.1);
  }

  .card-content {
    flex: 1;
    min-width: 0;
  }

  .card-title {
    color: var(--color-text-main);
    font-size: 0.85rem;
    font-weight: 600;
    margin: 0 0 0.35rem 0;
  }

  .card-text {
    color: var(--color-text-muted);
    font-size: 0.78rem;
    line-height: 1.5;
    margin: 0;
  }

  .card-text strong {
    color: var(--color-text-main);
    font-weight: 600;
  }

  .card-hint {
    color: var(--color-text-muted);
    font-size: 0.7rem;
    font-style: italic;
    margin: 0.4rem 0 0 0;
    opacity: 0.8;
  }

  .bridge-details {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-top: 0.25rem;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
  }

  .detail-label {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .detail-value {
    color: var(--color-text-main);
    font-size: 0.82rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
</style>
