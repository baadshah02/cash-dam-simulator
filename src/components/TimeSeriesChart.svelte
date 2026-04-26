<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as echarts from 'echarts';
  import { dataStore, viewMode } from '../stores/simulation';
  import type { SimulationDataStore } from '../lib/engine/types';

  let chartContainer: HTMLDivElement | undefined = $state();
  let echartsInstance: echarts.ECharts | null = $state(null);

  /**
   * Read a CSS custom property value from the document root.
   */
  function cssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /**
   * Build the x-axis data labels: years 0–horizonYears.
   */
  function buildXAxisData(horizonYears: number): string[] {
    const labels: string[] = [];
    for (let y = 0; y <= horizonYears; y++) {
      labels.push(`${y}`);
    }
    return labels;
  }

  /**
   * Compute the effective endpoint year for a strategy — whichever is earlier:
   *   - The year the primary mortgage pays off (rounded up)
   *   - The full horizon
   *
   * This determines where the strategy's chart lines should end. After the primary
   * mortgage pays off, the strategy's "life" is essentially done and continuing to
   * plot post-payoff data doesn't reflect what the user cares about.
   */
  function effectiveEndpointYear(
    payoffMonth: number | null,
    finalBalance: number,
    horizonYears: number,
  ): number {
    if (payoffMonth !== null) {
      return Math.ceil(payoffMonth / 12);
    }
    // If final balance is effectively zero, treat it as paid off at the horizon
    if (finalBalance < 100) {
      return horizonYears;
    }
    return horizonYears;
  }

  /**
   * Extract year-end balances from monthly records, truncated at the strategy's
   * effective endpoint. Points past the endpoint are null, which ECharts renders
   * as a line break (the line just ends).
   */
  function extractYearlyBalances(
    data: SimulationDataStore,
    strategy: 'standard' | 'cashDam',
    field: 'primaryMortgageBalance' | 'investmentMortgageBalance' | 'helocBalance' | 'helocLimit',
  ): Array<number | null> {
    const result = strategy === 'standard' ? data.standard : data.cashDam;
    const records = result.monthlyRecords;
    const endpointYear = effectiveEndpointYear(
      result.payoffMonth,
      result.finalPrimaryBalance,
      data.params.horizonYears,
    );
    const values: Array<number | null> = [];

    // Year 0: starting value
    if (field === 'primaryMortgageBalance') {
      values.push(data.params.primaryMortgageStart);
    } else if (field === 'investmentMortgageBalance') {
      values.push(data.params.investmentMortgageStart);
    } else if (field === 'helocBalance') {
      values.push(data.params.startingHelocBalance);
    } else if (field === 'helocLimit') {
      values.push(data.params.globalLimit - data.params.primaryMortgageStart);
    }

    // Years 1–horizonYears: end-of-year values. Truncate at endpointYear.
    const horizonYears = data.params.horizonYears;
    for (let y = 1; y <= horizonYears; y++) {
      if (y > endpointYear) {
        values.push(null);
        continue;
      }
      const monthIndex = y * 12 - 1; // 0-based index
      if (monthIndex < records.length) {
        values.push(records[monthIndex][field]);
      }
    }

    return values;
  }

  /**
   * Build the Global Limit constant line (same value for all years).
   */
  function buildGlobalLimitData(data: SimulationDataStore): number[] {
    return Array(data.params.horizonYears + 1).fill(data.params.globalLimit);
  }

  /**
   * Build ECharts option based on current data and view mode.
   */
  function buildChartOption(data: SimulationDataStore, mode: string): echarts.EChartsOption {
    const textMain = cssVar('--color-text-main') || '#E8ECF1';
    const textMuted = cssVar('--color-text-muted') || '#6B7A8D';
    const chartGrid = cssVar('--color-chart-grid') || '#1E2A36';
    const tooltipBg = cssVar('--color-tooltip-bg') || '#1E2A36';
    const tooltipBorder = cssVar('--color-tooltip-border') || '#D4A843';
    const accentGreen = cssVar('--color-accent-green') || '#00C896';
    const accentPrimary = cssVar('--color-accent-primary') || '#D4A843';
    const accentRed = cssVar('--color-accent-red') || '#FF4757';
    const accentBlue = cssVar('--color-accent-blue') || '#4A9EFF';

    const xAxisData = buildXAxisData(data.params.horizonYears);
    const series: echarts.SeriesOption[] = [];
    const legendData: string[] = [];

    if (mode === 'standard' || mode === 'comparison') {
      const label = mode === 'comparison' ? 'Primary Mortgage (Std)' : 'Primary Mortgage';
      const primaryStd = extractYearlyBalances(data, 'standard', 'primaryMortgageBalance');
      series.push({
        name: label,
        type: 'line',
        data: primaryStd,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: {
          color: accentGreen,
          width: 2,
          type: mode === 'comparison' ? 'dashed' : 'solid',
        },
        itemStyle: { color: accentGreen },
        animationDuration: 800,
        animationEasing: 'cubicOut',
      });
      legendData.push(label);

      // In Standard mode, also show Investment Mortgage and HELOC Balance
      if (mode === 'standard') {
        const investmentStd = extractYearlyBalances(data, 'standard', 'investmentMortgageBalance');
        series.push({
          name: 'Investment Mortgage',
          type: 'line',
          data: investmentStd,
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { color: accentPrimary, width: 2 },
          itemStyle: { color: accentPrimary },
          animationDuration: 800,
          animationEasing: 'cubicOut',
        });
        legendData.push('Investment Mortgage');

        const helocStd = extractYearlyBalances(data, 'standard', 'helocBalance');
        series.push({
          name: 'HELOC Balance',
          type: 'line',
          data: helocStd,
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { color: accentRed, width: 2 },
          itemStyle: { color: accentRed },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: `${accentRed}40` },
              { offset: 1, color: `${accentRed}05` },
            ]),
          },
          animationDuration: 800,
          animationEasing: 'cubicOut',
        });
        legendData.push('HELOC Balance');

        // HELOC Limit — ice blue dashed
        const helocLimitStd = extractYearlyBalances(data, 'standard', 'helocLimit');
        series.push({
          name: 'HELOC Limit',
          type: 'line',
          data: helocLimitStd,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: accentBlue, width: 1.5, type: 'dashed' },
          itemStyle: { color: accentBlue },
          animationDuration: 800,
          animationEasing: 'cubicOut',
        });
        legendData.push('HELOC Limit');

        // Global Limit — dashed gray
        const globalLimitStd = buildGlobalLimitData(data);
        series.push({
          name: 'Global Limit',
          type: 'line',
          data: globalLimitStd,
          smooth: false,
          symbol: 'none',
          lineStyle: { color: textMuted, width: 1.5, type: 'dashed' },
          itemStyle: { color: textMuted },
          animationDuration: 800,
          animationEasing: 'cubicOut',
        });
        legendData.push('Global Limit');
      }
    }

    if (mode === 'cashdam' || mode === 'comparison') {
      const suffix = mode === 'comparison' ? ' (CD)' : '';

      // Global Limit — dashed gray
      const globalLimit = buildGlobalLimitData(data);
      series.push({
        name: 'Global Limit',
        type: 'line',
        data: globalLimit,
        smooth: false,
        symbol: 'none',
        lineStyle: { color: textMuted, width: 1.5, type: 'dashed' },
        itemStyle: { color: textMuted },
        animationDuration: 800,
        animationEasing: 'cubicOut',
      });
      legendData.push('Global Limit');

      // Primary Mortgage (Cash Dam) — emerald
      const primaryCD = extractYearlyBalances(data, 'cashDam', 'primaryMortgageBalance');
      const primaryLabel = `Primary Mortgage${suffix}`;
      series.push({
        name: primaryLabel,
        type: 'line',
        data: primaryCD,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: accentGreen, width: 2 },
        itemStyle: { color: accentGreen },
        animationDuration: 800,
        animationEasing: 'cubicOut',
      });
      legendData.push(primaryLabel);

      // Investment Mortgage — gold
      const investmentCD = extractYearlyBalances(data, 'cashDam', 'investmentMortgageBalance');
      const investLabel = `Investment Mortgage${suffix}`;
      series.push({
        name: investLabel,
        type: 'line',
        data: investmentCD,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: accentPrimary, width: 2 },
        itemStyle: { color: accentPrimary },
        animationDuration: 800,
        animationEasing: 'cubicOut',
      });
      legendData.push(investLabel);

      // HELOC Limit — ice blue
      const helocLimitData = extractYearlyBalances(data, 'cashDam', 'helocLimit');
      const helocLimitLabel = `HELOC Limit${suffix}`;
      series.push({
        name: helocLimitLabel,
        type: 'line',
        data: helocLimitData,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: accentBlue, width: 1.5, type: 'dashed' },
        itemStyle: { color: accentBlue },
        animationDuration: 800,
        animationEasing: 'cubicOut',
      });
      legendData.push(helocLimitLabel);

      // HELOC Balance — crimson with gradient fill
      const helocBalanceData = extractYearlyBalances(data, 'cashDam', 'helocBalance');
      const helocBalLabel = `HELOC Balance${suffix}`;
      series.push({
        name: helocBalLabel,
        type: 'line',
        data: helocBalanceData,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: accentRed, width: 2 },
        itemStyle: { color: accentRed },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${accentRed}40` },
            { offset: 1, color: `${accentRed}05` },
          ]),
        },
        animationDuration: 800,
        animationEasing: 'cubicOut',
      });
      legendData.push(helocBalLabel);
    }

    return {
      animation: true,
      animationDuration: 800,
      animationEasing: 'cubicOut',
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          lineStyle: { color: tooltipBorder, type: 'dashed' },
          crossStyle: { color: tooltipBorder },
        },
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        borderWidth: 1,
        textStyle: {
          color: textMain,
          fontSize: 12,
        },
        formatter: (params: unknown) => {
          if (!Array.isArray(params)) return '';
          const items = params as Array<{
            seriesName: string;
            value: number;
            marker: string;
            axisValue: string;
          }>;
          if (items.length === 0) return '';
          let html = `<div style="font-weight:600;margin-bottom:4px;">Year ${items[0].axisValue}</div>`;
          for (const item of items) {
            const val = typeof item.value === 'number'
              ? '$' + Math.round(item.value).toLocaleString('en-CA')
              : item.value;
            html += `<div style="display:flex;justify-content:space-between;gap:16px;"><span>${item.marker} ${item.seriesName}</span><span style="font-weight:600;font-variant-numeric:tabular-nums;">${val}</span></div>`;
          }
          return html;
        },
      },
      legend: {
        show: true,
        data: legendData,
        textStyle: { color: textMuted, fontSize: 11 },
        top: 8,
        itemGap: 16,
        itemWidth: 16,
        itemHeight: 10,
      },
      grid: {
        left: 16,
        right: 16,
        top: 48,
        bottom: 8,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
        name: 'Year',
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: { color: textMuted, fontSize: 11 },
        axisLine: { lineStyle: { color: chartGrid } },
        axisTick: { lineStyle: { color: chartGrid } },
        axisLabel: { color: textMuted, fontSize: 11 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: textMuted,
          fontSize: 11,
          formatter: (value: number) => {
            if (value >= 1_000_000) return '$' + (value / 1_000_000).toFixed(1) + 'M';
            if (value >= 1_000) return '$' + (value / 1_000).toFixed(0) + 'K';
            return '$' + value;
          },
        },
        splitLine: { lineStyle: { color: chartGrid, type: 'dashed' } },
      },
      series,
    };
  }

  function handleResize() {
    echartsInstance?.resize();
  }

  onMount(() => {
    if (!chartContainer) return;

    echartsInstance = echarts.init(chartContainer);

    // Initial render
    const option = buildChartOption($dataStore, $viewMode);
    echartsInstance.setOption(option);

    window.addEventListener('resize', handleResize);
  });

  onDestroy(() => {
    window.removeEventListener('resize', handleResize);
    if (echartsInstance) {
      echartsInstance.dispose();
      echartsInstance = null;
    }
  });

  // Reactively update chart when data or view mode changes
  $effect(() => {
    // Access reactive dependencies
    const data = $dataStore;
    const mode = $viewMode;

    if (echartsInstance) {
      const option = buildChartOption(data, mode);
      echartsInstance.setOption(option, true);
    }
  });
</script>

<div class="chart-wrapper">
  <div class="chart-container" bind:this={chartContainer}></div>
</div>

<style>
  .chart-wrapper {
    background: var(--color-chart-bg, var(--color-panel-bg));
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 0.75rem;
    overflow: hidden;
  }

  .chart-container {
    width: 100%;
    height: 420px;
    min-height: 300px;
  }

  @media (max-width: 768px) {
    .chart-container {
      height: 320px;
    }
  }
</style>
