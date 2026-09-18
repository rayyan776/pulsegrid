import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, afterNextRender, computed, effect, inject, input, viewChild } from '@angular/core';
import { httpResource } from '@angular/common/http';
import Chart from 'chart.js/auto';
import { APP_CONFIG } from '../../../core/tokens/app-config.token';
import { SocketService } from '../../../core/services/socket.service';
import { ThemeService } from '../../../core/services/theme.service';
import { chartChrome, buildAreaGradient } from '../../../shared/chart-theme';
import { MetricKey, AggInterval } from '../models/widget-config.model';

const MAX_POINTS = 60;
const SMOOTH_WINDOW = 3;

// How far back to ask for, matched to how coarse the bucket is — a 1h
// rollup shown over only 60 minutes would be a single point, so each
// interval pairs with a window long enough to actually fill the chart.
const WINDOW_MINUTES: Record<AggInterval, number> = {
  '1m': 60,        // last hour, one point per minute
  '10m': 60 * 24,  // last day, one point per 10 minutes
  '1h': 60 * 24 * 7, // last week, one point per hour
};

const METRIC_COLORS: Record<MetricKey, string> = {
  cpu: '#ff6b4a',
  memory: '#4361ee',
  latency: '#12b3a8',
};

// Shape of a document from GET /aggregates?interval=... — a Rollup1m /
// Rollup10m / Rollup1h doc, NOT a raw Metric doc. These field names
// (bucketStart, avgCpu/avgMemory/avgLatency) don't match the raw metric
// shape at all — reading `.timestamp`/`.cpu` off one of these (as an
// earlier version of this file did) silently produces `undefined` for
// every point, which is why the chart could look empty even though the
// API response itself had real data in it.
interface RollupPoint {
  deviceId: string;
  bucketStart: number;
  avgCpu: number;
  avgMemory: number;
  avgLatency: number;
  maxCpu: number;
  sampleCount: number;
}

const ROLLUP_FIELD: Record<MetricKey, keyof RollupPoint> = {
  cpu: 'avgCpu',
  memory: 'avgMemory',
  latency: 'avgLatency',
};

@Component({
  selector: 'pg-mini-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas></canvas>`,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    canvas { width: 100% !important; height: 100% !important; }
  `],
})
export class MiniChartComponent implements OnDestroy {
  readonly deviceId = input.required<string>();
  readonly metric = input<MetricKey>('cpu');
  readonly interval = input<AggInterval>('1m');

  private readonly config = inject(APP_CONFIG);
  private readonly socket = inject(SocketService);
  private readonly themeSvc = inject(ThemeService);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart: Chart | null = null;

  private liveRawBuffer: number[] = [];

  private readonly historyRes = httpResource<RollupPoint[]>(
    () => `${this.config.apiUrl}/devices/${this.deviceId()}/aggregates?interval=${this.interval()}&minutes=${WINDOW_MINUTES[this.interval()]}`,
    { defaultValue: [] },
  );

  private readonly liveForThisDevice = computed(() =>
    this.socket.updatesByDevice().get(this.deviceId()) ?? null,
  );

  constructor() {
    afterNextRender(() => this.initChart());

    effect((onCleanup) => {
      const id = setInterval(() => this.historyRes.reload(), 60_000);
      onCleanup(() => clearInterval(id));
    });

    effect(() => {
      const history = this.historyRes.value();
      if (!this.chart) return;
      const m = this.metric();
      const sorted = [...history].sort((a, b) => a.bucketStart - b.bucketStart);
      const { labels, data } = downsampleAndSmooth(sorted, m, MAX_POINTS);
      this.chart.data.labels = labels;
      this.chart.data.datasets[0].data = data;
      this.applyAxisBounds();
      this.chart.update('none');
      this.liveRawBuffer = sorted.slice(-SMOOTH_WINDOW).map((p) => p[ROLLUP_FIELD[m]] as number);
    });

    effect(() => {
      const update = this.liveForThisDevice();
      // Live per-2s readings only make sense spliced onto the 1m view —
      // on a 10m/1h axis a single instantaneous reading isn't a valid
      // stand-in for a whole bucket average, so leave those views to
      // refresh purely from the Rollup collections on their own timer.
      if (!update || !this.chart || this.interval() !== '1m') return;
      const m = this.metric();
      const labels = this.chart.data.labels as string[];
      const data = this.chart.data.datasets[0].data as number[];

      this.liveRawBuffer.push(update[m]);
      if (this.liveRawBuffer.length > SMOOTH_WINDOW) this.liveRawBuffer.shift();
      const smoothed = this.liveRawBuffer.reduce((a, b) => a + b, 0) / this.liveRawBuffer.length;

      labels.push(new Date(update.timestamp).toLocaleTimeString());
      data.push(smoothed);
      if (data.length > MAX_POINTS) {
        data.shift();
        labels.shift();
      }
      this.applyAxisBounds();
      this.chart.update('none');
    });

    // Re-skin the chrome (grid lines, ticks, tooltip) whenever the person
    // flips light/dark mode — Chart.js reads plain color strings, not CSS
    // variables, so it can't pick this up on its own the way the rest of
    // the page does.
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
    const color = METRIC_COLORS[this.metric()];
    const chrome = chartChrome(this.themeSvc.theme());

    const gradient = buildAreaGradient(ctx, canvas.clientHeight, color);

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          data: [], borderColor: color, backgroundColor: gradient, borderWidth: 2.25,
          fill: true, tension: 0.4, pointRadius: 0, cubicInterpolationMode: 'monotone',
          pointHoverRadius: 4, pointHoverBackgroundColor: color, pointHoverBorderColor: chrome.pointHoverBorder,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        // IMPORTANT: don't also attach a manual ResizeObserver here.
        // responsive:true already makes Chart.js install its own internal
        // ResizeObserver on the canvas's parent — a second, hand-rolled one
        // used to sit alongside it (see git history), and the two would race
        // during a fast drag-resize: whichever one wrote the canvas's real
        // pixel buffer LAST could win using a stale, mid-drag size instead
        // of the final settled one. That's what caused the chart to keep a
        // taller-than-visible internal buffer after shrinking to the
        // smallest size — the full 0–100 axis got laid out across that
        // oversized buffer, and only the top slice (e.g. 90–100) fell
        // inside the actually-visible, correctly-sized box; the rest was
        // real, rendered content sitting just outside the clipped view.
        // onResize is Chart.js's own official hook, fired with the size it
        // just settled on — there's only one measurement authority now.
        onResize: (chart, size) => this.onChartResize(chart, size.height),
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: chrome.tooltipBg, borderColor: chrome.tooltipBorder, borderWidth: 1,
            titleColor: chrome.tooltipTitle, bodyColor: chrome.tooltipBody, padding: 8, cornerRadius: 8,
            displayColors: false, titleFont: { size: 10 }, bodyFont: { size: 12, weight: 'bold' },
          },
        },
        scales: {
          x: { display: false },
          y: {
            min: 0,
            max: this.metric() === 'latency' ? undefined : 100,
            grid: { color: chrome.grid },
            border: { display: false },
            ticks: { color: chrome.tick, font: { size: 10 } },
          },
        },
      },
    });
  }

  /** Fires once, synchronously, from inside Chart.js's own resize handling —
   *  `heightPx` is the size Chart.js itself just finished laying out for,
   *  so rebuilding the gradient against it can never be stale or racy. */
  private onChartResize(chart: Chart, heightPx: number): void {
    const freshCtx = chart.canvas.getContext('2d');
    if (!freshCtx) return;
    const liveColor = METRIC_COLORS[this.metric()];
    chart.data.datasets[0].backgroundColor = buildAreaGradient(freshCtx, heightPx, liveColor);
  }

  private applyAxisBounds(): void {
    if (!this.chart) return;
    const y = this.chart.options.scales?.['y'];
    if (!y) return;
    y.min = 0;
    y.max = this.metric() === 'latency' ? undefined : 100;
  }

  private applyChrome(mode: ReturnType<ThemeService['theme']>): void {
    if (!this.chart) return;
    const chrome = chartChrome(mode);
    const y = this.chart.options.scales?.['y'] as any;
    if (y) {
      y.grid = { ...(y.grid ?? {}), color: chrome.grid };
      y.ticks = { ...(y.ticks ?? {}), color: chrome.tick, font: { size: 10 } };
    }
    const tooltip = this.chart.options.plugins?.tooltip as any;
    if (tooltip) {
      tooltip.backgroundColor = chrome.tooltipBg;
      tooltip.borderColor = chrome.tooltipBorder;
      tooltip.titleColor = chrome.tooltipTitle;
      tooltip.bodyColor = chrome.tooltipBody;
    }
    const dataset = this.chart.data.datasets[0] as any;
    if (dataset) dataset.pointHoverBorderColor = chrome.pointHoverBorder;
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}

function downsampleAndSmooth(
  sorted: RollupPoint[],
  metric: MetricKey,
  maxPoints: number,
): { labels: string[]; data: number[] } {
  const field = ROLLUP_FIELD[metric];
  const step = Math.max(1, Math.ceil(sorted.length / maxPoints));
  const sampled = sorted.filter((_, i) => i % step === 0);
  const raw = sampled.map((p) => (p[field] as number) ?? 0);

  const smoothed = raw.map((_, i) => {
    const start = Math.max(0, i - SMOOTH_WINDOW + 1);
    const slice = raw.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });

  return {
    labels: sampled.map((p) => new Date(p.bucketStart).toLocaleTimeString()),
    data: smoothed,
  };
}
