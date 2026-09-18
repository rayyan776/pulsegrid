import {
  ChangeDetectionStrategy, Component, ElementRef, OnDestroy,
  afterNextRender, effect, inject, input, viewChild,
} from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { MetricPoint } from '../../../core/services/device.service';
import { DeviceUpdate } from '../../../core/services/socket.service';
import { ThemeService } from '../../../core/services/theme.service';
import { chartChrome, buildAreaGradient } from '../../../shared/chart-theme';

Chart.register(...registerables);

const MAX_LIVE_POINTS = 150;
const CPU_COLOR = '#ff6b4a';
const AVG_COLOR = '#d98c0e';

@Component({
  selector: 'pg-timeseries-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas></canvas>`,
  styles: [`:host { display: block; height: 320px; } canvas { width: 100% !important; height: 100% !important; }`],
})
export class TimeseriesChartComponent implements OnDestroy {
  // Historical points from GET /api/devices/:id/history (via httpResource).
  readonly history = input<MetricPoint[]>([]);
  // Latest live point from the socket, already filtered to this deviceId.
  readonly liveUpdate = input<DeviceUpdate | null>(null);

  private readonly themeSvc = inject(ThemeService);

  // View Query: the canvas lives in THIS component's own template.
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart: Chart<'line'> | null = null;

  constructor() {
    // Chart.js needs a real <canvas> in the DOM before it can attach — so
    // building it belongs in afterNextRender (post-render), not the
    // constructor or an early effect that could fire before the view exists.
    afterNextRender(() => this.initChart());

    // effect(): whenever `history()` changes (new device selected, or the
    // httpResource re-fetches because selectedDeviceId/historyMinutes
    // changed), rebuild the whole dataset from scratch.
    effect(() => {
      const points = [...this.history()].sort((a, b) => a.timestamp - b.timestamp);
      if (!this.chart) return;
      this.chart.data.labels = points.map((p) => this.formatTime(p.timestamp));
      this.chart.data.datasets[0].data = points.map((p) => p.cpu);
      this.chart.data.datasets[1].data = points.map((p) => p.rollingAvgCpu);
      this.chart.update('none');
    });

    // effect(): the live-update path. A new socket message arrives roughly
    // every 2s (see backend simulator.js tick interval) — append one point
    // and drop the oldest once we exceed MAX_LIVE_POINTS, so the chart
    // scrolls forward instead of growing unbounded.
    effect(() => {
      const update = this.liveUpdate();
      if (!update || !this.chart) return;

      const labels = this.chart.data.labels as string[];
      const cpuData = this.chart.data.datasets[0].data as number[];
      const avgData = this.chart.data.datasets[1].data as number[];

      labels.push(this.formatTime(update.timestamp));
      cpuData.push(update.cpu);
      avgData.push(update.rollingAvgCpu ?? (avgData.length ? avgData[avgData.length - 1] : update.cpu));

      if (labels.length > MAX_LIVE_POINTS) {
        labels.shift();
        cpuData.shift();
        avgData.shift();
      }
      // 'none' animation mode: skip the transition tween on every tick —
      // essential for a chart updating every ~2s, otherwise animations queue up.
      this.chart.update('none');
    });

    // Re-skin the chrome whenever light/dark mode flips — Chart.js reads
    // plain color strings, not CSS variables, so it needs to be told.
    effect(() => {
      const mode = this.themeSvc.theme();
      if (!this.chart) return;
      this.applyChrome(mode);
      this.chart.update('none');
    });
  }

  private initChart(): void {
    const canvas = this.canvasRef().nativeElement;
    const ctx = canvas.getContext('2d')!;
    const chrome = chartChrome(this.themeSvc.theme());
    const gradient = buildAreaGradient(ctx, canvas.clientHeight || 320, CPU_COLOR);

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'CPU %', data: [], borderColor: CPU_COLOR, backgroundColor: gradient,
            borderWidth: 2, fill: true, tension: 0.3, pointRadius: 0 },
          { label: 'Rolling avg CPU %', data: [], borderColor: AVG_COLOR, borderDash: [4, 4],
            borderWidth: 1.5, tension: 0.3, pointRadius: 0 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        // Root-cause fix: don't pair responsive:true with a hand-rolled
        // ResizeObserver. Chart.js already attaches its own internal
        // ResizeObserver on the canvas's parent when responsive is on — a
        // second one racing it during a fast drag-resize can end up writing
        // the canvas's actual pixel buffer from a stale, mid-drag size
        // instead of the final settled one. The visible symptom: the chart
        // keeps a taller-than-visible internal buffer after a shrink, so
        // its 0–100 axis gets laid out across that oversized buffer and
        // only a thin top slice (whatever value range lands at the top)
        // remains inside the actually-visible box — everything else is
        // real content sitting just past the clipped edge. Using Chart.js's
        // own onResize hook means there's only one measurement authority.
        onResize: (chart, size) => this.onChartResize(chart, size.height),
        plugins: {
          legend: { labels: { color: chrome.legend, boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            backgroundColor: chrome.tooltipBg, borderColor: chrome.tooltipBorder, borderWidth: 1,
            titleColor: chrome.tooltipTitle, bodyColor: chrome.tooltipBody, padding: 10, cornerRadius: 8,
          },
        },
        scales: {
          x: { ticks: { color: chrome.tick, maxTicksLimit: 8 }, grid: { color: chrome.grid } },
          y: { min: 0, max: 100, ticks: { color: chrome.tick }, grid: { color: chrome.grid } },
        },
      },
    };
    this.chart = new Chart(ctx, config);
  }

  /** Fires synchronously from inside Chart.js's own resize handling, with
   *  the height it just finished laying out for — never stale, never racy. */
  private onChartResize(chart: Chart, heightPx: number): void {
    const freshCtx = chart.canvas.getContext('2d');
    if (!freshCtx) return;
    chart.data.datasets[0].backgroundColor = buildAreaGradient(freshCtx, heightPx, CPU_COLOR);
  }

  private applyChrome(mode: ReturnType<ThemeService['theme']>): void {
    if (!this.chart) return;
    const chrome = chartChrome(mode);
    const legend = this.chart.options.plugins?.legend as any;
    if (legend) legend.labels = { ...(legend.labels ?? {}), color: chrome.legend };
    const tooltip = this.chart.options.plugins?.tooltip as any;
    if (tooltip) {
      tooltip.backgroundColor = chrome.tooltipBg;
      tooltip.borderColor = chrome.tooltipBorder;
      tooltip.titleColor = chrome.tooltipTitle;
      tooltip.bodyColor = chrome.tooltipBody;
    }
    const x = this.chart.options.scales?.['x'] as any;
    if (x) {
      x.ticks = { ...(x.ticks ?? {}), color: chrome.tick };
      x.grid = { ...(x.grid ?? {}), color: chrome.grid };
    }
    const y = this.chart.options.scales?.['y'] as any;
    if (y) {
      y.ticks = { ...(y.ticks ?? {}), color: chrome.tick };
      y.grid = { ...(y.grid ?? {}), color: chrome.grid };
    }
  }

  private formatTime(epochMs: number): string {
    const d = new Date(epochMs);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
