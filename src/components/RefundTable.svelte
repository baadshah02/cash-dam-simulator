<script lang="ts">
  import { dataStore } from '../stores/simulation';

  /**
   * Format a number as Canadian currency ($X,XXX).
   */
  function fmtCurrency(value: number): string {
    return '$' + Math.round(value).toLocaleString('en-CA');
  }

  let annualRecords = $derived($dataStore.cashDam.annualRecords);
</script>

<div class="refund-table-container">
  <h3 class="table-title">Annual Tax Refunds</h3>
  <div class="table-scroll">
    <table class="refund-table">
      <thead>
        <tr>
          <th>Year</th>
          <th>Annual Refund</th>
          <th>Cumulative</th>
        </tr>
      </thead>
      <tbody>
        {#each annualRecords as record}
          <tr>
            <td class="year-cell">{record.year}</td>
            <td class="currency-cell">{fmtCurrency(record.taxRefundAmount)}</td>
            <td class="currency-cell cumulative">{fmtCurrency(record.cumulativeTaxRefunds)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .refund-table-container {
    background: var(--color-panel-bg);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1rem;
    overflow: hidden;
  }

  .table-title {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin: 0 0 0.75rem 0;
  }

  .table-scroll {
    max-height: 320px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  .table-scroll::-webkit-scrollbar {
    width: 6px;
  }

  .table-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .table-scroll::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
  }

  .refund-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
  }

  .refund-table thead {
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .refund-table th {
    background: var(--color-panel-bg);
    color: var(--color-text-muted);
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-align: right;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--color-border);
  }

  .refund-table th:first-child {
    text-align: left;
  }

  .refund-table td {
    padding: 0.35rem 0.6rem;
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-main);
    font-variant-numeric: tabular-nums;
  }

  .refund-table tr:last-child td {
    border-bottom: none;
  }

  .refund-table tr:hover td {
    background: rgba(255, 255, 255, 0.02);
  }

  .year-cell {
    text-align: left;
    color: var(--color-text-muted);
    font-weight: 500;
  }

  .currency-cell {
    text-align: right;
  }

  .cumulative {
    color: var(--color-accent-green);
    font-weight: 500;
  }
</style>
