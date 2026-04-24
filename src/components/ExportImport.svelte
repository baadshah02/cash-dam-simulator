<script lang="ts">
  import { params } from '../stores/simulation';
  import { exportParams, importParams } from '../lib/engine/serialization';
  import { get } from 'svelte/store';

  let errorMessage = $state('');
  let fileInput: HTMLInputElement | undefined = $state();

  function handleExport() {
    const json = exportParams(get(params));
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cash-dam-params.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInput?.click();
  }

  function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    errorMessage = '';
    const reader = new FileReader();

    reader.onload = () => {
      const text = reader.result as string;
      const result = importParams(text);

      if (result.success) {
        params.set(result.params);
        errorMessage = '';
      } else {
        errorMessage = result.errors.map(e => `${e.field}: ${e.message}`).join('; ');
      }

      // Reset file input so the same file can be re-imported
      if (fileInput) fileInput.value = '';
    };

    reader.onerror = () => {
      errorMessage = 'Failed to read file';
      if (fileInput) fileInput.value = '';
    };

    reader.readAsText(file);
  }
</script>

<div class="export-import">
  <h3 class="section-title">Export / Import</h3>

  <div class="button-row">
    <button class="action-btn export-btn" onclick={handleExport} title="Export parameters as JSON">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Export
    </button>

    <button class="action-btn import-btn" onclick={handleImportClick} title="Import parameters from JSON">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      Import
    </button>

    <input
      bind:this={fileInput}
      type="file"
      accept=".json"
      onchange={handleFileChange}
      class="hidden-input"
      aria-label="Import parameters file"
    />
  </div>

  {#if errorMessage}
    <div class="error-message" role="alert">
      {errorMessage}
    </div>
  {/if}
</div>

<style>
  .export-import {
    padding: 0;
  }

  .section-title {
    color: var(--color-text-muted);
    font-size: 0.7rem;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin: 0 0 0.75rem 0;
  }

  .button-row {
    display: flex;
    gap: 0.5rem;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex: 1;
    justify-content: center;
    padding: 0.45rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-panel-bg);
    color: var(--color-text-muted);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  }

  .action-btn:hover {
    background: var(--color-border);
    color: var(--color-text-main);
    border-color: var(--color-text-muted);
  }

  .hidden-input {
    display: none;
  }

  .error-message {
    margin-top: 0.5rem;
    padding: 0.4rem 0.6rem;
    background: rgba(255, 71, 87, 0.1);
    border: 1px solid var(--color-accent-red);
    border-radius: 4px;
    color: var(--color-accent-red);
    font-size: 0.7rem;
    line-height: 1.4;
    word-break: break-word;
  }
</style>
