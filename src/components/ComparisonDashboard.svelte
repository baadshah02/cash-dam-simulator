<script lang="ts">
  import { dataStore, viewMode } from '../stores/simulation';

  function fmtCurrency(value: number): string {
    return '$' + Math.round(value).toLocaleString('en-CA');
  }

  function fmtTimeline(month: number | null, finalBalance?: number): string {
    if (month !== null) {
      const year = Math.ceil(month / 12);
      return `Month ${month} (Year ${year})`;
    }
    if (finalBalance !== undefined && finalBalance < 100) {
      return '~Month 192 (Year 16)';
    }
    return 'Not Paid Off';
  }

  function effectivePayoff(month: number | null, finalBalance: number): number | null {
    if (month !== null) return month;
    if (finalBalance < 100) return 192;
    return null;
  }

  function winnerLower(a: number | null, b: number | null): 'a' | 'b' | 'tie' {
    if (a === null && b === null) return 'tie';
    if (a === null) return 'b';
    if (b === null) return 'a';
    if (Math.abs(a - b) < 0.01) return 'tie';
    return a < b ? 'a' : 'b';
  }

  // Reactive data
  let data = $derived($dataStore);
  let mode = $derived($viewMode);

  // Payoff
  let stdPayoff = $derived(data.standard.payoffMonth);
  let stdFinalBal = $derived(data.standard.finalPrimaryBalance);
  let cdPayoff = $derived(data.cashDam.payoffMonth);
  let cdFinalBal = $derived(data.cashDam.finalPrimaryBalance);
  let effStdPayoff = $derived(effectivePayoff(stdPayoff, stdFinalBal));
  let effCdPayoff = $derived(effectivePayoff(cdPayoff, cdFinalBal));
  let payoffWin = $derived(winnerLower(effStdPayoff, effCdPayoff));

  // Payoff difference in months for the highlight card
  let payoffDiffMonths = $derived(
    effStdPayoff !== null && effCdPayoff !== null
      ? Math.abs(effStdPayoff - effCdPayoff)
      : null
  );
  let payoffWinnerLabel = $derived(
    payoffWin === 'a' ? 'Standard' : payoffWin === 'b' ? 'Cash Dam' : null
  );

  // Taxes
  let stdTaxes = $derived(data.standard.cumulativeTaxesPaid);
  let cdTaxes = $derived(data.cashDam.cumulativeTaxesPaid);
  let taxWin = $derived(winnerLower(stdTaxes, cdTaxes));
  let netTaxSavings = $derived(stdTaxes - cdTaxes);

  // Interest
  let stdInterest = $derived(data.standard.cumulativeInterestPaid);
  let cdInterest = $derived(data.cashDam.cumulativeInterestPaid);
  let interestWin = $derived(winnerLower(stdInterest, cdInterest));

  // Cash Dam specifics
  let cumulativeRefunds = $derived(data.cashDam.cumulativeTaxRefunds);
  let helocBurnRate = $derived(data.cashDam.monthlyHelocBurnRate);
  let collisionMonth = $derived(data.cashDam.collisionMonth);
  let collisionYear = $derived(data.cashDam.collisionYear);
  let collisionStatus = $derived(
    collisionMonth !== null
      ? `Year ${collisionYear} (Month ${collisionMonth})`
      : 'Clear Runway'
  );

  // Visibility
  let showStandard = $derived(mode === 'standard' || mode === 'comparison');
  let showCashDam = $derived(mode === 'cashdam' || mode === 'comparison');
  let showComparison = $derived(mode === 'comparison');
</script>

<div class="dashboard">
  {#if showComparison}
    <!-- ===== SECTION 1: KEY TAKEAWAYS ===== -->
    <div class="section-label">Key Takeaways</div>
    <div class="highlights">
      <!-- Faster Mortgage Payoff -->
      <div class="highlight-card">
        <div class="hl-label">Faster Mortgage Payoff</div>
        {#if payoffWinnerLabel && payoffDiffMonths !== null && payoffDiffMonths > 0}
          <div class="hl-value accent-green">{payoffWinnerLabel}</div>
          <div class="hl-detail">{payoffDiffMonths} month{payoffDiffMonths !== 1 ? 's' : ''} faster</div>
        {:else}
          <div class="hl-value">Tie</div>
          <div class="hl-detail">Both strategies pay off at the same time</div>
        {/if}
      </div>

      <!-- Net Tax Savings -->
      <div class="highlight-card">
        <div class="hl-label">Net Tax Savings</div>
        {#if netTaxSavings > 0}
          <div class="hl-value accent-green">{fmtCurrency(netTaxSavings)}</div>
          <div class="hl-detail">Saved with Cash Dam over 16 years</div>
        {:else if netTaxSavings < 0}
          <div class="hl-value accent-red">{fmtCurrency(Math.abs(netTaxSavings))}</div>
          <div class="hl-detail">More taxes with Cash Dam</div>
        {:else}
          <div class="hl-value">$0</div>
          <div class="hl-detail">No difference</div>
        {/if}
      </div>

      <!-- HELOC Collision Risk -->
      <div class="highlight-card" class:collision-warning={collisionMonth !== null}>
        <div class="hl-label">HELOC Collision Risk</div>
        <div class="hl-value" class:accent-green={collisionMonth === null} class:accent-red={collisionMonth !== null}>
          {collisionMonth === null ? 'Clear' : `Year ${collisionYear}`}
        </div>
        <div class="hl-detail">
          {collisionMonth === null ? 'No collision within 16-year horizon' : collisionStatus}
        </div>
      </div>
    </div>

    <!-- ===== SECTION 2: SIDE-BY-SIDE BREAKDOWN ===== -->
    <div class="section-label">Strategy Breakdown</div>
    <div class="breakdown-table">
      <div class="bt-header">
        <div class="bt-metric-header">Metric</div>
        <div class="bt-val-header">Standard</div>
        <div class="bt-val-header cd-header">Cash Dam</div>
      </div>

      <!-- Primary Mortgage Payoff -->
      <div class="bt-row">
        <div class="bt-metric">Primary Mortgage Payoff</div>
        <div class="bt-val" class:bt-winner={payoffWin === 'a'}>
          {fmtTimeline(stdPayoff, stdFinalBal)}
        </div>
        <div class="bt-val" class:bt-winner={payoffWin === 'b'}>
          {fmtTimeline(cdPayoff, cdFinalBal)}
        </div>
      </div>

      <!-- Total Interest Paid -->
      <div class="bt-row">
        <div class="bt-metric">Total Interest Paid</div>
        <div class="bt-val" class:bt-winner={interestWin === 'a'}>
          {fmtCurrency(stdInterest)}
        </div>
        <div class="bt-val" class:bt-winner={interestWin === 'b'}>
          {fmtCurrency(cdInterest)}
        </div>
      </div>

      <!-- Taxes on Rental Income -->
      <div class="bt-row">
        <div class="bt-metric">Taxes on Rental Income</div>
        <div class="bt-val" class:bt-winner={taxWin === 'a'}>
          {fmtCurrency(stdTaxes)}
        </div>
        <div class="bt-val" class:bt-winner={taxWin === 'b'}>
          {fmtCurrency(cdTaxes)}
        </div>
      </div>

      <!-- Cumulative Tax Refunds -->
      <div class="bt-row">
        <div class="bt-metric">Cumulative Tax Refunds</div>
        <div class="bt-val bt-na">—</div>
        <div class="bt-val accent-green">{fmtCurrency(cumulativeRefunds)}</div>
      </div>

      <!-- Monthly HELOC Burn Rate -->
      <div class="bt-row">
        <div class="bt-metric">Monthly HELOC Burn Rate</div>
        <div class="bt-val bt-na">—</div>
        <div class="bt-val">{fmtCurrency(helocBurnRate)}/mo</div>
      </div>
    </div>

  {:else}
    <!-- ===== SINGLE STRATEGY MODE ===== -->
    <div class="cards-single">
      {#if showStandard}
        <div class="card">
          <div class="card-header">
            <span class="card-label">Primary Mortgage Payoff</span>
            <span class="card-badge">Standard</span>
          </div>
          <div class="card-value">{fmtTimeline(stdPayoff, stdFinalBal)}</div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-label">Total Interest Paid</span>
            <span class="card-badge">Standard</span>
          </div>
          <div class="card-value">{fmtCurrency(stdInterest)}</div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-label">Taxes on Rental Income</span>
            <span class="card-badge">Standard</span>
          </div>
          <div class="card-value">{fmtCurrency(stdTaxes)}</div>
        </div>
      {/if}

      {#if showCashDam}
        <div class="card">
          <div class="card-header">
            <span class="card-label">Primary Mortgage Payoff</span>
            <span class="card-badge cashdam-badge">Cash Dam</span>
          </div>
          <div class="card-value">{fmtTimeline(cdPayoff, cdFinalBal)}</div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-label">Total Interest Paid</span>
            <span class="card-badge cashdam-badge">Cash Dam</span>
          </div>
          <div class="card-value">{fmtCurrency(cdInterest)}</div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-label">Taxes on Rental Income</span>
            <span class="card-badge cashdam-badge">Cash Dam</span>
          </div>
          <div class="card-value">{fmtCurrency(cdTaxes)}</div>
        </div>
        <div class="card refund-card">
          <div class="card-header">
            <span class="card-label">Cumulative Tax Refunds</span>
            <span class="card-badge cashdam-badge">Cash Dam</span>
          </div>
          <div class="card-value accent-green">{fmtCurrency(cumulativeRefunds)}</div>
        </div>
        <div class="card" class:collision-warning={collisionMonth !== null}>
          <div class="card-header">
            <span class="card-label">HELOC Collision</span>
            <span class="card-badge cashdam-badge">Cash Dam</span>
          </div>
          <div class="card-value" class:accent-green={collisionMonth === null} class:accent-red={collisionMonth !== null}>
            {collisionStatus}
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-label">Monthly HELOC Burn Rate</span>
            <span class="card-badge cashdam-badge">Cash Dam</span>
          </div>
          <div class="card-value">{fmtCurrency(helocBurnRate)}/mo</div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .dashboard {
    width: 100%;
  }

  /* Section labels */
  .section-label {
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    margin-bottom: 0.6rem;
    margin-top: 1.25rem;
  }

  .section-label:first-child {
    margin-top: 0;
  }

  /* ===== SECTION 1: HIGHLIGHT CARDS ===== */
  .highlights {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
  }

  @media (max-width: 768px) {
    .highlights {
      grid-template-columns: 1fr;
    }
  }

  .highlight-card {
    background: var(--color-panel-bg);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1rem 1.15rem;
    transition: border-color 0.25s ease, box-shadow 0.25s ease;
  }

  .highlight-card:hover {
    border-color: var(--color-text-muted);
  }

  .highlight-card.collision-warning {
    border-color: var(--color-accent-red);
    box-shadow: 0 0 8px rgba(255, 71, 87, 0.1);
  }

  .hl-label {
    color: var(--color-text-muted);
    font-size: 0.7rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 0.4rem;
  }

  .hl-value {
    color: var(--color-text-main);
    font-size: 1.3rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1.3;
  }

  .hl-detail {
    color: var(--color-text-muted);
    font-size: 0.75rem;
    margin-top: 0.2rem;
  }

  /* ===== SECTION 2: BREAKDOWN TABLE ===== */
  .breakdown-table {
    background: var(--color-panel-bg);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    overflow: hidden;
  }

  .bt-header {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr;
    gap: 0;
    padding: 0.65rem 1rem;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg);
  }

  .bt-metric-header,
  .bt-val-header {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .bt-val-header {
    text-align: right;
  }

  .cd-header {
    color: var(--color-accent-primary);
  }

  .bt-row {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr;
    gap: 0;
    padding: 0.7rem 1rem;
    border-bottom: 1px solid var(--color-border);
    transition: background 0.15s ease;
  }

  .bt-row:last-child {
    border-bottom: none;
  }

  .bt-row:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .bt-metric {
    color: var(--color-text-muted);
    font-size: 0.8rem;
    font-weight: 500;
    display: flex;
    align-items: center;
  }

  .bt-val {
    color: var(--color-text-main);
    font-size: 0.9rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-align: right;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .bt-winner {
    color: var(--color-accent-green);
  }

  .bt-na {
    color: var(--color-text-muted);
    font-style: italic;
    font-weight: 400;
  }

  @media (max-width: 600px) {
    .bt-header,
    .bt-row {
      grid-template-columns: 1fr;
      gap: 0.25rem;
    }
    .bt-val-header {
      text-align: left;
    }
    .bt-val {
      text-align: left;
      justify-content: flex-start;
    }
  }

  /* ===== SINGLE STRATEGY MODE ===== */
  .cards-single {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .card {
    background: var(--color-panel-bg);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1rem 1.15rem;
    position: relative;
    transition: border-color 0.25s ease, box-shadow 0.25s ease;
  }

  .card:hover {
    border-color: var(--color-text-muted);
  }

  .collision-warning {
    border-color: var(--color-accent-red);
    box-shadow: 0 0 8px rgba(255, 71, 87, 0.1);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .card-label {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .card-badge {
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
    background: var(--color-border);
    color: var(--color-text-muted);
  }

  .cashdam-badge {
    background: rgba(212, 168, 67, 0.15);
    color: var(--color-accent-primary);
  }

  .card-value {
    color: var(--color-text-main);
    font-size: 1.15rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1.3;
  }

  .accent-green {
    color: var(--color-accent-green);
  }

  .accent-red {
    color: var(--color-accent-red);
  }

  .refund-card {
    border-color: rgba(0, 200, 150, 0.2);
  }
</style>
