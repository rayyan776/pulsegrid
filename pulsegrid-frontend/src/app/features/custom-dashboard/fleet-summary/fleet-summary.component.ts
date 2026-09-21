import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { DeviceService } from '../../../core/services/device.service';
import { SocketService } from '../../../core/services/socket.service';
import { SettingsService } from '../../../core/services/settings.service';
import { DEFAULT_THRESHOLDS } from '../../../shared/thresholds';

const OFFLINE_AFTER_MS = 10_000; // matches the backend's presence key TTL

@Component({
  selector: 'pg-fleet-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kpi-grid">
      <div class="kpi-card glass">
        <span class="icon-ring i-devices">
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none"><rect x="2.5" y="4" width="15" height="9" rx="1.6" stroke="currentColor" stroke-width="1.5"/><path d="M7 17h6M10 13v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </span>
        <div class="kpi-text">
          <span class="value">{{ totalDevices() }}</span>
          <span class="label">Devices</span>
        </div>
      </div>

      <div class="kpi-card glass">
        <span class="icon-ring i-ok">
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none"><path d="M4 10.5 8 14l8-8.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <div class="kpi-text">
          <span class="value ok">{{ onlineCount() }}</span>
          <span class="label">Online</span>
        </div>
      </div>

      <button class="kpi-card glass kpi-clickable" [class.danger-card]="problemCount() > 0"
        [disabled]="problemCount() === 0" (click)="jumpToProblem.emit()">
        <span class="icon-ring i-danger">
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none"><path d="M10 3 2 17h16L10 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M10 8.5v3.2M10 14.2h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        </span>
        <div class="kpi-text">
          <span class="value" [class.danger]="problemCount() > 0">
            {{ problemCount() }}
            @if (problemCount() > 0) { <span class="pulse-badge"></span> }
          </span>
          <span class="label">Problems</span>
        </div>
      </button>

      <div class="kpi-card glass accent-card">
        <span class="icon-ring i-accent">
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none"><path d="M3 15 8 9l3.5 3.5L17 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <div class="kpi-text">
          <span class="value">{{ avgCpu() }}<span class="unit">%</span></span>
          <span class="label">Fleet avg CPU</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4);
      margin-bottom: var(--space-5); }

    .kpi-card { display: flex; align-items: center; gap: 14px; padding: 18px 20px;
      transition: transform 0.2s var(--ease), border-color 0.2s ease; position: relative; overflow: hidden;
      font: inherit; color: inherit; text-align: left; }
    .kpi-clickable:not(:disabled) { cursor: pointer; }
    .kpi-clickable:disabled { cursor: default; }
    .kpi-card:hover { transform: translateY(-2px); border-color: var(--border-hover); }
    .kpi-card::after { content: ''; position: absolute; inset: 0; background: linear-gradient(160deg, rgba(28,29,38,0.03), transparent 45%); pointer-events: none; }

    .icon-ring { width: 40px; height: 40px; min-width: 40px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center; }
    .i-devices { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }
    .i-ok { background: color-mix(in srgb, var(--ok) 14%, transparent); color: var(--ok); }
    .i-danger { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); }
    .i-accent { background: color-mix(in srgb, var(--accent-3) 14%, transparent); color: var(--accent-3); }

    .kpi-text { display: flex; flex-direction: column; gap: 2px; }
    .value { font-family: var(--font-mono); font-size: 26px; font-weight: 700; color: var(--text);
      display: flex; align-items: center; gap: 6px; line-height: 1; }
    .value.ok { color: var(--ok); }
    .value.danger { color: var(--danger); }
    .unit { font-size: 14px; opacity: 0.6; }
    .label { font-size: 11.5px; color: var(--text-muted); font-weight: 500; }

    .danger-card { border-color: color-mix(in srgb, var(--danger) 35%, transparent); }
    .accent-card { border-color: color-mix(in srgb, var(--accent-3) 28%, transparent); }

    .pulse-badge { width: 7px; height: 7px; border-radius: 50%; background: var(--danger);
      box-shadow: 0 0 8px var(--danger); animation: blip 1s ease-in-out infinite; }
    @keyframes blip { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

    @media (max-width: 900px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
  `],
})
export class FleetSummaryComponent {
  /** Emitted when the Problems card is clicked — parent decides what "jump to it" means. */
  readonly jumpToProblem = output<void>();

  private readonly deviceSvc = inject(DeviceService);
  private readonly socket = inject(SocketService);
  private readonly settingsSvc = inject(SettingsService);

  // Total device count — this is essentially static config, fine to source
  // from the one-time API fetch.
  protected readonly totalDevices = computed(() => this.deviceSvc.devicesResource.value().length);

  // Everything else that needs to feel "live" is derived straight from the
  // same socket map the charts read — so it updates on the exact same tick,
  // rather than waiting on DeviceService's slower, Settings-driven
  // devicesResource poll (which only refreshes online/offline + fleet count).
  private readonly liveReadings = computed(() => Array.from(this.socket.updatesByDevice().values()));

  protected readonly onlineCount = computed(() => {
    const now = Date.now();
    return this.liveReadings().filter((u) => now - u.timestamp < OFFLINE_AFTER_MS).length;
  });

  // Kept in sync with CustomDashboardComponent.jumpToFirstProblem's own
  // threshold check — this count is what makes that button visible/clickable.
  protected readonly problemCount = computed(() => {
    const cpuDangerAt = this.settingsSvc.settings().cpuAlertThreshold;
    const latencyDangerAt = DEFAULT_THRESHOLDS.latency.dangerAt;
    return this.liveReadings().filter((u) => u.cpu >= cpuDangerAt || u.latency >= latencyDangerAt).length;
  });

  protected readonly avgCpu = computed(() => {
    const list = this.liveReadings();
    if (!list.length) return 0;
    return Math.round(list.reduce((acc, u) => acc + u.cpu, 0) / list.length);
  });
}
