<script lang="ts">
  import { onMount } from 'svelte';
  import { themes, applyTheme, loadSavedTheme, saveTheme } from '../lib/themes';
  import type { ThemeDefinition } from '../lib/engine/types';

  let activeThemeId = $state('obsidian-capital');

  onMount(() => {
    const saved = loadSavedTheme();
    applyTheme(saved);
    activeThemeId = saved.id;
  });

  function selectTheme(theme: ThemeDefinition) {
    applyTheme(theme);
    saveTheme(theme.id);
    activeThemeId = theme.id;
  }
</script>

<div class="theme-selector" role="group" aria-label="Color theme">
  {#each themes as theme}
    <button
      class="theme-btn"
      class:active={activeThemeId === theme.id}
      onclick={() => selectTheme(theme)}
      title={theme.name}
      aria-pressed={activeThemeId === theme.id}
    >
      <span class="theme-swatch" style="background: {theme.colors.accentPrimary};"></span>
      <span class="theme-name">{theme.name}</span>
    </button>
  {/each}
</div>

<style>
  .theme-selector {
    display: inline-flex;
    gap: 0.25rem;
    align-items: center;
    border-radius: 6px;
    padding: 0.2rem;
    background: var(--color-panel-bg);
    border: 1px solid var(--color-border);
  }

  .theme-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.6rem;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 0.7rem;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease;
    white-space: nowrap;
  }

  .theme-btn:hover:not(.active) {
    background: var(--color-border);
    color: var(--color-text-main);
  }

  .theme-btn.active {
    background: var(--color-border);
    color: var(--color-text-main);
    font-weight: 600;
  }

  .theme-swatch {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .theme-name {
    line-height: 1;
  }
</style>
