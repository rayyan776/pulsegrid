import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Gridster, GridsterItem, GridsterConfig } from 'angular-gridster2';
import { WidgetHostComponent } from './widget-host/widget-host.component';
import { FleetSummaryComponent } from './fleet-summary/fleet-summary.component';
import { DashboardLayoutService } from './services/dashboard-layout.service';
import { DeviceService } from '../../core/services/device.service';
import { SocketService } from '../../core/services/socket.service';
import { MetricKey, WidgetType, AggInterval } from './models/widget-config.model';

@Component({
  selector: 'pg-custom-dashboard',
  standalone: true,
  imports: [Gridster, GridsterItem, WidgetHostComponent, FleetSummaryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pg-fleet-summary (jumpToProblem)="jumpToFirstProblem()" />

    <div class="canvas-header">
      <div class="heading">
        <h2>Live fleet dashboard</h2>
        <p>Drag, resize and arrange widgets — your layout autosaves.</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost" (click)="layout.resetLayout()">
          <svg viewBox="0 0 20 20" width="14" height="14" fill="none"><path d="M3.5 10a6.5 6.5 0 1 1 2 4.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M3.5 14.5v-4h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Reset layout
        </button>
        <button class="btn btn-primary" (click)="openAdd()">
          <svg viewBox="0 0 20 20" width="14" height="14" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          Add widget
        </button>
      </div>
    </div>

    <div class="dashboard-canvas glass">
      <gridster [options]="gridOptions">
        @for (w of layout.widgets(); track w.id) {
          <gridster-item [item]="w" [attr.id]="'widget-' + w.id"><pg-widget-host [config]="w" /></gridster-item>
        }
      </gridster>
    </div>

    <button class="fab" (click)="openAdd()" aria-label="Add widget">
      <svg viewBox="0 0 20 20" width="22" height="22" fill="none"><path d="M10 4v12M4 10h12" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>
    </button>

    @if (showAddModal()) {
      <div class="modal-backdrop" (click)="showAddModal.set(false)">
        <div class="modal glass" (click)="$event.stopPropagation()">
          <h3>Add widget</h3>

          <div class="picker-group">
            <span class="picker-label">Device</span>
            <div class="pills">
              @for (d of deviceIds(); track d) {
                <button [class.active]="pickDevice() === d" (click)="pickDevice.set(d)">{{ d }}</button>
              }
            </div>
          </div>

          <div class="picker-group">
            <span class="picker-label">Metric</span>
            <div class="pills">
              <button [class.active]="pickMetric() === 'cpu'" (click)="pickMetric.set('cpu')"><span class="dot cpu"></span>CPU</button>
              <button [class.active]="pickMetric() === 'memory'" (click)="pickMetric.set('memory')"><span class="dot memory"></span>Memory</button>
              <button [class.active]="pickMetric() === 'latency'" (click)="pickMetric.set('latency')"><span class="dot latency"></span>Latency</button>
            </div>
          </div>

          <div class="picker-group">
            <span class="picker-label">Type</span>
            <div class="pills">
              <button [class.active]="pickType() === 'chart'" (click)="pickType.set('chart')">Chart</button>
              <button [class.active]="pickType() === 'stat'" (click)="pickType.set('stat')">Stat</button>
            </div>
          </div>

          @if (pickType() === 'chart') {
            <div class="picker-group">
              <span class="picker-label">Aggregation</span>
              <div class="pills">
                <button [class.active]="pickInterval() === '1m'" (click)="pickInterval.set('1m')">1m (last hour)</button>
                <button [class.active]="pickInterval() === '10m'" (click)="pickInterval.set('10m')">10m (last day)</button>
                <button [class.active]="pickInterval() === '1h'" (click)="pickInterval.set('1h')">1h (last week)</button>
              </div>
              <p class="picker-hint">Which Rollup collection the chart reads from — set by aggregator.js's cron jobs, not live data.</p>
            </div>
          }

          <div class="modal-actions">
            <button class="btn btn-ghost" (click)="showAddModal.set(false)">Cancel</button>
            <button class="btn btn-primary" [disabled]="!pickDevice()" (click)="confirmAdd()">Add widget</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; position: relative; }

    .canvas-header { display: flex; justify-content: space-between; align-items: flex-end;
      margin-bottom: var(--space-4); gap: var(--space-4); flex-wrap: wrap; }
    .heading h2 { margin: 0 0 3px; font-size: 19px; font-weight: 700; letter-spacing: -0.01em; }
    .heading p { margin: 0; font-size: 13px; color: var(--text-muted); }
    .header-actions { display: flex; gap: 10px; }

    .btn { display: inline-flex; align-items: center; gap: 7px; border-radius: 10px;
      padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
      transition: transform 0.15s var(--ease), box-shadow 0.15s var(--ease), border-color 0.15s ease; border: none; }
    .btn:active { transform: scale(0.97); }
    .btn-ghost { background: var(--surface); border: 1px solid var(--border); color: var(--text-muted); }
    .btn-ghost:hover { color: var(--text); border-color: var(--border-hover); }
    .btn-primary { background: var(--accent-grad); color: #fff; box-shadow: var(--shadow-glow); }
    .btn-primary:hover { box-shadow: 0 10px 28px rgba(255, 107, 74, 0.35); }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }

    .dashboard-canvas { background-image: radial-gradient(var(--border) 1px, transparent 1px);
      background-size: 26px 26px; padding: var(--space-3); overflow: visible; }
    /* verticalFixed: the grid's own height now grows with however many rows the
       widgets occupy, instead of being squeezed into a viewport-relative box —
       that guesswork was why enlarging a widget had nowhere to go but got clipped,
       and why charts sized against a not-yet-settled container looked broken
       until something forced a relayout. The page scrolls normally past it. */
    /* scrollVertical: columns stretch to fill the width (like fit), but row
       height is a fixed constant instead of being computed by dividing the
       container's height across however many rows exist — that's what was
       squashing every row to near-nothing. The grid scrolls internally once
       content exceeds the box, so drag-resizing something bigger is always
       reachable. */
    gridster { display: block; height: calc(100vh - 300px); min-height: 460px; background: transparent; }

    /* angular-gridster2 ships its own default styles, including a solid
       white background on each grid cell — that's what was showing through
       our translucent glass cards almost untouched. Force it transparent so
       pg-widget-host's own dark glass background is what actually renders. */
    :host ::ng-deep .gridster-item { background: transparent; }
    :host ::ng-deep .jump-flash { animation: jump-flash 1.4s var(--ease); border-radius: var(--radius); }
    @keyframes jump-flash {
      0%, 100% { box-shadow: none; }
      15%, 55% { box-shadow: 0 0 0 3px var(--accent), 0 0 30px rgba(255,107,74,0.45); }
    }
    /* The placeholder gridster shows while you drag — themed to match instead
       of the library's default light-gray box. */
    :host ::ng-deep .gridster-item-placeholder { background: rgba(255, 107, 74, 0.12) !important;
      border: 1.5px dashed var(--accent) !important; border-radius: var(--radius); opacity: 1 !important; }

    /* Gridster's own resize handle — invisible until you hover the card,
       so the grid reads as clean data, not an editing tool, until you touch it. */
    :host ::ng-deep .gridster-item-resizable-handler { opacity: 0; transition: opacity 0.15s; }
    :host ::ng-deep .gridster-item:hover .gridster-item-resizable-handler { opacity: 0.7; }

    .fab { position: fixed; right: 32px; bottom: 32px; width: 54px; height: 54px; border-radius: 50%;
      background: var(--accent-grad); border: none; cursor: pointer; display: flex; align-items: center;
      justify-content: center; box-shadow: var(--shadow-glow); transition: transform 0.18s var(--ease), box-shadow 0.18s var(--ease); z-index: 20; }
    .fab:hover { transform: scale(1.08) rotate(90deg); box-shadow: 0 10px 30px rgba(255, 107, 74, 0.45); }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(28, 29, 38, 0.45); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center; z-index: 30; animation: fade-in 0.15s ease-out; padding: var(--space-4); }
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    .modal { width: 400px; max-width: 100%; padding: var(--space-5); box-shadow: 0 24px 70px rgba(0,0,0,0.55);
      animation: pop-in 0.2s var(--ease); }
    @keyframes pop-in { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: none; } }
    .modal h3 { margin: 0 0 var(--space-4); font-size: 16px; font-weight: 700; }
    .picker-group { margin-bottom: var(--space-4); }
    .picker-label { display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 7px;
      text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
    .pills { display: flex; flex-wrap: wrap; gap: 7px; }
    .pills button { display: inline-flex; align-items: center; gap: 6px; background: var(--surface-raised);
      border: 1px solid var(--border); color: var(--text-muted); border-radius: 20px; padding: 7px 13px;
      font-size: 12.5px; cursor: pointer; transition: all 0.15s var(--ease); }
    .pills button:hover { border-color: var(--accent); color: var(--text); }
    .pills button.active { background: var(--accent-grad); border-color: transparent; color: #fff; box-shadow: var(--shadow-glow); }
    .picker-hint { margin: 7px 0 0; font-size: 11.5px; color: var(--text-dim); line-height: 1.4; }
    .dot { width: 7px; height: 7px; border-radius: 50%; }
    .dot.cpu { background: var(--accent); } .dot.memory { background: var(--accent-2); } .dot.latency { background: var(--accent-3); }
    .modal-actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-5); }
  `],
})
export class CustomDashboardComponent {
  protected readonly layout = inject(DashboardLayoutService);
  private readonly deviceSvc = inject(DeviceService);
  private readonly socket = inject(SocketService);

  protected readonly deviceIds = computed(() => this.deviceSvc.devicesResource.value().map((d) => d.deviceId));

  protected readonly showAddModal = signal(false);
  protected readonly pickDevice = signal('');
  protected readonly pickMetric = signal<MetricKey>('cpu');
  protected readonly pickType = signal<WidgetType>('chart');
  protected readonly pickInterval = signal<AggInterval>('1m');

  protected readonly gridOptions: GridsterConfig = {
    gridType: 'scrollVertical',
    fixedRowHeight: 130,
    compactType: 'compactUp&Left',
    minCols: 9,
    maxCols: 9,
    minRows: 3,
    margin: 10,
    outerMargin: true,
    draggable: { enabled: true, dragHandleClass: 'drag-handle' }, // always on — no mode to enter
    resizable: { enabled: true },
    pushItems: true,
    itemChangeCallback: () => this.persist(),
    itemResizeCallback: () => this.persist(),
  };

  protected openAdd(): void {
    if (!this.pickDevice() && this.deviceIds().length) {
      this.pickDevice.set(this.deviceIds()[0]);
    }
    this.showAddModal.set(true);
  }

  protected confirmAdd(): void {
    this.layout.addWidget({
      deviceId: this.pickDevice(),
      metric: this.pickMetric(),
      type: this.pickType(),
      interval: this.pickInterval(),
    });
    this.showAddModal.set(false);
  }

  /** "Problems" KPI click: scroll to the first widget on a device currently past threshold, and flash it. */
  protected jumpToFirstProblem(): void {
    const readings = this.socket.updatesByDevice();
    const problemDeviceIds = new Set(
      Array.from(readings.values())
        .filter((u) => u.cpu >= 90 || u.latency >= 350)
        .map((u) => u.deviceId),
    );
    const target = this.layout.widgets().find((w) => problemDeviceIds.has(w.deviceId));
    if (!target) return;

    const el = document.getElementById(`widget-${target.id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('jump-flash');
    setTimeout(() => el.classList.remove('jump-flash'), 1400);
  }

  private persist(): void {
    this.layout.widgets.update((list) => [...list]);
  }
}
