import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { DeviceService } from '../../core/services/device.service';
import { SocketService, DeviceUpdate } from '../../core/services/socket.service';
import { TimeseriesChartComponent } from './timeseries-chart/timeseries-chart.component';
import { StatBadgeComponent } from '../../shared/components/stat-badge/stat-badge.component';
import { PanelComponent } from '../../shared/components/panel/panel.component';
import { PanelActionsDirective } from '../../shared/components/panel/panel-actions.directive';
import { AgoFromPipe } from '../../shared/pipes/duration-ago.pipe';

@Component({
  selector: 'pg-device-detail',
  standalone: true,
  imports: [TimeseriesChartComponent, StatBadgeComponent, PanelComponent, PanelActionsDirective, AgoFromPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="title-row">
        <span class="status-dot" [class.ok]="status() === 'ok'" [class.warn]="status() === 'warn'" [class.danger]="status() === 'danger'"></span>
        <h2>{{ id() }}</h2>
      </div>
      @if (latest(); as l) {
        <span class="ago">last sample {{ l.timestamp | agoFrom }}</span>
      }
    </div>

    @if (latest(); as l) {
      <div class="stats">
        <pg-stat-badge label="CPU (live)" [value]="l.cpu" />
        <pg-stat-badge label="Memory (live)" [value]="l.memory" />
        <pg-stat-badge label="Latency (live)" [value]="l.latency" unit="ms" [warnAt]="200" [dangerAt]="350" />
      </div>
    }

    <pg-panel title="CPU over time">
      <div pgPanelActions class="window-tabs">
        <button [class.active]="window() === 15" (click)="setWindow(15)">15m</button>
        <button [class.active]="window() === 60" (click)="setWindow(60)">1h</button>
        <button [class.active]="window() === 180" (click)="setWindow(180)">3h</button>
      </div>
      <pg-timeseries-chart [history]="history.value()" [liveUpdate]="liveForThisDevice()" />
    </pg-panel>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: var(--space-4); }
    .title-row { display: flex; align-items: center; gap: var(--space-2); }
    h2 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
    .status-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--text-muted); }
    .status-dot.ok { background: var(--ok); box-shadow: 0 0 8px var(--ok); }
    .status-dot.warn { background: var(--warn); box-shadow: 0 0 8px var(--warn); }
    .status-dot.danger { background: var(--danger); box-shadow: 0 0 8px var(--danger); }
    .ago { color: var(--text-muted); font-size: 12px; font-family: var(--font-mono); }
    .stats { display: flex; gap: var(--space-3); margin-bottom: var(--space-4); }
    .window-tabs { display: flex; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 2px; }
    .window-tabs button { background: transparent; color: var(--text-muted); border: none; border-radius: 6px;
      padding: 5px 12px; font-size: 12px; cursor: pointer; }
    .window-tabs button.active { background: var(--surface-raised); color: var(--accent); }
  `],
})
export class DeviceDetailComponent {
  readonly id = input.required<string>();

  private readonly deviceSvc = inject(DeviceService);
  private readonly socket = inject(SocketService);

  protected readonly history = this.deviceSvc.historyResource;
  protected readonly window = this.deviceSvc.historyMinutes;

  protected readonly liveForThisDevice = computed<DeviceUpdate | null>(() =>
  this.socket.updatesByDevice().get(this.id()) ?? null,
);

  protected readonly latest = computed(() => this.liveForThisDevice());

  protected readonly status = computed((): 'ok' | 'warn' | 'danger' => {
    const cpu = this.latest()?.cpu ?? 0;
    if (cpu >= 90) return 'danger';
    if (cpu >= 70) return 'warn';
    return 'ok';
  });

  constructor() {
    effect(() => { this.deviceSvc.selectedDeviceId.set(this.id()); });
  }

  protected setWindow(minutes: number): void {
    this.deviceSvc.historyMinutes.set(minutes);
  }
}